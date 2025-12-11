import React, { useEffect, useState } from 'react';
import { Session, UploadTask } from '../types';
import { getAllSessions, deleteSession } from '../services/db';
import { Plus, Play, MoreVertical, Trash2, Clock, Cloud, Edit2, Loader2, AlertCircle, Terminal, Copy, Check, ExternalLink, X } from 'lucide-react';

interface HomePageProps {
  onNavigateToUpload: () => void;
  onNavigateToPlayer: (sessionId: string) => void;
  onNavigateToEdit: (session: Session) => void;
  activeUpload?: UploadTask | null;
  onClearUpload?: () => void;
}

const DEFAULT_THUMBNAIL = "https://img.youtube.com/vi/F1ZZXaZ_QzY/maxresdefault.jpg";

const HomePage: React.FC<HomePageProps> = ({ onNavigateToUpload, onNavigateToPlayer, onNavigateToEdit, activeUpload, onClearUpload }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // SQL Help State
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSessions();
    
    // Close menu when clicking outside
    const handleClickOutside = () => setMenuOpenId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadSessions = async () => {
    try {
      const data = await getAllSessions();
      setSessions(data);
    } catch (error) {
      console.error("Failed to load sessions", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    setMenuOpenId(null);

    setDeletingIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
    });

    setTimeout(async () => {
        setSessions(prev => prev.filter(s => s.id !== id));
        setDeletingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });

        try {
            await deleteSession(id);
        } catch (error) {
            console.error("Failed to delete session cloud data", error);
            alert("Delete failed. Please refresh the page.");
        }
    }, 500);
  };
  
  const handleEdit = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    onNavigateToEdit(session);
    setMenuOpenId(null);
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === id ? null : id);
  };

  const getCleanTitle = (filename: string) => {
    let title = filename.replace(/\.[^/.]+$/, "");
    title = title.replace(/\s*\[.*?\]$/, "");
    return title;
  };

  const handleCopySql = () => {
    const sql = `-- 1. Initialize Storage
insert into storage.buckets (id, name, public) 
values ('media', 'media', true)
on conflict (id) do nothing;
-- Policies
drop policy if exists "Public Uploads" on storage.objects;
drop policy if exists "Public Select" on storage.objects;
create policy "Public Uploads" on storage.objects for insert to anon with check (bucket_id = 'media');
create policy "Public Select" on storage.objects for select to anon using (bucket_id = 'media');
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
alter table sessions add column if not exists cover_path text;
alter table sessions enable row level security;
drop policy if exists "Public Access" on sessions;
create policy "Public Access" on sessions for all to anon using (true) with check (true);
NOTIFY pgrst, 'reload config';`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F9F9FB] text-slate-900 font-sans">
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" fill="white"/>
                 <path d="M7 8H17M7 12H14" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
               </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">NewsLingo</h1>
        </div>
        <button
            onClick={onNavigateToUpload}
            className="hidden md:flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-full font-medium text-sm transition-all shadow-sm hover:shadow-md"
        >
            <Plus size={16} />
            <span>Import</span>
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Cloud Library</h2>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500 text-sm">Practice your listening with recent broadcasts</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-600 uppercase tracking-wide border border-indigo-100">
                    <Cloud size={10} className="mr-1" />
                    Synced
                </span>
            </div>
        </div>

        <div className="space-y-4">
            {/* Active Upload Card */}
            {activeUpload && (
                <div className="bg-white rounded-2xl p-3 flex gap-4 md:gap-6 items-center shadow-md border border-indigo-100 relative group animate-in fade-in slide-in-from-top-4">
                    
                    {/* Manual Dismiss Button */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onClearUpload) onClearUpload();
                        }}
                        className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-full transition-colors z-10"
                        title="Dismiss"
                    >
                        <X size={16} />
                    </button>

                    {/* Thumbnail */}
                    <div className="relative w-40 md:w-56 aspect-video shrink-0 rounded-xl overflow-hidden bg-slate-100 shadow-inner">
                         <img 
                            src={activeUpload.previewUrl || DEFAULT_THUMBNAIL} 
                            alt={activeUpload.title}
                            className="w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                             {activeUpload.error ? (
                                <AlertCircle className="text-red-500 bg-white rounded-full" size={24} />
                            ) : (
                                <Loader2 className="animate-spin text-white" size={24} />
                            )}
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 min-w-0 py-1 pr-8 self-stretch flex flex-col justify-center">
                        {/* Row 1: Title */}
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-tight line-clamp-2 mb-1.5">
                            {activeUpload.title}
                        </h3>
                        
                        {/* Row 2: Metadata */}
                        <div className="flex items-center text-sm font-medium text-slate-500 space-x-2 mb-2">
                             <span>NBC News</span>
                             <span className="w-1 h-1 rounded-full bg-slate-300" />
                             <span className="flex items-center text-slate-400 font-normal">
                                <Clock size={12} className="mr-1" />
                                {activeUpload.mediaType === 'audio' ? 'Audio' : 'Video'}
                            </span>
                        </div>

                        {/* Row 3: Progress Bar & Status (Upload Only) */}
                        {!activeUpload.error ? (
                            <div className="w-full">
                                <div className="flex justify-between items-center mb-1">
                                     <span className="text-xs text-indigo-600 font-bold">{activeUpload.progress}%</span>
                                     <span className="text-[10px] text-slate-400 font-mono truncate ml-2">{activeUpload.status}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${activeUpload.progress}%` }}
                                    />
                                </div>
                            </div>
                        ) : (
                             <div className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100">
                                Error: {activeUpload.error}
                                <button 
                                    onClick={() => setShowSqlHelp(!showSqlHelp)}
                                    className="ml-2 underline"
                                >
                                    Fix DB
                                </button>
                             </div>
                        )}
                        
                        {/* SQL Help Inline (Only on error) */}
                         {activeUpload.error && showSqlHelp && (
                            <div className="mt-2 bg-slate-800 rounded p-2 relative z-20">
                                <pre className="text-[10px] text-indigo-100 whitespace-pre-wrap h-20 overflow-y-auto">
{`-- SQL Fix
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
-- Policies... (Copy full SQL from edit screen if needed)`}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 text-slate-400">
                    <div className="animate-pulse w-full max-w-2xl h-32 bg-slate-200 rounded-2xl"></div>
                    <div className="animate-pulse w-full max-w-2xl h-32 bg-slate-200 rounded-2xl"></div>
                </div>
            ) : sessions.length === 0 && !activeUpload ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm text-center">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 text-indigo-500">
                        <Play size={32} fill="currentColor" className="ml-1" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Your library is empty</h3>
                    <p className="text-slate-500 max-w-xs mt-2 mb-6 text-sm leading-relaxed">
                    Upload an NBC Nightly News clip to sync it to all your devices.
                    </p>
                    {/* Hidden on mobile */}
                    <button 
                        onClick={onNavigateToUpload}
                        className="hidden md:inline-block mt-4 text-indigo-600 font-semibold hover:text-indigo-700 text-sm hover:underline"
                    >
                        Upload your first episode
                    </button>
                    {/* Message for mobile users */}
                    <p className="md:hidden mt-4 text-xs text-slate-400 italic">
                        Switch to desktop to upload content.
                    </p>
                </div>
            ) : (
                sessions.map((session) => {
                    const isDeleting = deletingIds.has(session.id);
                    return (
                        <div 
                            key={session.id}
                            onClick={() => !isDeleting && onNavigateToPlayer(session.id)}
                            className={`group bg-white rounded-2xl p-3 flex gap-4 md:gap-6 items-center shadow-sm border border-slate-100 transition-all duration-500 ease-in-out cursor-pointer relative overflow-hidden ${
                                isDeleting 
                                ? 'opacity-0 translate-x-12 max-h-0 py-0 my-0 border-0 pointer-events-none' 
                                : 'opacity-100 max-h-64 hover:shadow-lg hover:border-indigo-100'
                            }`}
                        >
                            {/* Thumbnail Section */}
                            <div className="relative w-40 md:w-56 aspect-video shrink-0 rounded-xl overflow-hidden bg-slate-100 shadow-inner group-hover:scale-[1.02] transition-transform duration-300">
                                <img 
                                    src={session.coverUrl || DEFAULT_THUMBNAIL} 
                                    alt={session.title}
                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[1px]">
                                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                        <Play size={20} className="text-indigo-600 ml-1" fill="currentColor" />
                                    </div>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="flex-1 min-w-0 py-1 pr-8 self-stretch flex flex-col justify-center">
                                {/* Row 1 */}
                                <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-tight line-clamp-2 mb-1.5 group-hover:text-indigo-600 transition-colors">
                                    {getCleanTitle(session.title)}
                                </h3>
                                {/* Row 2 */}
                                <div className="flex items-center text-sm font-medium text-slate-500 space-x-2">
                                    <span>NBC News</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span className="flex items-center text-slate-400 font-normal">
                                        <Clock size={12} className="mr-1" />
                                        {session.mediaType === 'audio' ? 'Audio' : 'Video'}
                                    </span>
                                </div>
                            </div>

                            {/* Action Menu */}
                            <div className="absolute top-4 right-2 sm:right-4">
                                <button 
                                    onClick={(e) => toggleMenu(e, session.id)}
                                    className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <MoreVertical size={18} />
                                </button>
                                {menuOpenId === session.id && (
                                    <div className="absolute right-0 top-10 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                        <button
                                            onClick={(e) => handleEdit(e, session)}
                                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center font-medium"
                                        >
                                            <Edit2 size={14} className="mr-2" />
                                            Edit Details
                                        </button>
                                        <div className="h-px bg-slate-100 my-1" />
                                        <button
                                            onClick={(e) => handleDelete(e, session.id)}
                                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center font-medium"
                                        >
                                            <Trash2 size={14} className="mr-2" />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;