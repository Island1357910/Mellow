import type { ReactNode } from 'react';
import Avatar from '../Common/Avatar';
import { anchorAvatarProps } from '../Common/AnchorImage';
import AnchorImage from '../Common/AnchorImage';
import { getAnchorById } from '../../data/anchors';
import { LIVE } from '../../theme/liveTheme';

interface DuoProps {
  mode?: 'duo';
  anchorAId: string;
  anchorBId: string;
  scoreA: number;
  scoreB: number;
  countdown?: string;
  urgent?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: 'compact' | 'full';
}

interface SquadProps {
  mode: 'squad';
  participantIds: string[];
  scores: Record<string, number>;
  countdown?: string;
  urgent?: boolean;
  onClick?: () => void;
  className?: string;
}

type PKBattleCardProps = DuoProps | SquadProps;

/** 二人 / 四人 PK 列表卡片（视觉明显区分） */
export default function PKBattleCard(props: PKBattleCardProps) {
  if (props.mode === 'squad') {
    return <SquadCard {...props} />;
  }
  return <DuoCard {...props} mode="duo" />;
}

function DuoCard({
  anchorAId,
  anchorBId,
  scoreA,
  scoreB,
  countdown,
  urgent,
  onClick,
  className = '',
  variant = 'compact',
}: DuoProps) {
  const anchorA = getAnchorById(anchorAId);
  const anchorB = getAnchorById(anchorBId);
  if (!anchorA || !anchorB) return null;

  if (variant === 'full') {
    const inner = (
      <div className={className}>
        <DuoFull
          anchorA={anchorA}
          anchorB={anchorB}
          scoreA={scoreA}
          scoreB={scoreB}
          countdown={countdown}
          urgent={urgent}
        />
      </div>
    );
    return wrapClick(inner, onClick);
  }

  const total = scoreA + scoreB || 1;
  const pctA = Math.round((scoreA / total) * 100);
  const avA = anchorAvatarProps(anchorA);
  const avB = anchorAvatarProps(anchorB);

  const inner = (
    <div
      className={`overflow-hidden rounded-2xl border ${className}`}
      style={{ borderColor: LIVE.border, background: LIVE.card }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: LIVE.borderSoft }}>
        <span className="rounded-sm bg-[#7c3aed]/30 px-1.5 py-0.5 text-[10px] font-extrabold text-[#c4b5fd]">
          私人 PK · 双人
        </span>
        {countdown && (
          <span className={`ml-auto text-[10px] font-bold ${urgent ? 'animate-blink text-[#f4212e]' : 'text-[#9b8fb0]'}`}>
            {countdown}
          </span>
        )}
      </div>
      <div className="flex min-h-[88px]">
        <div className="relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3">
          <Avatar {...avA} size={44} />
          <p className="max-w-full truncate text-[12px] font-bold text-[#f3eef9]">{anchorA.stageName}</p>
          <p className="text-[13px] font-bold text-[#9b5cff]">{scoreA}</p>
        </div>
        <div className="relative z-10 flex w-12 shrink-0 flex-col items-center justify-center">
          <span className="text-[13px] font-black text-[#9b8fb0]">VS</span>
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3">
          <Avatar {...avB} size={44} />
          <p className="max-w-full truncate text-[12px] font-bold text-[#f3eef9]">{anchorB.stageName}</p>
          <p className="text-[13px] font-bold text-[#d946ef]">{scoreB}</p>
        </div>
      </div>
      <div className="flex h-1" style={{ background: LIVE.borderSoft }}>
        <div className="bg-[#9b5cff] transition-all duration-500" style={{ width: `${pctA}%` }} />
        <div className="bg-[#d946ef] transition-all duration-500" style={{ width: `${100 - pctA}%` }} />
      </div>
    </div>
  );

  return wrapClick(inner, onClick);
}

