import { useCallback, useEffect, useRef, useState } from 'react';
import { BREAD_DECOR_IMAGES } from '../data/breadDecorAssets';
import './IntroSequence.css';

const INTRO_CLIP_SEC = 5;
const FADE_CLASS = 'intro-sequence--fading';

const introSrc = `${import.meta.env.BASE_URL}videos/intro.mp4`;
const introLogoSrc = `${import.meta.env.BASE_URL}images/retouch_2026032719293447.png`;

/**
 * 首帧：与全页面包装饰同款图，随意散布（错落位置、大小、节奏），中央留给视频。
 * left/top 为锚点中心；w 为宽度 clamp。
 * @type {{ left: string, top: string, w: string, idx: number, delay: number, dur: string }[]}
 */
const INTRO_FLOAT_DECOR = [
  { left: '6%', top: '11%', w: 'clamp(48px, 7.8vw, 92px)', idx: 0, delay: 0, dur: '9.4s' },
  { left: '88%', top: '14%', w: 'clamp(36px, 5.6vw, 72px)', idx: 4, delay: 0.85, dur: '7.6s' },
  { left: '14%', top: '38%', w: 'clamp(42px, 6.5vw, 80px)', idx: 2, delay: 0.35, dur: '8.8s' },
  { left: '91%', top: '44%', w: 'clamp(52px, 8.2vw, 98px)', idx: 7, delay: 1.1, dur: '10.2s' },
  { left: '3%', top: '62%', w: 'clamp(34px, 5.2vw, 68px)', idx: 11, delay: 0.5, dur: '7.1s' },
  { left: '72%', top: '8%', w: 'clamp(44px, 6.8vw, 84px)', idx: 1, delay: 0.2, dur: '8.3s' },
  { left: '22%', top: '78%', w: 'clamp(56px, 8.8vw, 102px)', idx: 5, delay: 1.35, dur: '9.9s' },
  { left: '84%', top: '72%', w: 'clamp(38px, 5.8vw, 74px)', idx: 9, delay: 0.65, dur: '7.9s' },
  { left: '48%', top: '6%', w: 'clamp(40px, 6.2vw, 76px)', idx: 3, delay: 1.5, dur: '8.5s' },
  { left: '52%', top: '88%', w: 'clamp(46px, 7vw, 88px)', idx: 8, delay: 0.15, dur: '9.1s' },
  { left: '34%', top: '22%', w: 'clamp(32px, 5vw, 64px)', idx: 12, delay: 2.1, dur: '7.4s' },
  { left: '68%', top: '30%', w: 'clamp(50px, 7.5vw, 94px)', idx: 6, delay: 0.95, dur: '10.5s' },
  { left: '8%', top: '86%', w: 'clamp(44px, 6.6vw, 82px)', idx: 10, delay: 1.25, dur: '8s' },
  { left: '94%', top: '28%', w: 'clamp(30px, 4.8vw, 58px)', idx: 14, delay: 1.7, dur: '6.8s' },
];

/**
 * 首屏：视频停第一帧；中上游戏图标 + 漂浮装饰；点击进入后与按钮一同消失，播片后渐隐。
 * @param {{ onComplete?: () => void }} props
 */
export default function IntroSequence({ onComplete }) {
  const videoRef = useRef(null);
  const finishLock = useRef(false);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'playing' | 'fadeOut'
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const goFadeOut = useCallback(() => {
    if (finishLock.current) return;
    finishLock.current = true;
    const v = videoRef.current;
    if (v) {
      v.pause();
    }
    setPhase('fadeOut');
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || phase !== 'playing') return undefined;

    const onTimeUpdate = () => {
      if (v.currentTime >= INTRO_CLIP_SEC - 0.04) {
        goFadeOut();
      }
    };
    const onEnded = () => goFadeOut();

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('ended', onEnded);
    };
  }, [phase, goFadeOut]);

  const onLoadedData = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.currentTime = 0;
      void v.play().then(() => {
        v.pause();
        setFirstFrameReady(true);
      }).catch(() => {
        v.pause();
        setFirstFrameReady(true);
      });
    } catch {
      setFirstFrameReady(true);
    }
  }, []);

  const onEnterClick = () => {
    if (loadFailed) {
      onComplete?.();
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    finishLock.current = false;
    setPhase('playing');
    v.currentTime = 0;
    void v.play().catch(() => {
      onComplete?.();
    });
  };

  const onOverlayTransitionEnd = (e) => {
    if (phase !== 'fadeOut' || e.propertyName !== 'opacity') return;
    onComplete?.();
  };

  const idle = phase === 'idle';

  return (
    <div
      className={`intro-sequence${phase === 'fadeOut' ? ` ${FADE_CLASS}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="开场动画"
      onTransitionEnd={onOverlayTransitionEnd}
    >
      <div className="intro-sequence-video-stage">
        <div className="intro-sequence-video-canvas">
          <video
            ref={videoRef}
            className="intro-sequence-video"
            src={introSrc}
            muted
            playsInline
            preload="auto"
            onLoadedData={onLoadedData}
            onError={() => {
              setLoadFailed(true);
              setFirstFrameReady(true);
            }}
          />
        </div>
      </div>
      <div className="intro-sequence-veil" aria-hidden />
      {idle && (
        <div className="intro-sequence-float-layer" aria-hidden>
          {INTRO_FLOAT_DECOR.map((item, i) => (
            <img
              key={i}
              className="intro-sequence-float-img"
              src={BREAD_DECOR_IMAGES[item.idx % BREAD_DECOR_IMAGES.length]}
              alt=""
              draggable={false}
              style={{
                left: item.left,
                top: item.top,
                width: item.w,
                animationDelay: `${item.delay}s`,
                '--intro-drift-dur': item.dur,
              }}
            />
          ))}
        </div>
      )}
      {idle && (
        <>
          <img
            className="intro-sequence-logo"
            src={introLogoSrc}
            alt=""
            draggable={false}
          />
          <button
            type="button"
            className="intro-sequence-enter"
            onClick={onEnterClick}
            disabled={!firstFrameReady}
          >
            进入游戏
          </button>
        </>
      )}
    </div>
  );
}
