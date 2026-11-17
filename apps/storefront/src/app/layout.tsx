import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { ShoppingBag, Search, Heart, User, Sparkles } from 'lucide-react';
import { CartDrawer } from '@/components/cart-drawer';
import { CartButton } from '@/components/cart-button';

export const metadata: Metadata = {
  title: 'NexStore PK | Universal AI-Powered Commerce',
  description: 'Shop Fashion, Tech, and Universal Products across Pakistan with Fast Shipping and Cash on Delivery.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        {/* Top Announcement Bar */}
        <div className="bg-slate-900 text-slate-200 text-xs py-2 px-4 border-b border-slate-800">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>🇵🇰 <strong>Pakistan Direct:</strong> Cash on Delivery & Free Shipping on orders over Rs. 2,999</span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-slate-400">
              <span className="hover:text-white cursor-pointer">Track Order</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">Help</span>
              <span>•</span>
              <span className="text-white font-semibold">PKR (Rs.)</span>
            </div>
          </div>
        </div>

        {/* Global Navigation Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                N
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                NexStore<span className="text-blue-600">.pk</span>
              </span>
            </Link>

            {/* AI-Integrated Universal Search */}
            <div className="flex-1 max-w-xl relative hidden md:block">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Search 50,000+ products or ask AI ('Running shoes under 5000' or 'Core i7 laptop')..."
                  className="w-full bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-600 rounded-full py-2.5 pl-5 pr-28 text-sm outline-none transition"
                />
                <button className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full flex items-center gap-1 transition">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-5">
              <button className="text-slate-600 hover:text-slate-900 flex flex-col items-center text-xs">
                <User className="w-5 h-5" />
                <span className="mt-1 hidden sm:inline">Account</span>
              </button>
              <CartButton />
            </div>
          </div>
        </header>

        {/* Dynamic Storefront Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="bg-slate-900 text-slate-400 text-xs py-10 border-t border-slate-800 mt-12">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  N
                </div>
                <span className="text-base font-bold text-white">NexStore.pk</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Universal AI-Powered Multi-Category Commerce & Marketplace Ecosystem.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Categories</h4>
              <ul className="space-y-2">
                <li><Link href="/category/tech" className="hover:text-white">Laptops & Tech</Link></li>
                <li><Link href="/category/fashion" className="hover:text-white">Fashion & Apparel</Link></li>
                <li><span className="text-slate-500">Groceries (Expanding Soon)</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Customer Support</h4>
              <ul className="space-y-2">
                <li><span className="hover:text-white cursor-pointer">Track Your Order</span></li>
                <li><span className="hover:text-white cursor-pointer">Returns & Refunds</span></li>
                <li><span className="hover:text-white cursor-pointer">Payment Options (COD, JazzCash)</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Payment Methods</h4>
              <p className="text-slate-400 mb-2">We support Pakistan-wide trusted payment methods:</p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 font-bold">COD</span>
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-rose-400 font-bold">JazzCash</span>
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-emerald-400 font-bold">Easypaisa</span>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 mt-8 pt-4 border-t border-slate-800 text-center text-slate-500">
            © 2026 NexStore Commerce Platform. Architecture-First Modular Engineering.
          </div>
        </footer>

        {/* Global Slide-Over Cart Drawer */}
        <CartDrawer />
      </body>
    </html>
  );
}
