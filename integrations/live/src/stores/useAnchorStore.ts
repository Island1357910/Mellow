import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';
import { getAllAnchors, getAnchorById } from '../data/anchors';
import { FAKE_NICKNAMES } from '../data/fakeDanmu';
import { pickActivityForAnchor, type AnchorActivity } from '../data/activities';
import { isAnchorLiveNow, computeLiveMap, getLiveSessionKey } from '../data/schedules';
import { getGameClockNow, useGameTimeStore } from '../stores/useGameTimeStore';
import { tickRivalScore } from '../utils/simulator';
import type { AnchorRuntimeState } from '../types';

function favorGain(amount: number): number {
  if (amount >= 100000) return 45;
  if (amount >= 50000) return 28;
  if (amount >= 10000) return 16;
  if (amount >= 5000) return 10;
  if (amount >= 1000) return 6;
  if (amount >= 52) return 2;
  if (amount >= 10) return 1;
  return 0.4;
}

function makeSessionRivals(): AnchorRuntimeState['rivals'] {
  const names = new Set<string>();
  while (names.size < 2) {
    names.add(FAKE_NICKNAMES[Math.floor(Math.random() * FAKE_NICKNAMES.length)]);
  }
  return Array.from(names).map((name) => ({
    name,
    score: Math.floor(Math.random() * 300) + 50,
  }));
}

function makeInitialRuntime(id: string): AnchorRuntimeState {
  const anchor = getAnchorById(id);
  const activity = anchor ? pickActivityForAnchor(anchor) : { icon: '🎧', label: '在听歌放空' };
  const rivals = makeSessionRivals();
  return {
    id,
    favor: Math.floor(Math.random() * 8),
    totalSpent: 0,
    liveSessionKey: '',
    liveSessionPlayerSpent: 0,
    liveSessionRivals: rivals.map((r) => ({ ...r })),
    isOnline: isAnchorLiveNow(id, getGameClockNow()),
    currentViewers: 500 + Math.floor(Math.random() * 4000),
    lastInteractAt: Date.now(),
    jealousNotifiedAt: 0,
    missNotifiedAt: 0,
    flirtNotifiedAt: 0,
    pkHelpNotifiedAt: 0,
    proactiveDmGameDay: -1,
    proactiveDmCount: 0,
    lastProactiveDmGameSec: 0,
    unansweredFollowUpMsgId: '',
    rivals,
    activity: { ...activity, changedAt: Date.now() },
  };
}

function resolveLiveLeaderboard(runtime: AnchorRuntimeState, anchorId: string) {
  const sessionKey = getLiveSessionKey(anchorId, getGameClockNow());
  if (runtime.liveSessionKey === sessionKey && runtime.liveSessionRivals?.length) {
    return {
      playerScore: runtime.liveSessionPlayerSpent ?? 0,
      rivals: runtime.liveSessionRivals,
    };
  }
  return {
    playerScore: runtime.totalSpent,
    rivals: runtime.rivals,
  };
}

interface AnchorState {
  runtime: Record<string, AnchorRuntimeState>;
  followedIds: string[];

  ensureInit: () => void;
  /** 进入直播间时确保本场直播榜单状态（同一场退出再进不重置） */
  ensureLiveSession: (anchorId: string) => void;
  getLiveLeaderboard: (anchorId: string) => { playerScore: number; rivals: AnchorRuntimeState['rivals'] };
  getRuntime: (id: string) => AnchorRuntimeState;
  isTop1: (id: string) => boolean;
  isFollowed: (id: string) => boolean;
  toggleFollow: (id: string) => void;
  follow: (id: string) => void;
  unfollow: (id: string) => void;
  addSpend: (anchorId: string, amount: number) => void;
  boostFavor: (anchorId: string, amount: number) => void;
  markInteract: (anchorId: string) => void;
  /** 进入直播间时按人设初始化一次当前事项 */
  initActivityOnLiveEntry: (anchorId: string) => void;
  /** 玩家指令改变当前事项 */
  setActivity: (anchorId: string, activity: AnchorActivity) => void;
  markVisitedOther: (currentAnchorId: string) => string[]; // 返回因为吃醋需要触发私信的主播ID列表
  tickSimulation: () => void;
  markJealousNotified: (id: string) => void;
  markMissNotified: (id: string) => void;
  markFlirtNotified: (id: string) => void;
  markPkHelpNotified: (id: string) => void;
  recordProactiveDm: (id: string) => void;
  markUnansweredFollowUp: (id: string, msgId: string) => void;
  clearUnansweredFollowUp: (id: string) => void;
}

