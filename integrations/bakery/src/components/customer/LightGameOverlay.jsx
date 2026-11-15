import { useState, useEffect, useRef, useCallback } from 'react';
import { BREAD_DECOR_IMAGES, BREAD_DECOR_SLOTS } from '../../data/breadDecorAssets';
import './LightGameOverlay.css';

const GRID_SIZE = 16;        // 4×4
const TOTAL_SECONDS = 30;
const SPAWN_INTERVAL = 750;  // 每 750ms 亮一格
const LIGHT_DURATION = 1700; // 灯亮持续 1700ms 后自动熄灭

/** 根据命中率计算收益倍率 */
function calcMultiplier(hits, total) {
  if (total === 0) return 1.0;
  const rate = hits / total;
  if (rate >= 0.80) return 1.3;
  if (rate >= 0.55) return 1.2;
  if (rate >= 0.30) return 1.1;
  return 1.0;
}

function multLevel(m) {
  if (m >= 1.3) return 5;
  if (m >= 1.2) return 4;
  if (m >= 1.1) return 3;
  return 1;
}

function multDesc(m) {
  if (m >= 1.3) return '完美！顾客都被你的热情感染了 🎉';
  if (m >= 1.2) return '出色！今天的面包格外香气四溢 ✨';
  if (m >= 1.1) return '不错！收益稳步提升，继续加油 👍';
  return '还可以，明天再接再厉 💪';
}

/** 给结果屏选一张最好看的面包图（用命中率偏后段的索引） */
function pickResultBread(multiplier) {
  const idx = multiplier >= 1.3 ? 4 : multiplier >= 1.2 ? 8 : multiplier >= 1.1 ? 2 : 11;
  return BREAD_DECOR_IMAGES[idx % BREAD_DECOR_IMAGES.length];
}

/**
 * @param {function} onComplete(multiplier) - 游戏结束且顾客就绪时回调
 * @param {boolean}  guestsReady           - 顾客数据是否已加载完成
 */
