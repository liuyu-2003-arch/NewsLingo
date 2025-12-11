import React, { useEffect, useRef, useMemo } from 'react';
import { SubtitleSegment } from '../types';
import { Bot } from 'lucide-react';

interface SubtitleListProps {
  subtitles: SubtitleSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
  onAnalyze: (text: string) => void;
}

// Helper component for word-by-word highlighting
const KaraokeText: React.FC<{ 
  text: string; 
  startTime: number; 
  endTime: number; 
  currentTime: number;
}> = ({ text, startTime, endTime, currentTime }) => {
  const words = useMemo(() => text.split(' '), [text]);
  
  // Calculate progress (0 to 1) within this specific segment
  const duration = endTime - startTime;
  const elapsed = Math.max(0, currentTime - startTime);
  const progress = Math.min(1, elapsed / duration);

  // Estimate current character position based on progress
  const totalLength = text.length;
  const currentCharField = Math.floor(totalLength * progress);

  let charCount = 0;

  return (
    <p className="text-lg leading-relaxed font-medium">
      {words.map((word, i) => {
        // Calculate range of characters this word occupies
        const startChar = charCount;
        const endChar = charCount + word.length;
        charCount += word.length + 1; // +1 for space

        // Determine state
        const isPast = endChar < currentCharField;
        const isCurrent = currentCharField >= startChar && currentCharField <= endChar;

        return (
          <span 
            key={i} 
            className={`transition-colors duration-75 inline-block mr-1.5 py-0.5 px-0.5 rounded-md ${
              isCurrent 
                ? 'text-white bg-indigo-600 shadow-md transform scale-105 font-bold' 
                : isPast 
                  ? 'text-slate-900' 
                  : 'text-slate-400'
            }`}
          >
            {word}
          </span>
        );
      })}
    </p>
  );
};

const SubtitleList: React.FC<SubtitleListProps> = ({ subtitles, currentTime, onSeek, onAnalyze }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<number | null>(null);

  // Find active segment index
  const activeIndex = subtitles.findIndex(
    (s) => currentTime >= s.startTime && currentTime < s.endTime
  );

  // Handle user scroll detection to pause auto-scroll
  const handleScroll = () => {
    isUserScrolling.current = true;
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => {
      isUserScrolling.current = false;
    }, 2000); // Resume auto-scroll after 2 seconds of inactivity
  };

  useEffect(() => {
    if (activeRef.current && !isUserScrolling.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  return (
    <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-32 no-scrollbar space-y-6"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {subtitles.map((sub, index) => {
          const isActive = index === activeIndex;
          
          // Split text into English (first line) and Chinese/Other (subsequent lines)
          const [primaryText, ...rest] = sub.text.split('\n');
          const secondaryText = rest.join('\n');

          return (
            <div
              key={sub.id}
              ref={isActive ? activeRef : null}
              className={`group relative p-4 rounded-xl transition-all duration-300 cursor-pointer border-2 ${
                isActive 
                  ? 'bg-white border-indigo-100 shadow-lg scale-105 z-10' 
                  : 'bg-transparent border-transparent hover:bg-slate-100/50'
              }`}
              onClick={() => onSeek(sub.startTime)}
            >
              <div className="flex flex-col gap-1">
                 {/* Header Row: Time & AI Button */}
                 <div className="flex items-center justify-between mb-1">
                     <div className={`font-mono text-xs font-semibold tracking-wide ${isActive ? 'text-indigo-500' : 'text-slate-300'}`}>
                        {new Date(sub.startTime * 1000).toISOString().substr(14, 5)}
                     </div>
                     
                     <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAnalyze(primaryText); // Analyze only the English part
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                            isActive 
                            ? 'bg-indigo-50 text-indigo-600 opacity-100' 
                            : 'bg-white text-slate-400 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:bg-indigo-50 shadow-sm border border-slate-100'
                        }`}
                        title="AI Explain"
                     >
                        <Bot size={14} />
                        <span className="hidden sm:inline">AI Explain</span>
                     </button>
                 </div>

                 {/* Text Content */}
                 <div className="w-full">
                    {/* Primary Language (English) */}
                    {isActive ? (
                        <KaraokeText 
                            text={primaryText}
                            startTime={sub.startTime}
                            endTime={sub.endTime}
                            currentTime={currentTime}
                        />
                    ) : (
                        <p 
                            className={`text-lg leading-relaxed transition-colors font-medium ${
                                'text-slate-500'
                            }`}
                        >
                            {primaryText}
                        </p>
                    )}
                    
                    {/* Secondary Language (Chinese) */}
                    {secondaryText && (
                        <p className={`text-base mt-2 leading-relaxed transition-colors font-chinese ${
                            isActive
                                ? 'text-slate-600'
                                : 'text-slate-400/80'
                        }`}>
                            {secondaryText}
                        </p>
                    )}
                 </div>
              </div>
            </div>
          );
        })}
        
        {/* Spacer for bottom scrolling */}
        <div className="h-48" />
      </div>
    </div>
  );
};

export default SubtitleList;