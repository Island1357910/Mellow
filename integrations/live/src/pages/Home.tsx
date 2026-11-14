import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatGameClock, useGameTimeStore } from '../stores/useGameTimeStore';
import StatusBar from '../components/Phone/StatusBar';
import PostcardWidget from '../components/Home/PostcardWidget';
import DesktopAppButton from '../components/Home/DesktopAppButton';
import TimeAdjustSheet from '../components/Home/TimeAdjustSheet';
import { useNavStore } from '../stores/useNavStore';
import { useChatStore } from '../stores/useChatStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { usePKStore } from '../stores/usePKStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { getAnchorById } from '../data/anchors';
import {
  DEFAULT_RECENT_APPS,
  DEFAULT_WIDGET_BOTTOM_IMAGE,
  DEFAULT_WIDGET_TOP_IMAGE,
  DESKTOP_BOTTOM_APPS,
  DESKTOP_TOP_APPS,
  type AppIconKey,
} from '../data/appearance';
import {
  resolveAppIcon,
  resolveHomeBackground,
  resolveWallpaperImageUrl,
  resolveWallpaperLabel,
  type AppearanceSettings,
} from '../utils/appearanceResolver';
import { resolveHomeTextColors } from '../utils/homeTextColor';

const APP_SCREEN_MAP: Record<AppIconKey, string> = {
  liveList: 'liveList',
  socialFeed: 'socialFeed',
  chatList: 'chatList',
  shop: 'shop',
  delivery: 'delivery',
  wallet: 'wallet',
  music: 'music',
  settings: 'settings',
};

const SWIPE_THRESHOLD = 48;

/** 欢迎页文字固定黑色，不受设置影响 */
const WELCOME_TEXT = {
  main: '#000000',
  sub: '#525252',
  label: '#404040',
};

