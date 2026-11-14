import { STORAGE_PREFIX, storageGet, storageKeys, storageRemove, storageSet } from './storage';

const SAVE_SLOT_PREFIX = `${STORAGE_PREFIX}save_slot_`;
const SAVE_META_KEY = `${STORAGE_PREFIX}save_meta`;

export interface SaveSlotMeta {
  slot: number;
  label: string;
  savedAt: number;
  playerName: string;
  gameDay: number;
}

export interface SaveSnapshot {
  version: 1;
  savedAt: number;
  stores: Record<string, string>;
}

const GAME_STORE_KEYS = [
  'shenhao_player',
  'shenhao_anchor',
  'shenhao_chat',
  'shenhao_social',
  'shenhao_commerce',
  'shenhao_game_time',
  'shenhao_settings',
  'shenhao_music',
  'shenhao_moments',
  'shenhao-custom-anchors',
] as const;

function slotKey(slot: number) {
  return `${SAVE_SLOT_PREFIX}${slot}`;
}

function isSaveMetaKey(key: string) {
  return key.startsWith(SAVE_SLOT_PREFIX) || key === SAVE_META_KEY;
}

function isGameDataKey(key: string) {
  return key.startsWith('shenhao') && !isSaveMetaKey(key);
}

export async function listSaveSlots(): Promise<(SaveSlotMeta | null)[]> {
  const meta = await loadMeta();
  return [0, 1, 2].map((slot) => meta[slot] ?? null);
}

async function loadMeta(): Promise<Record<number, SaveSlotMeta>> {
  try {
    const raw = await storageGet(SAVE_META_KEY);
    return raw ? (JSON.parse(raw) as Record<number, SaveSlotMeta>) : {};
  } catch {
    return {};
  }
}

async function saveMeta(meta: Record<number, SaveSlotMeta>) {
  await storageSet(SAVE_META_KEY, JSON.stringify(meta));
}

export async function captureSnapshot(): Promise<SaveSnapshot> {
  const stores: Record<string, string> = {};
  for (const key of GAME_STORE_KEYS) {
    const val = await storageGet(key);
    if (val != null) stores[key] = val;
  }
  const keys = await storageKeys();
  for (const key of keys) {
    if (!isGameDataKey(key) || stores[key]) continue;
    const val = await storageGet(key);
    if (val != null) stores[key] = val;
  }
  return { version: 1, savedAt: Date.now(), stores };
}

export async function saveToSlot(slot: number, meta: Omit<SaveSlotMeta, 'slot' | 'savedAt'>): Promise<void> {
  const snapshot = await captureSnapshot();
  await storageSet(slotKey(slot), JSON.stringify(snapshot));
  const all = await loadMeta();
  all[slot] = { slot, savedAt: snapshot.savedAt, ...meta };
  await saveMeta(all);
}

export async function loadFromSlot(slot: number): Promise<boolean> {
  try {
    const raw = await storageGet(slotKey(slot));
    if (!raw) return false;
    const snapshot = JSON.parse(raw) as SaveSnapshot;
    for (const [key, val] of Object.entries(snapshot.stores)) {
      await storageSet(key, val);
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteSlot(slot: number): Promise<void> {
  await storageRemove(slotKey(slot));
  const all = await loadMeta();
  delete all[slot];
  await saveMeta(all);
}

export async function startNewGame(clearSettings = false): Promise<void> {
  const keys = await storageKeys();
  const keysToRemove = keys.filter((key) => {
    if (!isGameDataKey(key)) return false;
    if (!clearSettings && (key === 'shenhao_settings' || key === 'shenhao_music')) return false;
    return true;
  });
  await Promise.all(keysToRemove.map((key) => storageRemove(key)));
}
