export interface SubtitleSegment {
  id: number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

export enum AppState {
  HOME = 'HOME',
  UPLOAD = 'UPLOAD',
  PLAYER = 'PLAYER',
  EDIT = 'EDIT',
}

export interface Session {
  id: string;
  title: string;
  mediaType: 'audio' | 'video';
  createdAt: number;
  subtitles: SubtitleSegment[];
  coverUrl?: string;
}

export interface VideoConfig {
  mediaUrl: string; // Blob URL for uploaded audio/video
  mediaType: 'audio' | 'video';
  mediaName: string;
  subtitles: SubtitleSegment[];
  coverUrl?: string;
}

export interface AIExplanation {
  word: string;
  definition: string;
  context: string;
}

export interface UploadTask {
  id: string;
  title: string;
  progress: number; // 0-100
  status: string; // e.g. "Translating...", "Uploading..."
  error?: string;
}