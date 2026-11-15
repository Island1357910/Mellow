import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useGame } from './GameContext';
import { DEFAULT_BGM_ID, getBgmTrackById, getBgmUrlForTrackId } from '../data/bgmTracks';
import { loadBgmPrefs, saveBgmPrefs } from '../systems/bgmStorage';
import { collectUnlockedBgmTrackIds, sortBgmTrackIdsForMenu } from '../systems/bgmUnlocks';

const BgmContext = createContext(null);

function readInitialBgmState() {
  const p = loadBgmPrefs();
  const savedId = p.menuTrackId;
  const menuTrackId =
    savedId && getBgmTrackById(savedId)?.id === savedId ? savedId : DEFAULT_BGM_ID;
  return {
    playing: p.playing !== false,
    volume: p.volume != null ? Math.min(1, Math.max(0, p.volume)) : 0.38,
    menuTrackId,
  };
}

export function BgmProvider({ children, audioUnlocked = true }) {
  const { state } = useGame();
  const init = useRef(readInitialBgmState());
  const audioRef = useRef(null);
  const lastUrlRef = useRef('');
  const [overrideTrackId, setOverrideTrackIdState] = useState(null);
  const [playing, setPlaying] = useState(init.current.playing);
  const [volume, setVolumeState] = useState(init.current.volume);
  const [menuSelectedTrackId, setMenuSelectedTrackIdState] = useState(init.current.menuTrackId);

  const unlockedMenuTrackIds = useMemo(
    () => sortBgmTrackIdsForMenu(collectUnlockedBgmTrackIds(state)),
    [state],
  );

  useEffect(() => {
    setMenuSelectedTrackIdState((prev) => {
      if (unlockedMenuTrackIds.includes(prev)) return prev;
      const next = unlockedMenuTrackIds.includes(DEFAULT_BGM_ID)
        ? DEFAULT_BGM_ID
        : unlockedMenuTrackIds[0] || DEFAULT_BGM_ID;
      saveBgmPrefs({ menuTrackId: next });
      return next;
    });
  }, [unlockedMenuTrackIds]);

  const effectiveTrackId = useMemo(() => {
    if (overrideTrackId != null && getBgmTrackById(overrideTrackId)) {
      return overrideTrackId;
    }
    return menuSelectedTrackId;
  }, [overrideTrackId, menuSelectedTrackId]);

  const setMenuTrackId = useCallback((id) => {
    if (!getBgmTrackById(id)) return;
    setMenuSelectedTrackIdState((prev) => {
      if (!unlockedMenuTrackIds.includes(id)) return prev;
      saveBgmPrefs({ menuTrackId: id });
      return id;
    });
  }, [unlockedMenuTrackIds]);

  useEffect(() => {
    const a = new Audio();
    a.loop = true;
    a.preload = 'auto';
    const onErr = () => {
      console.warn('[千味面包房] 背景音乐加载失败，请确认 public/music 下文件存在且名称与 bgmTracks.js 一致');
    };
    a.addEventListener('error', onErr);
    audioRef.current = a;
    return () => {
      a.removeEventListener('error', onErr);
      a.pause();
      a.src = '';
      audioRef.current = null;
      lastUrlRef.current = '';
    };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const url = getBgmUrlForTrackId(effectiveTrackId);
    if (lastUrlRef.current !== url) {
      lastUrlRef.current = url;
      a.pause();
      a.src = url;
      a.load();
    }
    a.volume = volume;
    if (playing && audioUnlocked) {
      const p = a.play();
      if (p !== undefined) p.catch(() => {});
    } else {
      a.pause();
    }
  }, [effectiveTrackId, volume, playing, audioUnlocked]);

  const playBgm = useCallback(() => {
    setPlaying(true);
    saveBgmPrefs({ playing: true });
    const a = audioRef.current;
    if (a && lastUrlRef.current) {
      const p = a.play();
      if (p !== undefined) p.catch(() => {});
    }
  }, []);

  const stopBgm = useCallback(() => {
    setPlaying(false);
    saveBgmPrefs({ playing: false });
    audioRef.current?.pause();
  }, []);

  /** 剧情 / 人物志传入 track id；离开页面时请传 null */
  const setBgmOverride = useCallback((trackIdOrNull) => {
    if (trackIdOrNull != null) {
      if (!getBgmTrackById(trackIdOrNull)) return;
    }
    setOverrideTrackIdState(trackIdOrNull);
  }, []);

  const setVolume = useCallback((v) => {
    const nv = Math.max(0, Math.min(1, Number(v)));
    setVolumeState(nv);
    saveBgmPrefs({ volume: nv });
  }, []);

  const value = {
    effectiveTrackId,
    menuSelectedTrackId,
    unlockedMenuTrackIds,
    setMenuTrackId,
    playing,
    volume,
    playBgm,
    stopBgm,
    setVolume,
    setBgmOverride,
  };

  return <BgmContext.Provider value={value}>{children}</BgmContext.Provider>;
}

export function useBgm() {
  const ctx = useContext(BgmContext);
  if (!ctx) throw new Error('useBgm 须在 BgmProvider 内使用');
  return ctx;
}