export default function Home() {
  const push = useNavStore((s) => s.push);
  const hasUnread = useChatStore((s) => Object.values(s.sessions).some((sess) => sess.unread));
  const playerName = usePlayerStore((s) => s.playerName);
  const pkActive = usePKStore((s) => s.active);
  const pkMode = usePKStore((s) => s.mode);
  const pkParticipants = usePKStore((s) => s.participants);
  const pkAnchorAId = usePKStore((s) => s.anchorA);
  const pkAnchorBId = usePKStore((s) => s.anchorB);
  const gameTotalSeconds = useGameTimeStore((s) => s.gameTotalSeconds);

  const appearance = useSettingsStore(
    useShallow((s) => ({
      wallpaperId: s.wallpaperId,
      customWallpaperUrl: s.customWallpaperUrl,
      fontId: s.fontId,
      customFontUrl: s.customFontUrl,
      iconStyleId: s.iconStyleId,
      customIconUrls: s.customIconUrls,
    }))
  );
  const widgetTopImageUrl = useSettingsStore((s) => s.widgetTopImageUrl) || DEFAULT_WIDGET_TOP_IMAGE;
  const widgetBottomImageUrl = useSettingsStore((s) => s.widgetBottomImageUrl) || DEFAULT_WIDGET_BOTTOM_IMAGE;
  const recentAppKeys = useSettingsStore((s) => s.recentAppKeys) ?? DEFAULT_RECENT_APPS;
  const homeTextColorId = useSettingsStore((s) => s.homeTextColorId) ?? 'auto';
  const customHomeTextColor = useSettingsStore((s) => s.customHomeTextColor) ?? '#ffffff';
  const homePage = useSettingsStore((s) => s.homeDesktopPage) ?? 0;
  const recordAppOpen = useSettingsStore((s) => s.recordAppOpen);
  const setHomeDesktopPage = useSettingsStore((s) => s.setHomeDesktopPage);

  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);

  const display = formatGameClock(useGameTimeStore.getState().getClock());
  void gameTotalSeconds;

  const wallpaperImage = resolveWallpaperImageUrl(appearance);
  const homeBg = resolveHomeBackground(appearance);
  const wallpaperLabel = resolveWallpaperLabel(appearance);
  const isDark = appearance.wallpaperId === 'night';
  const appTextColors = resolveHomeTextColors(homeTextColorId, customHomeTextColor, isDark);
  const cardBg = isDark ? 'border-indigo-400/30 bg-indigo-950/45' : 'border-white/70 bg-white/65';

  const pkAnchorA = pkAnchorAId ? getAnchorById(pkAnchorAId) : null;
  const pkAnchorB = pkAnchorBId ? getAnchorById(pkAnchorBId) : null;

  const openApp = (key: AppIconKey) => {
    setHomeDesktopPage(1);
    recordAppOpen(key);
    push(APP_SCREEN_MAP[key] as Parameters<typeof push>[0]);
  };

  const dockApps = (
    (recentAppKeys?.length ? recentAppKeys : DEFAULT_RECENT_APPS).filter((k) =>
      Object.prototype.hasOwnProperty.call(APP_SCREEN_MAP, k)
    ) as AppIconKey[]
  )
    .concat(DEFAULT_RECENT_APPS)
    .filter((k, i, arr) => arr.indexOf(k) === i)
    .slice(0, 4);

  const bgStyle = wallpaperImage
    ? {
        backgroundImage: `url("${wallpaperImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundImage: homeBg };

  const goToPage = (page: 0 | 1) => setHomeDesktopPage(page);

  const handleSwipe = (dx: number, dy: number) => {
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0 && homePage < 1) goToPage(1);
    if (dx > 0 && homePage > 0) goToPage(0);
  };

  const isSwipeBlockedTarget = (target: EventTarget | null) =>
    !!(target as HTMLElement | null)?.closest(
      'button, a, input, textarea, select, label, [data-page-arrow]'
    );

  const beginSwipe = (clientX: number, clientY: number) => {
    dragStartX.current = clientX;
    dragStartY.current = clientY;
    isDragging.current = true;
  };

  const finishSwipe = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    activePointerId.current = null;
    handleSwipe(clientX - dragStartX.current, clientY - dragStartY.current);
  };

  const cancelSwipe = () => {
    isDragging.current = false;
    activePointerId.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isSwipeBlockedTarget(e.target)) return;

    beginSwipe(e.clientX, e.clientY);
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    finishSwipe(e.clientX, e.clientY);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    cancelSwipe();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isSwipeBlockedTarget(e.target)) return;
    const touch = e.touches[0];
    if (!touch) return;
    beginSwipe(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    finishSwipe(touch.clientX, touch.clientY);
  };

  const handleTouchCancel = () => {
    cancelSwipe();
  };

  return (
    <div className="relative flex h-full flex-col" style={bgStyle}>
      <StatusBar />

      <div
        className="home-swipe-area relative min-h-0 flex-1 overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${homePage * 100}%)` }}
        >
          {/* 第一页：欢迎与信息 */}
          <div className="flex h-full w-full shrink-0 flex-col px-6 pt-12 pb-8">
            <button
              type="button"
              className="text-left active:opacity-80"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setTimeSheetOpen(true)}
            >
              <p
                className="text-[4.5rem] font-extralight leading-none tracking-tight"
                style={{ color: appTextColors.main }}
              >
                {display.time}
              </p>
              <p className="mt-3 text-base" style={{ color: appTextColors.sub }}>
                {display.date}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: appTextColors.sub }}>
                点击调整时间 · 跳到心仪主播开播
              </p>
            </button>

            <div className={`mt-6 max-w-[85%] rounded-2xl border px-4 py-3.5 text-left shadow-sm backdrop-blur-md ${cardBg}`}>
              <p className="text-xs" style={{ color: WELCOME_TEXT.sub }}>
                欢迎回来
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: WELCOME_TEXT.main }}>
                {playerName || '神秘女王'}
              </p>
              <p className="mt-2 text-[11px]" style={{ color: WELCOME_TEXT.sub }}>
                壁纸 · {wallpaperLabel}
              </p>
              <p className="mt-2 text-[10px]" style={{ color: WELCOME_TEXT.sub }}>
                向右滑动进入应用桌面 →
              </p>
            </div>

            {pkActive && (pkMode === 'squad' ? pkParticipants.length === 4 : !!(pkAnchorA && pkAnchorB)) && (
              <button
                type="button"
                onClick={() => push('pkRoom')}
                onPointerDown={(e) => e.stopPropagation()}
                className={`mt-4 max-w-[85%] flex items-center gap-2 rounded-2xl border px-4 py-3 text-left shadow-sm backdrop-blur-md active:scale-[0.98] transition ${
                  isDark ? 'border-white/20 bg-black/45' : 'border-[#cfd9de] bg-white/80'
                }`}
              >
                <span className="text-[11px] font-black text-[#9b5cff]">
                  {pkMode === 'squad' ? '四人PK' : 'PK'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: WELCOME_TEXT.label }}>
                  {pkMode === 'squad' ? (
                    <>
                      <span className="font-semibold" style={{ color: WELCOME_TEXT.main }}>
                        {pkParticipants
                          .slice(0, 2)
                          .map((id) => getAnchorById(id)?.stageName)
                          .filter(Boolean)
                          .join('、')}
                      </span>{' '}
                      等四人连麦对战中
                    </>
                  ) : (
                    <>
                      <span className="font-semibold" style={{ color: WELCOME_TEXT.main }}>
                        {pkAnchorA!.stageName}
                      </span>{' '}
                      正在和{' '}
                      <span className="font-semibold" style={{ color: WELCOME_TEXT.main }}>
                        {pkAnchorB!.stageName}
                      </span>{' '}
                      对战
                    </>
                  )}
                </span>
                <span className="shrink-0 rounded-full bg-[#9b5cff] px-2.5 py-1 text-[10px] font-bold text-white">
                  围观
                </span>
              </button>
            )}

            <div className="flex-1" />
          </div>

          {/* 第二页：应用桌面 */}
          <div className="flex h-full w-full shrink-0 flex-col px-4 pt-3">
            <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-4 gap-x-2 gap-y-3">
              <div className="col-span-2 row-span-2">
                <PostcardWidget imageUrl={widgetTopImageUrl} tilt="left" isDark={isDark} />
              </div>
              <div className="col-span-2 row-span-2 grid grid-cols-2 grid-rows-2 place-items-center gap-1">
                {DESKTOP_TOP_APPS.map((key) => (
                  <DesktopAppButton
                    key={key}
                    appKey={key}
                    appearance={appearance}
                    labelColor={appTextColors.label}
                    onOpen={openApp}
                    showBadge={key === 'chatList' && hasUnread}
                  />
                ))}
              </div>

              <div className="col-span-2 row-span-2 grid grid-cols-2 grid-rows-2 place-items-center gap-1">
                {DESKTOP_BOTTOM_APPS.map((key) => (
                  <DesktopAppButton
                    key={key}
                    appKey={key}
                    appearance={appearance}
                    labelColor={appTextColors.label}
                    onOpen={openApp}
                    showBadge={key === 'chatList' && hasUnread}
                  />
                ))}
              </div>
              <div className="col-span-2 row-span-2">
                <PostcardWidget imageUrl={widgetBottomImageUrl} tilt="right" isDark={isDark} />
              </div>
            </div>

            <div className="pt-2 pb-4">
              <div
                className={`flex items-center justify-around rounded-3xl border py-2.5 shadow-sm backdrop-blur-md ${
                  isDark ? 'border-indigo-400/30 bg-indigo-950/45' : 'border-white/70 bg-white/60'
                }`}
              >
                {dockApps.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openApp(key)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="relative flex h-10 w-10 items-center justify-center rounded-xl active:scale-90 transition"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/30 bg-white/15">
                      <DesktopAppIcon appKey={key} appearance={appearance} />
                    </div>
                    {key === 'chatList' && hasUnread && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-center text-[9px]" style={{ color: appTextColors.sub }}>
                最近使用
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          data-page-arrow
          aria-label="上一页"
          disabled={homePage === 0}
          onClick={() => goToPage(0)}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition active:scale-95 ${
            homePage === 0
              ? 'pointer-events-none border-white/20 bg-white/10 opacity-0'
              : isDark
                ? 'border-indigo-300/40 bg-indigo-950/55 text-white/90'
                : 'border-white/70 bg-white/65 text-slate-700'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          type="button"
          data-page-arrow
          aria-label="下一页"
          disabled={homePage === 1}
          onClick={() => goToPage(1)}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition active:scale-95 ${
            homePage === 1
              ? 'pointer-events-none border-white/20 bg-white/10 opacity-0'
              : isDark
                ? 'border-indigo-300/40 bg-indigo-950/55 text-white/90'
                : 'border-white/70 bg-white/65 text-slate-700'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 pb-4">
        {[0, 1].map((page) => (
          <button
            key={page}
            type="button"
            aria-label={page === 0 ? '欢迎页' : '应用页'}
            onClick={() => goToPage(page as 0 | 1)}
            className={`h-1.5 rounded-full transition-all ${
              homePage === page ? 'w-5 bg-pink-400' : 'w-1.5 bg-white/50'
            }`}
          />
        ))}
      </div>

      <TimeAdjustSheet open={timeSheetOpen} onClose={() => setTimeSheetOpen(false)} />
    </div>
  );
}

function DesktopAppIcon({ appKey, appearance }: { appKey: AppIconKey; appearance: AppearanceSettings }) {
  const icon = resolveAppIcon(appKey, appearance);
  if (icon.kind === 'image') {
    return <img src={icon.url} alt="" className="h-6 w-6 rounded-md object-cover" />;
  }
  return <span className="text-lg">{icon.value}</span>;
}
