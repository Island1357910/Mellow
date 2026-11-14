import { getAnchorById } from '../../data/anchors';
import AnchorImage from '../Common/AnchorImage';

interface PKVersusStageProps {
  anchorAId: string;
  anchorBId: string;
  scoreA: number;
  scoreB: number;
  countdown?: string;
  urgent?: boolean;
  className?: string;
  /** card：列表卡片；screen：全屏铺底对战画�?*/
  variant?: 'card' | 'screen';
  /** screen 时由外层顶部栏展示倒计时，舞台内可隐藏 */
  hideCountdown?: boolean;
}

const LEFT_CLIP = 'polygon(0 0, 100% 0, 88% 100%, 0 100%)';
const RIGHT_CLIP = 'polygon(12% 0, 100% 0, 100% 100%, 0 100%)';

/** PK 左右对战舞台：斜切拼接无缝铺�?+ 中间 VS */
export default function PKVersusStage({
  anchorAId,
  anchorBId,
  scoreA,
  scoreB,
  countdown,
  urgent,
  className = '',
  variant = 'card',
  hideCountdown = false,
}: PKVersusStageProps) {
  const anchorA = getAnchorById(anchorAId);
  const anchorB = getAnchorById(anchorBId);
  if (!anchorA || !anchorB) return null;

  const total = scoreA + scoreB || 1;
  const pctA = Math.round((scoreA / total) * 100);
  const isScreen = variant === 'screen';
  const leftClip = isScreen ? LEFT_CLIP : 'none';
  const rightClip = isScreen ? RIGHT_CLIP : 'polygon(18% 0, 100% 0, 100% 100%, 0 100%)';
  const leftWidth = isScreen ? 'w-1/2' : 'w-[52%]';
  const rightWidth = isScreen ? 'w-1/2' : 'w-[52%]';

  return (
    <div
      className={`relative overflow-hidden ${
        isScreen ? 'h-full bg-[#0c0614]' : 'rounded-2xl border border-[#3d2a55] bg-[#0c0614] shadow-sm'
      } ${className}`}
    >
      <div className={isScreen ? 'relative h-full min-h-0' : 'relative h-44'}>
        <div
          className={`absolute inset-y-0 left-0 z-10 overflow-hidden ${leftWidth}`}
          style={{ clipPath: leftClip }}
        >
          <AnchorImage anchor={anchorA} className="h-full w-full scale-[1.02] object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#9b5cff]/35 via-[#9b5cff]/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10">
            <p className="truncate text-[12px] font-extrabold text-white">{anchorA.stageName}</p>
            <p className="text-3xl font-black tabular-nums leading-none text-white drop-shadow">
              {scoreA}
              <span className="ml-1 text-[12px] font-bold text-[#9b5cff]">分</span>
            </p>
          </div>
        </div>

        <div
          className={`absolute inset-y-0 right-0 z-10 overflow-hidden ${rightWidth}`}
          style={{ clipPath: rightClip }}
        >
          <AnchorImage anchor={anchorB} className="h-full w-full scale-[1.02] object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#d946ef]/35 via-[#d946ef]/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10 text-right">
            <p className="truncate text-[12px] font-extrabold text-white">{anchorB.stageName}</p>
            <p className="text-3xl font-black tabular-nums leading-none text-white drop-shadow">
              {scoreB}
              <span className="ml-1 text-[12px] font-bold text-[#d946ef]">分</span>
            </p>
          </div>
        </div>

        {isScreen && (
          <div
            className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-gradient-to-b from-white/5 via-white/80 to-white/5"
            style={{ transform: 'translateX(-50%) rotate(10deg)' }}
          />
        )}
        {!isScreen && (
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-20 h-full w-10 -translate-x-1/2"
            style={{ transform: 'translateX(-50%) rotate(12deg)' }}
          >
            <div className="mx-auto h-full w-px bg-gradient-to-b from-white/20 via-white to-white/20" />
          </div>
        )}

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#0c0614] shadow-lg">
            <span className="text-[13px] font-black tracking-wider text-white">VS</span>
          </div>
        </div>

        {countdown && !hideCountdown && (
          <div className="absolute left-1/2 top-2 z-30 -translate-x-1/2">
            <span
              className={`rounded-full border border-white/20 bg-[#0c0614]/70 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm ${
                urgent ? 'animate-blink text-[#f4212e]' : ''
              }`}
            >
              {countdown}
            </span>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-40 flex h-1.5">
        <div
          className="bg-[#9b5cff] transition-all duration-500"
          style={{ width: `${pctA}%` }}
        />
        <div
          className="bg-[#d946ef] transition-all duration-500"
          style={{ width: `${100 - pctA}%` }}
        />
      </div>
    </div>
  );
}
