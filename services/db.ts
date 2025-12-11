import { Session, SubtitleSegment } from '../types';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';

const BUCKET_NAME = 'media';
const TABLE_NAME = 'sessions';

export interface StoredSession extends Session {
  mediaUrl: string; // Changed from mediaBlob to mediaUrl for cloud storage
}

// Helper for XHR upload with progress
const uploadFileWithProgress = (
    bucket: string, 
    path: string, 
    file: File, 
    onProgress?: (percent: number) => void
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        // Construct standard Supabase Storage API URL
        const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
        
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
        xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
        // Ensure cache control matches what we want
        xhr.setRequestHeader('cache-control', '3600'); 
        // Important: Upsert false is default for POST. If we wanted upsert, we'd use 'x-upsert': 'true' header if supported or PUT.
        // Setting content type explicitly
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = (e.loaded / e.total) * 100;
                onProgress(percent);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                try {
                    const err = JSON.parse(xhr.responseText);
                    reject(new Error(err.message || xhr.statusText));
                } catch {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        
        xhr.send(file);
    });
};

export const saveSession = async (
  title: string,
  mediaFile: File,
  mediaType: 'audio' | 'video',
  subtitles: SubtitleSegment[],
  coverFile?: File,
  onStatusChange?: (status: string) => void,
  onUploadProgress?: (percent: number) => void
): Promise<string> => {
  
  // 1. Upload Media File
  const cleanName = mediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${Date.now()}_${cleanName}`;
  const mediaPath = fileName; // Path in bucket is just filename here

  if (onStatusChange) {
      const sizeMB = (mediaFile.size / (1024 * 1024)).toFixed(1);
      onStatusChange(`Uploading media (${sizeMB} MB)...`);
  }
  
  try {
      await uploadFileWithProgress(BUCKET_NAME, mediaPath, mediaFile, onUploadProgress);
  } catch (error: any) {
      console.error('Upload Error:', error);
      throw new Error(`Upload failed: ${error.message}`);
  }

  // 1b. Upload Cover File (Optional)
  let coverPath = null;
  if (coverFile) {
    if (onStatusChange) onStatusChange('Uploading cover image...');
    const cleanCoverName = coverFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const coverFileName = `covers/${Date.now()}_${cleanCoverName}`;
    
    // Cover is small, standard upload is fine
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
  if (onStatusChange) onStatusChange('Saving session data...');
  
  const sessionData: any = {
    title: title,
    media_path: mediaPath,
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
    await supabase.storage.from(BUCKET_NAME).remove([mediaPath]);
    throw new Error(`Database save failed: ${insertError.message}`);
  }

  return insertData.id;
};

export const updateSession = async (
  id: string,
  title: string,
  subtitles?: SubtitleSegment[],
  coverFile?: File,
  onStatusChange?: (status: string) => void
): Promise<void> => {
  let coverPath = undefined;
  
  // 1. Upload new cover if provided
  if (coverFile) {
    if (onStatusChange) onStatusChange('Uploading new cover...');
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
  if (onStatusChange) onStatusChange('Updating database...');
  
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
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*') 
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch Error:', error);
    throw new Error(`Failed to load sessions: ${error.message}`);
  }

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
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Get Session Error:', error);
    return undefined;
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.media_path);
  
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
  const { data: session, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('media_path, cover_path')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new Error('Session not found');
  }

  const filesToRemove = [session.media_path];
  if (session.cover_path) filesToRemove.push(session.cover_path);

  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(filesToRemove);

  if (storageError) {
    console.warn('Failed to delete files from storage, but proceeding to delete DB record.');
  }

  const { error: dbError } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (dbError) {
    throw new Error(`Failed to delete session: ${dbError.message}`);
  }
};