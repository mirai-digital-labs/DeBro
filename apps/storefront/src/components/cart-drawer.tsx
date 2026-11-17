'use client';

import { useCartStore } from '@/lib/cart-store';
import Link from 'next/link';
import { ShoppingBag, X, Trash2, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';

export function CartDrawer() {
  const { cart, isOpen, closeCart, updateQuantity, removeItem, initCart } = useCartStore();

  useEffect(() => {
    initCart();
  }, [initCart]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold">Shopping Cart</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-[10px] font-bold">
                {cart?.items.length || 0}
              </span>
            </div>
            <button onClick={closeCart} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Pakistan Free Delivery Indicator */}
          <div className="bg-emerald-50 border-b border-emerald-100 p-3 text-xs text-emerald-800">
            {cart && cart.subtotal >= 2999 ? (
              <span className="font-semibold">🎉 You have qualified for FREE Shipping!</span>
            ) : (
              <span>Add Rs. {(2999 - (cart?.subtotal || 0)).toLocaleString()} more for <strong>FREE Delivery</strong></span>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!cart || cart.items.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <span className="text-4xl">🛍️</span>
                <p className="text-xs font-semibold text-slate-700">Your cart is currently empty</p>
                <button
                  onClick={closeCart}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200"
                >
                  Start Exploring
                </button>
              </div>
            ) : (
              cart.items.map((item) => (
                <div key={item.id} className="flex gap-3 pb-4 border-b border-slate-100 group">
                  <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl overflow-hidden shrink-0">
                    {item.product.images[0]?.url ? (
                      <img src={item.product.images[0].url} alt={item.product.title} className="w-full h-full object-cover" />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 truncate">{item.product.title}</h4>
                    <p className="text-[11px] text-slate-500 truncate">{item.variant.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-slate-200 rounded-lg text-xs">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2 py-0.5 hover:bg-slate-100 text-slate-600 font-bold"
                        >
                          -
                        </button>
                        <span className="px-2 font-semibold text-slate-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-0.5 hover:bg-slate-100 text-slate-600 font-bold"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Rs. {item.totalPrice.toLocaleString()}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-slate-400 hover:text-rose-600"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Button */}
          {cart && cart.items.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">Rs. {cart.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Shipping</span>
                <span className="font-semibold text-emerald-600">
                  {cart.shippingTotal === 0 ? 'FREE' : `Rs. ${cart.shippingTotal}`}
                </span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total</span>
                <span className="text-blue-600">Rs. {cart.total.toLocaleString()}</span>
              </div>

              <Link
                href="/checkout"
                onClick={closeCart}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
