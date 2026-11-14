import { useEffect, useState } from 'react';
import { usePKStore } from '../stores/usePKStore';

/**
 * PK倒计时展示。
 * 注意：真正的"到点结算"由全局后台行为(useBackgroundBehaviors)统一处理，
 * 这样无论玩家是否正在观战PK页面，PK都能正常推进和结算，此处只负责UI展示。
 */
export function usePKCountdown() {
  const { active, endTime } = usePKStore();
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      setRemainingMs(Math.max(0, endTime - Date.now()));
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [active, endTime]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    remainingMs,
    label: `${minutes}:${seconds.toString().padStart(2, '0')}`,
    isUrgent: remainingMs > 0 && remainingMs <= 30000,
  };
}
