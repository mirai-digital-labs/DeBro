'use client';

import { useState } from 'react';
import { Product, ProductVariant } from '@platform/types';
import { useCartStore } from '@/lib/cart-store';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Truck, RotateCcw } from 'lucide-react';

interface PdpActionBoxProps {
  product: Product;
}

export function PdpActionBox({ product }: PdpActionBoxProps) {
  const router = useRouter();
  const { addItem, openCart } = useCartStore();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async () => {
    setIsAdding(true);
    await addItem(selectedVariant.id, quantity);
    setIsAdding(false);
    openCart();
  };

  const handleDirectBuy = async () => {
    setIsAdding(true);
    await addItem(selectedVariant.id, quantity);
    setIsAdding(false);
    router.push('/checkout');
  };

  return (
    <div className="space-y-6">
      <div>
        {product.brand && (
          <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px] uppercase tracking-wider">
            {product.brand}
          </span>
        )}
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2">
          {product.title}
        </h1>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          {product.shortDescription || product.description}
        </p>
      </div>

      {/* Pricing Display */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-baseline gap-3">
        <span className="text-3xl font-black text-slate-900">
          Rs. {selectedVariant.price.toLocaleString()}
        </span>
        {selectedVariant.compareAtPrice && (
          <span className="text-sm text-slate-400 line-through">
            Rs. {selectedVariant.compareAtPrice.toLocaleString()}
          </span>
        )}
        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
          In Stock (Pakistan)
        </span>
      </div>

      {/* Variants Selector Matrix */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-800 block">
          Available Configurations ({product.variants.length})
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {product.variants.map((v) => {
            const isSelected = selectedVariant.id === v.id;
            return (
              <div
                key={v.id}
                onClick={() => setSelectedVariant(v)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="font-bold text-slate-900">{v.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">SKU: {v.sku}</p>
                <p className="font-extrabold text-blue-600 mt-1">Rs. {v.price.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quantity & Action Buttons */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">Quantity:</label>
          <div className="flex items-center border border-slate-200 rounded-lg text-xs bg-slate-50">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-3 py-1.5 hover:bg-slate-200 text-slate-700 font-bold"
            >
              -
            </button>
            <span className="px-3 font-semibold text-slate-900">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="px-3 py-1.5 hover:bg-slate-200 text-slate-700 font-bold"
            >
              +
            </button>
          </div>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={isAdding}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{isAdding ? 'Adding...' : 'Add to Shopping Cart'}</span>
        </button>

        <button
          onClick={handleDirectBuy}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
        >
          Order with Cash on Delivery (1-Click)
        </button>
      </div>

      {/* Trust Guarantees */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Fast 2-4 Days Shipping</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Official Warranty</span>
        </div>
        <div className="flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
          <span>7-Day Return</span>
        </div>
      </div>
    </div>
  );
}
