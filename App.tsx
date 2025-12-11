import React, { useState } from 'react';
import { AppState, VideoConfig, Session, UploadTask } from './types';
import SetupForm from './components/SetupForm';
import HomePage from './components/HomePage';
import PlayerBar from './components/PlayerBar';
import SubtitleList from './components/SubtitleList';
import AIModal from './components/AIModal';
import { explainText } from './services/geminiService';
import { getSession } from './services/db';
import { processAndUploadSession, ProcessingOptions } from './services/sessionProcessor';
import { ArrowLeft, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [config, setConfig] = useState<VideoConfig | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<Session | undefined>(undefined);
  
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

  // Background Upload State
  const [activeUpload, setActiveUpload] = useState<UploadTask | null>(null);

  const loadSession = async (sessionId: string) => {
    setLoadingSession(true);
    try {
      const session = await getSession(sessionId);
      if (session) {
        const mediaUrl = session.mediaUrl;
        const displayTitle = session.title;

        setConfig({
          mediaUrl,
          mediaType: session.mediaType,
          mediaName: displayTitle,
          subtitles: session.subtitles,
          coverUrl: session.coverUrl,
        });
        setAppState(AppState.PLAYER);
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

  const handleStartUpload = (options: ProcessingOptions) => {
      // 1. Set Initial Task State
      const newTask: UploadTask = {
          id: 'temp-' + Date.now(),
          title: options.title,
          progress: 0,
          status: 'Initializing...'
      };
      setActiveUpload(newTask);

      // 2. Switch to Home Immediately
      setAppState(AppState.HOME);

      // 3. Start Background Process
      processAndUploadSession(
          options,
          (update) => {
              setActiveUpload(prev => prev ? { ...prev, ...update } : null);
          },
          (sessionId) => {
             setActiveUpload(null);
             // Trigger a refresh on Home Page if possible, 
             // but since HomePage fetches on mount, we might need a signal.
             // For now, we rely on the user seeing the card disappear or we can force reload.
             // A simple way is to reset AppState to force HomePage remount or pass a refresh trigger.
             // But simpler: The list will update on next fetch. 
             // To force instant update, we can pass a refresh key to HomePage.
             window.location.reload(); // Simplest way to ensure list is fresh after background upload
          },
          (error) => {
             setActiveUpload(prev => prev ? { ...prev, error, status: 'Failed' } : null);
             setTimeout(() => setActiveUpload(null), 5000);
          }
      );
  };

  const handleEditSession = (session: Session) => {
     setSessionToEdit(session);
     setAppState(AppState.EDIT);
  };

  const handleSubtitleSeek = (time: number) => {
    setSeekCommand(time);
  };

  const handleAnalyze = async (text: string) => {
    setIsPlaying(false);
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
    setSessionToEdit(undefined);
  };

  return (
    <div className="h-full bg-slate-50 relative">
      
      {/* HOME VIEW */}
      {appState === AppState.HOME && (
        <HomePage 
          onNavigateToUpload={() => {
              setSessionToEdit(undefined);
              setAppState(AppState.UPLOAD);
          }}
          onNavigateToPlayer={loadSession}
          onNavigateToEdit={handleEditSession}
          activeUpload={activeUpload}
        />
      )}

      {/* UPLOAD / EDIT VIEW */}
      {(appState === AppState.UPLOAD || appState === AppState.EDIT) && (
        <SetupForm 
          initialData={appState === AppState.EDIT ? sessionToEdit : undefined}
          onCancel={handleBackToHome}
          onSuccess={(id) => loadSession(id)}
          onStartUpload={handleStartUpload}
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
            coverUrl={config.coverUrl}
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