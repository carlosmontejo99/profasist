// IndexedDB Audio Storage Service for ProfAsist
// Replaces localStorage Base64 storage to avoid webview quotas and UI blocking

const DB_NAME = 'ProfAsistAudioDB';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export interface RecordingMetadata {
  id: string;
  name: string;
  folder: string;
  format: string;
  quality: string;
  duration: string;
  date: string;
  mode: 'profesor' | 'alumno';
  sizeBytes?: number;
  mimeType?: string;
  url?: string; // Legacy base64 support if present
}

export const AudioDB = {
  /** Save audio Blob to IndexedDB */
  async saveAudioBlob(id: string, blob: Blob): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(blob, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /** Get audio Blob from IndexedDB */
  async getAudioBlob(id: string): Promise<Blob | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /** Get playback object URL for an audio recording */
  async getAudioUrl(rec: RecordingMetadata): Promise<string> {
    try {
      const blob = await AudioDB.getAudioBlob(rec.id);
      if (blob) {
        return URL.createObjectURL(blob);
      }
    } catch (e) {
      console.warn("Could not retrieve Blob from IndexedDB:", e);
    }
    // Fallback to legacy base64 dataUrl if present
    if (rec.url && rec.url.startsWith('data:')) {
      return rec.url;
    }
    return '';
  },

  /** Delete audio Blob from IndexedDB */
  async deleteAudioBlob(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /** Get total storage used by audio Blobs in bytes */
  async getStorageUsage(): Promise<{ totalBytes: number; count: number }> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();
      let totalBytes = 0;
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const blob = cursor.value as Blob;
          if (blob && blob.size) {
            totalBytes += blob.size;
          }
          count++;
          cursor.continue();
        } else {
          resolve({ totalBytes, count });
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  /** Detect supported MediaRecorder MIME types on current WebView */
  getSupportedMimeTypes(): Array<{ mime: string; ext: string; supported: boolean }> {
    const candidateTypes = [
      { mime: 'audio/webm;codecs=opus', ext: 'webm' },
      { mime: 'audio/webm', ext: 'webm' },
      { mime: 'audio/mp4;codecs="mp4a.40.2"', ext: 'm4a' },
      { mime: 'audio/mp4', ext: 'm4a' },
      { mime: 'audio/aac', ext: 'aac' },
      { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
      { mime: 'audio/wav', ext: 'wav' }
    ];

    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return candidateTypes.map(t => ({ ...t, supported: false }));
    }

    return candidateTypes.map(t => ({
      ...t,
      supported: MediaRecorder.isTypeSupported(t.mime)
    }));
  }
};