function SquadCard({
  participantIds,
  scores,
  countdown,
  urgent,
  onClick,
  className = '',
}: SquadProps) {
  const anchors = participantIds.map((id) => getAnchorById(id)).filter(Boolean);
  if (anchors.length !== 4) return null;

  const inner = (
    <div
      className={`overflow-hidden rounded-2xl border ${className}`}
      style={{
        borderColor: '#7c3aed',
        background: `linear-gradient(145deg, ${LIVE.surface} 0%, #2a1050 100%)`,
        boxShadow: '0 0 0 1px rgba(155,92,255,0.25), 0 8px 28px rgba(88,28,135,0.35)',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="rounded-sm bg-[#9b5cff] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
          多人 PK · 四人
        </span>
        <span className="text-[10px] font-semibold text-[#c4b5fd]">四宫格连麦</span>
        {countdown && (
          <span className={`ml-auto text-[10px] font-bold ${urgent ? 'animate-blink text-[#f4212e]' : 'text-[#9b8fb0]'}`}>
            {countdown}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-0.5 px-2 pb-2">
        {anchors.map((anchor) => {
          if (!anchor) return null;
          const score = scores[anchor.id] ?? 0;
          return (
            <div key={anchor.id} className="relative h-16 overflow-hidden rounded-lg">
              <AnchorImage anchor={anchor} fit="cover" className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0614]/90 to-transparent" />
              <div className="absolute inset-x-1 bottom-1">
                <p className="truncate text-[10px] font-bold text-white">{anchor.stageName}</p>
                <p className="text-[11px] font-black text-[#c4b5fd]">{score}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return wrapClick(inner, onClick);
}

function wrapClick(inner: ReactNode, onClick?: () => void) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left transition hover:opacity-95">
        {inner}
      </button>
    );
  }
  return <>{inner}</>;
}

function DuoFull({
  anchorA,
  anchorB,
  scoreA,
  scoreB,
  countdown,
  urgent,
}: {
  anchorA: NonNullable<ReturnType<typeof getAnchorById>>;
  anchorB: NonNullable<ReturnType<typeof getAnchorById>>;
  scoreA: number;
  scoreB: number;
  countdown?: string;
  urgent?: boolean;
}) {
  const total = scoreA + scoreB || 1;
  const pctA = Math.round((scoreA / total) * 100);

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: LIVE.border, background: LIVE.bg }}>
      <div className="flex items-center gap-2 px-2.5 pt-2">
        <span className="rounded-sm bg-[#7c3aed]/35 px-1.5 py-0.5 text-[10px] font-extrabold text-[#c4b5fd]">
          私人 PK · 双人
        </span>
      </div>
      <div className="relative mx-2 mb-2 mt-1 h-28 overflow-hidden rounded-xl">
        <div className="absolute inset-y-0 left-0 w-[52%] overflow-hidden">
          <AnchorImage anchor={anchorA} className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent" />
          <div className="absolute bottom-1.5 left-2.5">
            <p className="text-[11px] font-bold text-white">{anchorA.stageName}</p>
            <p className="text-[15px] font-black text-[#9b5cff]">{scoreA}</p>
          </div>
        </div>
        <div
          className="absolute inset-y-0 right-0 w-[52%] overflow-hidden"
          style={{ clipPath: 'polygon(18% 0, 100% 0, 100% 100%, 0 100%)' }}
        >
          <AnchorImage anchor={anchorB} className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-l from-black/55 to-transparent" />
          <div className="absolute bottom-1.5 right-2.5 text-right">
            <p className="text-[11px] font-bold text-white">{anchorB.stageName}</p>
            <p className="text-[15px] font-black text-[#d946ef]">{scoreB}</p>
          </div>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#9b5cff]/50 bg-[#0c0614]/80">
            <span className="text-[10px] font-black text-white">VS</span>
          </div>
        </div>
        {countdown && (
          <span
            className={`absolute left-1/2 top-1.5 z-20 -translate-x-1/2 rounded-full bg-[#0c0614]/70 px-2 py-0.5 text-[10px] font-bold text-white ${
              urgent ? 'animate-blink text-[#ff7a86]' : ''
            }`}
          >
            {countdown}
          </span>
        )}
      </div>
      <div className="flex h-1.5" style={{ background: LIVE.borderSoft }}>
        <div className="bg-[#9b5cff] transition-all" style={{ width: `${pctA}%` }} />
        <div className="bg-[#d946ef] transition-all" style={{ width: `${100 - pctA}%` }} />
      </div>
    </div>
  );
}
