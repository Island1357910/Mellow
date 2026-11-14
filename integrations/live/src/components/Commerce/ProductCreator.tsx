import { useState } from 'react';
import type { CommerceProduct } from '../../types';

interface ProductCreatorProps {
  type: 'shop' | 'delivery';
  accentClass: string;
  onGenerated: (product: CommerceProduct, saveToLibrary: boolean) => void;
  generateProduct: (description: string) => Promise<CommerceProduct>;
}

export default function ProductCreator({
  type,
  accentClass,
  onGenerated,
  generateProduct,
}: ProductCreatorProps) {
  const [desc, setDesc] = useState('');
  const [preview, setPreview] = useState<CommerceProduct | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const text = desc.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const product = await generateProduct(text);
      setPreview(product);
    } finally {
      setLoading(false);
    }
  };

  const label = type === 'shop' ? '描述想要的实体礼物' : '描述想点的外卖';

  return (
    <div className="mx-3 mb-3 rounded-xl border border-dashed border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">✨ AI 定制商品</p>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder={`${label}，例如：${type === 'shop' ? '机械键盘、永生花礼盒' : '少糖珍珠奶茶、深夜烧烤'}`}
        rows={2}
        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
      />
      <button
        type="button"
        disabled={!desc.trim() || loading}
        onClick={handleGenerate}
        className={`mt-2 w-full rounded-full py-2 text-xs font-bold text-white disabled:opacity-40 ${accentClass}`}
      >
        {loading ? '生成中…' : '生成商品'}
      </button>

      {preview && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{preview.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{preview.name}</p>
              <p className="truncate text-[11px] text-slate-400">{preview.desc}</p>
              <p className="text-sm font-bold text-orange-500">¥{preview.price}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onGenerated(preview, false);
                setPreview(null);
                setDesc('');
              }}
              className="flex-1 rounded-full border border-slate-200 py-1.5 text-[11px] text-slate-600"
            >
              直接购买
            </button>
            <button
              type="button"
              onClick={() => {
                onGenerated(preview, true);
                setPreview(null);
                setDesc('');
              }}
              className={`flex-1 rounded-full py-1.5 text-[11px] font-bold text-white ${accentClass}`}
            >
              存入商品库
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