export default function LightGameOverlay({ onComplete, guestsReady }) {
  const [countdown, setCountdown] = useState(TOTAL_SECONDS);
  const [litCells, setLitCells] = useState(new Set());
  const [score, setScore] = useState(0);
  const [spawned, setSpawned] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hitCells, setHitCells] = useState(new Set());
  const [resultShown, setResultShown] = useState(false);

  const spawnedRef = useRef(0);
  const gameOverRef = useRef(false);

  /* 倒计时 */
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          gameOverRef.current = true;
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* 随机亮灯 */
  useEffect(() => {
    const id = setInterval(() => {
      if (gameOverRef.current) return;
      setLitCells((prev) => {
        const all = Array.from({ length: GRID_SIZE }, (_, i) => i);
        const unlit = all.filter((i) => !prev.has(i));
        if (unlit.length === 0) return prev;
        const pick = unlit[Math.floor(Math.random() * unlit.length)];
        spawnedRef.current += 1;
        setSpawned(spawnedRef.current);
        setTimeout(() => {
          setLitCells((cur) => { const n = new Set(cur); n.delete(pick); return n; });
        }, LIGHT_DURATION);
        return new Set([...prev, pick]);
      });
    }, SPAWN_INTERVAL);
    return () => clearInterval(id);
  }, []);

  /* 游戏结束后短暂延迟再展示结果屏 */
  useEffect(() => {
    if (!gameOver) return;
    const id = setTimeout(() => setResultShown(true), 350);
    return () => clearTimeout(id);
  }, [gameOver]);

  /* 结果 + 顾客就绪 → 回调 */
  useEffect(() => {
    if (!resultShown || !guestsReady) return;
    const multiplier = calcMultiplier(score, spawnedRef.current);
    const id = setTimeout(() => onComplete(multiplier), 1800);
    return () => clearTimeout(id);
  }, [resultShown, guestsReady, score, onComplete]);

  /* 点击格子 */
  const handleCellClick = useCallback((idx) => {
    if (gameOver) return;
    setLitCells((prev) => {
      if (!prev.has(idx)) return prev;
      const next = new Set(prev);
      next.delete(idx);
      setScore((s) => s + 1);
      setHitCells((h) => {
        const nh = new Set(h);
        nh.add(idx);
        setTimeout(() => setHitCells((hh) => { const r = new Set(hh); r.delete(idx); return r; }), 300);
        return nh;
      });
      return next;
    });
  }, [gameOver]);

  const multiplier = calcMultiplier(score, spawnedRef.current);
  const level = multLevel(multiplier);

  /* 倒计时圆弧 */
  const R = 33;
  const C = 2 * Math.PI * R;
  const arcOffset = C - C * (countdown / TOTAL_SECONDS);

  return (
    <div className="light-game-overlay">
      {/* 底图层 */}
      <div className="lg-bg-photo" aria-hidden />
      {/* 暖色遮罩 */}
      <div className="lg-bg-veil" aria-hidden />
      {/* 颗粒质感 */}
      <div className="lg-bg-grain" aria-hidden />
      {/* 漂浮面包装饰（复用游戏同款） */}
      <div className="lg-bg-decor" aria-hidden>
        {BREAD_DECOR_SLOTS.map((slot, i) => (
          <img
            key={i}
            className="lg-bg-decor-img"
            style={{
              left: slot.left,
              top: slot.top,
              width: slot.size,
              animationDelay: `${slot.delay}s`,
            }}
            src={BREAD_DECOR_IMAGES[i % BREAD_DECOR_IMAGES.length]}
            alt=""
            draggable={false}
          />
        ))}
      </div>

      {/* 游戏内容 */}
      <div className="lg-content">
        {!resultShown ? (
          <>
            <div className="lg-header">
              <p className="lg-title">🏪 顾客正在前往店铺…</p>
              <p className="lg-subtitle">点击发光的面包为今日营业积蓄能量，分数决定收益倍率！</p>
            </div>

            {/* 倒计时圆圈 */}
            <div className="lg-timer-wrap">
              <svg className="lg-timer-svg" viewBox="0 0 80 80">
                <circle className="lg-timer-bg" cx="40" cy="40" r={R} />
                <circle
                  className="lg-timer-arc"
                  cx="40" cy="40" r={R}
                  strokeDasharray={C}
                  strokeDashoffset={arcOffset}
                />
              </svg>
              <div className={`lg-timer-text${countdown <= 5 ? ' urgent' : ''}`}>
                {countdown}
              </div>
            </div>

            {/* 分数 / 倍率 */}
            <div className="lg-score-bar">
              <div className="lg-score-item">
                <span className="lg-score-label">点亮</span>
                <span className="lg-score-value">{score} / {spawned}</span>
              </div>
              <div className="lg-score-item">
                <span className="lg-score-label">当前倍率</span>
                <span className={`lg-mult-value lg-mult-${level}`}>{multiplier.toFixed(1)}x</span>
              </div>
            </div>

            {/* 面包灯格 */}
            <div className="lg-grid">
              {Array.from({ length: GRID_SIZE }, (_, i) => {
                const isLit = litCells.has(i);
                const isHit = hitCells.has(i);
                const breadSrc = BREAD_DECOR_IMAGES[i % BREAD_DECOR_IMAGES.length];
                return (
                  <button
                    key={i}
                    type="button"
                    className={`lg-cell${isLit ? ' lit' : ''}${isHit ? ' hit-flash' : ''}`}
                    onClick={() => handleCellClick(i)}
                    aria-label={isLit ? '点击熄灯' : '灯已熄灭'}
                  >
                    {isLit
                      ? <img className="lg-cell-bread" src={breadSrc} alt="" draggable={false} />
                      : <img className="lg-cell-bread-dim" src={breadSrc} alt="" draggable={false} />
                    }
                  </button>
                );
              })}
            </div>

            <p className="lg-hint">点击发光的面包得分 · 面包会在 {(LIGHT_DURATION / 1000).toFixed(1)} 秒后自动熄灭</p>
          </>
        ) : (
          /* 结果屏 */
          <div className="lg-result">
            <img
              className="lg-result-bread-icon"
              src={pickResultBread(multiplier)}
              alt=""
              draggable={false}
            />
            <p className="lg-result-title">今日收益倍率已确定</p>
            <div className={`lg-result-mult lg-mult-value lg-mult-${level}`}>
              {multiplier.toFixed(1)}x
            </div>
            <p className="lg-result-desc">
              命中 {score} / {spawnedRef.current} 个面包
              （{spawnedRef.current > 0 ? Math.round(score / spawnedRef.current * 100) : 0}%）<br />
              {multDesc(multiplier)}
            </p>
            {!guestsReady && (
              <div className="lg-result-waiting">
                <span className="lg-result-waiting-dot" />
                <span className="lg-result-waiting-dot" />
                <span className="lg-result-waiting-dot" />
                <span>顾客还在路上，稍等片刻…</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
