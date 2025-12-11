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
  subtitles: SubtitleSegment[],
  coverFile?: File
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

  // 1b. Upload Cover File (Optional)
  let coverPath = null;
  if (coverFile) {
    const cleanCoverName = coverFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const coverFileName = `covers/${Date.now()}_${cleanCoverName}`;
    
    const { data: coverUploadData, error: coverUploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(coverFileName, coverFile, {
        cacheControl: '3600',
        upsert: false
        });
    
    if (coverUploadError) {
        console.warn('Cover upload failed, continuing without cover:', coverUploadError);
    } else {
        coverPath = coverUploadData.path;
    }
  }

  // 2. Insert Metadata + Subtitles into Supabase Database
  // Construct the object dynamically to be cleaner, though Supabase might strict check keys against columns
  const sessionData: any = {
    title: title,
    media_path: uploadData.path,
    media_type: mediaType,
    subtitles: subtitles,
    created_at: Date.now()
  };

  if (coverPath) {
    sessionData.cover_path = coverPath;
  }

  const { data: insertData, error: insertError } = await supabase
    .from(TABLE_NAME)
    .insert([sessionData])
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

export const updateSession = async (
  id: string,
  title: string,
  subtitles?: SubtitleSegment[],
  coverFile?: File
): Promise<void> => {
  let coverPath = undefined;
  
  // 1. Upload new cover if provided
  if (coverFile) {
    const cleanCoverName = coverFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const coverFileName = `covers/${Date.now()}_${cleanCoverName}`;
    
    const { data: coverUploadData, error: coverUploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(coverFileName, coverFile, {
        cacheControl: '3600',
        upsert: false
        });
    
    if (coverUploadError) {
        throw new Error(`Cover upload failed: ${coverUploadError.message}`);
    }
    coverPath = coverUploadData.path;
  }

  // 2. Update Database
  const updates: any = { 
    title,
  };

  if (subtitles) {
    updates.subtitles = subtitles;
  }
  
  if (coverPath) {
    updates.cover_path = coverPath;
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id);

  if (error) {
    throw new Error(`Update failed: ${error.message}`);
  }
};

export const getAllSessions = async (): Promise<Session[]> => {
  // Use select('*') to handle cases where schema might not have new columns (like cover_path) yet
  // This prevents the "column does not exist" error from breaking the app load
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*') 
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch Error:', error);
    throw new Error(`Failed to load sessions: ${error.message}`);
  }

  // Map snake_case database fields to camelCase interface properties
  return (data || []).map((item: any) => {
    let coverUrl = undefined;
    if (item.cover_path) {
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(item.cover_path);
        coverUrl = publicUrlData.publicUrl;
    }

    return {
        id: item.id,
        title: item.title,
        mediaType: item.media_type,
        createdAt: item.created_at,
        subtitles: item.subtitles,
        coverUrl: coverUrl
    };
  });
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
  
  // 3. Get Public URL for cover
  let coverUrl = undefined;
  if (data.cover_path) {
      const { data: coverUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.cover_path);
      coverUrl = coverUrlData.publicUrl;
  }

  return {
    id: data.id,
    title: data.title,
    mediaType: data.media_type,
    createdAt: data.created_at,
    subtitles: data.subtitles,
    mediaUrl: publicUrlData.publicUrl,
    coverUrl: coverUrl
  };
};

export const deleteSession = async (id: string): Promise<void> => {
  // 1. Get the media path first so we can delete the file
  const { data: session, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('media_path, cover_path')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new Error('Session not found');
  }

  // 2. Delete from Storage
  const filesToRemove = [session.media_path];
  if (session.cover_path) filesToRemove.push(session.cover_path);

  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(filesToRemove);

  if (storageError) {
    console.warn('Failed to delete files from storage, but proceeding to delete DB record.');
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