import AnchorImage from '../Common/AnchorImage';
import Loading from '../Common/Loading';
import SubtitleBubble from './SubtitleBubble';
import type { AnchorProfile } from '../../types';

interface LinkMicOverlayProps {
  open: boolean;
  phase: 'connecting' | 'active';
  anchor: AnchorProfile;
  playerName: string;
  callSeconds: number;
  subtitle: { id: string; text: string } | null;
  anchorTyping: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onHangup: () => void;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function LinkMicOverlay({
  open,
  phase,
  anchor,
  playerName,
  callSeconds,
  subtitle,
  anchorTyping,
  input,
  onInputChange,
  onSend,
  onHangup,
}: LinkMicOverlayProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[65] flex min-h-0 flex-col overflow-hidden bg-black">
      <div className="absolute inset-0">
        <AnchorImage anchor={anchor} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent via-35% to-black/60" />
        {phase === 'connecting' && <div className="pointer-events-none absolute inset-0 bg-black/25" />}
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between px-4 pt-10">
          <span className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
            {phase === 'connecting' ? '📶 正在连线...' : `🔴 连麦中 ${formatDuration(callSeconds)}`}
          </span>
          <button
            onClick={onHangup}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/90 text-white active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          {phase === 'connecting' && (
            <div className="absolute inset-x-0 bottom-[38%] flex flex-col items-center gap-2">
              <Loading small text={`正在连接 ${anchor.stageName} 的视频...`} />
            </div>
          )}

          <div className="absolute bottom-4 right-4 flex h-20 w-16 flex-col items-center justify-center gap-1 rounded-xl border border-white/25 bg-black/35 backdrop-blur-sm">
            <span className="text-lg">🤳</span>
            <span className="max-w-full truncate px-1 text-[9px] text-white/80">{playerName || '你'}</span>
          </div>
        </div>

        {phase === 'active' && (
          <>
            <div className="shrink-0 px-3 pb-1">
              <SubtitleBubble
                id={subtitle?.id ?? null}
                text={subtitle?.text ?? null}
                anchorName={anchor.stageName}
                className="mx-auto w-full max-w-[300px]"
              />
              {anchorTyping && !subtitle && (
                <div className="mx-auto w-fit rounded-full bg-white/90 px-2.5 py-1 text-[10px] text-pink-500 shadow">
                  {anchor.stageName} 正在说话…
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-white/15 bg-black/40 px-3 py-2.5 backdrop-blur-sm">
              <input
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSend()}
                placeholder={anchorTyping ? `${anchor.stageName}正在说话...` : '视频里跟他说点什么...'}
                className="flex-1 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[13px] text-white placeholder:text-white/35 outline-none"
              />
              <button
                onClick={onSend}
                className="rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-400 px-4 py-2 text-[12px] font-semibold text-white active:scale-95"
              >
                发送
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
