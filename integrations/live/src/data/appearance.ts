import type { FontPresetId, HomeTextColorId, IconStyleId, WallpaperId } from '../types';

const PHOTO1 =
  'https://drive-cdn.mujian.me/17/5a96b829-2572-49c1-9d48-52f234244043_Image_1781251004368_240.png';
const PHOTO2 =
  'https://drive-cdn.mujian.me/17/f2b0907c-eca3-4d2a-851b-97a1b6ec63dc_OPLUSDRAG_com.xingin.xhs_NoteXYImageView_2026-06-%284%29.png';
const PHOTO3 =
  'https://drive-cdn.mujian.me/17/1c7480e2-2ad1-4c20-8470-41ec615d350f_OPLUSDRAG_com.xingin.xhs_NoteXYImageView_2026-06-%286%29.png';
const PHOTO4 =
  'https://drive-cdn.mujian.me/17/a3a8a16c-9f5a-4533-8728-7a430e363101_OPLUSDRAG_com.xingin.xhs_NoteXYImageView_2026-06-%289%29.png';
const PHOTO5 =
  'https://drive-cdn.mujian.me/17/8527dc1e-5945-438f-929c-18895a5ac731_OPLUSDRAG_com.xingin.xhs_NoteXYImageView_2026-05-%288%29.png';

/** 主屏默认底图（欢迎页与桌面默认壁纸） */
export const HOME_DEFAULT_WALLPAPER_URL =
  'https://drive-cdn.mujian.me/17/adc07d4f-5f39-4d3c-8a9d-8f10278f9e2a_mmexport1783947063258.png';
const PHOTO_ALT_1 =
  'https://drive-cdn.mujian.me/17/a5a6b47d-37ab-4e30-8042-9405993c1fcc_mmexport1783951928570.png';
const PHOTO_ALT_2 =
  'https://drive-cdn.mujian.me/17/9a05bec8-2eb8-491a-bfa6-1ceacb9a822b_mmexport1783953211547.png';

export const DEFAULT_WIDGET_TOP_IMAGE = PHOTO_ALT_1;
export const DEFAULT_WIDGET_BOTTOM_IMAGE = PHOTO_ALT_2;

/** 历史默认装饰图，用于自动迁移到新默认 */
export const LEGACY_WIDGET_TOP_IMAGES = [
  'https://drive-cdn.mujian.me/17/9743b83c-48bf-4bdc-bd6d-d250b824e696_retouch_2026051221161711.png',
  'https://drive-cdn.mujian.me/17/9bf5f04b-9350-4711-9191-bbfade1f4822_OPLUSDRAG_com.xingin.xhs_NoteXYImageView_2026-05-.png',
];
export const LEGACY_WIDGET_BOTTOM_IMAGES = [
  'https://drive-cdn.mujian.me/17/91b9095d-3078-4e94-afcf-446b446bba65_retouch_2026061216005447.png',
  'https://drive-cdn.mujian.me/17/066f08c9-13ae-493a-bece-b925c85b16b9_OPLUSDRAG_com.xingin.xhs_NoteXYImageView_2026-05-%282%29.png',
];

export function migrateWidgetImageUrl(
  saved: string | undefined,
  legacyUrls: string[],
  nextDefault: string,
  fallback: string
): string {
  const trimmed = saved?.trim();
  if (!trimmed) return fallback;
  if (legacyUrls.includes(trimmed)) return nextDefault;
  return trimmed;
}

export const DEFAULT_FONT_URL =
  'https://drive-cdn.mujian.me/17/93203ac0-5d57-47a9-bdf0-a66b04e5b0a9_%E6%B1%87%E6%96%87%E4%BB%BF%E5%AE%8B.ttf';

function photoWallpaper(url: string, label: string) {
  const bg = `url("${url}") center/cover no-repeat`;
  return { label, shell: bg, home: bg, imageUrl: url };
}

