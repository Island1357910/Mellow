import { pay } from '../utils/mellowHost';
import { useMemo, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import CategoryTabs from '../components/Commerce/CategoryTabs';
import ProductCreator from '../components/Commerce/ProductCreator';
import AnchorPicker from '../components/Commerce/AnchorPicker';
import { getAllAnchors } from '../data/anchors';
import { DELIVERY_ITEMS } from '../data/deliveryItems';
import { useCommerceStore } from '../stores/useCommerceStore';
import { useAnchorStore } from '../stores/useAnchorStore';
import { useChatStore } from '../stores/useChatStore';
import { useNavStore } from '../stores/useNavStore';
import { useAI } from '../hooks/useAI';
import type { CommerceProduct } from '../types';

export default function Delivery() {
  const back = useNavStore((s) => s.back);
  const placeOrder = useCommerceStore((s) => s.placeOrder);
  const savedDeliveryProducts = useCommerceStore((s) => s.savedDeliveryProducts);
  const saveProduct = useCommerceStore((s) => s.saveProduct);
  const generateProduct = useCommerceStore((s) => s.generateProduct);
  const boostFavor = useAnchorStore((s) => s.boostFavor);
  const { generateAnchorReply } = useAI();
  const [anchorId, setAnchorId] = useState(getAllAnchors()[0]?.id ?? '');
  const [category, setCategory] = useState('全部');
  const [toast, setToast] = useState('');

  const allProducts = useMemo(
    () => [...savedDeliveryProducts, ...DELIVERY_ITEMS],
    [savedDeliveryProducts]
  );

  const categories = useMemo(() => {
    const set = new Set(allProducts.map((p) => p.category));
    return ['全部', '我的库', ...Array.from(set).filter((c) => c !== '自定义')];
  }, [allProducts]);

  const list = useMemo(() => {
    if (category === '全部') return allProducts;
    if (category === '我的库') return savedDeliveryProducts;
    return allProducts.filter((p) => p.category === category);
  }, [category, allProducts, savedDeliveryProducts]);

  const order = async (product: CommerceProduct) => {
    if (!anchorId) return;
    if (!(await pay(product.price))) return;
    placeOrder({
      anchorId,
      productId: product.id,
      productName: product.name,
      price: product.price,
      type: 'delivery',
    });
    boostFavor(anchorId, Math.min(8, Math.floor(product.price / 10) + 1));
    setToast(`已给 ${getAllAnchors().find((a) => a.id === anchorId)?.stageName} 点了 ${product.name}`);
    setTimeout(() => setToast(''), 2500);
    try {
      const reply = await generateAnchorReply({
        anchorId,
        scene: '私聊',
        userMessage: `（系统事件：观众刚刚在美团外卖给你点了【实体投喂】「${product.name}」，会送到你手里。这是真实外卖/实体礼，不是直播间虚拟打赏。请表达开心和感谢，可以撒娇说正好饿了，不超过50字。）`,
      });
      useChatStore.getState().addMessage(anchorId, 'anchor', reply);
    } catch {
      // 忽略
    }
  };

  const onGenerated = (product: CommerceProduct, saveToLibrary: boolean) => {
    if (saveToLibrary) {
      saveProduct('delivery', product);
      setToast(`「${product.name}」已存入商品库`);
    } else {
      void order(product);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fffbeb]">
      <StatusBar />
      <div className="shrink-0 bg-[#ffc300] px-4 pb-3 pt-1">
        <div className="flex h-12 items-center">
          <button type="button" onClick={back} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-800">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
              <path d="M9 1L2 8l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-[15px] font-semibold text-slate-800">美团外卖</h1>
          <div className="w-8" />
        </div>
        <p className="px-1 text-[11px] text-slate-700/80">给主播点奶茶外卖 · 30分钟送达</p>
      </div>

      <div className="relative z-20 shrink-0 border-b border-yellow-200 bg-white px-4 py-2">
        <AnchorPicker
          anchors={getAllAnchors()}
          value={anchorId}
          onChange={setAnchorId}
          accentClass="bg-[#ffc300] text-slate-800"
          borderClass="border-yellow-200"
        />
      </div>

      <CategoryTabs
        categories={categories}
        active={category}
        onChange={setCategory}
        activeClassName="bg-[#ffc300] text-slate-800 font-semibold"
        inactiveClassName="bg-white text-slate-500 border border-yellow-200"
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4 pt-2">
        <ProductCreator
          type="delivery"
          accentClass="bg-[#ffc300] text-slate-800"
          generateProduct={(d) => generateProduct('delivery', d)}
          onGenerated={onGenerated}
        />

        {category === '我的库' && savedDeliveryProducts.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">商品库为空，生成商品后可存入</p>
        )}

        <div className="px-3">
          {list.map((p) => (
            <div
              key={p.id}
              className="mb-2 flex items-center gap-3 rounded-xl border border-yellow-100 bg-white p-3 shadow-sm"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-yellow-50 text-3xl">
                {p.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{p.name}</p>
                <p className="text-[11px] text-slate-400">{p.desc}</p>
                <p className="mt-1 text-sm font-bold text-[#ff6600]">¥{p.price}</p>
              </div>
              <button
                type="button"
                onClick={() => order(p)}
                className="shrink-0 rounded-full bg-[#ffc300] px-4 py-2 text-xs font-bold text-slate-800"
              >
                下单
              </button>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-xs text-white">
          {toast}
        </div>
      )}
    </div>
  );
}
