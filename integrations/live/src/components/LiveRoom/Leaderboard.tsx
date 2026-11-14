import { usePlayerStore } from '../../stores/usePlayerStore';
import type { RivalFan } from '../../types';

interface LeaderboardProps {
  playerScore: number;
  rivals: RivalFan[];
  /** 是否收起为右侧侧边栏 */
  collapsed?: boolean;
  onToggle?: () => void;
}

const MEDALS = ['1', '2', '3'];

export default function Leaderboard({
  playerScore,
  rivals,
  collapsed = false,
  onToggle,
}: LeaderboardProps) {
  const playerName = usePlayerStore((s) => s.playerName);

  const entries = [
    { name: playerName || '你', score: playerScore, isPlayer: true },
    ...rivals.map((r) => ({ name: r.name, score: r.score, isPlayer: false })),
  ].sort((a, b) => b.score - a.score);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-0.5 rounded-l-xl border border-r-0 border-[#3d2a55] bg-[#1a0f2a]/95 py-3 pl-1.5 pr-1 shadow-md backdrop-blur transition active:scale-95"
        title="展开贡献榜"
      >
        <span
          className="text-[10px] font-extrabold tracking-wide text-[#c4b5fd]"
          style={{ writingMode: 'vertical-rl' }}
        >
          贡献榜
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#9b8fb0]">
          <path d="M6.5 1.5L3 5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="w-[108px] rounded-2xl border border-[#3d2a55] bg-[#1a0f2a]/95 p-2 shadow-md backdrop-blur">
      <div className="flex items-center justify-between gap-1 px-0.5">
        <p className="text-[10px] font-bold text-[#9b8fb0]">贡献榜</p>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-5 w-5 items-center justify-center rounded-full text-[#9b8fb0] hover:bg-white/10"
            title="向右收起"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 1.5L7 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {entries.slice(0, 3).map((e, idx) => (
        <div
          key={e.name + idx}
          className={`mt-1 flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] ${
            e.isPlayer ? 'bg-[#9b5cff]/25' : ''
          }`}
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white ${
              idx === 0 ? 'bg-[#9b5cff]' : 'bg-[#536471]'
            }`}
          >
            {MEDALS[idx]}
          </span>
          <span
            className={`min-w-0 flex-1 truncate ${
              e.isPlayer ? 'font-bold text-[#c4b5fd]' : 'text-white'
            }`}
          >
            {e.name}
          </span>
          <span className="font-semibold text-[#c4b5fd]">{formatScore(e.score)}</span>
        </div>
      ))}
    </div>
  );
}

function formatScore(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return `${n}`;
}
