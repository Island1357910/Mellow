import { useHorizontalScroll } from '../../hooks/useHorizontalScroll';

interface ScrollTabsProps<T extends string> {
  items: readonly T[];
  active: T;
  onChange: (item: T) => void;
  /** underline = X 风格下划线；pill = 圆角胶囊 */
  variant?: 'underline' | 'pill';
  className?: string;
  tone?: 'light' | 'dark';
}

/** 可左右滑动的分类标签：手机滑动 + 电脑拖拽/滚轮 */
export default function ScrollTabs<T extends string>({
  items,
  active,
  onChange,
  variant = 'underline',
  className = '',
  tone = 'light',
}: ScrollTabsProps<T>) {
  const { ref, onWheel, onPointerDown, onClickCapture } = useHorizontalScroll<HTMLDivElement>();
  const dark = tone === 'dark';

  return (
    <div
      ref={ref}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      className={`scroll-tabs shrink-0 cursor-grab active:cursor-grabbing ${
        variant === 'underline' ? (dark ? 'border-b border-[#3d2a55]' : 'border-b border-[#eff3f4]') : ''
      } ${className}`}
    >
      <div
        className={`flex w-max min-w-full flex-nowrap ${
          variant === 'underline' ? 'gap-0 px-2' : 'gap-2 px-4 py-2.5'
        }`}
      >
        {items.map((item) => {
          const isActive = item === active;
          if (variant === 'underline') {
            return (
              <button
                key={item}
                type="button"
                onClick={() => onChange(item)}
                className={`relative shrink-0 whitespace-nowrap px-3.5 py-3 text-[14px] font-bold transition-colors ${
                  isActive
                    ? dark
                      ? 'text-[#f3eef9]'
                      : 'text-[#0f1419]'
                    : dark
                      ? 'text-[#9b8fb0] hover:bg-white/5'
                      : 'text-[#536471] hover:bg-black/[0.03]'
                }`}
              >
                {item}
                {isActive && (
                  <span
                    className={`absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full ${
                      dark ? 'bg-[#9b5cff]' : 'bg-[#1d9bf0]'
                    }`}
                  />
                )}
              </button>
            );
          }
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${
                isActive
                  ? dark
                    ? 'bg-[#9b5cff] text-white'
                    : 'bg-[#0f1419] text-white'
                  : dark
                    ? 'border border-[#3d2a55] bg-[#160b24] text-[#f3eef9]'
                    : 'border border-[#cfd9de] bg-white text-[#0f1419] hover:bg-black/[0.03]'
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
