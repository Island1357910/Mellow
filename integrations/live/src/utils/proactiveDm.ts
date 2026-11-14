import { getGameClockNow } from '../stores/useGameTimeStore';
import type { AnchorRuntimeState } from '../types';

/** 每个游戏日每位主播最多主动私信次数 */
export const MAX_PROACTIVE_DM_PER_GAME_DAY = 3;

/** 两次主动私信之间至少间隔的游戏小时 */
export const MIN_GAME_HOURS_BETWEEN_PROACTIVE_DM = 6;

/** 主播发私信后玩家未回复，多少游戏小时后发失落 follow-up */
export const UNANSWERED_FOLLOWUP_GAME_HOURS = 4;

export function getGameTotalSeconds() {
  return getGameClockNow().totalSeconds;
}

export function gameHoursToSeconds(hours: number) {
  return hours * 3600;
}

export function resetProactiveDmIfNewDay(runtime: AnchorRuntimeState, gameDay: number): AnchorRuntimeState {
  if (runtime.proactiveDmGameDay === gameDay) return runtime;
  return {
    ...runtime,
    proactiveDmGameDay: gameDay,
    proactiveDmCount: 0,
  };
}

export function canSendProactiveDm(runtime: AnchorRuntimeState, gameDay: number, nowGameSec: number): boolean {
  const r = resetProactiveDmIfNewDay(runtime, gameDay);
  if (r.proactiveDmCount >= MAX_PROACTIVE_DM_PER_GAME_DAY) return false;
  const minGap = gameHoursToSeconds(MIN_GAME_HOURS_BETWEEN_PROACTIVE_DM);
  if (r.lastProactiveDmGameSec > 0 && nowGameSec - r.lastProactiveDmGameSec < minGap) return false;
  return true;
}

export function markProactiveDmSent(runtime: AnchorRuntimeState, gameDay: number, nowGameSec: number): AnchorRuntimeState {
  const r = resetProactiveDmIfNewDay(runtime, gameDay);
  return {
    ...r,
    proactiveDmCount: r.proactiveDmCount + 1,
    lastProactiveDmGameSec: nowGameSec,
  };
}
