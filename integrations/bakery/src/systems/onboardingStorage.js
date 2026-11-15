import { HUB_ONBOARDING_EVENT } from '../data/hubOnboarding';

const STORAGE_KEY = 'qianwei_bakery_onboarding';

/**
 * @returns {{ done: boolean, step: number }}
 */
export function loadHubOnboarding() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { done: false, step: 0 };
    const j = JSON.parse(raw);
    const hub = j?.hub;
    return {
      done: Boolean(hub?.done),
      step: Math.max(0, Math.min(Number(hub?.step) || 0, 1e6)),
    };
  } catch {
    return { done: false, step: 0 };
  }
}

export function saveHubOnboarding({ done, step }) {
  try {
    const prevRaw = localStorage.getItem(STORAGE_KEY);
    let prev = {};
    try {
      prev = prevRaw ? JSON.parse(prevRaw) : {};
    } catch {
      prev = {};
    }
    const next = { ...prev, hub: { done: Boolean(done), step: Math.max(0, step) } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(HUB_ONBOARDING_EVENT));
  } catch {
    /* ignore */
  }
}

/** 重新开始主页新手引导（设置页等调用） */
export function resetHubOnboarding() {
  saveHubOnboarding({ done: false, step: 0 });
}
