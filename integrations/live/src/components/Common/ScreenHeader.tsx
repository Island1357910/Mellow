import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  transparent?: boolean;
  /** 直播黑紫主题 */
  tone?: 'light' | 'dark';
}

/** X 风格顶栏：白底、细分割线、居中标题 */
export default function ScreenHeader({
  title,
  onBack,
  right,
  transparent = false,
  tone = 'light',
}: ScreenHeaderProps) {
  const dark = tone === 'dark';
  return (
    <div
      className={`flex h-12 shrink-0 items-center justify-between px-2 ${
        transparent
          ? ''
          : dark
            ? 'border-b border-[#3d2a55] bg-[#0c0614]/95 backdrop-blur-md'
            : 'border-b border-[#eff3f4] bg-white/90 backdrop-blur-md'
      }`}
    >
      <div className="flex w-14 shrink-0 items-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
              dark
                ? 'text-[#f3eef9] hover:bg-white/10 active:bg-white/15'
                : 'text-[#0f1419] hover:bg-black/[0.06] active:bg-black/[0.1]'
            }`}
          >
            <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
              <path d="M9 1L2 8l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      <div
        className={`min-w-0 flex-1 truncate text-center text-[17px] font-bold ${
          dark ? 'text-[#f3eef9]' : 'text-[#0f1419]'
        }`}
      >
        {title}
      </div>
      <div className="flex min-w-14 shrink-0 items-center justify-end pr-1">{right}</div>
    </div>
  );
}
