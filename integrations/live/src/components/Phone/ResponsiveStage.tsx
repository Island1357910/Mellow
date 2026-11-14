import { useEffect, useState, type ReactNode } from 'react';
import { PHONE_WIDTH, PHONE_HEIGHT } from './PhoneFrame';

const BEZEL = 20; // PhoneFrame 边框宽度（左右/上下各自的总占用）
const MARGIN = 24; // 期望与视口边缘保留的安全间距

/**
 * 根据视口尺寸自适应缩放手机外壳，保证任何窗口大小下都能完整显示、
 * 不产生页面级滚动条。
 */
export default function ResponsiveStage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const totalWidth = PHONE_WIDTH + BEZEL;
    const totalHeight = PHONE_HEIGHT + BEZEL;

    const updateScale = () => {
      const availableWidth = window.innerWidth - MARGIN;
      const availableHeight = window.innerHeight - MARGIN;
      const next = Math.min(1, availableWidth / totalWidth, availableHeight / totalHeight);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
      {children}
    </div>
  );
}
