import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';
import { ANCHOR_GRADIENTS } from '../data/anchors';
import { setCustomAnchorsRegistry } from '../data/customAnchorRegistry';
import type { AnchorProfile, CustomAnchorPresets, SpeciesCategory } from '../types';

export interface CustomAnchorDraft {
  stageName: string;
  realName: string;
  age: number;
  ageLabel?: string;
  tag: string;
  personality: string;
  speakingStyle: string;
  greenTeaStyle: string;
  tipStyle: string;
  chatStyle: string;
  background: string;
  hairColor: string;
  appearance: string;
  portraitUrl: string;
  isHuman: boolean;
  species?: string;
  speciesCategory?: SpeciesCategory;
  presets: CustomAnchorPresets;
}

const EMPTY_PRESETS: CustomAnchorPresets = {
  welcomeLines: [],
  catchphrases: [],
  tipLines: [],
  activityLabels: [],
  alwaysLive: true,
};

export function createEmptyCustomDraft(): CustomAnchorDraft {
  return {
    stageName: '',
    realName: '',
    age: 22,
    tag: '自定义主播',
    personality: '',
    speakingStyle: '',
    greenTeaStyle: '',
    tipStyle: '',
    chatStyle: '',
    background: '',
    hairColor: '',
    appearance: '',
    portraitUrl: '',
    isHuman: true,
    presets: { ...EMPTY_PRESETS, alwaysLive: true },
  };
}

function draftToProfile(draft: CustomAnchorDraft, id: string, gradientIndex: number): AnchorProfile {
  const stage = draft.stageName.trim() || '未命名主播';
  return {
    id,
    realName: draft.realName.trim() || stage,
    stageName: stage,
    age: Math.max(1, Math.min(999, draft.age || 22)),
    ageLabel: draft.ageLabel?.trim() || undefined,
    personality: draft.personality.trim() || '温柔体贴，喜欢讨好观众',
    speakingStyle: draft.speakingStyle.trim() || '语气软软的，爱撒娇',
    greenTeaStyle: draft.greenTeaStyle.trim() || '偶尔暗示自己比其他主播更懂你',
    tipStyle: draft.tipStyle.trim() || '会点名具体礼物撒娇求赏',
    chatStyle: draft.chatStyle.trim() || '私信更黏人，比直播间更私密',
    background: draft.background.trim() || '玩家亲手创建的自定义主播',
    tag: draft.tag.trim() || '自定义主播',
    gradient: ANCHOR_GRADIENTS[gradientIndex % ANCHOR_GRADIENTS.length],
    avatarLetter: stage.charAt(0),
    portraitUrl: draft.portraitUrl.trim() || undefined,
    hairColor: draft.hairColor.trim() || undefined,
    appearance: draft.appearance.trim() || undefined,
    isHuman: draft.isHuman !== false,
    species: draft.isHuman === false ? draft.species?.trim() || '未知物种' : undefined,
    speciesCategory:
      draft.isHuman === false ? draft.speciesCategory ?? '魅魔' : undefined,
    isCustom: true,
    presets: {
      welcomeLines: (draft.presets.welcomeLines ?? []).map((s) => s.trim()).filter(Boolean),
      catchphrases: (draft.presets.catchphrases ?? []).map((s) => s.trim()).filter(Boolean),
      tipLines: (draft.presets.tipLines ?? []).map((s) => s.trim()).filter(Boolean),
      activityLabels: (draft.presets.activityLabels ?? []).map((s) => s.trim()).filter(Boolean),
      liveStartHour: draft.presets.liveStartHour,
      liveEndHour: draft.presets.liveEndHour,
      alwaysLive: draft.presets.alwaysLive ?? true,
    },
  };
}

interface CustomAnchorState {
  anchors: AnchorProfile[];
  createAnchor: (draft: CustomAnchorDraft) => string;
  updateAnchor: (id: string, draft: CustomAnchorDraft) => void;
  removeAnchor: (id: string) => void;
  getById: (id: string) => AnchorProfile | undefined;
}

export const useCustomAnchorStore = create<CustomAnchorState>()(
  persist(
    (set, get) => ({
      anchors: [],

      createAnchor: (draft) => {
        const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const profile = draftToProfile(draft, id, get().anchors.length);
        set((state) => {
          const anchors = [...state.anchors, profile];
          setCustomAnchorsRegistry(anchors);
          return { anchors };
        });
        return id;
      },

      updateAnchor: (id, draft) => {
        set((state) => {
          const anchors = state.anchors.map((a, i) =>
            a.id === id ? draftToProfile(draft, id, i) : a
          );
          setCustomAnchorsRegistry(anchors);
          return { anchors };
        });
      },

      removeAnchor: (id) => {
        set((state) => {
          const anchors = state.anchors.filter((a) => a.id !== id);
          setCustomAnchorsRegistry(anchors);
          return { anchors };
        });
      },

      getById: (id) => get().anchors.find((a) => a.id === id),
    }),
    {
      name: 'shenhao-custom-anchors',
      storage: idbJSONStorage,
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state?.anchors) {
          setCustomAnchorsRegistry(state.anchors);
          queueMicrotask(async () => {
            const { useAnchorStore } = await import('./useAnchorStore');
            useAnchorStore.getState().ensureInit();
            useAnchorStore.getState().tickSimulation();
          });
        }
      },
    }
  )
);

// 同步当前内存态（热更新 / 非 persist 首屏）
setCustomAnchorsRegistry(useCustomAnchorStore.getState().anchors);
useCustomAnchorStore.subscribe((state) => {
  setCustomAnchorsRegistry(state.anchors);
});


export function profileToDraft(anchor: AnchorProfile): CustomAnchorDraft {
  return {
    stageName: anchor.stageName,
    realName: anchor.realName,
    age: anchor.age,
    ageLabel: anchor.ageLabel,
    tag: anchor.tag,
    personality: anchor.personality,
    speakingStyle: anchor.speakingStyle,
    greenTeaStyle: anchor.greenTeaStyle,
    tipStyle: anchor.tipStyle ?? '',
    chatStyle: anchor.chatStyle ?? '',
    background: anchor.background,
    hairColor: anchor.hairColor ?? '',
    appearance: anchor.appearance ?? '',
    portraitUrl: anchor.portraitUrl ?? '',
    isHuman: anchor.isHuman !== false,
    species: anchor.species,
    speciesCategory: anchor.speciesCategory,
    presets: {
      welcomeLines: [...(anchor.presets?.welcomeLines ?? [])],
      catchphrases: [...(anchor.presets?.catchphrases ?? [])],
      tipLines: [...(anchor.presets?.tipLines ?? [])],
      activityLabels: [...(anchor.presets?.activityLabels ?? [])],
      liveStartHour: anchor.presets?.liveStartHour,
      liveEndHour: anchor.presets?.liveEndHour,
      alwaysLive: anchor.presets?.alwaysLive ?? true,
    },
  };
}