export const WALLPAPER_PRESETS: Record<
  Exclude<WallpaperId, 'custom'>,
  { label: string; shell: string; home: string; imageUrl?: string }
> = {
  photo1: photoWallpaper(PHOTO1, '旅拍·主图'),
  photo2: photoWallpaper(PHOTO2, '旅拍·二'),
  photo3: photoWallpaper(PHOTO3, '旅拍·三'),
  photo4: photoWallpaper(PHOTO4, '旅拍·四'),
  photo5: photoWallpaper(PHOTO5, '旅拍·五'),
  photo6: photoWallpaper(HOME_DEFAULT_WALLPAPER_URL, '主屏·默认'),
  photo7: photoWallpaper(PHOTO_ALT_1, '主屏·备用一'),
  photo8: photoWallpaper(PHOTO_ALT_2, '主屏·备用二'),
  dawn: {
    label: '晨曦蓝粉',
    shell: 'linear-gradient(180deg, #eaf5ff 0%, #fdeef7 100%)',
    home:
      'radial-gradient(circle at 25% 8%, rgba(147,197,253,0.35), transparent 42%), radial-gradient(circle at 85% 75%, rgba(244,169,209,0.4), transparent 48%), linear-gradient(180deg, #eaf5ff 0%, #f6f0fe 45%, #fdeef7 100%)',
  },
  night: {
    label: '深夜紫雾',
    shell: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
    home:
      'radial-gradient(circle at 20% 10%, rgba(129,140,248,0.25), transparent 45%), radial-gradient(circle at 80% 80%, rgba(192,132,252,0.2), transparent 50%), linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)',
  },
  mint: {
    label: '薄荷清新',
    shell: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)',
    home:
      'radial-gradient(circle at 30% 15%, rgba(110,231,183,0.35), transparent 40%), radial-gradient(circle at 75% 70%, rgba(52,211,153,0.25), transparent 48%), linear-gradient(180deg, #ecfdf5 0%, #a7f3d0 100%)',
  },
  sunset: {
    label: '落日橘金',
    shell: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)',
    home:
      'radial-gradient(circle at 25% 10%, rgba(251,191,36,0.35), transparent 42%), radial-gradient(circle at 85% 75%, rgba(251,146,60,0.3), transparent 48%), linear-gradient(180deg, #fff7ed 0%, #fed7aa 100%)',
  },
  rose: {
    label: '玫瑰梦境',
    shell: 'linear-gradient(180deg, #fff1f2 0%, #fce7f3 100%)',
    home:
      'radial-gradient(circle at 20% 8%, rgba(251,113,133,0.3), transparent 42%), radial-gradient(circle at 80% 78%, rgba(244,114,182,0.35), transparent 48%), linear-gradient(180deg, #fff1f2 0%, #fbcfe8 100%)',
  },
};

export const FONT_PRESETS: Record<Exclude<FontPresetId, 'custom'>, { label: string; family: string }> = {
  default: {
    label: '系统默认',
    family: '"PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif',
  },
  heiti: {
    label: '黑体',
    family: '"SimHei", "Heiti SC", "STHeiti", "Microsoft YaHei", sans-serif',
  },
  serif: {
    label: '衬线优雅',
    family: '"Noto Serif SC", "Songti SC", "SimSun", serif',
  },
  round: {
    label: '圆润可爱',
    family: '"M PLUS Rounded 1c", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  mono: {
    label: '等宽极客',
    family: '"JetBrains Mono", "Consolas", "PingFang SC", monospace',
  },
};

export type AppIconKey =
  | 'liveList'
  | 'socialFeed'
  | 'chatList'
  | 'shop'
  | 'delivery'
  | 'wallet'
  | 'music'
  | 'settings';

export const ICON_STYLE_PRESETS: Record<
  Exclude<IconStyleId, 'custom'>,
  { label: string; icons: Record<AppIconKey, string> }
