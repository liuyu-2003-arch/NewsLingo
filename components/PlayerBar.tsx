import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Maximize2, Minimize2, Music } from 'lucide-react';

interface PlayerBarProps {
  mediaUrl: string;
  mediaType: 'audio' | 'video';
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  seekCommand: number | null;
}

const PlayerBar: React.FC<PlayerBarProps> = ({
  mediaUrl,
  mediaType,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  isPlaying,
  onPlayStateChange,
  seekCommand
}) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Use the specific NBC Nightly News thumbnail
  const coverImage = "https://img.youtube.com/vi/F1ZZXaZ_QzY/maxresdefault.jpg"; 

  // Handle External Seek Command
  useEffect(() => {
    if (seekCommand !== null && mediaRef.current) {
        mediaRef.current.currentTime = seekCommand;
    }
  }, [seekCommand]);

  // Sync play/pause state
  useEffect(() => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.play().catch(e => console.error("Play error", e));
      } else {
        mediaRef.current.pause();
      }
    }
  }, [isPlaying]);

  const togglePlay = () => {
    onPlayStateChange(!isPlaying);
  };

  const skip = (seconds: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.min(Math.max(0, mediaRef.current.currentTime + seconds), duration);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent triggering when typing in inputs
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                skip(-10);
                break;
            case 'ArrowRight':
                e.preventDefault();
                skip(30);
                break;
            case ' ': // Spacebar to toggle play
                e.preventDefault();
                togglePlay();
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration]); // Dependencies for togglePlay closure

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      onTimeUpdate(mediaRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      const d = mediaRef.current.duration;
      setDuration(d);
      onDurationChange(d);
    }
  };

  const handleEnded = () => {
    onPlayStateChange(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    onTimeUpdate(time);
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds && seconds !== 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-all duration-500 ease-in-out z-50 ${expanded ? 'h-[60vh]' : 'h-24'}`}>
      
      {/* Hidden Media Element */}
      <video
        ref={mediaRef as any}
        src={mediaUrl}
        className="hidden"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPause={() => onPlayStateChange(false)}
        onPlay={() => onPlayStateChange(true)}
      />

      <div className="h-full flex flex-col">
        {expanded && (
           <div className="flex-1 bg-slate-900 relative w-full flex justify-center items-center overflow-hidden">
               {mediaType === 'video' ? (
                   <video 
                     src={mediaUrl} 
                     className="h-full w-full object-contain"
                   />
               ) : (
                   <div className="w-full h-full relative flex items-center justify-center bg-slate-950">
                        {/* Blurred Background */}
                        <div className="absolute inset-0 overflow-hidden">
                            <img 
                                src={coverImage} 
                                onError={() => setImageError(true)}
                                alt="" 
                                className="w-full h-full object-cover opacity-30 blur-2xl scale-110"
                            />
                        </div>
                        {/* Main Cover */}
                        <div className="relative z-10 p-8 max-h-full max-w-full aspect-square flex items-center justify-center">
                            {imageError ? (
                                <div className="bg-slate-800 rounded-2xl w-64 h-64 flex flex-col items-center justify-center text-slate-500">
                                    <Music size={64} />
                                    <span className="mt-4 font-medium">No Cover Art</span>
                                </div>
                            ) : (
                                <img 
                                    src={coverImage} 
                                    alt="Cover Art" 
                                    className="w-auto h-auto max-h-[80%] max-w-[80%] shadow-2xl rounded-lg object-contain"
                                />
                            )}
                        </div>
                   </div>
               )}
           </div>
        )}

        <div className="flex items-center justify-between px-4 md:px-8 h-24 bg-white/95 backdrop-blur-sm z-20">
          
          {/* Media Thumbnail / Icon */}
          <div className={`relative transition-all duration-500 ease-in-out shadow-sm rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center border border-slate-200 ${
              expanded 
              ? 'fixed top-20 left-1/2 -translate-x-1/2 h-[calc(60vh-6rem)] w-auto aspect-video z-30 shadow-2xl hidden md:block opacity-0 pointer-events-none' 
              : 'w-32 h-20 aspect-video'
              }`}>
             
             {mediaType === 'video' ? (
                 <video
                    src={mediaUrl}
                    className="w-full h-full object-cover bg-black opacity-80"
                 />
             ) : (
                 imageError ? (
                     <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-300">
                         <Music size={32} />
                     </div>
                 ) : (
                     <img 
                        src={coverImage}
                        alt="Cover"
                        onError={() => setImageError(true)}
                        className="w-full h-full object-cover" 
                     />
                 )
             )}
          </div>

          {/* Controls */}
          <div className="flex-1 px-4 md:px-12 flex flex-col justify-center space-y-2">
             <div className="flex items-center justify-center gap-6 md:gap-8">
                {/* Back 10s */}
                <button 
                  onClick={() => skip(-10)}
                  className="group flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-50"
                  title="Rewind 10s (Left Arrow)"
                >
                    <RotateCcw size={20} strokeWidth={2} />
                    <span className="text-xs font-bold font-mono tracking-tight">-10s</span>
                </button>

                {/* Flat Play Button */}
                <button 
                  onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-lg hover:shadow-indigo-200 hover:scale-105 active:scale-95"
                  title="Play/Pause (Space)"
                >
                    {isPlaying ? (
                        <Pause size={28} fill="currentColor" />
                    ) : (
                        <Play size={28} fill="currentColor" className="ml-1" />
                    )}
                </button>

                 {/* Forward 30s */}
                 <button 
                  onClick={() => skip(30)}
                  className="group flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-50"
                  title="Forward 30s (Right Arrow)"
                >
                    <span className="text-xs font-bold font-mono tracking-tight">+30s</span>
                    <RotateCw size={20} strokeWidth={2} />
                </button>
             </div>
             
             {/* Progress Bar */}
             <div className="flex items-center space-x-3 w-full max-w-3xl mx-auto pt-1">
                <span className="text-xs font-mono text-slate-400 w-10 text-right">{formatTime(currentTime)}</span>
                <div className="relative flex-1 h-1.5 group">
                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        step="0.1"
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="absolute inset-0 bg-slate-100 rounded-full overflow-hidden pointer-events-none border border-slate-200">
                        <div 
                            className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
                            style={{ width: `${(currentTime / (duration || 0.1)) * 100}%` }}
                        />
                    </div>
                </div>
                <span className="text-xs font-mono text-slate-400 w-10">{formatTime(duration)}</span>
             </div>
          </div>

           {/* Expand Toggle - Hide for Audio */}
           {mediaType === 'video' ? (
               <button 
                 onClick={() => setExpanded(!expanded)}
                 className="p-2 text-slate-400 hover:text-indigo-600 transition-colors hidden sm:block"
                 title={expanded ? "Minimize" : "Maximize"}
               >
                 {expanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
               </button>
           ) : (
             <div className="w-8 hidden sm:block" /> /* Spacer to balance layout */
           )}
        </div>
      </div>
    </div>
  );
};

export default PlayerBar;