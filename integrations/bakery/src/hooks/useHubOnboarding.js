import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { PAGE_IDS, useUI } from '../context/UIContext';
import { HUB_ONBOARDING_EVENT, HUB_ONBOARDING_STEPS } from '../data/hubOnboarding';
import { loadHubOnboarding, saveHubOnboarding } from '../systems/onboardingStorage';

export function useHubOnboarding() {
  const { activePage } = useUI();
   
  const { notify } = useGame();
  const [hubDone, setHubDone] = useState(() => loadHubOnboarding().done);
  const [hubStep, setHubStep] = useState(() => loadHubOnboarding().step);
  const prevPageRef = useRef(activePage);

  const syncFromStorage = useCallback(() => {
    const { done, step } = loadHubOnboarding();
    setHubDone(done);
    setHubStep(step);
  }, []);

  useEffect(() => {
    const on = () => syncFromStorage();
    window.addEventListener(HUB_ONBOARDING_EVENT, on);
    return () => window.removeEventListener(HUB_ONBOARDING_EVENT, on);
  }, [syncFromStorage]);

  useEffect(() => {
    if (hubDone) {
      prevPageRef.current = activePage;
      return;
    }
    const prev = prevPageRef.current;
    prevPageRef.current = activePage;

    const expected = HUB_ONBOARDING_STEPS[hubStep];
    if (!expected) {
      setHubDone(true);
      saveHubOnboarding({ done: true, step: hubStep });
      return;
    }

    if (prev === PAGE_IDS.hub && activePage === expected.pageId) {
      const next = hubStep + 1;
      if (next >= HUB_ONBOARDING_STEPS.length) {
        setHubDone(true);
        saveHubOnboarding({ done: true, step: next });
        notify('新手引导已完成！可随时从顶栏「主页」回到地图。', 'success');
      } else {
        setHubStep(next);
        saveHubOnboarding({ done: false, step: next });
        notify(`已了解「${expected.title}」。需要继续时，请点顶栏「主页」返回地图。`, 'info');
      }
    } else if (prev === PAGE_IDS.hub && activePage !== PAGE_IDS.hub && activePage !== expected.pageId) {
      notify(`请按指引先进入「${expected.title}」（闪烁的标签）。仍可从侧栏前往其它页面。`, 'info');
    }
  }, [activePage, hubStep, hubDone, notify]);

  const skipHubOnboarding = useCallback(() => {
    setHubDone(true);
    saveHubOnboarding({ done: true, step: hubStep });
    notify('已跳过新手引导，稍后可到「设置」重新开启。', 'info');
  }, [hubStep, notify]);

  const showHubCoach =
    !hubDone && hubStep < HUB_ONBOARDING_STEPS.length && activePage === PAGE_IDS.hub;

  const currentStepDef = HUB_ONBOARDING_STEPS[hubStep] ?? null;

  return {
    showHubCoach,
    hubDone,
    hubStep,
    currentStepDef,
    totalSteps: HUB_ONBOARDING_STEPS.length,
    skipHubOnboarding,
    isExpectedSpot: (pageId) => currentStepDef?.pageId === pageId,
  };
}
