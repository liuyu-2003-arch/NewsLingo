import React, { useState } from 'react';
import { Upload, Music, FileText, PlayCircle, ArrowLeft, Cloud, AlertCircle, Terminal, Copy, ExternalLink, Check, Image as ImageIcon } from 'lucide-react';
import { parseSubtitleFile } from '../services/subtitleParser';
import { saveSession } from '../services/db';

interface SetupFormProps {
  onCancel: () => void;
  onSuccess: (sessionId: string) => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ onCancel, onSuccess }) => {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [subFile, setSubFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!mediaFile) {
        throw new Error('Please select an audio or video file.');
      }

      if (!subFile) {
        throw new Error('Please select a subtitle file (.srt or .vtt).');
      }

      const subtitles = await parseSubtitleFile(subFile);
      if (subtitles.length === 0) {
        throw new Error('Could not parse any subtitles from the file. Please check the format.');
      }

      // Determine type
      const isAudio = mediaFile.type.startsWith('audio');
      
      // Save to Supabase (Cloud)
      const sessionId = await saveSession(
        mediaFile.name,
        mediaFile,
        isAudio ? 'audio' : 'video',
        subtitles,
        coverFile || undefined
      );

      onSuccess(sessionId);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during upload.');
      setLoading(false);
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4">
              <Cloud size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Upload to Cloud</h1>
            <p className="text-slate-500">Sync your content across all devices</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Media Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">1. Media File (Audio/Video)</label>
              <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors bg-slate-50 ${mediaFile ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400'}`}>
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
                        onChange={(e) => setMediaFile(e.target.files ? e.target.files[0] : null)}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 truncate px-4">
                    {mediaFile ? mediaFile.name : "MP3, WAV, MP4"}
                  </p>
                </div>
              </div>
            </div>

            {/* Subtitle Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">2. Subtitle File (.srt or .vtt)</label>
              <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors bg-slate-50 ${subFile ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400'}`}>
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
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 truncate px-4">
                    {subFile ? subFile.name : "SRT or VTT"}
                  </p>
                </div>
              </div>
            </div>

            {/* Cover Upload (Optional) */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                3. Cover Image <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors bg-slate-50 ${coverFile ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400'}`}>
                <div className="space-y-1 text-center w-full">
                  {coverFile ? (
                     <img 
                        src={URL.createObjectURL(coverFile)} 
                        alt="Preview" 
                        className="mx-auto h-16 w-16 object-cover rounded-lg shadow-sm"
                     />
                  ) : (
                     <ImageIcon className="mx-auto h-12 w-12 text-slate-400" />
                  )}
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label htmlFor="cover-upload" className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                      <span>{coverFile ? 'Change image' : 'Select Image'}</span>
                      <input
                        id="cover-upload"
                        name="cover-upload"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => setCoverFile(e.target.files ? e.target.files[0] : null)}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 truncate px-4">
                    {coverFile ? coverFile.name : "JPG, PNG"}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Uploading to Cloud...' : 'Upload & Sync'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetupForm;