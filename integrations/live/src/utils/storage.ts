import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const identityScope = new URLSearchParams(window.location.search).get('identity');
const DB_NAME = identityScope ? `shenhao_db_${identityScope}` : 'shenhao_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const MIGRATION_FLAG = '__idb_migrated_v1';

export const STORAGE_PREFIX = 'shenhao_';

let dbPromise: Promise<IDBDatabase> | null = null;
let migratePromise: Promise<void> | null = null;

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 事务已中止'));
  });
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function isLegacyLocalKey(key: string) {
  return key.startsWith('shenhao');
}

async function migrateFromLocalStorage() {
  if (identityScope) return;
  const db = await openDB();
  const flagTx = db.transaction(STORE_NAME, 'readonly');
  const flagReq = flagTx.objectStore(STORE_NAME).get(MIGRATION_FLAG);
  const [flag] = await Promise.all([requestToPromise(flagReq), txDone(flagTx)]);
  if (flag) return;

  const entries: Array<[string, string]> = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !isLegacyLocalKey(key)) continue;
      const val = localStorage.getItem(key);
      if (val != null) entries.push([key, val]);
    }
  } catch {
    // 隐私模式等环境下读取失败则跳过迁移
  }

  const writeTx = db.transaction(STORE_NAME, 'readwrite');
  const store = writeTx.objectStore(STORE_NAME);
  for (const [key, value] of entries) {
    store.put(value, key);
  }
  store.put('1', MIGRATION_FLAG);
  await txDone(writeTx);

  try {
    for (const [key] of entries) {
      localStorage.removeItem(key);
    }
  } catch {
    // 迁移成功后清理旧数据失败不影响后续使用
  }
}

async function ensureReady() {
  if (!migratePromise) {
    migratePromise = migrateFromLocalStorage().catch((err) => {
      migratePromise = null;
      throw err;
    });
  }
  await migratePromise;
}

export async function storageGet(key: string): Promise<string | null> {
  await ensureReady();
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(key);
  const [value] = await Promise.all([requestToPromise(req), txDone(tx)]);
  return typeof value === 'string' ? value : value == null ? null : String(value);
}

export async function storageSet(key: string, value: string): Promise<void> {
  await ensureReady();
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(value, key);
  await txDone(tx);
}

export async function storageRemove(key: string): Promise<void> {
  await ensureReady();
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(key);
  await txDone(tx);
}

export async function storageKeys(): Promise<string[]> {
  await ensureReady();
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).getAllKeys();
  const [keys] = await Promise.all([requestToPromise(req), txDone(tx)]);
  return keys.map(String).filter((key) => key !== MIGRATION_FLAG);
}

const idbStorage: StateStorage = {
  getItem: (name) => storageGet(name),
  setItem: (name, value) => storageSet(name, value),
  removeItem: (name) => storageRemove(name),
};

export const idbJSONStorage = createJSONStorage(() => idbStorage)!;
