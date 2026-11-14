import { ANCHORS, getAllAnchors, getAnchorById } from './anchors';
import type { GameClock } from '../stores/useGameTimeStore';

/** 6 组重叠 8 小时档口，任意时刻至少 2 组在线 = 12 位主播 */
const LIVE_GROUPS = [
  { label: '清晨档', start: 0, end: 8 },
  { label: '上午档', start: 4, end: 12 },
  { label: '下午档', start: 8, end: 16 },
  { label: '傍晚档', start: 12, end: 20 },
  { label: '黄金档', start: 16, end: 24 },
  { label: '深夜档', start: 20, end: 4 },
] as const;

export interface AnchorScheduleInfo {
  anchorId: string;
  slotLabel: string;
  usualStart: number;
  usualEnd: number;
  displayText: string;
}

const SCHEDULE_MAP = new Map<string, AnchorScheduleInfo>();

ANCHORS.forEach((a, i) => {
  const group = LIVE_GROUPS[Math.floor(i / 6) % LIVE_GROUPS.length];
  const endDisplay = group.end <= group.start ? `次日${group.end}:00` : `${group.end}:00`;
  SCHEDULE_MAP.set(a.id, {
    anchorId: a.id,
    slotLabel: group.label,
    usualStart: group.start,
    usualEnd: group.end,
    displayText: `${group.label} · 约 ${group.start}:00 - ${endDisplay}`,
  });
});

function daySeed(anchorId: string, clock: GameClock) {
  const key = `${clock.day}-${anchorId}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

export function getAnchorSchedule(anchorId: string): AnchorScheduleInfo {
  const mapped = SCHEDULE_MAP.get(anchorId);
  if (mapped) return mapped;

  const custom = getAnchorById(anchorId);
  if (custom?.isCustom && custom.presets) {
    const start = custom.presets.liveStartHour ?? 0;
    const end = custom.presets.liveEndHour ?? 24;
    const endDisplay = end >= 24 || end === 0 ? '24:00' : `${end}:00`;
    if (custom.presets.alwaysLive) {
      return {
        anchorId,
        slotLabel: '自定义常驻',
        usualStart: 0,
        usualEnd: 24,
        displayText: '自定义 · 全天可播',
      };
    }
    return {
      anchorId,
      slotLabel: '自定义档',
      usualStart: start,
      usualEnd: end % 24 === 0 && end !== 0 ? 24 : end % 24,
      displayText: `自定义 · 约 ${start}:00 - ${endDisplay}`,
    };
  }

  return {
    anchorId,
    slotLabel: '黄金档',
    usualStart: 19,
    usualEnd: 23,
    displayText: '黄金档 · 约 19:00 - 23:00',
  };
}

/** 今日是否请假（约 8% 概率，保证在线人数） */
export function isCancelledToday(anchorId: string, clock: GameClock): boolean {
  const seed = daySeed(anchorId, clock);
  return seed % 100 < 8;
}

/** 今日实际开播偏移（-30 ~ +40 分钟） */
export function getTodayOffsetMinutes(anchorId: string, clock: GameClock): number {
  const seed = daySeed(anchorId, clock);
  return (seed % 71) - 30;
}

function isNaturalLive(anchorId: string, clock: GameClock): boolean {
  const custom = getAnchorById(anchorId);
  if (custom?.isCustom && custom.presets?.alwaysLive) return true;
  if (isCancelledToday(anchorId, clock)) return false;
  const s = getAnchorSchedule(anchorId);
  const offsetMin = getTodayOffsetMinutes(anchorId, clock);
  const totalStartMin = s.usualStart * 60 + offsetMin;
  const totalEndMin = s.usualEnd * 60 + offsetMin;
  const nowMin = clock.hour * 60 + clock.minute;

  const startMin = ((totalStartMin % 1440) + 1440) % 1440;
  const endMin = ((totalEndMin % 1440) + 1440) % 1440;

  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

/** 计算所有主播在线状态，保证任意时刻至少 MIN_LIVE 人在播 */
const MIN_LIVE = 4;

export function computeLiveMap(clock: GameClock): Map<string, boolean> {
  const map = new Map<string, boolean>();
  const all = getAllAnchors();
  for (const a of all) {
    map.set(a.id, isNaturalLive(a.id, clock));
  }

  let online = [...map.values()].filter(Boolean).length;
  if (online >= MIN_LIVE) return map;

  const fallback = ANCHORS.filter((a) => !map.get(a.id)).sort(
    (a, b) => daySeed(a.id, clock) - daySeed(b.id, clock)
  );

  for (const a of fallback) {
    if (online >= MIN_LIVE) break;
    map.set(a.id, true);
    online += 1;
  }
  return map;
}

export function isAnchorLiveNow(anchorId: string, clock: GameClock): boolean {
  return computeLiveMap(clock).get(anchorId) ?? false;
}

/** 标识「同一场直播」：同一游戏日 + 同一主播档口 */
export function getLiveSessionKey(anchorId: string, clock: GameClock): string {
  const schedule = getAnchorSchedule(anchorId);
  return `${anchorId}:${clock.day}:${schedule.slotLabel}`;
}

export function getTodayScheduleDetail(anchorId: string, clock: GameClock): string {
  const custom = getAnchorById(anchorId);
  if (custom?.isCustom && custom.presets?.alwaysLive) return '自定义主播 · 随时可开播';
  const s = getAnchorSchedule(anchorId);
  if (isCancelledToday(anchorId, clock)) return '今日请假，暂不直播';
  const offset = getTodayOffsetMinutes(anchorId, clock);
  const startMin = s.usualStart * 60 + offset;
  const endMin = s.usualEnd * 60 + offset;
  const fmt = (mins: number) => {
    const h = Math.floor(((mins % 1440) + 1440) % 1440 / 60);
    const m = Math.abs(mins) % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  const endNote = endMin <= startMin ? '（跨日）' : '';
  const offsetNote =
    offset === 0 ? '' : offset > 0 ? ` · 今日可能晚${offset}分钟` : ` · 今日可能早${Math.abs(offset)}分钟`;
  return `${s.slotLabel} · 约 ${fmt(startMin)} - ${fmt(endMin)}${endNote}${offsetNote}`;
}

export function getLiveStatusText(anchorId: string, isOnline: boolean, clock: GameClock): string {
  if (isCancelledToday(anchorId, clock) && !isOnline) return '今日请假，暂未开播';
  if (isOnline) return '直播中';
  const offset = getTodayOffsetMinutes(anchorId, clock);
  const sign = offset >= 0 ? `可能晚${offset}分钟` : `可能早${Math.abs(offset)}分钟`;
  return `未开播 · ${getAnchorSchedule(anchorId).displayText}（${sign}）`;
}
