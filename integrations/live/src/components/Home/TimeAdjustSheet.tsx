import { useEffect, useMemo, useState } from 'react';
import { getAllAnchors } from '../../data/anchors';
import { getAnchorSchedule, getTodayOffsetMinutes } from '../../data/schedules';
import { formatGameClock, useGameTimeStore } from '../../stores/useGameTimeStore';
import { useAnchorStore } from '../../stores/useAnchorStore';
import { useToastStore } from '../../stores/useToastStore';
import { anchorAvatarProps } from '../Common/AnchorImage';
import Avatar from '../Common/Avatar';

const SLOT_PRESETS = [
  { label: '清晨档', hour: 2, tip: '0-8点档' },
  { label: '上午档', hour: 8, tip: '4-12点档' },
  { label: '下午档', hour: 12, tip: '8-16点档' },
  { label: '傍晚档', hour: 16, tip: '12-20点档' },
  { label: '黄金档', hour: 19, tip: '16-24点档' },
  { label: '深夜档', hour: 22, tip: '20-次日4点' },
] as const;

interface TimeAdjustSheetProps {
  open: boolean;
  onClose: () => void;
}

/** 首页时间调节：跳转游戏内时间，快速对齐心仪主播开播档 */
export default function TimeAdjustSheet({ open, onClose }: TimeAdjustSheetProps) {
  const setTime = useGameTimeStore((s) => s.setTime);
  const showToast = useToastStore((s) => s.show);

  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(19);
  const [minute, setMinute] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const c = useGameTimeStore.getState().getClock();
    setDay(c.day);
    setHour(c.hour);
    setMinute(c.minute);
    setQuery('');
  }, [open]);

  const preview = formatGameClock({
    day,
    hour,
    minute,
    totalSeconds: day * 86400 + hour * 3600 + minute * 60,
  });

  const filteredAnchors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return getAllAnchors();
    return getAllAnchors().filter(
      (a) =>
        a.stageName.toLowerCase().includes(q) ||
        a.realName.toLowerCase().includes(q) ||
        a.tag.toLowerCase().includes(q) ||
        (a.species ?? '').toLowerCase().includes(q)
    );
  }, [query]);

  const applyTime = (next: { day?: number; hour: number; minute?: number }, tip?: string) => {
    setTime(next);
    useAnchorStore.getState().tickSimulation();
    const after = useGameTimeStore.getState().getClock();
    const label = formatGameClock(after);
    showToast(tip ?? `已跳转到 ${label.date} ${label.time}`);
    onClose();
  };

  const jumpToAnchor = (anchorId: string, stageName: string) => {
    const schedule = getAnchorSchedule(anchorId);
    const offset = getTodayOffsetMinutes(anchorId, { day, hour, minute, totalSeconds: 0 });
    let totalMin = schedule.usualStart * 60 + offset + 20;
    let targetDay = day;
    while (totalMin < 0) {
      totalMin += 1440;
      targetDay -= 1;
    }
    while (totalMin >= 1440) {
      totalMin -= 1440;
      targetDay += 1;
    }
    applyTime(
      {
        day: Math.max(0, targetDay),
        hour: Math.floor(totalMin / 60) % 24,
        minute: totalMin % 60,
      },
      `已跳到 ${stageName} 开播时段附近`
    );
  };

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[90] flex flex-col bg-black/40 backdrop-blur-[2px]"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div
        className="mt-auto flex max-h-[88%] flex-col rounded-t-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eff3f4] px-4 py-3">
          <button type="button" onClick={onClose} className="text-[14px] text-[#536471]">
            取消
          </button>
          <p className="text-[16px] font-bold text-[#0f1419]">调整游戏时间</p>
          <button
            type="button"
            onClick={() => applyTime({ day, hour, minute })}
            className="text-[14px] font-bold text-[#1d9bf0]"
          >
            确定
          </button>
        </div>

        <div className="border-b border-[#eff3f4] px-4 py-3 text-center">
          <p className="text-[28px] font-light tracking-tight text-[#0f1419]">{preview.time}</p>
          <p className="mt-1 text-[13px] text-[#536471]">{preview.date}</p>
          <p className="mt-1 text-[11px] text-[#71767b]">跳转后主播在线状态会立即刷新</p>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
          <p className="mb-2 text-[12px] font-bold text-[#536471]">日期 / 时分</p>
          <div className="mb-3 flex items-center gap-2">
            <Stepper label="天" value={day + 1} onDec={() => setDay((d) => Math.max(0, d - 1))} onInc={() => setDay((d) => d + 1)} />
            <Stepper label="时" value={hour} onDec={() => setHour((h) => (h + 23) % 24)} onInc={() => setHour((h) => (h + 1) % 24)} />
            <Stepper
              label="分"
              value={minute}
              onDec={() => setMinute((m) => (m + 55) % 60)}
              onInc={() => setMinute((m) => (m + 5) % 60)}
            />
          </div>

          <p className="mb-2 text-[12px] font-bold text-[#536471]">快捷档口</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {SLOT_PRESETS.map((slot) => (
              <button
                key={slot.label}
                type="button"
                onClick={() => applyTime({ day, hour: slot.hour, minute: 0 }, `已跳到${slot.label}`)}
                className="rounded-full border border-[#cfd9de] px-3 py-1.5 text-[12px] font-bold text-[#0f1419] active:bg-[#eff3f4]"
              >
                {slot.label}
                <span className="ml-1 font-normal text-[#536471]">{slot.hour}:00</span>
              </button>
            ))}
          </div>

          <p className="mb-2 text-[12px] font-bold text-[#536471]">跳到主播开播时间</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索艺名 / 真名 / 标签"
            className="mb-2 w-full rounded-full border border-[#cfd9de] bg-[#eff3f4] px-3 py-2 text-[13px] text-[#0f1419] outline-none focus:border-[#1d9bf0] focus:bg-white"
          />
          <div className="max-h-56 overflow-y-auto rounded-2xl border border-[#eff3f4]">
            {filteredAnchors.slice(0, 40).map((anchor) => {
              const schedule = getAnchorSchedule(anchor.id);
              return (
                <button
                  key={anchor.id}
                  type="button"
                  onClick={() => jumpToAnchor(anchor.id, anchor.stageName)}
                  className="flex w-full items-center gap-3 border-b border-[#eff3f4] px-3 py-2.5 text-left last:border-b-0 active:bg-black/[0.03]"
                >
                  <Avatar {...anchorAvatarProps(anchor)} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-[#0f1419]">{anchor.stageName}</p>
                    <p className="truncate text-[11px] text-[#536471]">{schedule.displayText}</p>
                  </div>
                  <span className="shrink-0 text-[12px] font-bold text-[#1d9bf0]">跳转</span>
                </button>
              );
            })}
            {filteredAnchors.length === 0 && (
              <p className="px-3 py-6 text-center text-[13px] text-[#536471]">没有匹配的主播</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-2xl border border-[#cfd9de] px-2 py-2">
      <button type="button" onClick={onDec} className="h-8 w-8 rounded-full text-lg text-[#0f1419] active:bg-[#eff3f4]">
        −
      </button>
      <div className="text-center">
        <p className="text-[16px] font-bold tabular-nums text-[#0f1419]">{value.toString().padStart(2, '0')}</p>
        <p className="text-[10px] text-[#536471]">{label}</p>
      </div>
      <button type="button" onClick={onInc} className="h-8 w-8 rounded-full text-lg text-[#0f1419] active:bg-[#eff3f4]">
        +
      </button>
    </div>
  );
}
