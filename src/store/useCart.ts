import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asUnit, clampQuantity, type SellUnit } from '@/lib/meterage';

export interface CartItem {
  id: string; // Variant ID
  product_id: string;
  title: string;
  color: string;
  price: number;
  quantity: number;
  min_order_quantity: number;
  image: string;
  /** 'MTR' (0.5 m steps) or 'PCS'. Older saved carts have none: treated as MTR. */
  unit?: SellUnit;
  /** Longest single cut available when added (metres). */
  max_cut_m?: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  syncItems: (updates: { id: string; price: number; min_order_quantity: number; unit?: SellUnit; max_cut_m?: number }[]) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      addItem: (newItem) => set((state) => {
        const existingItem = state.items.find((item) => item.id === newItem.id);
        const unit = asUnit(newItem.unit);
        const moq = newItem.min_order_quantity || 1;
        if (existingItem) {
          const newQty = clampQuantity(existingItem.quantity + newItem.quantity, unit, moq, newItem.max_cut_m);
          return {
            items: state.items.map((item) =>
              item.id === newItem.id
                ? { ...item, quantity: newQty }
                : item
            ),
          };
        }
        return { items: [...state.items, { ...newItem, unit, quantity: clampQuantity(newItem.quantity, unit, moq, newItem.max_cut_m) }] };
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((item) => {
          if (item.id === id) {
            const moq = item.min_order_quantity || 1;
            return { ...item, quantity: clampQuantity(quantity, asUnit(item.unit), moq, item.max_cut_m) };
          }
          return item;
        }),
      })),
      clearCart: () => set({ items: [] }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      syncItems: (updates) => set((state) => {
        let hasChanges = false;
        const newItems = state.items.map((item) => {
          const update = updates.find(u => u.id === item.id);
          if (update) {
            const moq = update.min_order_quantity || 1;
            const unit = asUnit(update.unit ?? item.unit);
            const maxCut = update.max_cut_m ?? item.max_cut_m;
            const newQty = clampQuantity(item.quantity, unit, moq, maxCut);
            if (item.price !== update.price || item.min_order_quantity !== update.min_order_quantity || item.quantity !== newQty
                || item.unit !== unit || item.max_cut_m !== maxCut) {
              hasChanges = true;
              return { ...item, price: update.price, min_order_quantity: update.min_order_quantity, quantity: newQty, unit, max_cut_m: maxCut };
            }
          }
          return item;
        });
        return hasChanges ? { items: newItems } : state;
      }),
    }),
    {
      name: 'mithila-cart-storage',
    }
  )
);
