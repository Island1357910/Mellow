interface FloatingGiftItem {
  id: string;
  icon: string;
}

interface Props {
  items: FloatingGiftItem[];
  onDone: (id: string) => void;
}

/** 小额礼物送出时，从底部飘起的小图标动画 */
export default function FloatingGift({ items, onDone }: Props) {
  return (
    <div className="pointer-events-none absolute bottom-24 right-4 z-30 h-40 w-10">
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="animate-float-up absolute bottom-0 right-0 text-2xl"
          style={{ animationDelay: `${idx * 80}ms` }}
          onAnimationEnd={() => onDone(item.id)}
        >
          {item.icon}
        </div>
      ))}
    </div>
  );
}

export type { FloatingGiftItem };
