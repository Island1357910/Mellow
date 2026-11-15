const KEY = 'qianwei_bakery_bgm';

export function loadBgmPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return {
      playing: typeof p.playing === 'boolean' ? p.playing : undefined,
      volume: typeof p.volume === 'number' && !Number.isNaN(p.volume) ? p.volume : undefined,
      menuTrackId: typeof p.menuTrackId === 'string' ? p.menuTrackId : undefined,
    };
  } catch {
    return {};
  }
}

export function saveBgmPrefs(patch) {
  const prev = loadBgmPrefs();
  localStorage.setItem(KEY, JSON.stringify({ ...prev, ...patch }));
}
