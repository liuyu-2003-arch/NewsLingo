import React, { useState } from 'react';
import { Upload, Music, FileText, PlayCircle, ArrowLeft } from 'lucide-react';
import { parseSubtitleFile } from '../services/subtitleParser';
import { saveSession } from '../services/db';

interface SetupFormProps {
  onCancel: () => void;
  onSuccess: (sessionId: string) => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ onCancel, onSuccess }) => {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [subFile, setSubFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!mediaFile) {
        throw new Error('Please upload an audio or video file.');
      }

      if (!subFile) {
        throw new Error('Please upload a subtitle file (.srt or .vtt).');
      }

      const subtitles = await parseSubtitleFile(subFile);
      if (subtitles.length === 0) {
        throw new Error('Could not parse any subtitles from the file. Please check the format.');
      }

      // Determine type
      const isAudio = mediaFile.type.startsWith('audio');
      
      // Save to IndexedDB
      const sessionId = await saveSession(
        mediaFile.name,
        mediaFile,
        isAudio ? 'audio' : 'video',
        subtitles
      );

      onSuccess(sessionId);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center justify-center">
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
            <Upload size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">New Session</h1>
          <p className="text-slate-500">Upload content to add to your library</p>
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
                    <span>{mediaFile ? 'Change file' : 'Upload MP3 or MP4'}</span>
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
                    <span>{subFile ? 'Change file' : 'Upload Subtitles'}</span>
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

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Creating Session...' : 'Save & Start Learning'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupForm;