export const useAnchorStore = create<AnchorState>()(
  persist(
    (set, get) => ({
      runtime: {},
      followedIds: [],

      ensureInit: () => {
        const runtime = { ...get().runtime };
        let changed = false;
        for (const anchor of getAllAnchors()) {
          if (!runtime[anchor.id]) {
            runtime[anchor.id] = makeInitialRuntime(anchor.id);
            changed = true;
          } else if (
            !runtime[anchor.id].activity ||
            runtime[anchor.id].proactiveDmGameDay == null ||
            runtime[anchor.id].liveSessionKey == null
          ) {
            // 兼容旧存档：补齐新增字段
            runtime[anchor.id] = { ...makeInitialRuntime(anchor.id), ...runtime[anchor.id] };
            if (!runtime[anchor.id].liveSessionRivals?.length) {
              runtime[anchor.id].liveSessionRivals = makeSessionRivals();
            }
            changed = true;
          }
        }
        if (changed) set({ runtime });
      },

      ensureLiveSession: (anchorId) =>
        set((state) => {
          const sessionKey = getLiveSessionKey(anchorId, getGameClockNow());
          const prev = state.runtime[anchorId] ?? makeInitialRuntime(anchorId);
          if (prev.liveSessionKey === sessionKey) {
            return state;
          }
          const anchor = getAnchorById(anchorId);
          const activity = anchor ? pickActivityForAnchor(anchor) : { icon: '🎧', label: '在听歌放空' };
          const rivals = makeSessionRivals();
          return {
            runtime: {
              ...state.runtime,
              [anchorId]: {
                ...prev,
                liveSessionKey: sessionKey,
                liveSessionPlayerSpent: 0,
                liveSessionRivals: rivals,
                activity: { ...activity, changedAt: Date.now() },
              },
            },
          };
        }),

      getLiveLeaderboard: (anchorId) => {
        const r = get().runtime[anchorId];
        if (!r) return { playerScore: 0, rivals: [] };
        return resolveLiveLeaderboard(r, anchorId);
      },

      getRuntime: (id) => {
        const r = get().runtime[id];
        if (r) return r;
        const created = makeInitialRuntime(id);
        set((state) => ({ runtime: { ...state.runtime, [id]: created } }));
        return created;
      },

      isTop1: (id) => {
        const r = get().runtime[id];
        if (!r) return false;
        const { playerScore, rivals } = resolveLiveLeaderboard(r, id);
        return rivals.every((rival) => playerScore >= rival.score);
      },

      isFollowed: (id) => get().followedIds.includes(id),

      follow: (id) =>
        set((state) =>
          state.followedIds.includes(id)
            ? state
            : { followedIds: [...state.followedIds, id] }
        ),

      unfollow: (id) =>
        set((state) => ({ followedIds: state.followedIds.filter((x) => x !== id) })),

      toggleFollow: (id) => {
        if (get().isFollowed(id)) get().unfollow(id);
        else get().follow(id);
      },

      addSpend: (anchorId, amount) =>
        set((state) => {
          const prev = state.runtime[anchorId] ?? makeInitialRuntime(anchorId);
          const sessionKey = getLiveSessionKey(anchorId, getGameClockNow());
          const inSameSession = prev.liveSessionKey === sessionKey;
          const nextFavor = Math.min(100, prev.favor + favorGain(amount));
          return {
            runtime: {
              ...state.runtime,
              [anchorId]: {
                ...prev,
                totalSpent: prev.totalSpent + amount,
                liveSessionPlayerSpent: inSameSession
                  ? (prev.liveSessionPlayerSpent ?? 0) + amount
                  : prev.liveSessionPlayerSpent ?? 0,
                favor: nextFavor,
                lastInteractAt: Date.now(),
              },
            },
          };
        }),

      boostFavor: (anchorId, amount) =>
        set((state) => {
          const prev = state.runtime[anchorId] ?? makeInitialRuntime(anchorId);
          return {
            runtime: {
              ...state.runtime,
              [anchorId]: {
                ...prev,
                favor: Math.min(100, prev.favor + amount),
                lastInteractAt: Date.now(),
              },
            },
          };
        }),

      markInteract: (anchorId) =>
        set((state) => {
          const prev = state.runtime[anchorId] ?? makeInitialRuntime(anchorId);
          return {
            runtime: {
              ...state.runtime,
              [anchorId]: { ...prev, lastInteractAt: Date.now() },
            },
          };
        }),

      initActivityOnLiveEntry: (anchorId) => {
        get().ensureLiveSession(anchorId);
      },

      setActivity: (anchorId, activity) =>
        set((state) => {
          const prev = state.runtime[anchorId] ?? makeInitialRuntime(anchorId);
          return {
            runtime: {
              ...state.runtime,
              [anchorId]: {
                ...prev,
                activity: { ...activity, changedAt: Date.now() },
                lastInteractAt: Date.now(),
              },
            },
          };
        }),

      markVisitedOther: (currentAnchorId) => {
        const state = get();
        const jealousIds: string[] = [];
        const now = Date.now();
        const updated: Record<string, AnchorRuntimeState> = { ...state.runtime };
        for (const anchor of getAllAnchors()) {
          if (anchor.id === currentAnchorId) continue;
          const r = updated[anchor.id];
          if (!r) continue;
          // 好感度中等以上、且最近有互动过的主播才会吃醋
          if (r.favor >= 25 && now - r.jealousNotifiedAt > 3 * 60 * 1000) {
            jealousIds.push(anchor.id);
            updated[anchor.id] = { ...r, jealousNotifiedAt: now };
          }
        }
        set({ runtime: updated });
        return jealousIds;
      },

      markJealousNotified: (id) =>
        set((state) => {
          const prev = state.runtime[id];
          if (!prev) return {};
          return {
            runtime: { ...state.runtime, [id]: { ...prev, jealousNotifiedAt: Date.now() } },
          };
        }),

      markMissNotified: (id) =>
        set((state) => {
          const prev = state.runtime[id];
          if (!prev) return {};
          return {
            runtime: { ...state.runtime, [id]: { ...prev, missNotifiedAt: Date.now() } },
          };
        }),

      markFlirtNotified: (id) =>
        set((state) => {
          const prev = state.runtime[id];
          if (!prev) return {};
          return {
            runtime: { ...state.runtime, [id]: { ...prev, flirtNotifiedAt: Date.now() } },
          };
        }),

      markPkHelpNotified: (id) =>
        set((state) => {
          const prev = state.runtime[id];
          if (!prev) return {};
          return {
            runtime: { ...state.runtime, [id]: { ...prev, pkHelpNotifiedAt: Date.now() } },
          };
        }),

      recordProactiveDm: (id) =>
        set((state) => {
          const prev = state.runtime[id] ?? makeInitialRuntime(id);
          const clock = useGameTimeStore.getState().getClock();
          const nowSec = clock.totalSeconds;
          let r = prev;
          if (r.proactiveDmGameDay !== clock.day) {
            r = { ...r, proactiveDmGameDay: clock.day, proactiveDmCount: 0 };
          }
          return {
            runtime: {
              ...state.runtime,
              [id]: {
                ...r,
                proactiveDmCount: r.proactiveDmCount + 1,
                lastProactiveDmGameSec: nowSec,
              },
            },
          };
        }),

      markUnansweredFollowUp: (id, msgId) =>
        set((state) => {
          const prev = state.runtime[id];
          if (!prev) return {};
          return {
            runtime: { ...state.runtime, [id]: { ...prev, unansweredFollowUpMsgId: msgId } },
          };
        }),

      clearUnansweredFollowUp: (id) =>
        set((state) => {
          const prev = state.runtime[id];
          if (!prev) return {};
          return {
            runtime: { ...state.runtime, [id]: { ...prev, unansweredFollowUpMsgId: '' } },
          };
        }),

      tickSimulation: () =>
        set((state) => {
          const clock = useGameTimeStore.getState().getClock();
          const liveMap = computeLiveMap(clock);
          const updated: Record<string, AnchorRuntimeState> = { ...state.runtime };
          for (const id of Object.keys(updated)) {
            const r = updated[id];
            const sessionKey = getLiveSessionKey(id, clock);
            const inSameSession = r.liveSessionKey === sessionKey;
            updated[id] = {
              ...r,
              isOnline: liveMap.get(id) ?? false,
              rivals: r.rivals.map((rival) => ({
                ...rival,
                score: tickRivalScore(rival.score),
              })),
              liveSessionRivals: inSameSession
                ? (r.liveSessionRivals ?? r.rivals).map((rival) => ({
                    ...rival,
                    score: tickRivalScore(rival.score),
                  }))
                : r.liveSessionRivals,
              currentViewers: Math.max(
                200,
                r.currentViewers + Math.floor(Math.random() * 60) - 25
              ),
            };
          }
          return { runtime: updated };
        }),
    }),
    {
      name: 'shenhao_anchor',
      storage: idbJSONStorage,
    }
  )
);
