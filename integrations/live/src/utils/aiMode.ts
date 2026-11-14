import { useSettingsStore } from '../stores/useSettingsStore';
import type { AiInteractionMode } from '../types';

export function getAiInteractionMode(): AiInteractionMode {
  return useSettingsStore.getState().aiInteractionMode;
}

/** 主动式：AI 会在后台持续推演；被动式：仅响应玩家操作 */
export function isActiveAiMode(): boolean {
  return getAiInteractionMode() === 'active';
}
