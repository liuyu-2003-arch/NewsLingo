import React, { useState, useEffect } from 'react';
import { Music, FileText, ArrowLeft, Cloud, Edit2, Image as ImageIcon, Languages, Wand2, Loader2, AlertCircle, Terminal, Copy, Check, ExternalLink, Play, Clock, Tag } from 'lucide-react';
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

const DEFAULT_THUMBNAIL = "https://img.youtube.com/vi/F1ZZXaZ_QzY/maxresdefault.jpg";

const SetupForm: React.FC<SetupFormProps> = ({ initialData, onCancel, onSuccess, onStartUpload }) => {
  const isEditMode = !!initialData;
  
  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState(initialData?.category || 'NBC News');
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

  // Derived state for preview
  const displayCover = coverFile 
    ? URL.createObjectURL(coverFile) 
    : extractedCover 
        ? URL.createObjectURL(extractedCover) 
        : initialData?.coverUrl || DEFAULT_THUMBNAIL;

  const displayMediaType = mediaFile 
    ? (mediaFile.type.startsWith('audio') ? 'Audio' : 'Video') 
    : initialData?.mediaType === 'audio' ? 'Audio' : 'Video';

  const handleMediaSelect = async (file: File | null) => {
    setMediaFile(file);
    setExtractedCover(null); 

    if (file) {
        if (!title && !isEditMode) {
            // Remove extension and cleanup
            setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "));
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
    const sql = `-- Same SQL as before...
-- 1. Initialize Storage
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
-- Policies
drop policy if exists "Public Uploads" on storage.objects;
drop policy if exists "Public Select" on storage.objects;
create policy "Public Uploads" on storage.objects for insert to anon with check (bucket_id = 'media');
create policy "Public Select" on storage.objects for select to anon using (bucket_id = 'media');
-- 2. Initialize Database
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  title text,
  category text, 
  media_path text,
  media_type text,
  subtitles jsonb,
  cover_path text,
  created_at bigint
);
alter table sessions add column if not exists cover_path text;
alter table sessions add column if not exists category text;
alter table sessions enable row level security;
drop policy if exists "Public Access" on sessions;
create policy "Public Access" on sessions for all to anon using (true) with check (true);
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
            category,
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
              category,
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
      <div className="min-h-full flex flex-col items-center p-4 py-8">
        
        {/* Header Navigation */}
        <div className="w-full max-w-4xl mb-6 flex items-center justify-between">
            <button 
              onClick={onCancel}
              className="flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
                <ArrowLeft size={20} className="mr-2" />
                Back
            </button>
            <h1 className="text-lg font-bold text-slate-800">
                {isEditMode ? 'Edit Episode' : 'New Episode'}
            </h1>
            <div className="w-16"></div> {/* Spacer */}
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-4xl space-y-6">
            
            {/* 1. PREVIEW CARD (Editable) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <div className="flex gap-4 md:gap-6 items-center">
                    {/* Thumbnail Preview */}
                    <div className="relative w-40 md:w-56 aspect-video shrink-0 rounded-xl overflow-hidden bg-slate-100 shadow-inner group">
                         <img 
                            src={displayCover} 
                            alt="Preview"
                            className="w-full h-full object-cover transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            {extractingCover && <Loader2 className="animate-spin text-white" />}
                            {!extractingCover && (
                                <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                                    <Play size={20} className="text-indigo-600 ml-1" fill="currentColor" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Content Preview & Editing */}
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="mb-3">
                            <label htmlFor="title" className="sr-only">Title</label>
                            <input
                                type="text"
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="block w-full text-lg md:text-xl font-bold text-slate-900 placeholder:text-slate-300 border-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 bg-transparent px-0 py-1 transition-all leading-tight"
                                placeholder="Enter Episode Title..."
                                required
                            />
                        </div>

                        {/* Category Edit */}
                        <div className="flex items-center gap-2 mb-2">
                             <Tag size={14} className="text-slate-400" />
                             <input
                                type="text"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="text-xs font-semibold text-slate-600 bg-slate-100 rounded px-2 py-1 border-0 focus:ring-1 focus:ring-indigo-500 w-32"
                                placeholder="Category..."
                             />
                        </div>

                        {/* Media Type Info - Aligned with Category */}
                        <div className="flex items-center gap-2">
                             <Clock size={14} className="text-slate-400" />
                             <span className="text-xs font-semibold text-slate-400">
                                {displayMediaType}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. FILE INPUTS */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-6 space-y-6">
                    
                    {/* Media File */}
                    {!isEditMode && (
                        <div className="flex items-center gap-4">
                            <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${mediaFile ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                <Music size={24} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Media File</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="audio/*,video/*"
                                        onChange={(e) => handleMediaSelect(e.target.files ? e.target.files[0] : null)}
                                        className="hidden"
                                        id="media-upload"
                                    />
                                    <label 
                                        htmlFor="media-upload"
                                        className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                                    >
                                        <span className={`text-sm truncate ${mediaFile ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                            {mediaFile ? mediaFile.name : 'Select Audio or Video (MP4, MP3)...'}
                                        </span>
                                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Browse</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Subtitle File */}
                    <div className="flex items-center gap-4">
                        <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${subFile ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <FileText size={24} />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Subtitles</label>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".srt,.vtt"
                                    onChange={(e) => setSubFile(e.target.files ? e.target.files[0] : null)}
                                    className="hidden"
                                    id="sub-upload"
                                />
                                <label 
                                    htmlFor="sub-upload"
                                    className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                    <span className={`text-sm truncate ${subFile ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                        {subFile ? subFile.name : 'Select Subtitles (.SRT, .VTT)...'}
                                    </span>
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Browse</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Cover Image (Optional) */}
                    <div className="flex items-center gap-4">
                        <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${coverFile || extractedCover ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <ImageIcon size={24} />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                                <span>Cover Image <span className="text-slate-400 font-normal">(Optional)</span></span>
                                {extractedCover && !coverFile && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex items-center">
                                        <Wand2 size={10} className="mr-1" /> Auto-Extracted
                                    </span>
                                )}
                            </label>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setCoverFile(e.target.files ? e.target.files[0] : null)}
                                    className="hidden"
                                    id="cover-upload"
                                />
                                <label 
                                    htmlFor="cover-upload"
                                    className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                    <span className={`text-sm truncate ${coverFile || extractedCover ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                        {coverFile ? coverFile.name : extractedCover ? 'Using auto-generated cover' : 'Select Image (JPG, PNG)...'}
                                    </span>
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Browse</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Auto Translate Toggle */}
                    {(!isEditMode || subFile) && (
                        <div className="pt-2">
                             <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg border border-indigo-100 bg-indigo-50/50">
                                <input
                                    type="checkbox"
                                    checked={autoTranslate}
                                    onChange={(e) => setAutoTranslate(e.target.checked)}
                                    disabled={loading}
                                    className="focus:ring-indigo-500 h-5 w-5 text-indigo-600 border-gray-300 rounded"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center text-sm font-semibold text-indigo-900">
                                        <Languages size={16} className="mr-2" />
                                        Auto-Translate to Chinese
                                    </div>
                                    <p className="text-xs text-indigo-700/70 mt-0.5">
                                        Uses Gemini AI to bilingual subtitles.
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-col gap-4">
                     {error && (
                        <div className="rounded-lg bg-red-50 border border-red-100 p-3 flex items-start">
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 shrink-0" />
                            <div className="flex-1">
                                <div className="text-sm text-red-700 font-medium">{error}</div>
                                <button 
                                    type="button"
                                    onClick={() => {
                                        // Show SQL help
                                        const el = document.getElementById('sql-help-setup');
                                        if(el) el.classList.remove('hidden');
                                    }}
                                    className="text-xs text-red-600 underline mt-1"
                                >
                                    Database Issue? Click here.
                                </button>
                                <div id="sql-help-setup" className="hidden mt-2 bg-slate-800 rounded p-2 relative">
                                     <pre className="text-[10px] text-indigo-100 whitespace-pre-wrap h-20 overflow-y-auto">
{`-- SQL Fix
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
create policy "Public Uploads" on storage.objects for insert to anon with check (bucket_id = 'media');
-- Add category column
alter table sessions add column if not exists category text;
NOTIFY pgrst, 'reload config';`}
                                     </pre>
                                     <button onClick={handleCopySql} className="absolute top-2 right-2 text-white bg-white/20 p-1 rounded text-[10px]">Copy</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin mr-2" />
                                {loadingStep}
                            </>
                        ) : (
                            isEditMode ? 'Save Changes' : 'Upload Episode'
                        )}
                    </button>
                </div>
            </div>
            
          </form>
      </div>
    </div>
  );
};

export default SetupForm;