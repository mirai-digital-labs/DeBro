'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Cart, CartItem } from '@platform/types';

interface CartState {
  cart: Cart | null;
  isOpen: boolean;
  isLoading: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  initCart: () => Promise<void>;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: null,
      isOpen: false,
      isLoading: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      initCart: async () => {
        const currentCart = get().cart;
        if (currentCart?.id) {
          try {
            const res = await fetch(`${BACKEND_URL}/api/v1/cart/${currentCart.id}`);
            if (res.ok) {
              const data = await res.json();
              set({ cart: data.data });
              return;
            }
          } catch (e) {
            // Ignore & recreate
          }
        }

        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/cart`, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            set({ cart: data.data });
          }
        } catch (err) {
          console.warn('Failed to initialize cart from backend', err);
        }
      },

      addItem: async (variantId: string, quantity: number = 1) => {
        let currentCart = get().cart;
        if (!currentCart?.id) {
          await get().initCart();
          currentCart = get().cart;
        }
        if (!currentCart?.id) return;

        set({ isLoading: true });
        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/cart/${currentCart.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variantId, quantity }),
          });
          if (res.ok) {
            const data = await res.json();
            set({ cart: data.data, isOpen: true });
          }
        } catch (err) {
          console.error('Failed to add item to cart', err);
        } finally {
          set({ isLoading: false });
        }
      },

      updateQuantity: async (itemId: string, quantity: number) => {
        const currentCart = get().cart;
        if (!currentCart?.id) return;

        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/cart/${currentCart.id}/items/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity }),
          });
          if (res.ok) {
            const data = await res.json();
            set({ cart: data.data });
          }
        } catch (err) {
          console.error('Failed to update quantity', err);
        }
      },

      removeItem: async (itemId: string) => {
        const currentCart = get().cart;
        if (!currentCart?.id) return;

        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/cart/${currentCart.id}/items/${itemId}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            const data = await res.json();
            set({ cart: data.data });
          }
        } catch (err) {
          console.error('Failed to remove item', err);
        }
      },
    }),
    {
      name: 'nexstore_cart_storage',
      partialize: (state) => ({ cart: state.cart }),
    }
  )
);
