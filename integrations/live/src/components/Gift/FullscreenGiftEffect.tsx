interface FullscreenGiftEffectItem {
  id: string;
  icon: string;
  giftName: string;
  senderName: string;
  targetName: string;
}

interface Props {
  effects: FullscreenGiftEffectItem[];
  onDone: (id: string) => void;
}

/** 大额礼物（>=1000）触发的全屏特效动画 */
export default function FullscreenGiftEffect({ effects, onDone }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center overflow-hidden">
      {effects.map((fx) => (
        <div
          key={fx.id}
          className="animate-fullscreen-fx absolute flex flex-col items-center gap-2"
          onAnimationEnd={() => onDone(fx.id)}
        >
          <div className="absolute inset-0 -z-10 scale-150 bg-[radial-gradient(circle,rgba(255,215,0,0.35),transparent_70%)]" />
          <div className="text-[88px] drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]">{fx.icon}</div>
          <div className="rounded-full bg-black/50 px-4 py-1.5 text-sm font-bold text-yellow-300 shadow-lg">
            {fx.senderName} 送出 {fx.giftName} 给 {fx.targetName}！
          </div>
        </div>
      ))}
    </div>
  );
}

export type { FullscreenGiftEffectItem };
