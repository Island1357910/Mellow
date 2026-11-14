interface PKSpeechBubbleProps {
  id: string | null;
  text: string | null;
  anchorName: string;
  side: 'A' | 'B';
  className?: string;
}

/** PK 主播口播：X 风格引用卡，左右分侧 */
export default function PKSpeechBubble({ id, text, anchorName, side, className = '' }: PKSpeechBubbleProps) {
  if (!id || !text) return null;

  const isLeft = side === 'A';

  return (
    <div key={id} className={`animate-pk-bubble-down pointer-events-none ${className}`}>
      <div
        className={`rounded-2xl border bg-[#160b24]/95 px-3 py-2 backdrop-blur-sm ${
          isLeft ? 'border-[#9b5cff]/40' : 'border-[#d946ef]/40'
        }`}
      >
        <p
          className={`mb-0.5 text-[11px] font-bold ${isLeft ? 'text-left text-[#9b5cff]' : 'text-right text-[#d946ef]'}`}
        >
          {anchorName} 说
        </p>
        <p className={`text-[13px] leading-snug text-white ${isLeft ? 'text-left' : 'text-right'}`}>
          {text}
        </p>
      </div>
    </div>
  );
}
