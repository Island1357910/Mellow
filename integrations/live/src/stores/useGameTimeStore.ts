import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';

/** 1 现实秒 = 12 游戏秒（游戏内一天约 2 现实小时） */
export const GAME_SECONDS_PER_REAL_SECOND = 12;

export interface GameClock {
  /** 游戏内第几天（从 0 起） */
  day: number;
  hour: number;
  minute: number;
  /** 累计游戏秒 */
  totalSeconds: number;
}

export function secondsToClock(totalSeconds: number): GameClock {
  const day = Math.floor(totalSeconds / 86400);
  const rem = ((totalSeconds % 86400) + 86400) % 86400;
  return {
    day,
    hour: Math.floor(rem / 3600),
    minute: Math.floor((rem % 3600) / 60),
    totalSeconds,
  };
}

export function formatGameClock(clock: GameClock): { time: string; date: string } {
  const time = `${clock.hour.toString().padStart(2, '0')}:${clock.minute.toString().padStart(2, '0')}`;
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[(clock.day + 1) % 7];
  return { time, date: `第${clock.day + 1}天 ${weekday}` };
}

interface GameTimeState {
  gameTotalSeconds: number;
  lastTickRealMs: number;

  ensureInit: () => void;
  tick: () => void;
  getClock: () => GameClock;
  /** 手动调整游戏时间（跳转到指定天/时/分） */
  setTime: (opts: { day?: number; hour: number; minute?: number }) => void;
}

const DEFAULT_START_SECONDS = 19 * 3600; // 第1天 19:00

type PersistedGameTime = {
  gameTotalSeconds?: number;
  /** 旧版存档字段，兼容迁移 */
  gameMinutes?: number;
  lastTickRealMs?: number;
};

export const useGameTimeStore = create<GameTimeState>()(
  persist(
    (set, get) => ({
      gameTotalSeconds: DEFAULT_START_SECONDS,
      lastTickRealMs: 0,

      ensureInit: () => {
        const state = get() as GameTimeState & PersistedGameTime;
        if (state.gameTotalSeconds == null && state.gameMinutes != null) {
          set({ gameTotalSeconds: state.gameMinutes * 60 });
        } else if (state.gameTotalSeconds == null) {
          set({ gameTotalSeconds: DEFAULT_START_SECONDS });
        }
        if (get().lastTickRealMs === 0) {
          set({ lastTickRealMs: Date.now() });
        }
      },

      tick: () => {
        const now = Date.now();
        const { lastTickRealMs, gameTotalSeconds } = get();
        const base = lastTickRealMs || now;
        const elapsedSec = Math.max(0, Math.floor((now - base) / 1000));
        if (elapsedSec <= 0) return;
        set({
          gameTotalSeconds: gameTotalSeconds + elapsedSec * GAME_SECONDS_PER_REAL_SECOND,
          lastTickRealMs: base + elapsedSec * 1000,
        });
      },

      getClock: () => secondsToClock(get().gameTotalSeconds),

      setTime: ({ day, hour, minute = 0 }) => {
        const current = get().getClock();
        const d = Math.max(0, Math.floor(day ?? current.day));
        const h = Math.max(0, Math.min(23, Math.floor(hour)));
        const m = Math.max(0, Math.min(59, Math.floor(minute)));
        set({
          gameTotalSeconds: d * 86400 + h * 3600 + m * 60,
          lastTickRealMs: Date.now(),
        });
      },
    }),
    {
      name: 'shenhao_game_time',
      storage: idbJSONStorage,
      partialize: (state) => ({
        gameTotalSeconds: state.gameTotalSeconds,
        lastTickRealMs: state.lastTickRealMs,
      }),
    }
  )
);

export function getGameClockNow(): GameClock {
  return useGameTimeStore.getState().getClock();
}

/** @deprecated 使用 getClock().totalSeconds；保留供旧逻辑引用 */
export function minutesToClock(totalMinutes: number): GameClock {
  return secondsToClock(totalMinutes * 60);
}
