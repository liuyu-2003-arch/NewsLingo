import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2, Music, AlertCircle } from 'lucide-react';

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

  const togglePlay = () => {
    onPlayStateChange(!isPlaying);
  };

  const skip = (seconds: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.min(Math.max(0, mediaRef.current.currentTime + seconds), duration);
    }
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-500 ease-in-out z-50 ${expanded ? 'h-[60vh]' : 'h-24'}`}>
      
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
          <div className={`relative transition-all duration-500 ease-in-out shadow-lg rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center border border-slate-100 ${
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
             <div className="flex items-center justify-center space-x-4 md:space-x-8">
                <button 
                  onClick={() => skip(-5)}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                  title="-5s"
                >
                    <SkipBack size={24} />
                </button>

                <button 
                  onClick={togglePlay}
                  className="p-3 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all"
                >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>

                 <button 
                  onClick={() => skip(5)}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                  title="+5s"
                >
                    <SkipForward size={24} />
                </button>
             </div>
             
             {/* Progress Bar */}
             <div className="flex items-center space-x-3 w-full max-w-3xl mx-auto">
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
                    <div className="absolute inset-0 bg-slate-200 rounded-full overflow-hidden pointer-events-none">
                        <div 
                            className="h-full bg-indigo-600 transition-all duration-100 ease-linear"
                            style={{ width: `${(currentTime / (duration || 0.1)) * 100}%` }}
                        />
                    </div>
                </div>
                <span className="text-xs font-mono text-slate-400 w-10">{formatTime(duration)}</span>
             </div>
          </div>

           {/* Expand Toggle */}
           <button 
             onClick={() => setExpanded(!expanded)}
             className="p-2 text-slate-400 hover:text-indigo-600 transition-colors hidden sm:block"
             title={expanded ? "Minimize" : "Maximize"}
           >
             {expanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
           </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerBar;