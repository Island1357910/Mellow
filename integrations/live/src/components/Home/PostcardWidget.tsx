interface PostcardWidgetProps {
  imageUrl: string;
  tilt?: 'left' | 'right';
  isDark?: boolean;
}

export default function PostcardWidget({ imageUrl, tilt = 'left', isDark }: PostcardWidgetProps) {
  const rotate = tilt === 'left' ? '-2deg' : '2deg';

  return (
    <div className="flex h-full items-center justify-center p-1">
      <div
        className={`relative w-full overflow-hidden rounded-2xl border shadow-md aspect-[3/4] ${
          isDark ? 'border-white/20 bg-indigo-950/30' : 'border-white/80 bg-white/50'
        }`}
        style={{ transform: `rotate(${rotate})` }}
      >
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-white/5" />
      </div>
    </div>
  );
}
