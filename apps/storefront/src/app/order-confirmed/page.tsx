'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, ArrowRight, MessageSquare, Phone } from 'lucide-react';
import { Suspense } from 'react';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('orderNumber') || 'ORD-202611-CONFIRMED';

  return (
    <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
        <CheckCircle2 className="w-9 h-9" />
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Order Placed Successfully!</span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
          Shukriya! Your order is confirmed.
        </h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          We have received your order and our logistics team has started preparing your package for shipment.
        </p>
      </div>

      {/* Order Badge Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Tracking Reference</span>
            <p className="text-base font-black text-blue-600">{orderNumber}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
            Cash on Delivery
          </span>
        </div>

        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <Package className="w-4 h-4 text-slate-400" />
            <span>Estimated Delivery: <strong>2 - 4 Business Days</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            <span>SMS & WhatsApp tracking alerts sent to your phone</span>
          </div>
        </div>
      </div>

      <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function OrderConfirmedPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-xs text-slate-400">Loading order details...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
