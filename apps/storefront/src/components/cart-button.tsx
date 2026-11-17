'use client';

import { useCartStore } from '@/lib/cart-store';
import { ShoppingBag } from 'lucide-react';

export function CartButton() {
  const { cart, openCart } = useCartStore();
  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <button
      onClick={openCart}
      className="text-slate-600 hover:text-blue-600 flex flex-col items-center text-xs relative cursor-pointer group"
    >
      <div className="relative">
        <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
        {itemCount > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
            {itemCount}
          </span>
        )}
      </div>
      <span className="mt-1 hidden sm:inline">Cart</span>
    </button>
  );
}
