import { useState } from 'react';
import type { ChatMessage } from '../../types';
import Avatar from '../Common/Avatar';
import { anchorAvatarProps } from '../Common/AnchorImage';
import { estimateVoiceSeconds } from './ChatExtras';
import type { getAnchorById } from '../../data/anchors';

export function ChatBubble({
  anchor,
  message,
}: {
  anchor: NonNullable<ReturnType<typeof getAnchorById>>;
  message: ChatMessage;
}) {
  const { role, content, kind = 'text' } = message;

  if (role === 'anchor') {
    return (
      <div className="flex items-end gap-2">
        <Avatar {...anchorAvatarProps(anchor)} size={30} />
        <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-[#eff3f4] bg-[#f7f9f9] px-3 py-2 text-[13px] text-[#0f1419]">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[75%]">
        {kind === 'text' && (
          <div className="rounded-2xl rounded-tr-sm bg-[#1d9bf0] px-3 py-2 text-[13px] text-white">
            {content}
          </div>
        )}
        {kind === 'redpacket' && <RedPacketBubble amount={message.redPacketAmount ?? 0} blessing={content} />}
        {kind === 'voice' && <VoiceBubble text={message.voiceText ?? content} />}
        {kind === 'image' && <ImageBubble desc={message.imageDesc ?? content} />}
      </div>
    </div>
  );
}

function RedPacketBubble({ amount, blessing }: { amount: number; blessing: string }) {
  return (
    <div className="overflow-hidden rounded-2xl rounded-tr-sm bg-gradient-to-br from-red-500 to-orange-500 shadow-md">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-2xl">🧧</span>
        <div>
          <p className="text-sm font-bold text-white">{amount.toLocaleString()} 虚拟币</p>
          <p className="text-[11px] text-white/85">{blessing || '恭喜发财'}</p>
        </div>
      </div>
      <p className="bg-red-600/30 px-3 py-1 text-[9px] text-white/70">虚拟红包 · 已领取</p>
    </div>
  );
}

function VoiceBubble({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const seconds = estimateVoiceSeconds(text);

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="w-full rounded-2xl rounded-tr-sm bg-gradient-to-r from-violet-500 to-purple-500 px-3 py-2.5 text-left text-white shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm">🎙️</span>
        <div className="flex flex-1 items-center gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <span
              key={i}
              className="w-0.5 rounded-full bg-white/80"
              style={{ height: `${8 + (i % 3) * 6}px` }}
            />
          ))}
        </div>
        <span className="text-[11px] text-white/80">{seconds}"</span>
      </div>
      {expanded && (
        <p className="mt-2 border-t border-white/20 pt-2 text-[12px] leading-relaxed text-white/95">
          {text}
        </p>
      )}
      {!expanded && <p className="mt-1 text-[10px] text-white/60">点击转文字</p>}
    </button>
  );
}

function ImageBubble({ desc }: { desc: string }) {
  const hue = (desc.charCodeAt(0) * 17) % 360;
  return (
    <div className="overflow-hidden rounded-2xl rounded-tr-sm border border-sky-100 bg-white shadow-sm">
      <div
        className="flex h-36 items-center justify-center px-3 text-center"
        style={{
          background: `linear-gradient(135deg, hsl(${hue}, 70%, 85%), hsl(${(hue + 40) % 360}, 65%, 78%))`,
        }}
      >
        <div>
          <span className="text-3xl">🖼️</span>
          <p className="mt-2 text-[11px] font-medium text-slate-600">AI 想象图</p>
        </div>
      </div>
      <p className="px-3 py-2 text-[12px] leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}
