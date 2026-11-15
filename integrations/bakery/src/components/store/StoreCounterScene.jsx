import { STORE_WINDOW_IMAGE_URL, STORE_COUNTER_OVERLAY_IMAGE_URL } from '../../data/storeFloorHotspots';

/**
 * 店面分层：底层橱窗 → 中层顾客立绘 → 顶层柜台遮挡
 * @param {React.ReactNode} [floatingUI] 叠在顶层的 UI（对话框、货架等），需在 CSS 内自行 pointer-events
 */
export default function StoreCounterScene({
  portraitUrl,
  topRightSlot,
  floatingUI,
  className = '',
}) {
  return (
    <div className={`store-counter-scene ${className}`.trim()}>
      {topRightSlot ? (
        <div className="store-counter-scene-topright">
          {topRightSlot}
        </div>
      ) : null}
      <div className="store-counter-layers">
        <img
          className="store-counter-layer store-counter-window"
          src={STORE_WINDOW_IMAGE_URL}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <div className="store-counter-middle" aria-hidden={!portraitUrl}>
          {portraitUrl ? (
            <img
              className="store-counter-patron"
              src={portraitUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : null}
        </div>
        <img
          className="store-counter-layer store-counter-overlay"
          src={STORE_COUNTER_OVERLAY_IMAGE_URL}
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
      {floatingUI ? (
        <div className="store-counter-floating-ui">
          {floatingUI}
        </div>
      ) : null}
    </div>
  );
}
