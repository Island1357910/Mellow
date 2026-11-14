import { useEffect, useState } from 'react';
import { formatGameClock, useGameTimeStore } from '../../stores/useGameTimeStore';
import { embedded } from '../../utils/mellowHost';

/** 顶部状态栏：显示游戏内时间；默认黑底白字 */
export default function StatusBar({ dark = true }: { dark?: boolean }) {
  return embedded ? null : <GameStatusBar dark={dark} />;
}

function GameStatusBar({ dark }: { dark: boolean }) {
  const gameTotalSeconds = useGameTimeStore((s) => s.gameTotalSeconds);
  const [time, setTime] = useState('');

  useEffect(() => {
    const clock = useGameTimeStore.getState().getClock();
    setTime(formatGameClock(clock).time);
  }, [gameTotalSeconds]);

  return (
    <div
      className={`relative z-30 flex shrink-0 items-center justify-between px-4 pt-2 pb-1 text-[13px] font-semibold ${
        dark ? 'bg-black text-white' : 'bg-transparent text-slate-800'
      }`}
    >
      <span>{time}</span>
      <div className="flex items-center gap-1">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <rect x="0" y="7" width="3" height="4" rx="0.5" fill="currentColor" />
          <rect x="4.5" y="5" width="3" height="6" rx="0.5" fill="currentColor" />
          <rect x="9" y="3" width="3" height="8" rx="0.5" fill="currentColor" />
          <rect x="13" y="0" width="3" height="11" rx="0.5" fill="currentColor" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path
            d="M7.5 9.5a1 1 0 100 2 1 1 0 000-2zM4.2 6.8a4.7 4.7 0 016.6 0l-1.1 1.1a3.1 3.1 0 00-4.4 0L4.2 6.8zM1.7 4.3a8.2 8.2 0 0111.6 0L12.2 5.4a6.6 6.6 0 00-9.4 0L1.7 4.3z"
            fill="currentColor"
          />
        </svg>
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <rect x="0.5" y="0.5" width="20" height="11" rx="2.5" stroke="currentColor" />
          <rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" />
          <rect x="21.5" y="3.5" width="1.5" height="5" rx="0.75" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
