import { useState } from 'react';
import { CHAT_BG_PRESETS } from '../../data/chatAppearance';
import { useSettingsStore } from '../../stores/useSettingsStore';

export default function ChatBackgroundSheet({
  anchorId,
  open,
  onClose,
}: {
  anchorId: string;
  open: boolean;
  onClose: () => void;
}) {
  const chatBackgrounds = useSettingsStore((s) => s.chatBackgrounds);
  const importedImages = useSettingsStore((s) => s.importedImages);
  const setChatBackground = useSettingsStore((s) => s.setChatBackground);
  const current = chatBackgrounds[anchorId] ?? 'default';
  const [customUrl, setCustomUrl] = useState('');

  if (!open) return null;

  const apply = (bg: string) => {
    setChatBackground(anchorId, bg);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[70%] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-sm font-bold text-slate-700">聊天背景</p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {Object.entries(CHAT_BG_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              onClick={() => apply(id)}
              className={`overflow-hidden rounded-xl border-2 ${
                current === id ? 'border-sky-400' : 'border-transparent'
              }`}
            >
              <div className="h-16 w-full" style={{ backgroundImage: preset.style }} />
              <p className="py-1 text-center text-[10px] text-slate-500">{preset.label}</p>
            </button>
          ))}
        </div>

        {importedImages.length > 0 && (
          <>
            <p className="mb-2 text-xs font-semibold text-slate-500">已导入图片</p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {importedImages.slice(0, 9).map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => apply(img.dataUrl)}
                  className={`h-16 overflow-hidden rounded-xl border-2 ${
                    current === img.dataUrl ? 'border-sky-400' : 'border-transparent'
                  }`}
                >
                  <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mb-2 text-xs font-semibold text-slate-500">图片链接</p>
        <div className="flex gap-2">
          <input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="粘贴图片 URL"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none"
          />
          <button
            type="button"
            onClick={() => customUrl.trim() && apply(customUrl.trim())}
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white"
          >
            应用
          </button>
        </div>
      </div>
    </div>
  );
}
