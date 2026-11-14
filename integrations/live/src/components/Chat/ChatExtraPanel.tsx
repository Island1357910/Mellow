export type ChatExtraAction = 'redpacket' | 'voice' | 'image' | 'voice_call' | 'video_call';

const EXTRA_ITEMS: { id: ChatExtraAction; icon: string; label: string; accent: string }[] = [
  { id: 'redpacket', icon: '🧧', label: '红包', accent: 'text-red-500' },
  { id: 'voice', icon: '🎙️', label: '语音', accent: 'text-violet-500' },
  { id: 'image', icon: '🖼️', label: '图片', accent: 'text-sky-500' },
  { id: 'voice_call', icon: '📞', label: '语音电话', accent: 'text-emerald-500' },
  { id: 'video_call', icon: '📹', label: '视频电话', accent: 'text-indigo-500' },
];

export default function ChatExtraPanel({
  open,
  onSelect,
}: {
  open: boolean;
  onSelect: (action: ChatExtraAction) => void;
}) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-out ${
        open ? 'max-h-28 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="grid grid-cols-5 gap-2 px-3 pb-2 pt-1">
        {EXTRA_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className="flex flex-col items-center gap-0.5 active:scale-95"
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-lg ${item.accent}`}
            >
              {item.icon}
            </span>
            <span className="text-[9px] text-slate-400">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
