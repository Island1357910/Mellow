import { useBalance } from "../utils/mellowHost";
import { useMemo, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import Avatar from '../components/Common/Avatar';
import { anchorAvatarProps } from '../components/Common/AnchorImage';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useCommerceStore } from '../stores/useCommerceStore';
import { useNavStore } from '../stores/useNavStore';
import { getAnchorById } from '../data/anchors';

export default function Wallet() {
  const balance = useBalance();
  const back = useNavStore((s) => s.back);
  const totalSpentAll = usePlayerStore((s) => s.totalSpentAll);
  const spendRecords = usePlayerStore((s) => s.spendRecords);
  const orders = useCommerceStore((s) => s.orders);
  const [tab, setTab] = useState<'virtual' | 'physical'>('virtual');

  const rankByAnchor = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of spendRecords) {
      map.set(r.anchorId, (map.get(r.anchorId) ?? 0) + r.price);
    }
    return Array.from(map.entries())
      .map(([anchorId, total]) => ({ anchor: getAnchorById(anchorId), total }))
      .filter((x) => x.anchor)
      .sort((a, b) => b.total - a.total);
  }, [spendRecords]);

  const physicalTotal = useMemo(
    () => orders.reduce((sum, o) => sum + o.price, 0),
    [orders]
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <StatusBar />
      <ScreenHeader title="我的钱包" onBack={back} />

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 rounded-2xl border border-[#cfd9de] bg-[#f7f9f9] p-5 text-center">
          <p className="text-[13px] text-[#536471]">账户余额</p>
          <p className="mt-1 text-5xl font-black text-[#0f1419]">{balance ?? "—"}</p>
          <p className="mt-2 text-[12px] text-[#536471]">与当前半糖身份共用余额</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-[#cfd9de] bg-white p-3">
            <p className="text-[12px] text-[#536471]">直播虚拟打赏</p>
            <p className="mt-1 text-lg font-bold text-[#1d9bf0]">{totalSpentAll.toLocaleString()} 币</p>
          </div>
          <div className="rounded-2xl border border-[#cfd9de] bg-white p-3">
            <p className="text-[12px] text-[#536471]">实体礼物消费</p>
            <p className="mt-1 text-lg font-bold text-[#0f1419]">¥{physicalTotal.toLocaleString()}</p>
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('virtual')}
            className={`flex-1 rounded-full py-2 text-xs font-bold ${
              tab === 'virtual' ? 'bg-[#0f1419] text-white' : 'border border-[#cfd9de] bg-white text-[#0f1419]'
            }`}
          >
            虚拟礼物
          </button>
          <button
            type="button"
            onClick={() => setTab('physical')}
            className={`flex-1 rounded-full py-2 text-xs font-bold ${
              tab === 'physical' ? 'bg-[#0f1419] text-white' : 'border border-[#cfd9de] bg-white text-[#0f1419]'
            }`}
          >
            实体礼物
          </button>
        </div>

        {tab === 'virtual' && (
          <>
            <p className="mb-2 px-1 text-xs text-slate-400">虚拟打赏排行（直播间榜一依据）</p>
            <div className="space-y-2">
              {rankByAnchor.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-300">还没有虚拟打赏记录</p>
              )}
              {rankByAnchor.map(({ anchor, total }, idx) => (
                <div key={anchor!.id} className="flex items-center gap-3 rounded-xl border border-blue-50 bg-white px-3 py-2.5 shadow-sm">
                  <span className="w-5 text-center text-sm font-bold text-slate-300">{idx + 1}</span>
                  <Avatar {...anchorAvatarProps(anchor!)} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{anchor!.stageName}</p>
                    <p className="text-[10px] text-slate-400">{anchor!.tag}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-pink-500">{total.toLocaleString()} 币</span>
                </div>
              ))}
            </div>

            {spendRecords.length > 0 && (
              <>
                <p className="mb-2 mt-5 px-1 text-xs text-slate-400">最近虚拟礼物记录</p>
                <div className="space-y-1.5">
                  {spendRecords.slice(0, 30).map((r) => {
                    const anchor = getAnchorById(r.anchorId);
                    return (
                      <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-[12px]">
                        <span className="text-slate-500">
                          直播间送给 <span className="text-slate-700">{anchor?.stageName ?? '未知主播'}</span>{' '}
                          虚拟礼物 {r.giftName}
                        </span>
                        <span className="font-semibold text-pink-400">-{r.price.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'physical' && (
          <>
            <p className="mb-2 px-1 text-xs text-slate-400">淘淘购 / 美团实体礼物订单</p>
            <div className="space-y-1.5">
              {orders.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-300">还没有实体礼物订单</p>
              )}
              {orders.slice(0, 40).map((o) => {
                const anchor = getAnchorById(o.anchorId);
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-[12px]">
                    <span className="text-slate-500">
                      {o.type === 'shop' ? '🛒' : '🍔'} 送给{' '}
                      <span className="text-slate-700">{anchor?.stageName ?? '未知主播'}</span>{' '}
                      实体礼 {o.productName}
                    </span>
                    <span className="font-semibold text-orange-400">¥{o.price}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
