import { useState } from 'react';

const RED_AMOUNTS = [52, 520, 1314, 8888];

export function RedPacketSheet({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (amount: number, blessing: string) => void;
}) {
  const [amount, setAmount] = useState(520);
  const [custom, setCustom] = useState('');
  const [blessing, setBlessing] = useState('');

  if (!open) return null;

  const finalAmount = custom.trim() ? Math.max(1, parseInt(custom, 10) || 520) : amount;

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/40">
      <div className="w-full rounded-t-3xl bg-white px-4 pb-8 pt-4">
        <p className="mb-3 text-center text-sm font-bold text-red-500">发虚拟红包</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {RED_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAmount(a);
                setCustom('');
              }}
              className={`rounded-full px-4 py-2 text-xs font-bold ${
                amount === a && !custom.trim() ? 'bg-red-500 text-white' : 'bg-red-50 text-red-400'
              }`}
            >
              {a} 币
            </button>
          ))}
        </div>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
          placeholder="自定义金额"
          className="mb-3 w-full rounded-xl border border-red-100 bg-red-50/50 px-3 py-2 text-sm outline-none"
        />
        <input
          value={blessing}
          onChange={(e) => setBlessing(e.target.value)}
          placeholder="恭喜发财，大吉大利～"
          maxLength={30}
          className="mb-4 w-full rounded-xl border border-red-100 px-3 py-2 text-sm outline-none"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm text-slate-500">
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onSend(finalAmount, blessing.trim() || '恭喜发财，大吉大利');
              onClose();
              setBlessing('');
              setCustom('');
            }}
            className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 py-3 text-sm font-bold text-white"
          >
            发送 {finalAmount} 币
          </button>
        </div>
      </div>
    </div>
  );
}

export function VoiceSheet({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/40">
      <div className="w-full rounded-t-3xl bg-white px-4 pb-8 pt-4">
        <p className="mb-1 text-center text-sm font-bold text-violet-500">发语音</p>
        <p className="mb-3 text-center text-[10px] text-slate-400">输入文字，将自动转为语音消息</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="想说的话…"
          maxLength={120}
          className="mb-4 w-full resize-none rounded-xl border border-violet-100 px-3 py-2 text-sm outline-none"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm text-slate-500">
            取消
          </button>
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => {
              onSend(text.trim());
              onClose();
              setText('');
            }}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            转语音并发送
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImageSheet({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (desc: string) => void;
}) {
  const [desc, setDesc] = useState('');

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/40">
      <div className="w-full rounded-t-3xl bg-white px-4 pb-8 pt-4">
        <p className="mb-1 text-center text-sm font-bold text-sky-500">发图片</p>
        <p className="mb-3 text-center text-[10px] text-slate-400">用文字描述你想发的图片内容</p>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={4}
          placeholder="例：夕阳下海边散步的自拍，穿白色连衣裙，笑得很甜"
          maxLength={150}
          className="mb-4 w-full resize-none rounded-xl border border-sky-100 px-3 py-2 text-sm outline-none"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm text-slate-500">
            取消
          </button>
          <button
            type="button"
            disabled={!desc.trim()}
            onClick={() => {
              onSend(desc.trim());
              onClose();
              setDesc('');
            }}
            className="flex-1 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-500 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            生成并发送
          </button>
        </div>
      </div>
    </div>
  );
}

/** 估算语音条秒数 */
export function estimateVoiceSeconds(text: string): number {
  return Math.min(60, Math.max(2, Math.ceil(text.length / 4)));
}
