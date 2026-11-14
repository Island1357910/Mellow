import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';
import type { SpendRecord } from '../types';

interface PlayerState {
  playerName: string;
  hasOnboarded: boolean;
  totalSpentAll: number;
  spendRecords: SpendRecord[];
  currentLiveAnchorId: string | null;
  /** 已开启开播提醒的主播 ID */
  scheduleReminders: string[];
  /** 今日已弹窗提醒过的 key（anchorId-date） */
  scheduleNotifiedKeys: string[];

  completeOnboarding: (name: string) => void;
  addSpendRecord: (record: Omit<SpendRecord, 'id' | 'timestamp' | 'kind'>) => void;
  setCurrentLiveAnchor: (id: string | null) => void;
  toggleScheduleReminder: (anchorId: string) => void;
  markScheduleNotified: (key: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      playerName: '',
      hasOnboarded: false,
      totalSpentAll: 0,
      spendRecords: [],
      currentLiveAnchorId: null,
      scheduleReminders: [],
      scheduleNotifiedKeys: [],

      completeOnboarding: (name) =>
        set({ playerName: name.trim() || '神秘女王', hasOnboarded: true }),

      addSpendRecord: (record) =>
        set((state) => ({
          totalSpentAll: state.totalSpentAll + record.price,
          spendRecords: [
            {
              ...record,
              kind: 'virtual' as const,
              id: `spend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              timestamp: Date.now(),
            },
            ...state.spendRecords,
          ].slice(0, 500),
        })),

      setCurrentLiveAnchor: (id) => set({ currentLiveAnchorId: id }),

      toggleScheduleReminder: (anchorId) =>
        set((state) => ({
          scheduleReminders: state.scheduleReminders.includes(anchorId)
            ? state.scheduleReminders.filter((x) => x !== anchorId)
            : [...state.scheduleReminders, anchorId],
        })),

      markScheduleNotified: (key) =>
        set((state) => ({
          scheduleNotifiedKeys: [...new Set([...state.scheduleNotifiedKeys, key])].slice(-200),
        })),
    }),
    {
      name: 'shenhao_player',
      storage: idbJSONStorage,
    }
  )
);
