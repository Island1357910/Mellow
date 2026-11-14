import type { AnchorProfile } from '../../types';
import Avatar from './Avatar';

interface AnchorImageProps {
  anchor: AnchorProfile;
  className?: string;
  /** cover 铺满裁切；contain 完整显示 */
  fit?: 'cover' | 'contain';
}

/** 主播立绘：有图用图片，无图用渐变占位 */
export default function AnchorImage({ anchor, className = '', fit = 'cover' }: AnchorImageProps) {
  if (anchor.portraitUrl) {
    return (
      <img
        src={anchor.portraitUrl}
        alt={anchor.stageName}
        className={`${fit === 'cover' ? 'object-cover object-top' : 'object-contain'} ${className}`}
      />
    );
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-b ${anchor.gradient} opacity-90`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      <Avatar gradient={anchor.gradient} letter={anchor.avatarLetter} size={80} className="relative z-10" />
    </div>
  );
}

/** 从 AnchorProfile 提取头像 props，方便批量替换 */
export function anchorAvatarProps(anchor: AnchorProfile) {
  return {
    gradient: anchor.gradient,
    letter: anchor.avatarLetter,
    imageUrl: anchor.portraitUrl,
  };
}
