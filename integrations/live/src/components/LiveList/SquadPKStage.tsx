import AnchorImage from '../Common/AnchorImage';
import { getAnchorById } from '../../data/anchors';
import { LIVE } from '../../theme/liveTheme';

interface Slot {
  left: string;
  top: string;
  width: string;
  height: string;
  z: number;
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DURATION = '0.58s';

/** 左上、左下、右上、右下 */
function equalSlots(ids: string[]): Record<string, Slot> {
  const w = '49.4%';
  const h = '49.4%';
  return {
    [ids[0]]: { left: '0%', top: '0%', width: w, height: h, z: 1 },
    [ids[1]]: { left: '0%', top: '50.6%', width: w, height: h, z: 1 },
    [ids[2]]: { left: '50.6%', top: '0%', width: w, height: h, z: 1 },
    [ids[3]]: { left: '50.6%', top: '50.6%', width: w, height: h, z: 1 },
  };
}

/** 主要主播放大靠左，其余缩小靠右一列 */
function focusSlots(ids: string[], focusId: string): Record<string, Slot> {
  const others = ids.filter((id) => id !== focusId);
  const mainW = 61.5;
  const sideW = 100 - mainW - 0.8;
  const sideLeft = mainW + 0.8;
  const rowH = (100 - 1.2) / 3;
  const slots: Record<string, Slot> = {
    [focusId]: { left: '0%', top: '0%', width: `${mainW}%`, height: '100%', z: 3 },
  };
  others.forEach((id, i) => {
    slots[id] = {
      left: `${sideLeft}%`,
      top: `${i * (rowH + 0.4)}%`,
      width: `${sideW}%`,
      height: `${rowH}%`,
      z: 2,
    };
  });
  return slots;
}

interface SquadPKStageProps {
  participantIds: string[];
  scores: Record<string, number>;
  focusAnchorId: string | null;
  onSelect: (anchorId: string) => void;
  className?: string;
}

/** 四人 PK 立绘舞台：均分布局 ↔ 主播聚焦，位置尺寸平滑过渡 */
export default function SquadPKStage({
  participantIds,
  scores,
  focusAnchorId,
  onSelect,
  className = '',
}: SquadPKStageProps) {
  const ids = participantIds.slice(0, 4);
  if (ids.length !== 4) return null;

  const slots =
    focusAnchorId && ids.includes(focusAnchorId) ? focusSlots(ids, focusAnchorId) : equalSlots(ids);

  const maxScore = Math.max(...ids.map((id) => scores[id] ?? 0), 1);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} style={{ background: LIVE.bg }}>
      {ids.map((id) => {
        const anchor = getAnchorById(id);
        if (!anchor) return null;
        const slot = slots[id];
        const isFocus = focusAnchorId === id;
        const score = scores[id] ?? 0;
        const lead = score === maxScore && score > 0;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="absolute overflow-hidden rounded-xl text-left outline-none ring-0 focus-visible:ring-2 focus-visible:ring-[#9b5cff]"
            style={{
              left: slot.left,
              top: slot.top,
              width: slot.width,
              height: slot.height,
              zIndex: slot.z,
              transition: `left ${DURATION} ${EASE}, top ${DURATION} ${EASE}, width ${DURATION} ${EASE}, height ${DURATION} ${EASE}, box-shadow ${DURATION} ${EASE}`,
              boxShadow: isFocus
                ? '0 0 0 2px rgba(155,92,255,0.85), 0 12px 40px rgba(124,58,237,0.35)'
                : '0 0 0 1px rgba(61,42,85,0.8)',
            }}
          >
            <AnchorImage anchor={anchor} fit="cover" className="h-full w-full" />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: isFocus
                  ? 'linear-gradient(to top, rgba(12,6,20,0.88) 0%, transparent 48%)'
                  : 'linear-gradient(to top, rgba(12,6,20,0.85) 0%, transparent 58%)',
              }}
            />
            {isFocus && (
              <span className="absolute left-2 top-2 rounded-sm bg-[#9b5cff] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white shadow">
                主要
              </span>
            )}
            {/* 分数角标：始终醒目 */}
            <div
              className={`absolute right-1.5 top-1.5 rounded-lg px-1.5 py-0.5 shadow-lg ring-1 ring-white/25 ${
                lead ? 'bg-[#9b5cff]' : 'bg-black/75'
              }`}
            >
              <p
                className={`font-black tabular-nums leading-none text-white ${
                  isFocus ? 'text-[18px]' : 'text-[14px]'
                }`}
                style={{ transition: `font-size ${DURATION} ${EASE}` }}
              >
                {score}
              </p>
            </div>
            <div className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-6">
              <p
                className={`truncate font-extrabold text-white drop-shadow ${
                  isFocus ? 'text-[13px]' : 'text-[11px]'
                }`}
                style={{ transition: `font-size ${DURATION} ${EASE}` }}
              >
                {anchor.stageName}
              </p>
              <p
                className={`font-black tabular-nums drop-shadow ${
                  lead ? 'text-[#c4b5fd]' : 'text-white'
                } ${isFocus ? 'text-xl' : 'text-[15px]'}`}
                style={{ transition: `font-size ${DURATION} ${EASE}` }}
              >
                {score}
                <span className="ml-1 text-[10px] font-bold text-white/70">分</span>
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
