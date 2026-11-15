import { useState, useCallback, useMemo } from 'react';
import { useUI } from '../../context/UIContext';
import Modal from '../common/Modal';
import { BAKERY_FLOOR_IMAGE_URL, getStoreFloorSpots } from '../../data/storeFloorHotspots';
import { assignPixelLabelFramesForPage } from '../../data/pixelLabelFrames';
import { PixelMapFramedLabel } from './PixelMapLabelKit';

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {React.ReactNode} [props.hintBelow]
 * @param {'business' | 'full'} [props.floorMode]
 * @param {(spotId: string) => void} [props.onBusinessSpotOpen] 营业态由父组件打开功能弹窗时传入，不再使用本组件的介绍弹窗
 * @param {boolean} [props.embedInStore] 营业页内嵌时缩短顶部说明
 */
export default function StoreFloorPlan({
  className = '',
  hintBelow,
  floorMode = 'full',
  onBusinessSpotOpen,
  embedInStore = false,
}) {
  const { navigateTo } = useUI();
  const [active, setActive] = useState(null);

  const spots = useMemo(() => getStoreFloorSpots(floorMode), [floorMode]);
  const frameUrls = useMemo(
    () => assignPixelLabelFramesForPage(`store-floor-${floorMode}`, spots.length),
    [floorMode, spots.length],
  );

  const goScroll = useCallback((id) => {
    if (!id) return;
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const spot = active ? spots.find((h) => h.id === active) : null;

  const delegateBusiness = floorMode === 'business' && typeof onBusinessSpotOpen === 'function';

  return (
    <div className={`store-floor-wrap ${className}`.trim()}>
      {!(delegateBusiness && embedInStore) && (
        <div className="store-floor-head">
          <h3 className="store-floor-title">店面导览</h3>
          <p className="store-floor-sub drawer-hint">
            {floorMode === 'full'
              ? '点击标签查看说明。营业时可从店面俯视图打开柜台/来客/记录；此处亦可跳转库存、采购、配方。'
              : '点击俯视图上的标签查看各区域说明。'}
          </p>
        </div>
      )}
      {delegateBusiness && embedInStore && (
        <p className="store-floor-sub drawer-hint store-floor-embed-hint">
          点击标签在窗口中操作：面包柜台 · 来客接待 · 今日记录
        </p>
      )}
      <div className={`store-floor-stage${delegateBusiness && embedInStore ? ' store-floor-stage--hero' : ''}`}>
        <img
          className="store-floor-bg"
          src={BAKERY_FLOOR_IMAGE_URL}
          alt="千味面包房店面俯视"
          loading="lazy"
          decoding="async"
        />
        <div className="store-floor-hotspots">
          {spots.map((h, i) => (
            <button
              key={h.id}
              type="button"
              className={`store-floor-hotspot${floorMode === 'business' ? ' store-floor-hotspot--business' : ''}`}
              style={{ left: `${h.leftPct}%`, top: `${h.topPct}%` }}
              onClick={() => {
                if (delegateBusiness) onBusinessSpotOpen(h.id);
                else setActive(h.id);
              }}
              title={h.title}
            >
              <PixelMapFramedLabel seedKey={h.id} frameUrl={frameUrls[i]}>
                {h.label}
              </PixelMapFramedLabel>
            </button>
          ))}
        </div>
      </div>
      {hintBelow}

      {spot && !delegateBusiness && (
        <Modal
          title={`🏪 ${spot.title}`}
          onClose={() => setActive(null)}
          footer={
            <div className="store-floor-modal-actions">
              {spot.navigateTo && (
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => {
                    navigateTo(spot.navigateTo);
                    setActive(null);
                  }}
                >
                  前往该页面
                </button>
              )}
              {floorMode === 'full' && spot.scrollTarget && (
                <button
                  type="button"
                  className="btn btn-accent btn-small"
                  onClick={() => {
                    goScroll(spot.scrollTarget);
                    setActive(null);
                  }}
                >
                  滚动到页面内区域
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setActive(null)}>
                关闭
              </button>
            </div>
          }
        >
          <p className="store-floor-modal-desc">{spot.description}</p>
        </Modal>
      )}
    </div>
  );
}
