import Avatar from '../Common/Avatar';
import { anchorAvatarProps } from '../Common/AnchorImage';
import type { AnchorProfile } from '../../types';

/** 视频通话立绘：有 portraitUrl 用图片，否则渐变占位 */
export default function AnchorPortrait({
  anchor,
  className = '',
}: {
  anchor: AnchorProfile;
  className?: string;
}) {
  if (anchor.portraitUrl) {
    return (
      <img
        src={anchor.portraitUrl}
        alt={anchor.stageName}
        className={`h-full w-full object-cover object-top ${className}`}
      />
    );
  }

  return (
    <div className={`relative flex h-full w-full flex-col items-center justify-end overflow-hidden ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-b ${anchor.gradient} opacity-90`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <div className="relative z-10 mb-8 flex flex-col items-center gap-3 px-6 pb-4">
        <div
          className={`flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${anchor.gradient} text-5xl font-bold text-white shadow-2xl ring-4 ring-white/30`}
        >
          {anchor.avatarLetter}
        </div>
        <p className="text-xl font-bold text-white drop-shadow">{anchor.stageName}</p>
        <p className="text-center text-xs text-white/80">{anchor.tag}</p>
      </div>
    </div>
  );
}

export function VoiceCallAvatar({ anchor, size = 120 }: { anchor: AnchorProfile; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-white/20" />
        <Avatar {...anchorAvatarProps(anchor)} size={size} />
      </div>
      <p className="text-lg font-semibold text-white">{anchor.stageName}</p>
    </div>
  );
}
