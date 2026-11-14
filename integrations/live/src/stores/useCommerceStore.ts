import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';
import type { CommerceOrder, CommerceProduct } from '../types';
import { generateCommerceProductDescription } from '../utils/ai';
import { generateProductLocal, parseProductFromAI } from '../utils/generateProduct';

interface CommerceState {
  orders: CommerceOrder[];
  savedShopProducts: CommerceProduct[];
  savedDeliveryProducts: CommerceProduct[];

  placeOrder: (order: Omit<CommerceOrder, 'id' | 'timestamp'>) => CommerceOrder;
  saveProduct: (type: 'shop' | 'delivery', product: CommerceProduct) => void;
  removeSavedProduct: (type: 'shop' | 'delivery', productId: string) => void;
  generateProduct: (type: 'shop' | 'delivery', description: string) => Promise<CommerceProduct>;
}

export const useCommerceStore = create<CommerceState>()(
  persist(
    (set) => ({
      orders: [],
      savedShopProducts: [],
      savedDeliveryProducts: [],

      placeOrder: (order) => {
        const full: CommerceOrder = {
          ...order,
          id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
        };
        set((state) => ({ orders: [full, ...state.orders].slice(0, 200) }));
        return full;
      },

      saveProduct: (type, product) =>
        set((state) => {
          const key = type === 'shop' ? 'savedShopProducts' : 'savedDeliveryProducts';
          const list = state[key];
          if (list.some((p) => p.id === product.id)) return state;
          return { [key]: [product, ...list].slice(0, 50) };
        }),

      removeSavedProduct: (type, productId) =>
        set((state) => {
          const key = type === 'shop' ? 'savedShopProducts' : 'savedDeliveryProducts';
          return { [key]: state[key].filter((p) => p.id !== productId) };
        }),

      generateProduct: async (type, description) => {
        const aiRaw = await generateCommerceProductDescription(description, type);
        const fromAi = aiRaw ? parseProductFromAI(aiRaw, type) : null;
        return fromAi ?? generateProductLocal(description, type);
      },
    }),
    {
      name: 'shenhao_commerce',
      storage: idbJSONStorage,
    }
  )
);

export function getSavedProducts(type: 'shop' | 'delivery') {
  const s = useCommerceStore.getState();
  return type === 'shop' ? s.savedShopProducts : s.savedDeliveryProducts;
}
