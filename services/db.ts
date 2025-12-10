import { Session, SubtitleSegment } from '../types';

const DB_NAME = 'NewsLingoDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export interface StoredSession extends Session {
  mediaBlob: Blob;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveSession = async (
  title: string,
  mediaBlob: Blob,
  mediaType: 'audio' | 'video',
  subtitles: SubtitleSegment[]
): Promise<string> => {
  const db = await openDB();
  const id = crypto.randomUUID();
  const session: StoredSession = {
    id,
    title,
    mediaBlob,
    mediaType,
    subtitles,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(session);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
};

export const getAllSessions = async (): Promise<Session[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Return metadata only, we don't need the heavy blobs for the list view
      const sessions = request.result.map((item: StoredSession) => {
        const { mediaBlob, ...meta } = item;
        return meta;
      });
      // Sort by newest first
      resolve(sessions.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
};

export const getSession = async (id: string): Promise<StoredSession | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteSession = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
