interface AvatarProps {
  gradient: string;
  letter: string;
  imageUrl?: string;
  size?: number;
  className?: string;
  ring?: boolean;
}

/** 主播头像：优先图片，无图则渐变色块 + 艺名首字 */
export default function Avatar({ gradient, letter, imageUrl, size = 48, className = '', ring = false }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`rounded-full object-cover shadow-lg select-none shrink-0 bg-slate-100 ${
          ring ? 'ring-2 ring-pink-400 ring-offset-2 ring-offset-white' : ''
        } ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold text-white shadow-lg select-none shrink-0 ${
        ring ? 'ring-2 ring-pink-400 ring-offset-2 ring-offset-white' : ''
      } ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {letter}
    </div>
  );
}
