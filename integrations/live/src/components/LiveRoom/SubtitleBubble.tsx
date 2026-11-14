interface SubtitleBubbleProps {
  id: string | null;
  text: string | null;
  anchorName: string;
  className?: string;
}

/** 主播口播：X 风格引用卡片 */
export default function SubtitleBubble({ id, text, anchorName, className = '' }: SubtitleBubbleProps) {
  if (!id || !text) return null;
  return (
    <div key={id} className={`animate-pk-bubble-down ${className}`}>
      <div className="rounded-2xl border border-[#3d2a55] bg-[#160b24]/95 px-3.5 py-2.5 backdrop-blur-sm">
        <p className="mb-1 text-[12px] font-bold text-[#9b5cff]">{anchorName} 说</p>
        <p className="text-[15px] leading-5 text-white">{text}</p>
      </div>
    </div>
  );
}
