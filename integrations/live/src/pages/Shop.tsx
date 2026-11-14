import { pay, useBalance } from '../utils/mellowHost';
import { useMemo, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import CategoryTabs from '../components/Commerce/CategoryTabs';
import ProductCreator from '../components/Commerce/ProductCreator';
import AnchorPicker from '../components/Commerce/AnchorPicker';
import { getAllAnchors } from '../data/anchors';
import { SHOP_PRODUCTS } from '../data/shopProducts';
import { useCommerceStore } from '../stores/useCommerceStore';
import { useAnchorStore } from '../stores/useAnchorStore';
import { useChatStore } from '../stores/useChatStore';
import { useNavStore } from '../stores/useNavStore';
import { useAI } from '../hooks/useAI';
import type { CommerceProduct } from '../types';

export default function Shop() {
  const balance = useBalance();
  const back = useNavStore((s) => s.back);
  const placeOrder = useCommerceStore((s) => s.placeOrder);
  const savedShopProducts = useCommerceStore((s) => s.savedShopProducts);
  const saveProduct = useCommerceStore((s) => s.saveProduct);
  const generateProduct = useCommerceStore((s) => s.generateProduct);
  const boostFavor = useAnchorStore((s) => s.boostFavor);
  const { generateAnchorReply } = useAI();
  const [anchorId, setAnchorId] = useState(getAllAnchors()[0]?.id ?? '');
  const [category, setCategory] = useState('全部');
  const [toast, setToast] = useState('');

  const allProducts = useMemo(
    () => [...savedShopProducts, ...SHOP_PRODUCTS],
    [savedShopProducts]
  );

  const categories = useMemo(() => {
    const set = new Set(allProducts.map((p) => p.category));
    return ['全部', '我的库', ...Array.from(set).filter((c) => c !== '自定义')];
  }, [allProducts]);

  const list = useMemo(() => {
    if (category === '全部') return allProducts;
    if (category === '我的库') return savedShopProducts;
    return allProducts.filter((p) => p.category === category);
  }, [category, allProducts, savedShopProducts]);

  const buy = async (product: CommerceProduct) => {
    if (!anchorId) return;
    if (!(await pay(product.price))) return;
    placeOrder({
      anchorId,
      productId: product.id,
      productName: product.name,
      price: product.price,
      type: 'shop',
    });
    boostFavor(anchorId, Math.min(12, Math.floor(product.price / 50) + 2));
    setToast(`已为 ${getAllAnchors().find((a) => a.id === anchorId)?.stageName} 下单 ${product.name}`);
    setTimeout(() => setToast(''), 2500);
    try {
      const reply = await generateAnchorReply({
        anchorId,
        scene: '私聊',
        userMessage: `（系统事件：观众刚刚在淘淘购App给你买了【实体礼物】「${product.name}」，价值约${product.price}元，会快递到你手里。这是实体礼，不是直播间虚拟打赏。请表达惊喜和感谢，不超过50字。）`,
      });
      useChatStore.getState().addMessage(anchorId, 'anchor', reply);
    } catch {
      // 忽略
    }
  };

  const onGenerated = (product: CommerceProduct, saveToLibrary: boolean) => {
    if (saveToLibrary) {
      saveProduct('shop', product);
      setToast(`「${product.name}」已存入商品库`);
    } else {
      void buy(product);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fff5f0]">
      <StatusBar />
      <div className="shrink-0 bg-gradient-to-r from-[#ff5000] to-[#ff7700] px-4 pb-3 pt-1 text-white">
        <div className="flex h-12 items-center">
          <button type="button" onClick={back} className="flex h-8 w-8 items-center justify-center rounded-full text-white">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
              <path d="M9 1L2 8l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-[15px] font-semibold">淘淘购</h1>
          <div className="w-8" />
        </div>
        <p className="px-1 text-[11px] text-white/90">给心仪的主播买实体礼物 · 余额 {balance ?? "—"}</p>
      </div>

      <div className="relative z-20 shrink-0 border-b border-orange-100 bg-white px-4 py-2">
        <AnchorPicker
          anchors={getAllAnchors()}
          value={anchorId}
          onChange={setAnchorId}
          accentClass="bg-[#ff5000]"
          borderClass="border-orange-100"
        />
      </div>

      <CategoryTabs
        categories={categories}
        active={category}
        onChange={setCategory}
        activeClassName="bg-[#ff5000] text-white"
        inactiveClassName="bg-white text-slate-500 border border-orange-100"
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4 pt-2">
        <ProductCreator
          type="shop"
          accentClass="bg-[#ff5000]"
          generateProduct={(d) => generateProduct('shop', d)}
          onGenerated={onGenerated}
        />

        {category === '我的库' && savedShopProducts.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">商品库为空，生成商品后可存入</p>
        )}

        <div className="grid grid-cols-2 gap-2 px-3">
          {list.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="flex h-24 items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 text-4xl">
                {p.icon}
              </div>
              <div className="p-2">
                <p className="truncate text-[12px] font-medium text-slate-800">{p.name}</p>
                <p className="truncate text-[10px] text-slate-400">{p.desc}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#ff5000]">¥{p.price}</span>
                  <button
                    type="button"
                    onClick={() => buy(p)}
                    className="rounded-full bg-[#ff5000] px-2.5 py-1 text-[10px] font-bold text-white"
                  >
                    购买
                  </button>
                </div>
              </div>
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
