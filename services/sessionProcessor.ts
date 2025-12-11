import { saveSession } from './db';
import { parseSubtitleFile } from './subtitleParser';
import { translateSubtitles } from './geminiService';
import { extractCoverFromMedia } from './mediaUtils';
import { UploadTask } from '../types';

export interface ProcessingOptions {
  title: string;
  mediaFile: File;
  subFile: File;
  coverFile: File | null;
  autoTranslate: boolean;
}

export const processAndUploadSession = async (
  options: ProcessingOptions,
  onTaskUpdate: (update: Partial<UploadTask>) => void,
  onComplete: (sessionId: string) => void,
  onError: (msg: string) => void
) => {
  try {
    const { title, mediaFile, subFile, coverFile, autoTranslate } = options;
    const isAudio = mediaFile.type.startsWith('audio');

    // 1. Parse Subtitles
    onTaskUpdate({ status: 'Parsing subtitles...', progress: 5 });
    let subtitles = await parseSubtitleFile(subFile);
    if (subtitles.length === 0) throw new Error('No subtitles found in file');

    // 2. Auto Translate
    if (autoTranslate) {
        onTaskUpdate({ status: 'AI Translating...', progress: 10 });
        try {
            subtitles = await translateSubtitles(subtitles, (completed, total) => {
                const percent = 10 + Math.floor((completed / total) * 30); // 10% to 40%
                onTaskUpdate({ 
                    progress: percent, 
                    status: `AI Translating (${completed}/${total})...` 
                });
            });
        } catch (e) {
            console.error("Translation failed", e);
        }
    }

    // 3. Auto Cover Extraction (if needed and not provided)
    // We do this here if the user didn't wait for it in the UI
    let finalCover = coverFile;
    if (!finalCover) {
        onTaskUpdate({ status: 'Extracting metadata...', progress: 45 });
        try {
           const extracted = await extractCoverFromMedia(mediaFile);
           if (extracted) finalCover = extracted;
        } catch (e) {
            console.warn("Background cover extraction failed", e);
        }
    }

    // 4. Upload
    onTaskUpdate({ status: 'Starting upload...', progress: 50 });
    
    const sessionId = await saveSession(
        title,
        mediaFile,
        isAudio ? 'audio' : 'video',
        subtitles,
        finalCover || undefined,
        (status) => onTaskUpdate({ status }),
        (percent) => {
            // Map 0-100 upload to 50-95 overall
            const overall = 50 + Math.floor(percent * 0.45);
            onTaskUpdate({ 
                progress: overall, 
                // Don't overwrite detailed status from saveSession unless needed
            });
        }
    );

    onTaskUpdate({ progress: 100, status: 'Complete' });
    onComplete(sessionId);

  } catch (error: any) {
      onError(error.message || 'Processing failed');
  }
};