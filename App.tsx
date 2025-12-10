import React, { useState, useEffect } from 'react';
import { AppState, VideoConfig } from './types';
import SetupForm from './components/SetupForm';
import HomePage from './components/HomePage';
import PlayerBar from './components/PlayerBar';
import SubtitleList from './components/SubtitleList';
import AIModal from './components/AIModal';
import { explainText } from './services/geminiService';
import { getSession } from './services/db';
import { ArrowLeft, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [config, setConfig] = useState<VideoConfig | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // AI Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Seek State
  const [seekCommand, setSeekCommand] = useState<number | null>(null);

  // No need to cleanup object URLs anymore as Supabase provides public http URLs
  
  const loadSession = async (sessionId: string) => {
    setLoadingSession(true);
    try {
      const session = await getSession(sessionId);
      if (session) {
        // Direct URL from Supabase
        const mediaUrl = session.mediaUrl;
        
        // Clean title logic
        const cleanTitle = session.title
            .replace(/\.[^/.]+$/, "")
            .replace(/\s*\[.*?\]$/, "");

        setConfig({
          mediaUrl,
          mediaType: session.mediaType,
          mediaName: cleanTitle,
          subtitles: session.subtitles,
        });
        setAppState(AppState.PLAYER);
        // Reset player state
        setCurrentTime(0);
        setIsPlaying(false);
        setSeekCommand(null);
      }
    } catch (e) {
      console.error("Error loading session", e);
      alert("Failed to load session data. Check your connection.");
    } finally {
      setLoadingSession(false);
    }
  };

  const handleSubtitleSeek = (time: number) => {
    setSeekCommand(time);
  };

  const handleAnalyze = async (text: string) => {
    setIsPlaying(false); // Pause video so user can read
    setSelectedText(text);
    setAiModalOpen(true);
    setAiLoading(true);
    setAiExplanation('');
    
    const explanation = await explainText(text, "News Broadcast");
    setAiExplanation(explanation);
    setAiLoading(false);
  };

  const handleBackToHome = () => {
    setAppState(AppState.HOME);
    setConfig(null); 
    setIsPlaying(false);
  };

  return (
    <div className="h-full bg-slate-50 relative">
      
      {/* HOME VIEW */}
      {appState === AppState.HOME && (
        <HomePage 
          onNavigateToUpload={() => setAppState(AppState.UPLOAD)}
          onNavigateToPlayer={loadSession}
        />
      )}

      {/* UPLOAD VIEW */}
      {appState === AppState.UPLOAD && (
        <SetupForm 
          onCancel={() => setAppState(AppState.HOME)}
          onSuccess={(id) => loadSession(id)}
        />
      )}

      {/* LOADING STATE */}
      {loadingSession && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
            <p className="text-slate-600 font-medium">Loading session from cloud...</p>
        </div>
      )}

      {/* PLAYER VIEW */}
      {appState === AppState.PLAYER && config && !loadingSession && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <header className="absolute top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 flex items-center justify-between px-6">
            <button 
                onClick={handleBackToHome}
                className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors font-medium text-sm"
            >
                <ArrowLeft size={18} className="mr-2" />
                Library
            </button>
            <div className="font-semibold text-slate-800 truncate max-w-md px-4">{config.mediaName}</div>
            <div className="w-20" /> {/* Spacer for balance */}
          </header>

          {/* Main Content - Subtitles */}
          <main className="flex-1 overflow-hidden relative">
            <SubtitleList 
                subtitles={config.subtitles}
                currentTime={currentTime}
                onSeek={handleSubtitleSeek}
                onAnalyze={handleAnalyze}
            />
          </main>

          {/* Sticky Player */}
          <PlayerBar 
            mediaUrl={config.mediaUrl}
            mediaType={config.mediaType}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            isPlaying={isPlaying}
            onPlayStateChange={setIsPlaying}
            seekCommand={seekCommand}
          />

          {/* Modals */}
          <AIModal 
            isOpen={aiModalOpen}
            onClose={() => setAiModalOpen(false)}
            selectedText={selectedText}
            explanation={aiExplanation}
            loading={aiLoading}
          />
        </div>
      )}
    </div>
  );
};

export default App;