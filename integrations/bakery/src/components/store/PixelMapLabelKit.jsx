import { useLayoutEffect, useRef, useState } from 'react';
import { getPixelLabelFrameUrl } from '../../data/pixelLabelFrames';

const FIT_STEP = 0.04;
const FIT_MAX = 1.48;

/**
 * 地图热点标签：画框为 img（保持原图比例），文案叠在框内偏下居中。
 * 文案放不下时逐级放大画框；仍不够则换行。优先传入 frameUrl（同页由 assignPixelLabelFramesForPage 分配且不重复）。
 */
export function PixelMapFramedLabel({ children, seedKey, frameUrl }) {
  const url = frameUrl ?? getPixelLabelFrameUrl(seedKey);
  const rootRef = useRef(null);
  const textRef = useRef(null);
  const [imgReady, setImgReady] = useState(0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const text = textRef.current;
    if (!root || !text) return;
    const img = root.querySelector('.pixel-map-framed-label__frame');
    if (!img?.naturalWidth) return;

    text.classList.remove('pixel-map-framed-label__text--wrap');
    let scale = 1;
    root.style.setProperty('--label-fit-scale', '1');
    void root.offsetHeight;

    for (;;) {
      root.style.setProperty('--label-fit-scale', String(scale));
      void root.offsetHeight;
      const overflowing = text.scrollWidth > text.clientWidth + 1;
      if (!overflowing) break;
      if (scale >= FIT_MAX - 1e-6) {
        text.classList.add('pixel-map-framed-label__text--wrap');
        void root.offsetHeight;
        break;
      }
      scale = Math.min(scale + FIT_STEP, FIT_MAX);
    }
  }, [url, children, imgReady]);

  return (
    <span ref={rootRef} className="store-floor-hotspot-label pixel-map-framed-label">
      <img
        className="pixel-map-framed-label__frame"
        src={url}
        alt=""
        decoding="async"
        draggable={false}
        onLoad={() => setImgReady((n) => n + 1)}
      />
      <span ref={textRef} className="pixel-map-framed-label__text">
        {children}
      </span>
    </span>
  );
}
