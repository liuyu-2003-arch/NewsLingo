import React, { useState, useEffect } from 'react';
import { Music, FileText, ArrowLeft, Cloud, Edit2, Image as ImageIcon, Languages, Wand2, Loader2, AlertCircle, Terminal, Copy, Check, ExternalLink } from 'lucide-react';
import { extractCoverFromMedia } from '../services/mediaUtils';
import { Session } from '../types';
import { updateSession } from '../services/db';
import { ProcessingOptions } from '../services/sessionProcessor';
import { parseSubtitleFile } from '../services/subtitleParser';

interface SetupFormProps {
  initialData?: Session;
  onCancel: () => void;
  onSuccess: (sessionId: string) => void;
  onStartUpload?: (options: ProcessingOptions) => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ initialData, onCancel, onSuccess, onStartUpload }) => {
  const isEditMode = !!initialData;
  
  const [title, setTitle] = useState(initialData?.title || '');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [subFile, setSubFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); 
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [autoTranslate, setAutoTranslate] = useState(true);

  const [extractingCover, setExtractingCover] = useState(false);
  const [extractedCover, setExtractedCover] = useState<File | null>(null);

  const handleMediaSelect = async (file: File | null) => {
    setMediaFile(file);
    setExtractedCover(null); 

    if (file) {
        if (!title && !isEditMode) {
            setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
        if (!coverFile) { 
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

  const handleCopySql = () => {
    const sql = `-- 1. Initialize Storage
insert into storage.buckets (id, name, public) 
values ('media', 'media', true)
on conflict (id) do nothing;

-- Safely recreate storage policies
drop policy if exists "Public Uploads" on storage.objects;
drop policy if exists "Public Select" on storage.objects;

create policy "Public Uploads" on storage.objects 
for insert to anon with check (bucket_id = 'media');

create policy "Public Select" on storage.objects 
for select to anon using (bucket_id = 'media');

-- 2. Initialize Database
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  title text,
  media_path text,
  media_type text,
  subtitles jsonb,
  cover_path text,
  created_at bigint
);

-- Ensure columns exist
alter table sessions add column if not exists cover_path text;

-- Enable RLS
alter table sessions enable row level security;

-- Safely recreate DB policies
drop policy if exists "Public Access" on sessions;

create policy "Public Access" on sessions 
for all to anon using (true) with check (true);

-- 3. Force Schema Cache Reload
NOTIFY pgrst, 'reload config';`;

    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (!title.trim()) throw new Error('Please enter a title.');
      
      // EDIT MODE
      if (isEditMode && initialData) {
         setLoading(true);
         setLoadingStep('Updating session...');
         
         let subtitles = undefined;
         if (subFile) {
             setLoadingStep('Parsing new subtitles...');
             subtitles = await parseSubtitleFile(subFile);
         }

         const finalCoverFile = coverFile || extractedCover;
         
         await updateSession(
            initialData.id, 
            title, 
            subtitles, 
            finalCoverFile || undefined,
            (status) => setLoadingStep(status)
         );
         setLoading(false);
         onSuccess(initialData.id);
         return;
      }

      // CREATE MODE (Background)
      if (!mediaFile) throw new Error('Please select an audio or video file.');
      if (!subFile) throw new Error('Please select a subtitle file (.srt or .vtt).');

      if (onStartUpload) {
          onStartUpload({
              title,
              mediaFile,
              subFile,
              coverFile: coverFile || extractedCover,
              autoTranslate
          });
      }

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="min-h-full flex flex-col items-center justify-center p-4 py-8 md:py-12">
        <div className="w-full max-w-5xl mb-6 flex items-center">
            <button 
              onClick={onCancel}
              className="flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
                <ArrowLeft size={20} className="mr-2" />
                Back to Library
            </button>
        </div>

        <div className="max-w-5xl w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-8 border-b border-slate-100 gap-4">
              <div className="flex items-center gap-4">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full text-indigo-600 ${isEditMode ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100'}`}>
                  {isEditMode ? <Edit2 size={24} /> : <Cloud size={28} />}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                        {isEditMode ? 'Edit Session' : 'Upload to Cloud'}
                    </h1>
                    <p className="text-slate-500 text-sm">
                        {isEditMode ? 'Update details for this episode' : 'Sync your content across all devices'}
                    </p>
                </div>
              </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                
                {/* LEFT COLUMN: Media & Title */}
                <div className="space-y-6">
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
                            className="block w-full px-4 py-3 rounded-lg border-gray-300 bg-slate-50 border focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-60 font-medium"
                            placeholder="e.g. NBC Nightly News - Oct 24"
                            required
                        />
                    </div>

                    {!isEditMode && (
                        <div className="space-y-2 h-64 md:h-80">
                            <label className="block text-sm font-medium text-slate-700">Media File</label>
                            <div className={`h-full mt-1 flex flex-col justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors bg-slate-50 ${mediaFile ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400'} ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                                <div className="space-y-4 text-center w-full">
                                    <Music className={`mx-auto h-16 w-16 ${mediaFile ? 'text-indigo-500' : 'text-slate-400'}`} />
                                    <div>
                                        <div className="flex text-sm text-slate-600 justify-center mb-1">
                                            <label htmlFor="media-upload" className="relative cursor-pointer rounded-md font-bold text-indigo-600 hover:text-indigo-500 focus-within:outline-none text-lg">
                                            <span>{mediaFile ? 'Change File' : 'Drag & Drop or Select File'}</span>
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
                                        <p className="text-xs text-slate-500 px-4">
                                            MP3, WAV, M4A, MP4 (Max 100MB recommended)
                                        </p>
                                    </div>
                                    {mediaFile && (
                                        <div className="inline-flex items-center px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-600 shadow-sm border border-slate-200 max-w-full truncate">
                                            {mediaFile.name}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Metadata */}
                <div className="space-y-6 flex flex-col h-full">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">
                            {isEditMode ? 'Replace Subtitles (Optional)' : 'Subtitle File'}
                        </label>
                        <div className={`mt-1 flex justify-center px-6 py-8 border-2 border-dashed rounded-xl transition-colors bg-slate-50 ${subFile ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400'} ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                            <div className="space-y-2 text-center w-full">
                            <FileText className={`mx-auto h-10 w-10 ${subFile ? 'text-indigo-500' : 'text-slate-400'}`} />
                            <div className="flex text-sm text-slate-600 justify-center">
                                <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                                <span>{subFile ? 'Change Subtitles' : 'Upload .SRT or .VTT'}</span>
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
                                {subFile ? subFile.name : "Supported formats: SRT, VTT"}
                            </p>
                            </div>
                        </div>
                    </div>

                    {(subFile || !isEditMode) && !isEditMode && (
                        <div className={`bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                            <label className="flex items-start space-x-3 cursor-pointer">
                                <div className="flex items-center h-5 mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={autoTranslate}
                                        onChange={(e) => setAutoTranslate(e.target.checked)}
                                        disabled={loading}
                                        className="focus:ring-indigo-500 h-5 w-5 text-indigo-600 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center text-base font-semibold text-indigo-900">
                                        <Languages size={18} className="mr-2" />
                                        Auto-Translate to Chinese
                                    </div>
                                    <p className="text-sm text-indigo-700/80 mt-1">
                                        Uses Gemini AI to generate bilingual subtitles automatically.
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">
                            {isEditMode ? 'Change Cover Image' : 'Cover Image'} <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        
                        <div className="flex gap-4 items-start">
                            {isEditMode && !coverFile && initialData?.coverUrl && !extractedCover && (
                                <div className="w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                                    <img src={initialData.coverUrl} className="w-full h-full object-cover" alt="Current Cover" />
                                </div>
                            )}

                            <div className={`flex-1 flex justify-center px-6 py-6 border-2 border-dashed rounded-xl transition-colors bg-slate-50 ${coverFile || extractedCover ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400'} ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                                <div className="space-y-2 text-center w-full flex flex-col items-center justify-center">
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
                                        <Loader2 className="mx-auto h-10 w-10 text-indigo-400 animate-spin" />
                                    ) : (
                                        <ImageIcon className="mx-auto h-10 w-10 text-slate-400" />
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
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-100">
                {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-4 space-y-3 mb-6">
                    <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 shrink-0" />
                        <div className="text-sm text-red-700 font-medium break-words">{error}</div>
                    </div>
                    
                    {/* SQL Help Section */}
                    <div className="mt-2 bg-white rounded border border-red-200 overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center">
                            <Terminal size={12} className="mr-2" />
                            Fix in Supabase SQL Editor
                        </span>
                        <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center">
                            Open Dashboard <ExternalLink size={10} className="ml-1" />
                        </a>
                        </div>
                        <div className="p-3 relative group">
                            <pre className="bg-slate-900 text-indigo-100 text-[10px] p-3 rounded-md overflow-x-auto overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed h-32">
    {`-- 1. Initialize Storage
insert into storage.buckets (id, name, public) 
values ('media', 'media', true)
on conflict (id) do nothing;

-- Safely recreate storage policies
drop policy if exists "Public Uploads" on storage.objects;
drop policy if exists "Public Select" on storage.objects;

create policy "Public Uploads" on storage.objects 
for insert to anon with check (bucket_id = 'media');

create policy "Public Select" on storage.objects 
for select to anon using (bucket_id = 'media');

-- 2. Initialize Database
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  title text,
  media_path text,
  media_type text,
  subtitles jsonb,
  cover_path text,
  created_at bigint
);

-- Ensure columns exist
alter table sessions add column if not exists cover_path text;

-- Enable RLS
alter table sessions enable row level security;

-- Safely recreate DB policies
drop policy if exists "Public Access" on sessions;

create policy "Public Access" on sessions 
for all to anon using (true) with check (true);

-- 3. Force Schema Cache Reload
NOTIFY pgrst, 'reload config';`}
                            </pre>
                            <button 
                                type="button"
                                onClick={handleCopySql}
                                className="absolute top-5 right-5 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded transition-colors flex items-center gap-1 backdrop-blur-sm"
                                title="Copy SQL"
                            >
                                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>
                    </div>
                </div>
                )}

                {loading ? (
                    <div className="w-full h-14 rounded-xl bg-slate-100 flex items-center justify-center space-x-3">
                        <Loader2 size={24} className="animate-spin text-indigo-600" />
                        <span className="text-slate-600 font-medium">{loadingStep}</span>
                    </div>
                ) : (
                    <button
                        type="submit"
                        className="w-full h-14 flex items-center justify-center border border-transparent rounded-xl shadow-lg shadow-indigo-200 text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
                    >
                        {isEditMode ? 'Save Changes' : 'Start Upload'}
                    </button>
                )}
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetupForm;