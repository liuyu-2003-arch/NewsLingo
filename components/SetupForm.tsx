import React, { useState, useEffect, useRef } from 'react';
import { Upload, Music, FileText, PlayCircle, ArrowLeft, Cloud, AlertCircle, Terminal, Copy, ExternalLink, Check, Image as ImageIcon, Languages, Edit2, Loader2, Wand2 } from 'lucide-react';
import { parseSubtitleFile } from '../services/subtitleParser';
import { saveSession, updateSession } from '../services/db';
import { translateSubtitles } from '../services/geminiService';
import { extractCoverFromMedia } from '../services/mediaUtils';
import { Session } from '../types';

interface SetupFormProps {
  initialData?: Session;
  onCancel: () => void;
  onSuccess: (sessionId: string) => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ initialData, onCancel, onSuccess }) => {
  const isEditMode = !!initialData;
  
  const [title, setTitle] = useState(initialData?.title || '');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [subFile, setSubFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); 
  const [progress, setProgress] = useState(0); 
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Translation State
  const [autoTranslate, setAutoTranslate] = useState(true);

  // Auto-Cover State
  const [extractingCover, setExtractingCover] = useState(false);
  const [extractedCover, setExtractedCover] = useState<File | null>(null);

  const uploadIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) window.clearInterval(uploadIntervalRef.current);
    };
  }, []);

  // Handle Media Select & Auto-Extract Logic
  const handleMediaSelect = async (file: File | null) => {
    setMediaFile(file);
    setExtractedCover(null); // Reset previous extraction

    if (file) {
        // 1. Auto-fill title if empty
        if (!title && !isEditMode) {
            setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }

        // 2. Try to extract cover
        if (!coverFile) { // Only extract if user hasn't manually picked one
            setExtractingCover(true);
            try {
                const cover = await extractCoverFromMedia(file);
                if (cover) {
                    setExtractedCover(cover);
                }
            } catch (e) {
                console.warn("Cover extraction failed", e);
            } finally {
                setExtractingCover(false);
            }
        }
    }
  };

  const simulateProgress = (start: number, end: number, durationMs: number) => {
    if (uploadIntervalRef.current) window.clearInterval(uploadIntervalRef.current);
    
    const startTime = Date.now();
    setProgress(start);

    uploadIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min(elapsed / durationMs, 1);
        const currentProgress = start + (end - start) * p;
        setProgress(Math.floor(currentProgress));

        if (p >= 1 && uploadIntervalRef.current) {
            window.clearInterval(uploadIntervalRef.current);
        }
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setProgress(0);

    try {
      // Validation
      if (!title.trim()) {
        throw new Error('Please enter a title.');
      }

      if (!isEditMode && !mediaFile) {
        throw new Error('Please select an audio or video file.');
      }

      if (!isEditMode && !subFile) {
        throw new Error('Please select a subtitle file (.srt or .vtt).');
      }

      let subtitles = undefined;

      // --- PHASE 1: Parsing & Translating (0% - 50%) ---
      
      if (subFile) {
        setLoadingStep('Parsing subtitles...');
        setProgress(2);
        const parsed = await parseSubtitleFile(subFile);
        if (parsed.length === 0) {
          throw new Error('Could not parse any subtitles from the file. Please check the format.');
        }
        subtitles = parsed;
        setProgress(5);

        if (autoTranslate) {
            setLoadingStep('Initializing AI translator...');
            try {
                subtitles = await translateSubtitles(subtitles, (completed, total) => {
                    const percentage = Math.floor(5 + (completed / total) * 45);
                    setProgress(percentage);
                    setLoadingStep(`Translating with AI (${completed}/${total} segments)...`);
                });
            } catch (translationErr) {
                console.error("Translation failed, proceeding with original:", translationErr);
            }
        }
      }
      setProgress(50);

      // --- PHASE 2: Uploading & Saving (50% - 100%) ---
      // Decide which cover to use: Manual -> Extracted -> None
      const finalCoverFile = coverFile || extractedCover;

      if (isEditMode && initialData) {
         setLoadingStep('Updating session...');
         simulateProgress(50, 90, 2000); 
         await updateSession(
            initialData.id, 
            title, 
            subtitles, 
            finalCoverFile || undefined,
            (status) => setLoadingStep(status)
         );
         setProgress(100);
         setLoadingStep('Done!');
         setTimeout(() => onSuccess(initialData.id), 500);
      } else {
         if (!mediaFile || !subtitles) return; 
         
         const isAudio = mediaFile.type.startsWith('audio');
         
         // We don't simulate progress anymore for the main upload, we rely on the callback.
         // But we set an initial state.
         setLoadingStep(`Preparing upload (${(mediaFile.size / (1024*1024)).toFixed(1)} MB)...`);
         
         const sessionId = await saveSession(
            title,
            mediaFile,
            isAudio ? 'audio' : 'video',
            subtitles,
            finalCoverFile || undefined,
            (status) => setLoadingStep(status),
            (uploadPercent) => {
                // Map upload progress (0-100) to overall progress (50-95)
                const overall = Math.floor(50 + (uploadPercent * 0.45));
                setProgress(overall);
                if (uploadPercent < 100) {
                   // Keep the text updated with % only if we want, but status callback handles text mostly
                   // We rely on onStatusChange to say "Uploading..."
                }
            }
         );
         
         setProgress(100);
         setLoadingStep('Done!');
         setTimeout(() => onSuccess(sessionId), 500);
      }

    } catch (err: any) {
      if (uploadIntervalRef.current) window.clearInterval(uploadIntervalRef.current);
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
      setLoadingStep('');
      setProgress(0);
    }
  };

  const handleCopySql = () => {
    const sql = `-- 1. Initialize Storage (Bucket & Policies)
insert into storage.buckets (id, name, public) 
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "Allow Uploads" on storage.objects 
for insert to anon with check (bucket_id = 'media');

create policy "Allow Select" on storage.objects 
for select to anon using (bucket_id = 'media');

-- 2. Initialize Database (Table & Policies)
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  title text,
  media_path text,
  media_type text,
  subtitles jsonb,
  cover_path text,
  created_at bigint
);

alter table sessions add column if not exists cover_path text;
alter table sessions enable row level security;

create policy "Allow All" on sessions 
for all to anon using (true) with check (true);`;

    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRlsError = error && (
    error.toLowerCase().includes('policy') || 
    error.toLowerCase().includes('permission') || 
    error.toLowerCase().includes('security')
  );

  const isSchemaError = error && (
    error.includes('42703') || 
    error.includes('cover_path') ||
    error.toLowerCase().includes('column')
  );

  const showSqlHelp = isRlsError || isSchemaError;

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="min-h-full flex flex-col items-center justify-center p-4 py-12">
        <div className="w-full max-w-md mb-6 flex items-center">
            <button 
              onClick={onCancel}
              className="flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
                <ArrowLeft size={20} className="mr-2" />
                Back to Library
            </button>
        </div>

        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6 border border-slate-100">
          <div className="text-center space-y-2">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-indigo-600 mb-4 ${isEditMode ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100'}`}>
              {isEditMode ? <Edit2 size={28} /> : <Cloud size={32} />}
            </div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                {isEditMode ? 'Edit Session' : 'Upload to Cloud'}
            </h1>
            <p className="text-slate-500">
                {isEditMode ? 'Update details for this episode' : 'Sync your content across all devices'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Title Input */}
            <div className="space-y-2">
                <label htmlFor="title" className="block text-sm font-medium text-slate-700">
                    Title
                </label>
                <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={loading}
                    className="block w-full px-4 py-3 rounded-lg border-gray-300 bg-slate-50 border focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-60"
                    placeholder="e.g. NBC Nightly News - Oct 24"
                    required
                />
            </div>

            {/* Media Upload */}
            {!isEditMode && (
                <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Media File (Audio/Video)</label>
                <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors bg-slate-50 ${mediaFile ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400'} ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                    <div className="space-y-1 text-center w-full">
                    <Music className={`mx-auto h-12 w-12 ${mediaFile ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <div className="flex text-sm text-slate-600 justify-center">
                        <label htmlFor="media-upload" className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                        <span>{mediaFile ? 'Change file' : 'Select MP3 or MP4'}</span>
                        <input
                            id="media-upload"
                            name="media-upload"
                            type="file"
                            accept="audio/*,video/*"
                            className="sr-only"
                            onChange={(e) => handleMediaSelect(e.target.files ? e.target.files[0] : null)}
                            disabled={loading}
                        />
                        </label>
                    </div>
                    <p className="text-xs text-slate-500 truncate px-4">
                        {mediaFile ? mediaFile.name : "MP3, WAV, MP4"}
                    </p>
                    </div>
                </div>
                </div>
            )}

            {/* Subtitle Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                  {isEditMode ? 'Replace Subtitles (Optional)' : 'Subtitle File (.srt or .vtt)'}
              </label>
              <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors bg-slate-50 ${subFile ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400'} ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="space-y-1 text-center w-full">
                  <FileText className={`mx-auto h-12 w-12 ${subFile ? 'text-indigo-500' : 'text-slate-400'}`} />
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                      <span>{subFile ? 'Change file' : 'Select Subtitles'}</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept=".srt,.vtt"
                        className="sr-only"
                        onChange={(e) => setSubFile(e.target.files ? e.target.files[0] : null)}
                        disabled={loading}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 truncate px-4">
                    {subFile ? subFile.name : "SRT or VTT"}
                  </p>
                </div>
              </div>
            </div>

            {/* Translation Option */}
            {(subFile || !isEditMode) && (
                <div className={`bg-indigo-50/50 rounded-lg p-3 border border-indigo-100 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                    <label className="flex items-start space-x-3 cursor-pointer">
                        <div className="flex items-center h-5">
                            <input
                                type="checkbox"
                                checked={autoTranslate}
                                onChange={(e) => setAutoTranslate(e.target.checked)}
                                disabled={loading}
                                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center text-sm font-medium text-indigo-900">
                                <Languages size={16} className="mr-1.5" />
                                Auto-Translate to Chinese
                            </div>
                            <p className="text-xs text-indigo-700 mt-0.5">
                                Uses Gemini AI to generate bilingual subtitles.
                            </p>
                        </div>
                    </label>
                </div>
            )}

            {/* Cover Upload (Optional) */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                {isEditMode ? 'Change Cover Image' : 'Cover Image'} <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              
              {/* Show existing cover if in edit mode and no new file selected */}
              {isEditMode && !coverFile && initialData?.coverUrl && !extractedCover && (
                  <div className="mb-2 w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                      <img src={initialData.coverUrl} className="w-full h-full object-cover" alt="Current Cover" />
                  </div>
              )}

              <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors bg-slate-50 ${coverFile || extractedCover ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400'} ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="space-y-1 text-center w-full">
                  {coverFile || extractedCover ? (
                     <div className="relative inline-block">
                        <img 
                            src={URL.createObjectURL(coverFile || extractedCover!)} 
                            alt="Preview" 
                            className="mx-auto h-16 w-16 object-cover rounded-lg shadow-sm"
                        />
                        {extractedCover && !coverFile && (
                             <div className="absolute -top-2 -right-2 bg-indigo-600 text-white p-1 rounded-full border-2 border-white" title="Auto-extracted">
                                <Wand2 size={10} />
                             </div>
                        )}
                     </div>
                  ) : extractingCover ? (
                     <Loader2 className="mx-auto h-12 w-12 text-indigo-400 animate-spin" />
                  ) : (
                     <ImageIcon className="mx-auto h-12 w-12 text-slate-400" />
                  )}
                  
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label htmlFor="cover-upload" className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                      <span>{coverFile || extractedCover ? 'Change image' : (extractingCover ? 'Extracting...' : 'Select Image')}</span>
                      <input
                        id="cover-upload"
                        name="cover-upload"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => setCoverFile(e.target.files ? e.target.files[0] : null)}
                        disabled={loading}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 truncate px-4">
                    {coverFile 
                        ? coverFile.name 
                        : extractedCover 
                            ? "Auto-Extracted from Media"
                            : "JPG, PNG"}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-4 space-y-3">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 shrink-0" />
                  <div className="text-sm text-red-700 font-medium break-words">{error}</div>
                </div>
                
                {showSqlHelp && (
                  <div className="mt-2 bg-white rounded border border-red-200 overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center">
                        <Terminal size={12} className="mr-2" />
                        Run in Supabase SQL Editor
                      </span>
                      <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center">
                        Open Dashboard <ExternalLink size={10} className="ml-1" />
                      </a>
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="text-xs text-slate-500">
                        {isSchemaError 
                           ? "Missing database columns. Run this SQL to update your table structure:"
                           : "Supabase blocks uploads by default. Run this SQL to fix permissions:"}
                      </p>
                      <div className="relative group">
                        <pre className="bg-slate-900 text-indigo-100 text-[10px] p-3 rounded-md overflow-x-auto overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed h-32">
                          {`-- 1. Setup Storage
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
create policy "Public Uploads" on storage.objects for insert to anon with check (bucket_id = 'media');
create policy "Public Select" on storage.objects for select to anon using (bucket_id = 'media');

-- 2. Setup Database
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  title text,
  media_path text,
  media_type text,
  subtitles jsonb,
  cover_path text,
  created_at bigint
);
alter table sessions add column if not exists cover_path text;
alter table sessions enable row level security;
create policy "Public Access" on sessions for all to anon using (true) with check (true);`}
                        </pre>
                        <button 
                            type="button"
                            onClick={handleCopySql}
                            className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
                            title="Copy SQL"
                        >
                            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button or Progress Bar */}
            {loading ? (
                <div className="space-y-2">
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div 
                            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center">
                            <Loader2 size={12} className="animate-spin mr-1.5" />
                            {loadingStep || 'Processing...'}
                        </span>
                        <span className="font-medium text-slate-700">{progress}%</span>
                    </div>
                </div>
            ) : (
                <button
                    type="submit"
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isEditMode ? 'Save Changes' : 'Upload & Sync'}
                </button>
            )}
            
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetupForm;