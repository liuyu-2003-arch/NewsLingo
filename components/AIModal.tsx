import React from 'react';
import { X, Sparkles, BookOpen, Loader2 } from 'lucide-react';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  explanation: string;
  loading: boolean;
}

const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, selectedText, explanation, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 flex justify-between items-start shrink-0">
          <div className="flex items-center text-white space-x-2">
            <Sparkles className="h-6 w-6 text-yellow-300" />
            <h3 className="text-xl font-bold">AI Tutor</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Analyzing Sentence</h4>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 italic font-medium">
              "{selectedText}"
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-indigo-600">
                <BookOpen size={18} />
                <h4 className="text-sm font-bold uppercase tracking-wide">Explanation</h4>
            </div>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3 text-slate-400">
                <Loader2 className="animate-spin h-8 w-8 text-indigo-500" />
                <p className="text-sm">Gemini is thinking...</p>
              </div>
            ) : (
              <div className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">
                {explanation}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIModal;