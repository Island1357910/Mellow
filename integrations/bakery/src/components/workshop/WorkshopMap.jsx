import { useMemo, useState } from 'react';
import { useUI, PAGE_IDS } from '../../context/UIContext';
import { WORKSHOP_IMAGE_URL, WORKSHOP_NAV_SPOTS } from '../../data/storeFloorHotspots';
import { assignPixelLabelFramesForPage } from '../../data/pixelLabelFrames';
import { PixelMapFramedLabel } from '../store/PixelMapLabelKit';
import Modal from '../common/Modal';
import { RecipesPage, StoryPage, CharactersPage } from '../../pages/menuPages';
import CustomOrderPage from '../../pages/CustomOrderPage';
import CompetitionPage from '../../pages/CompetitionPage';
import PrinciplePage from '../../pages/PrinciplePage';
import AchievementsPage from '../../pages/AchievementsPage';

const WORKSHOP_EMBED_PAGE = {
  recipes: RecipesPage,
  story: StoryPage,
  characters: CharactersPage,
  customOrder: CustomOrderPage,
  competition: CompetitionPage,
  principle: PrinciplePage,
  achievements: AchievementsPage,
};

const WORKSHOP_MODAL_TITLE = {
  recipes: '📜 配方',
  story: '📖 主线',
  characters: '👥 故事',
  customOrder: '📋 定制',
  competition: '🏅 比赛',
  principle: '📐 原理',
  achievements: '🎖️ 成就',
};

/** 工作室像素场景：光标打开弹窗展示子页面，关闭返回地图 */
export default function WorkshopMap() {
  const { navigateTo } = useUI();
  const [modalPage, setModalPage] = useState(null);
  const frameUrls = useMemo(
    () => assignPixelLabelFramesForPage('workshop', WORKSHOP_NAV_SPOTS.length),
    [],
  );

  const PageComp = modalPage ? WORKSHOP_EMBED_PAGE[modalPage] : null;
  const modalTitle = modalPage ? WORKSHOP_MODAL_TITLE[modalPage] : '';

  return (
    <div className="workshop-map-wrap">
      <div className="bakery-hub-head workshop-map-head">
        <h2 className="bakery-hub-title">📐 工作室</h2>
        <p className="drawer-hint bakery-hub-hint">
          新品研发与内容向玩法集中于此：配方、原理、比赛、定制与主线/人物志等。点击标签在弹窗中打开，点 ×
          回到本场景；右下角可到面包房进行当日制作流程。
        </p>
      </div>
      <div className="store-floor-stage store-floor-stage--workshop">
        <img
          className="store-floor-bg"
          src={WORKSHOP_IMAGE_URL}
          alt="工作室"
          loading="eager"
          decoding="async"
        />
        <button
          type="button"
          className="workshop-bakery-corner-btn"
          onClick={() => navigateTo(PAGE_IDS.gameBakery)}
          title="返回面包房"
        >
          🥖 面包房
        </button>
        <div className="store-floor-hotspots">
          {WORKSHOP_NAV_SPOTS.map((h, i) => (
            <button
              key={h.pageId}
              type="button"
              className={`store-floor-hotspot pixel-scene-nav-btn${modalPage === h.pageId ? ' is-current-nav' : ''}`}
              style={{
                left: `${h.leftPct}%`,
                top: `${h.topPct}%`,
                '--label-bg': h.labelBg,
                '--label-fg': h.labelFg,
                '--dot-border': h.dotBorder || '#1a1a1a',
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
              关闭返回工作室
            </button>
          )}
        >
          <div className="workshop-embed-shell">
            <PageComp
              embeddedInWorkshop={modalPage === 'story' || modalPage === 'characters'}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
