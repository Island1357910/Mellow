import { useMemo } from 'react';
import { useUI } from '../../context/UIContext';
import { BAKERY_FLOOR_IMAGE_URL, HUB_NAV_SPOTS } from '../../data/storeFloorHotspots';
import { assignPixelLabelFramesForPage } from '../../data/pixelLabelFrames';
import { useHubOnboarding } from '../../hooks/useHubOnboarding';
import HubOnboardingCoach from '../onboarding/HubOnboardingCoach';
import { PixelMapFramedLabel } from './PixelMapLabelKit';

/** 主页面：面包房像素底图 + 标签框导航 */
export default function BakeryHubMap() {
  const { navigateTo, activePage } = useUI();
  const onboarding = useHubOnboarding();
  const frameUrls = useMemo(
    () => assignPixelLabelFramesForPage('bakery-hub', HUB_NAV_SPOTS.length),
    [],
  );

  return (
    <div className="bakery-hub-wrap">
      <div className="bakery-hub-head">
        <h2 className="bakery-hub-title">🍞 千味面包房</h2>
        <p className="drawer-hint bakery-hub-hint">
          <strong>经营链</strong>：采购 → 工坊（仓库管理）→ 面包房（制作）→ 店面（销售）。
          <strong> 新品研发链</strong>：工作室（配方、原理、比赛与剧情等）。
          点击彩色标签进入。
        </p>
      </div>
      {onboarding.showHubCoach && onboarding.currentStepDef ? (
        <HubOnboardingCoach
          stepIndex={onboarding.hubStep}
          totalSteps={onboarding.totalSteps}
          title={onboarding.currentStepDef.title}
          lines={onboarding.currentStepDef.lines}
          onSkip={onboarding.skipHubOnboarding}
        />
      ) : null}
      <div className="store-floor-stage store-floor-stage--hub store-floor-stage--hub-onboarding-host">
        <img
          className="store-floor-bg"
          src={BAKERY_FLOOR_IMAGE_URL}
          alt="面包房主地图"
          loading="eager"
          decoding="async"
        />
        {onboarding.showHubCoach ? (
          <div className="hub-onboarding-map-dim" aria-hidden />
        ) : null}
        <div className="store-floor-hotspots">
          {HUB_NAV_SPOTS.map((h, i) => (
            <button
              key={h.pageId}
              type="button"
              className={`store-floor-hotspot pixel-scene-nav-btn store-hub-pixel-nav${
                activePage === h.pageId ? ' is-current-nav' : ''
              }${
                onboarding.showHubCoach && onboarding.isExpectedSpot(h.pageId)
                  ? ' hub-onboarding-target'
                  : ''
              }`}
              style={{
                left: `${h.leftPct}%`,
                top: `${h.topPct}%`,
                '--label-bg': h.labelBg,
                '--label-fg': h.labelFg,
                '--dot-border': h.dotBorder || '#141414',
              }}
              onClick={() => navigateTo(h.pageId)}
              title={h.label}
            >
              <PixelMapFramedLabel seedKey={h.pageId} frameUrl={frameUrls[i]}>
                {h.label}
              </PixelMapFramedLabel>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
