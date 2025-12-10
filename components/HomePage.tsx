import React, { useEffect, useState } from 'react';
import { Session } from '../types';
import { getAllSessions, deleteSession } from '../services/db';
import { Plus, Play, MoreVertical, Trash2, Calendar, Clock } from 'lucide-react';

interface HomePageProps {
  onNavigateToUpload: () => void;
  onNavigateToPlayer: (sessionId: string) => void;
}

const DEFAULT_THUMBNAIL = "https://img.youtube.com/vi/F1ZZXaZ_QzY/maxresdefault.jpg";

const HomePage: React.FC<HomePageProps> = ({ onNavigateToUpload, onNavigateToPlayer }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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
    e.stopPropagation(); // Prevent card click
    if (window.confirm('Are you sure you want to delete this session?')) {
      await deleteSession(id);
      loadSessions();
    }
    setMenuOpenId(null);
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === id ? null : id);
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getCleanTitle = (filename: string) => {
    // 1. Remove file extension (e.g. .mp3, .mp4)
    let title = filename.replace(/\.[^/.]+$/, "");
    // 2. Remove trailing bracketed ID like [F1ZZXaZ_QzY]
    title = title.replace(/\s*\[.*?\]$/, "");
    return title;
  };

  return (
    <div className="min-h-screen bg-[#F9F9FB] text-slate-900 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                N
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">NewsLingo</h1>
        </div>
        <button
            onClick={onNavigateToUpload}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-full font-medium text-sm transition-all shadow-sm hover:shadow-md"
        >
            <Plus size={16} />
            <span>Upload</span>
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Latest Episodes</h2>
            <p className="text-slate-500 text-sm mt-1">Practice your listening with recent broadcasts</p>
        </div>

        {loading ? (
           <div className="flex flex-col items-center justify-center py-20 space-y-4 text-slate-400">
               <div className="animate-pulse w-full max-w-2xl h-32 bg-slate-200 rounded-2xl"></div>
               <div className="animate-pulse w-full max-w-2xl h-32 bg-slate-200 rounded-2xl"></div>
           </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 text-indigo-500">
                <Play size={32} fill="currentColor" className="ml-1" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Your library is empty</h3>
            <p className="text-slate-500 max-w-xs mt-2 mb-6 text-sm leading-relaxed">
              Upload an NBC Nightly News clip or any audio/video file with subtitles to get started.
            </p>
            <button 
                onClick={onNavigateToUpload}
                className="text-indigo-600 font-semibold hover:text-indigo-700 text-sm hover:underline"
            >
                Upload your first episode
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div 
                key={session.id}
                onClick={() => onNavigateToPlayer(session.id)}
                className="group bg-white rounded-2xl p-3 flex gap-4 md:gap-6 items-center shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 cursor-pointer relative overflow-visible"
              >
                {/* Thumbnail Section */}
                <div className="relative w-40 md:w-56 aspect-video shrink-0 rounded-xl overflow-hidden bg-slate-900 shadow-inner group-hover:scale-[1.02] transition-transform duration-300">
                    <img 
                        src={DEFAULT_THUMBNAIL} 
                        alt={session.title}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                    
                    {/* Badge Removed to prevent ghosting */}
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[1px]">
                        <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <Play size={20} className="text-indigo-600 ml-1" fill="currentColor" />
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0 py-1 pr-8">
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-tight line-clamp-2 mb-1.5 group-hover:text-indigo-600 transition-colors">
                        {getCleanTitle(session.title)}
                    </h3>
                    <div className="flex items-center text-sm font-medium text-slate-500 space-x-2">
                        <span>NBC News</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-slate-400 font-normal">{formatDate(session.createdAt)}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:inline-block" />
                         <span className="hidden sm:inline-flex items-center text-slate-400 font-normal">
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
                    
                    {/* Dropdown Menu */}
                    {menuOpenId === session.id && (
                        <div className="absolute right-0 top-10 w-32 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;