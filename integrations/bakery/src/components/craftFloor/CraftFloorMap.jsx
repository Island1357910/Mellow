import { useMemo, useState } from 'react';
import { useUI, PAGE_IDS } from '../../context/UIContext';
import { CRAFT_FLOOR_IMAGE_URL, CRAFT_FLOOR_NAV_SPOTS } from '../../data/storeFloorHotspots';
import { assignPixelLabelFramesForPage } from '../../data/pixelLabelFrames';
import { PixelMapFramedLabel } from '../store/PixelMapLabelKit';
import Modal from '../common/Modal';
import { FillingLabPage, InventoryPage, ExplorationPage } from '../../pages/menuPages';

const CRAFT_MODAL_PAGE = {
  filling: FillingLabPage,
  inventory: InventoryPage,
  explore: ExplorationPage,
};

const CRAFT_MODAL_TITLE = {
  filling: '🥣 馅料',
  inventory: '📦 库存',
  explore: '🔭 探索',
};

/** 工坊像素场景：光标打开弹窗（馅料 / 库存 / 探索），关闭返回工坊 */
export default function CraftFloorMap() {
  const { navigateTo } = useUI();
  const [modalPage, setModalPage] = useState(null);
  const frameUrls = useMemo(
    () => assignPixelLabelFramesForPage('craft-floor', CRAFT_FLOOR_NAV_SPOTS.length),
    [],
  );

  const PageComp = modalPage ? CRAFT_MODAL_PAGE[modalPage] : null;
  const modalTitle = modalPage ? CRAFT_MODAL_TITLE[modalPage] : '';

  return (
    <div className="craft-floor-map-wrap workshop-map-wrap">
      <div className="bakery-hub-head workshop-map-head">
        <h2 className="bakery-hub-title">🧰 工坊</h2>
        <p className="drawer-hint bakery-hub-hint">
          经营链中的「仓库管理」入口：库存、馅料与探索。点击彩色标签在弹窗中打开；关闭后回到工坊。右下角返回主页。
        </p>
      </div>
      <div className="store-floor-stage store-floor-stage--craft-floor">
        <img
          className="store-floor-bg"
          src={CRAFT_FLOOR_IMAGE_URL}
          alt="工坊"
          loading="eager"
          decoding="async"
        />
        <button
          type="button"
          className="workshop-bakery-corner-btn craft-floor-hub-btn"
          onClick={() => navigateTo(PAGE_IDS.hub)}
          title="返回主页"
        >
          🏠 主页
        </button>
        <div className="store-floor-hotspots">
          {CRAFT_FLOOR_NAV_SPOTS.map((h, i) => (
            <button
              key={h.pageId}
              type="button"
              className={`store-floor-hotspot pixel-scene-nav-btn craft-floor-hotspot${
                modalPage === h.pageId ? ' is-current-nav' : ''
              }`}
              style={{
                left: `${h.leftPct}%`,
                top: `${h.topPct}%`,
                '--label-bg': h.labelBg,
                '--label-fg': h.labelFg,
                '--dot-border': h.dotBorder || '#141414',
              }}
              onClick={() => setModalPage(h.pageId)}
              title={h.label}
            >
              <PixelMapFramedLabel seedKey={h.pageId} frameUrl={frameUrls[i]}>
                {h.label}
              </PixelMapFramedLabel>
            </button>
          ))}
        </div>
      </div>

      {PageComp && (
        <Modal
          wide
          title={modalTitle}
          onClose={() => setModalPage(null)}
          footer={(
            <button type="button" className="btn btn-secondary" onClick={() => setModalPage(null)}>
              关闭返回工坊
            </button>
          )}
        >
          <div className="workshop-embed-shell">
            <PageComp />
          </div>
        </Modal>
      )}
    </div>
  );
}
