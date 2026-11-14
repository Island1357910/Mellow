import { APP_GRADIENTS, APP_LABELS, type AppIconKey } from '../../data/appearance';
import { resolveAppIcon, type AppearanceSettings } from '../../utils/appearanceResolver';

function AppIconDisplay({
  appKey,
  appearance,
}: {
  appKey: AppIconKey;
  appearance: AppearanceSettings;
}) {
  const icon = resolveAppIcon(appKey, appearance);
  if (icon.kind === 'image') {
    return <img src={icon.url} alt="" className="h-7 w-7 rounded-lg object-cover" />;
  }
  return <span className="text-xl">{icon.value}</span>;
}

interface DesktopAppButtonProps {
  appKey: AppIconKey;
  appearance: AppearanceSettings;
  labelColor?: string;
  onOpen: (key: AppIconKey) => void;
  showBadge?: boolean;
}

export default function DesktopAppButton({
  appKey,
  appearance,
  labelColor,
  onOpen,
  showBadge,
}: DesktopAppButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(appKey)}
      onPointerDown={(e) => e.stopPropagation()}
      className="relative flex flex-col items-center justify-center gap-1 active:scale-95 transition"
    >
      <div
        className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/50 bg-gradient-to-br ${APP_GRADIENTS[appKey]} shadow-sm`}
      >
        <AppIconDisplay appKey={appKey} appearance={appearance} />
        {showBadge && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
        )}
      </div>
      <span
        className="max-w-[5rem] truncate text-[12px] font-bold leading-tight"
        style={
          labelColor
            ? {
                color: labelColor,
                textShadow: '0 1px 3px rgba(255,255,255,0.85), 0 0 1px rgba(255,255,255,0.6)',
              }
            : undefined
        }
      >
        {APP_LABELS[appKey]}
      </span>
    </button>
  );
}
