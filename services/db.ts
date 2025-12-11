import { Session, SubtitleSegment } from '../types';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';

const BUCKET_NAME = 'media';
const TABLE_NAME = 'sessions';

export interface StoredSession extends Session {
  mediaUrl: string; 
}

// Helper for XHR upload with progress
const uploadFileWithProgress = (
    bucket: string, 
    path: string, 
    file: File, 
    onProgress?: (percent: number, loaded: number, total: number) => void
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
        
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
        xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
        xhr.setRequestHeader('cache-control', '3600'); 
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = (e.loaded / e.total) * 100;
                onProgress(percent, e.loaded, e.total);
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
  category: string,
  mediaFile: File,
  mediaType: 'audio' | 'video',
  subtitles: SubtitleSegment[],
  coverFile?: File,
  onStatusChange?: (status: string) => void,
  onUploadProgress?: (percent: number, loaded: number, total: number) => void
): Promise<string> => {
  
  // Prepare paths
  const cleanName = mediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${Date.now()}_${cleanName}`;
  const mediaPath = fileName; 

  let coverPath: string | null = null;
  let coverUploadPromise: Promise<void> = Promise.resolve();

  // 1. Start Cover Upload (Parallel)
  if (coverFile) {
    const cleanCoverName = coverFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const coverFileName = `covers/${Date.now()}_${cleanCoverName}`;
    coverPath = coverFileName;
    
    coverUploadPromise = supabase.storage
        .from(BUCKET_NAME)
        .upload(coverFileName, coverFile, {
            cacheControl: '3600',
            upsert: false
        })
        .then(({ error }) => {
            if (error) console.warn('Cover upload warning:', error);
        });
  }

  // 2. Start Media Upload (Parallel)
  if (onStatusChange) {
      const sizeMB = (mediaFile.size / (1024 * 1024)).toFixed(1);
      onStatusChange(`Uploading media (${sizeMB} MB)...`);
  }
  
  const mediaUploadPromise = uploadFileWithProgress(BUCKET_NAME, mediaPath, mediaFile, onUploadProgress);

  // 3. Wait for BOTH uploads to complete
  try {
      await Promise.all([mediaUploadPromise, coverUploadPromise]);
  } catch (error: any) {
      console.error('Parallel Upload Error:', error);
      throw new Error(`Upload failed: ${error.message}`);
  }

  // 4. Insert Metadata
  if (onStatusChange) onStatusChange('Finalizing...');
  
  const sessionData: any = {
    title: title,
    category: category || 'NBC News',
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
    // Attempt cleanup
    await supabase.storage.from(BUCKET_NAME).remove([mediaPath]);
    throw new Error(`Database save failed: ${insertError.message}`);
  }

  return insertData.id;
};

export const updateSession = async (
  id: string,
  title: string,
  category?: string,
  subtitles?: SubtitleSegment[],
  coverFile?: File,
  onStatusChange?: (status: string) => void
): Promise<void> => {
  let coverPath = undefined;
  
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

  if (onStatusChange) onStatusChange('Updating database...');
  
  const updates: any = { title };
  if (category) updates.category = category;
  if (subtitles) updates.subtitles = subtitles;
  if (coverPath) updates.cover_path = coverPath;

  const { error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(`Update failed: ${error.message}`);
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
        category: item.category || 'NBC News',
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
    category: data.category || 'NBC News',
    mediaType: data.media_type,
    createdAt: data.created_at,
    subtitles: data.subtitles,
    mediaUrl: publicUrlData.publicUrl,
    coverUrl: coverUrl
  };
};

export const deleteSession = async (id: string): Promise<void> => {
  // 1. Try to get paths for cleanup (Best Effort)
  try {
      const { data: session } = await supabase
        .from(TABLE_NAME)
        .select('media_path, cover_path')
        .eq('id', id)
        .single();

      if (session) {
          const filesToRemove = [session.media_path];
          if (session.cover_path) filesToRemove.push(session.cover_path);
          await supabase.storage.from(BUCKET_NAME).remove(filesToRemove);
      }
  } catch (e) {
      console.warn("Could not cleanup storage files, proceeding to delete DB record", e);
  }

  // 2. Always delete the DB record
  const { error: dbError } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (dbError) {
    throw new Error(`Failed to delete session: ${dbError.message}`);
  }
};