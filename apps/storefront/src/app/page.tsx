import Link from 'next/link';
import { ArrowRight, ShieldCheck, Truck, Clock, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-8 md:p-12 shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Universal Marketplace</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            One Platform. Every Category. Built for Pakistan.
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Discover verified Tech, premium Fashion, and everyday essentials with guaranteed Cash on Delivery, JazzCash, and express doorstep delivery.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/category/tech"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              <span>Explore Laptops & Tech</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/category/fashion"
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/20 transition"
            >
              <span>Explore Fashion Drop</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust & Guarantee Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">100% Verified Quality</h4>
            <p className="text-xs text-slate-500 mt-0.5">Direct manufacturer warranty</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">Nationwide Fast Shipping</h4>
            <p className="text-xs text-slate-500 mt-0.5">Karachi, Lahore, Islamabad & beyond</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">Easy 7-Day Returns</h4>
            <p className="text-xs text-slate-500 mt-0.5">Hassle-free replacement policy</p>
          </div>
        </div>
      </section>

      {/* Featured Categories Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Featured Categories</h2>
            <p className="text-xs text-slate-500">Universal catalog adapts dynamically to each industry</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tech Card */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition group">
            <div className="text-4xl mb-3">💻</div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Dynamic Specs & Warranty</span>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition mt-1">
              Laptops & Computing
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Filter by RAM, NVMe Storage, Processor tier, OLED screens, and official brand warranties.
            </p>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
              <span>View Tech Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Fashion Card */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition group">
            <div className="text-4xl mb-3">👔</div>
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Sizes, Colors & Fabrics</span>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-rose-600 transition mt-1">
              Men & Women Fashion
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Explore 100% Egyptian cotton shirts, leather boots, and seasonal drops with color swatches.
            </p>
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600">
              <span>View Fashion Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
