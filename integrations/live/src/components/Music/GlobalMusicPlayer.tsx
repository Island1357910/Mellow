import { useEffect, useMemo, useRef } from 'react';
import { useMusicStore } from '../../stores/useMusicStore';
import { getTracksFromOrder } from '../../utils/musicPlayback';

/** 全局音乐播放器：挂载在 App 根节点，退出音乐页不中断 */
export default function GlobalMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playlistOrder = useMusicStore((s) => s.playlistOrder);
  const customTracks = useMusicStore((s) => s.customTracks);
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const volume = useMusicStore((s) => s.volume);
  const pendingSeek = useMusicStore((s) => s.pendingSeek);
  const pause = useMusicStore((s) => s.pause);
  const playNext = useMusicStore((s) => s.playNext);
  const setPlaybackProgress = useMusicStore((s) => s.setPlaybackProgress);

  const current = useMemo(() => {
    const tracks = getTracksFromOrder(playlistOrder, customTracks);
    return tracks.find((t) => t.id === currentTrackId) ?? null;
  }, [playlistOrder, customTracks, currentTrackId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = current.url;
    audio.volume = volume;
    if (isPlaying) {
      void audio.play().catch(() => pause());
    } else {
      audio.pause();
    }
  }, [current?.id, current?.url, isPlaying, volume, pause]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || pendingSeek == null) return;
    audio.currentTime = pendingSeek;
    useMusicStore.setState({ pendingSeek: null });
  }, [pendingSeek, current?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const sync = () => setPlaybackProgress(audio.currentTime, audio.duration || 0);
    const onEnded = () => {
      const mode = useMusicStore.getState().playMode;
      if (mode === 'loop_one') {
        audio.currentTime = 0;
        void audio.play().catch(() => pause());
        return;
      }
      playNext();
    };

    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('loadedmetadata', sync);
    audio.addEventListener('durationchange', sync);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', sync);
      audio.removeEventListener('loadedmetadata', sync);
      audio.removeEventListener('durationchange', sync);
      audio.removeEventListener('ended', onEnded);
    };
  }, [playNext, pause, setPlaybackProgress, current?.id]);

  return <audio ref={audioRef} className="hidden" preload="metadata" />;
}
