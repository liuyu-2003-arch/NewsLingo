import { Session, SubtitleSegment } from '../types';
import { supabase } from './supabaseClient';

const BUCKET_NAME = 'media';
const TABLE_NAME = 'sessions';

export interface StoredSession extends Session {
  mediaUrl: string; // Changed from mediaBlob to mediaUrl for cloud storage
}

export const saveSession = async (
  title: string,
  mediaFile: File,
  mediaType: 'audio' | 'video',
  subtitles: SubtitleSegment[]
): Promise<string> => {
  
  // 1. Upload Media File to Supabase Storage
  // Sanitize filename to ensure compatibility
  const cleanName = mediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${Date.now()}_${cleanName}`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, mediaFile, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Upload Error:', uploadError);
    // Show the specific error message (likely "new row violates row-level security policy")
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // 2. Insert Metadata + Subtitles into Supabase Database
  const { data: insertData, error: insertError } = await supabase
    .from(TABLE_NAME)
    .insert([
      {
        title: title,
        media_path: uploadData.path, // Store the path to retrieve URL later
        media_type: mediaType,
        subtitles: subtitles, // Store JSON directly
        created_at: Date.now()
      }
    ])
    .select()
    .single();

  if (insertError) {
    console.error('Database Error:', insertError);
    // Cleanup: try to delete the uploaded file if DB insert fails
    await supabase.storage.from(BUCKET_NAME).remove([uploadData.path]);
    throw new Error(`Database save failed: ${insertError.message}`);
  }

  return insertData.id;
};

export const getAllSessions = async (): Promise<Session[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, title, media_type, created_at, subtitles') // Select minimal fields
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch Error:', error);
    throw new Error(`Failed to load sessions: ${error.message}`);
  }

  return data as Session[];
};

export const getSession = async (id: string): Promise<StoredSession | undefined> => {
  // 1. Get Session Data
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Get Session Error:', error);
    return undefined;
  }

  // 2. Get Public URL for the media
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.media_path);

  return {
    id: data.id,
    title: data.title,
    mediaType: data.media_type,
    createdAt: data.created_at,
    subtitles: data.subtitles,
    mediaUrl: publicUrlData.publicUrl
  };
};

export const deleteSession = async (id: string): Promise<void> => {
  // 1. Get the media path first so we can delete the file
  const { data: session, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('media_path')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new Error('Session not found');
  }

  // 2. Delete from Storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([session.media_path]);

  if (storageError) {
    console.warn('Failed to delete file from storage, but proceeding to delete DB record.');
  }

  // 3. Delete from Database
  const { error: dbError } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (dbError) {
    throw new Error(`Failed to delete session: ${dbError.message}`);
  }
};