> = {
  classic: {
    label: '经典彩色',
    icons: {
      liveList: '📺',
      socialFeed: '📱',
      chatList: '💬',
      shop: '🛒',
      delivery: '🍔',
      wallet: '💳',
      music: '🎵',
      settings: '⚙️',
    },
  },
  cute: {
    label: '软萌贴纸',
    icons: {
      liveList: '🎬',
      socialFeed: '✨',
      chatList: '🫧',
      shop: '🎀',
      delivery: '🧋',
      wallet: '💎',
      music: '🎶',
      settings: '🌸',
    },
  },
  minimal: {
    label: '极简符号',
    icons: {
      liveList: '▶️',
      socialFeed: '◎',
      chatList: '✉️',
      shop: '◆',
      delivery: '●',
      wallet: '¥',
      music: '♪',
      settings: '☰',
    },
  },
  luxury: {
    label: '奢华金钻',
    icons: {
      liveList: '👑',
      socialFeed: '💫',
      chatList: '💌',
      shop: '🛍️',
      delivery: '🍰',
      wallet: '🏦',
      music: '🎼',
      settings: '🔮',
    },
  },
};

export const APP_GRADIENTS: Record<AppIconKey, string> = {
  liveList: 'from-sky-100 to-sky-200',
  socialFeed: 'from-violet-100 to-purple-200',
  chatList: 'from-rose-100 to-pink-200',
  shop: 'from-orange-50 to-amber-100',
  delivery: 'from-yellow-50 to-amber-100',
  wallet: 'from-amber-50 to-rose-100',
  music: 'from-emerald-50 to-teal-100',
  settings: 'from-slate-100 to-slate-200',
};

export const APP_LABELS: Record<AppIconKey, string> = {
  liveList: '直播平台',
  socialFeed: '星圈',
  chatList: '私信',
  shop: '淘淘购',
  delivery: '美团',
  wallet: '钱包',
  music: '音乐',
  settings: '设置',
};

/** 桌面主屏全部 App（8 个，两行各 4 个） */
export const HOME_APP_KEYS: AppIconKey[] = [
  'liveList',
  'socialFeed',
  'chatList',
  'shop',
  'delivery',
  'wallet',
  'music',
  'settings',
];

/** 明信片布局：右上 2×2 */
export const DESKTOP_TOP_APPS: AppIconKey[] = ['liveList', 'socialFeed', 'chatList', 'shop'];

/** 明信片布局：左下 2×2 */
export const DESKTOP_BOTTOM_APPS: AppIconKey[] = ['delivery', 'wallet', 'music', 'settings'];

export const DEFAULT_RECENT_APPS: AppIconKey[] = ['liveList', 'chatList', 'socialFeed', 'music'];

export const HOME_TEXT_COLOR_PRESETS: Record<
  Exclude<HomeTextColorId, 'custom'>,
  { label: string; main: string; sub: string; labelColor: string }
> = {
  auto: { label: '跟随壁纸', main: '', sub: '', labelColor: '' },
  white: { label: '纯白', main: '#ffffff', sub: 'rgba(255,255,255,0.72)', labelColor: 'rgba(255,255,255,0.88)' },
  black: { label: '纯黑', main: '#000000', sub: '#404040', labelColor: '#000000' },
  cream: { label: '米白', main: '#fff7ed', sub: 'rgba(255,247,237,0.75)', labelColor: '#ffedd5' },
  sky: { label: '天蓝', main: '#0ea5e9', sub: '#38bdf8', labelColor: '#0284c7' },
  pink: { label: '樱粉', main: '#ec4899', sub: '#f472b6', labelColor: '#db2777' },
  rose: { label: '玫瑰', main: '#f43f5e', sub: '#fb7185', labelColor: '#e11d48' },
  violet: { label: '紫雾', main: '#8b5cf6', sub: '#a78bfa', labelColor: '#7c3aed' },
};
