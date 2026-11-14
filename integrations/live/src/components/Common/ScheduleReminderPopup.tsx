import { useEffect, useState } from 'react';
import { getAnchorById } from '../../data/anchors';
import { isAnchorLiveNow, isCancelledToday, getTodayScheduleDetail } from '../../data/schedules';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useAnchorStore } from '../../stores/useAnchorStore';
import { useGameTimeStore } from '../../stores/useGameTimeStore';
import { tryEnterLiveRoom } from '../../utils/liveRoomEntry';

interface ReminderItem {
  key: string;
  anchorId: string;
  title: string;
  body: string;
  type: 'live' | 'cancel';
}

/** 开播/请假提醒弹窗 */
export default function ScheduleReminderPopup() {
  const reminders = usePlayerStore((s) => s.scheduleReminders);
  const notifiedKeys = usePlayerStore((s) => s.scheduleNotifiedKeys);
  const markNotified = usePlayerStore((s) => s.markScheduleNotified);
  const runtimeMap = useAnchorStore((s) => s.runtime);
  const gameTotalSeconds = useGameTimeStore((s) => s.gameTotalSeconds);
  const [queue, setQueue] = useState<ReminderItem[]>([]);
  const [current, setCurrent] = useState<ReminderItem | null>(null);

  useEffect(() => {
    if (reminders.length === 0) return;
    const clock = useGameTimeStore.getState().getClock();
    const dateKey = `day-${clock.day}`;
    const pending: ReminderItem[] = [];

    for (const anchorId of reminders) {
      const anchor = getAnchorById(anchorId);
      if (!anchor) continue;
      const cancelled = isCancelledToday(anchorId, clock);
      const live = runtimeMap[anchorId]?.isOnline ?? isAnchorLiveNow(anchorId, clock);

      if (cancelled) {
        const key = `${anchorId}-cancel-${dateKey}`;
        if (!notifiedKeys.includes(key)) {
          pending.push({
            key,
            anchorId,
            title: `${anchor.stageName} 今日请假`,
            body: '主播在社媒发布了请假通知，今天可能不会开播。',
            type: 'cancel',
          });
        }
      } else if (live) {
        const key = `${anchorId}-live-${dateKey}`;
        if (!notifiedKeys.includes(key)) {
          pending.push({
            key,
            anchorId,
            title: `${anchor.stageName} 开播啦！`,
            body: getTodayScheduleDetail(anchorId, clock),
            type: 'live',
          });
        }
      }
    }

    if (pending.length > 0) {
      setQueue((prev) => {
        const existing = new Set(prev.map((p) => p.key));
        return [...prev, ...pending.filter((p) => !existing.has(p.key))];
      });
    }
  }, [reminders, notifiedKeys, runtimeMap, gameTotalSeconds]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
    }
  }, [queue, current]);

  if (!current) return null;

  const dismiss = () => {
    markNotified(current.key);
    setCurrent(null);
  };

  const goLive = () => {
    markNotified(current.key);
    setCurrent(null);
    tryEnterLiveRoom(current.anchorId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 pb-8">
      <div className="w-full max-w-sm rounded-3xl border border-blue-100 bg-white p-5 shadow-2xl">
        <p className="text-lg font-bold text-slate-800">
          {current.type === 'live' ? '📺 ' : '📋 '}
          {current.title}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{current.body}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-full border border-blue-100 py-2.5 text-sm text-slate-500"
          >
            知道了
          </button>
          {current.type === 'live' && (
            <button
              type="button"
              onClick={goLive}
              className="flex-1 rounded-full bg-[#1d9bf0] py-2.5 text-sm font-bold text-white"
            >
              去看看
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
