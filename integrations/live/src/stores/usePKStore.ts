import { create } from 'zustand';
import type { DanmuItem } from '../types';
import { isAnchorLive } from '../utils/liveRoomEntry';
import { pickSquadDiscussionTopic } from '../data/pkDiscussion';

export const PK_DURATION_MS = 3 * 60 * 1000;

export type PKMode = 'duo' | 'squad';

interface PKStoreState {
  active: boolean;
  mode: PKMode;
  /** 参与者：duo=2，squad=4 */
  participants: string[];
  scores: Record<string, number>;
  endTime: number;
  /** 获胜者主播 id */
  winnerId: string | null;
  danmu: DanmuItem[];
  playerParticipated: boolean;
  /** 四人局主要主播（打赏目标）；二人局可为 null */
  focusAnchorId: string | null;
  /** 四人局当前共同讨论话题 */
  discussionTopic: string;
  discussionUpdatedAt: number;

  /** @deprecated 兼容旧 UI：participants[0] */
  anchorA: string | null;
  /** @deprecated 兼容旧 UI：participants[1] */
  anchorB: string | null;
  scoreA: number;
  scoreB: number;
  result: 'A' | 'B' | null;

  startDuoPK: (anchorA: string, anchorB: string) => boolean;
  startSquadPK: (ids: string[]) => boolean;
  /** @deprecated 请用 startDuoPK */
  startPK: (anchorA: string, anchorB: string) => boolean;
  addGiftToAnchor: (anchorId: string, amount: number, fromPlayer?: boolean) => void;
  /** @deprecated 二人局 side 映射 */
  addGiftToSide: (side: 'A' | 'B', amount: number, fromPlayer?: boolean) => void;
  setFocusAnchor: (anchorId: string) => void;
  rotateDiscussionTopic: () => void;
  addDanmu: (item: DanmuItem) => void;
  finishPK: () => void;
  reset: () => void;
}

function emptyScores(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

function syncDuoFields(participants: string[], scores: Record<string, number>) {
  const a = participants[0] ?? null;
  const b = participants[1] ?? null;
  return {
    anchorA: a,
    anchorB: b,
    scoreA: a ? scores[a] ?? 0 : 0,
    scoreB: b ? scores[b] ?? 0 : 0,
  };
}

export const usePKStore = create<PKStoreState>()((set, get) => ({
  active: false,
  mode: 'duo',
  participants: [],
  scores: {},
  endTime: 0,
  winnerId: null,
  danmu: [],
  playerParticipated: false,
  focusAnchorId: null,
  discussionTopic: '',
  discussionUpdatedAt: 0,
  anchorA: null,
  anchorB: null,
  scoreA: 0,
  scoreB: 0,
  result: null,

  startDuoPK: (anchorA, anchorB) => {
    if (!anchorA || !anchorB || anchorA === anchorB) return false;
    if (!isAnchorLive(anchorA) || !isAnchorLive(anchorB)) return false;
    const participants = [anchorA, anchorB];
    const scores = emptyScores(participants);
    set({
      active: true,
      mode: 'duo',
      participants,
      scores,
      endTime: Date.now() + PK_DURATION_MS,
      winnerId: null,
      danmu: [],
      playerParticipated: false,
      focusAnchorId: null,
      discussionTopic: '',
      discussionUpdatedAt: 0,
      result: null,
      ...syncDuoFields(participants, scores),
    });
    return true;
  },

  startSquadPK: (ids) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length !== 4) return false;
    if (unique.some((id) => !isAnchorLive(id))) return false;
    const participants = unique.slice(0, 4);
    const scores = emptyScores(participants);
    const topic = pickSquadDiscussionTopic();
    set({
      active: true,
      mode: 'squad',
      participants,
      scores,
      endTime: Date.now() + PK_DURATION_MS,
      winnerId: null,
      danmu: [],
      playerParticipated: false,
      focusAnchorId: participants[0],
      discussionTopic: topic,
      discussionUpdatedAt: Date.now(),
      result: null,
      ...syncDuoFields(participants, scores),
    });
    return true;
  },

  startPK: (anchorA, anchorB) => get().startDuoPK(anchorA, anchorB),

  addGiftToAnchor: (anchorId, amount, fromPlayer = false) =>
    set((state) => {
      if (!state.participants.includes(anchorId)) return state;
      const scores = {
        ...state.scores,
        [anchorId]: (state.scores[anchorId] ?? 0) + amount,
      };
      return {
        scores,
        playerParticipated: fromPlayer ? true : state.playerParticipated,
        ...syncDuoFields(state.participants, scores),
      };
    }),

  addGiftToSide: (side, amount, fromPlayer = false) => {
    const { participants, addGiftToAnchor } = get();
    const id = side === 'A' ? participants[0] : participants[1];
    if (!id) return;
    addGiftToAnchor(id, amount, fromPlayer);
  },

  setFocusAnchor: (anchorId) =>
    set((state) => {
      if (!state.participants.includes(anchorId)) return state;
      return { focusAnchorId: anchorId };
    }),

  rotateDiscussionTopic: () =>
    set({
      discussionTopic: pickSquadDiscussionTopic(get().discussionTopic),
      discussionUpdatedAt: Date.now(),
    }),

  addDanmu: (item) =>
    set((state) => ({ danmu: [...state.danmu.slice(-49), item] })),

  finishPK: () =>
    set((state) => {
      const { participants, scores, mode } = state;
      let winnerId: string | null = participants[0] ?? null;
      let best = -1;
      for (const id of participants) {
        const s = scores[id] ?? 0;
        if (s > best) {
          best = s;
          winnerId = id;
        }
      }
      const duo = syncDuoFields(participants, scores);
      const result: 'A' | 'B' | null =
        mode === 'duo'
          ? duo.scoreA >= duo.scoreB
            ? 'A'
            : 'B'
          : null;
      return {
        active: false,
        winnerId,
        result,
      };
    }),

  reset: () =>
    set({
      active: false,
      mode: 'duo',
      participants: [],
      scores: {},
      endTime: 0,
      winnerId: null,
      danmu: [],
      playerParticipated: false,
      focusAnchorId: null,
      discussionTopic: '',
      discussionUpdatedAt: 0,
      anchorA: null,
      anchorB: null,
      scoreA: 0,
      scoreB: 0,
      result: null,
    }),
}));

export function getPKState() {
  return usePKStore.getState();
}

export function getPKScore(anchorId: string): number {
  return usePKStore.getState().scores[anchorId] ?? 0;
}
