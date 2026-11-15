import { useMemo } from 'react';
import { BREAD_DECOR_IMAGES } from '../data/breadDecorAssets';
import './CardBreadDecor.css';

function hashSeed(str) {
  let h = 2166136261;
  const s = String(str ?? 'x');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function next() {
    let t = (a += 0x6d2b79fd);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POSITION_SLOTS = [
  { top: '1%', left: '2%' },
  { top: '2%', right: '2%' },
  { bottom: '3%', left: '4%' },
  { bottom: '2%', right: '3%' },
  { top: '18%', left: '-1%' },
  { top: '12%', right: '-1%' },
  { bottom: '28%', right: '1%' },
  { bottom: '24%', left: '0%' },
  { top: '32%', left: '82%' },
  { top: '40%', right: '78%' },
  { top: '48%', left: '6%' },
  { bottom: '12%', left: '62%' },
];

function pickSlots(rnd, count) {
  const idx = [...Array(POSITION_SLOTS.length).keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const n = Math.min(count, idx.length);
  return idx.slice(0, n).map((i) => POSITION_SLOTS[i]);
}

/**
 * @param {string} seed
 * @param {'card'|'chrome'} variant  chrome：更半透明、尺度落差更大，用于页面区块/购物车等
 * @param {{ countMin?: number, countMax?: number }} [options] 覆盖默认数量（默认 1～2）
 */
export function buildCardDecorBits(seed, variant = 'card', options = {}) {
  const { countMin, countMax } = options;
  const optKey = `${countMin ?? ''}-${countMax ?? ''}`;
  const rnd = mulberry32(hashSeed(`${seed}|${variant}|${optKey}`));
  const isChrome = variant === 'chrome';
  let count;
  if (
    typeof countMin === 'number' &&
    typeof countMax === 'number' &&
    countMax >= countMin &&
    countMin >= 1
  ) {
    count = countMin + Math.floor(rnd() * (countMax - countMin + 1));
  } else {
    /* 每区少量：1～2 个，避免拥挤 */
    count = 1 + Math.floor(rnd() * 2);
  }
  count = Math.min(count, POSITION_SLOTS.length);

  const images = [...BREAD_DECOR_IMAGES];
  for (let i = images.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
  }
  const slots = pickSlots(rnd, count);

  return slots.map((pos, i) => {
    const sizeMin = isChrome ? 40 : 34;
    const sizeSpan = isChrome ? 36 : 32;
    const sizePx = sizeMin + Math.floor(rnd() * sizeSpan);
    const rot = (rnd() - 0.5) * (isChrome ? 30 : 34);

    const opacityMin = isChrome ? 0.12 : 0.22;
    const opacitySpan = isChrome ? 0.26 : 0.38;
    const opacity = opacityMin + rnd() * opacitySpan;

    const delay = rnd() * 4.8;
    const duration = isChrome ? 6.2 + rnd() * 5.5 : 5.2 + rnd() * 4.5;

    /* 错落缩放：三条尺度 + 动画内缩放脉动 */
    const loMin = isChrome ? 0.48 : 0.62;
    const loSpan = isChrome ? 0.42 : 0.35;
    const sLo = loMin + rnd() * loSpan;
    const pulse = isChrome ? 0.12 + rnd() * 0.38 : 0.1 + rnd() * 0.28;
    let sHi = sLo + pulse;
    let sMid = sLo + (sHi - sLo) * (0.35 + rnd() * 0.45);
    sMid = Math.min(Math.max(sMid, sLo * 1.02), sHi * 0.98);
    if (sHi < sLo * 1.06) sHi = sLo * (1.08 + rnd() * 0.15);

    const pulseHi = Number(Math.min(Math.max(sMid + (sHi - sMid) * (0.55 + rnd() * 0.85), sLo * 1.04), sLo * 1.62).toFixed(3));

    return {
      key: `${seed}-${variant}-${i}`,
      src: images[i % images.length],
      wrapStyle: {
        ...pos,
        '--decor-s-lo': Number(sLo.toFixed(3)),
        '--decor-s-mid': Number(sMid.toFixed(3)),
        '--decor-s-hi': Number(sHi.toFixed(3)),
        '--decor-pulse-hi': pulseHi,
        animationDelay: `${delay.toFixed(2)}s`,
        animationDuration: `${duration.toFixed(2)}s`,
      },
      imgStyle: {
        width: sizePx,
        opacity,
        transform: `rotate(${rot.toFixed(1)}deg)`,
      },
    };
  });
}

export default function CardBreadDecor({ seed, variant = 'card', countMin, countMax }) {
  const bits = useMemo(
    () => buildCardDecorBits(seed, variant, { countMin, countMax }),
    [seed, variant, countMin, countMax],
  );
  const layerClass =
    variant === 'chrome'
      ? 'card-bread-decor-layer card-bread-decor-layer--chrome'
      : 'card-bread-decor-layer';
  return (
    <span className={layerClass} aria-hidden>
      {bits.map((b) => (
        <span key={b.key} className="card-bread-decor-wrap" style={b.wrapStyle}>
          <img className="card-bread-decor-img" style={b.imgStyle} src={b.src} alt="" draggable={false} />
        </span>
      ))}
    </span>
  );
}
