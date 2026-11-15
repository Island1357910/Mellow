/**
 * 主地图新手引导说明卡（置于标题与地图之间，不遮挡地图标签）
 */
export default function HubOnboardingCoach({
  stepIndex,
  totalSteps,
  title,
  lines,
  onSkip,
}) {
  return (
    <div className="hub-onboarding-layer" aria-live="polite">
      <div className="hub-onboarding-card">
        <div className="hub-onboarding-card__head">
          <span className="hub-onboarding-badge">新手引导</span>
          <span className="hub-onboarding-progress">
            {stepIndex + 1} / {totalSteps}
          </span>
        </div>
        <h3 className="hub-onboarding-card__title">请前往：{title}</h3>
        <div className="hub-onboarding-card__body">
          {lines.map((line) => (
            <p key={line} className="hub-onboarding-line">
              {line}
            </p>
          ))}
        </div>
        <p className="hub-onboarding-hint drawer-hint">
          下方地图中<strong>闪烁高亮</strong>的标签为当前目标；点选后可用顶栏「主页」返回继续引导。
        </p>
        <div className="hub-onboarding-card__actions">
          <button type="button" className="btn btn-secondary btn-small" onClick={onSkip}>
            跳过引导
          </button>
        </div>
      </div>
    </div>
  );
}
