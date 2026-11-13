import { AppData } from '../types';

const DB_NAME = 'ProfAsistSnapshotDB';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const AUTO_SNAPSHOT_KEY = 'profasist_auto_snapshot';
const MAX_SNAPSHOTS = 20;
const DEBOUNCE_MS = 4000;

export interface SnapshotRecord {
  id: string;
  createdAt: string;
  reason: string;
  hash: string;
  size: number;
  data: AppData;
}

export interface SnapshotMeta {
  id: string;
  createdAt: string;
  reason: string;
  hash: string;
  size: number;
  groups: number;
  students: number;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastScheduledHash = '';

const canUseIndexedDb = (): boolean =>
  typeof indexedDB !== 'undefined' && indexedDB !== null;

const openDatabase = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (!canUseIndexedDb()) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('ProfAsist: no se pudo abrir IndexedDB para snapshots.', request.error);
      resolve(null);
    };
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> => {
  const database = await openDatabase();
  if (!database) return null;

  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('ProfAsist: operación de snapshot fallida.', request.error);
      resolve(null);
    };
    transaction.oncomplete = () => database.close();
  });
};

const hashData = (data: AppData): string => {
  const serialized = JSON.stringify(data);
  let hash = 5381;
  for (let index = 0; index < serialized.length; index += 1) {
    hash = ((hash << 5) + hash + serialized.charCodeAt(index)) | 0;
  }
  return `${serialized.length}:${hash >>> 0}`;
};

const toMeta = (record: SnapshotRecord): SnapshotMeta => ({
  id: record.id,
  createdAt: record.createdAt,
  reason: record.reason,
  hash: record.hash,
  size: record.size,
  groups: Array.isArray(record.data?.groups) ? record.data.groups.length : 0,
  students: Array.isArray(record.data?.groups)
    ? record.data.groups.reduce(
        (total, group) => total + (Array.isArray(group.students) ? group.students.length : 0),
        0,
      )
    : 0,
});

export const isSnapshotStorageAvailable = (): boolean => canUseIndexedDb();

export const getAutoSnapshotEnabled = (): boolean => {
  try {
    return localStorage.getItem(AUTO_SNAPSHOT_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const setAutoSnapshotEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(AUTO_SNAPSHOT_KEY, enabled ? 'true' : 'false');
  } catch {
    // localStorage is unavailable in private mode; snapshots remain optional.
  }
};

export const saveSnapshot = async (
  data: AppData,
  reason: string = 'manual',
): Promise<SnapshotMeta | null> => {
  const createdAt = new Date().toISOString();
  const record: SnapshotRecord = {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    reason,
    hash: hashData(data),
    size: JSON.stringify(data).length,
    data: JSON.parse(JSON.stringify(data)),
  };

  const result = await withStore<IDBValidKey>('readwrite', (store) => store.put(record));
  if (result === null) return null;

  await pruneSnapshots();
  return toMeta(record);
};

export const listSnapshots = async (): Promise<SnapshotMeta[]> => {
  const records = await withStore<SnapshotRecord[]>('readonly', (store) => store.getAll());
  if (!records) return [];
  return records
    .map(toMeta)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const getSnapshot = async (snapshotId: string): Promise<SnapshotRecord | null> =>
  withStore<SnapshotRecord>('readonly', (store) => store.get(snapshotId));

export const deleteSnapshot = async (snapshotId: string): Promise<void> => {
  await withStore<undefined>('readwrite', (store) => store.delete(snapshotId));
};

export const pruneSnapshots = async (maxSnapshots: number = MAX_SNAPSHOTS): Promise<void> => {
  const snapshots = await listSnapshots();
  if (snapshots.length <= maxSnapshots) return;
  const toDelete = snapshots.slice(maxSnapshots);
  await Promise.all(toDelete.map((snapshot) => deleteSnapshot(snapshot.id)));
};

/**
 * Debounced auto-snapshot. Called after every persisted group/delivery change.
 * It skips identical payloads and never runs outside a browser environment.
 */
export const scheduleAutoSnapshot = (
  data: AppData,
  reason: string = 'auto',
): void => {
  if (!canUseIndexedDb() || !getAutoSnapshotEnabled()) return;
  if (typeof window === 'undefined') return;

  const hash = hashData(data);
  if (hash === lastScheduledHash) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    lastScheduledHash = hash;
    void saveSnapshot(data, reason);
  }, DEBOUNCE_MS);
};
