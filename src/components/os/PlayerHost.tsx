import { useEffect, useRef } from 'react'
import { resolveTrackSrc, usePlayer } from '../../lib/playerStore.ts'

/** 挂在手机壳上，切换到短信或阅读页时仍持续播放。 */
export function PlayerHost({ namespace }: { namespace: string }) {
  const config = usePlayer(s => s.config), index = usePlayer(s => s.index)
  const playing = usePlayer(s => s.playing), volume = usePlayer(s => s.volume)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const track = config.tracks[index]
  useEffect(() => { usePlayer.getState().load(namespace) }, [namespace])
  useEffect(() => {
    if (!track || usePlayer.getState().namespace !== namespace || !track.src) return
    let cancelled = false
    let audio: HTMLAudioElement | null = null
    void resolveTrackSrc(namespace, track.src).then(url => {
      if (cancelled) return
      if (!url) throw Error('未找到音频文件')
      audio = new Audio(url); audioRef.current = audio
      audio.volume = usePlayer.getState().volume / 5
      audio.loop = usePlayer.getState().config.repeatMode === 'one'
      audio.ontimeupdate = () => { if (audio) usePlayer.setState({ seconds: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : 0 }) }
      audio.onplaying = () => usePlayer.setState({ error: '' })
      audio.onerror = () => usePlayer.setState({ playing: false, error: '音频播放失败，请检查链接或文件' })
      audio.onended = () => {
        if (!audio?.loop) {
          const old = usePlayer.getState().index
          usePlayer.getState().step(1)
          if (old === usePlayer.getState().index && audio) { audio.currentTime = 0; void audio.play().catch(() => usePlayer.setState({ playing: false })) }
        }
      }
      if (usePlayer.getState().playing) void audio.play().catch(() => usePlayer.setState({ playing: false, error: '请点播放，或检查音频链接' }))
    }).catch(e => { if (!cancelled) usePlayer.setState({ playing: false, error: String(e) }) })
    return () => { cancelled = true; audio?.pause(); if (audio) { audio.ontimeupdate = null; audio.onended = null; audio.onerror = null; audio.onplaying = null }; audioRef.current = null }
  }, [namespace, track?.id, track?.src])
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      if (playing) void audio.play().catch(() => usePlayer.setState({ playing: false, error: '请点播放，或检查音频链接' }))
      else audio.pause()
    }
  }, [playing, track?.id])
  useEffect(() => {
    if (!playing || !track || track.src) return
    const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain()
    oscillator.type = 'triangle'; oscillator.frequency.value = track.tone ?? 196
    gain.gain.value = usePlayer.getState().volume * 0.012; gainRef.current = gain
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start()
    void context.resume().catch(() => usePlayer.setState({ playing: false, error: '请再次点击播放' }))
    return () => { oscillator.stop(); gainRef.current = null; void context.close() }
  }, [playing, track?.id, track?.src, namespace])
  useEffect(() => {
    if (audioRef.current) { audioRef.current.volume = volume / 5; audioRef.current.loop = config.repeatMode === 'one' }
    if (gainRef.current) gainRef.current.gain.value = volume * 0.012
  }, [volume, config.repeatMode])
  return null
}
