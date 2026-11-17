import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchProductBySlug } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import { PdpActionBox } from '@/components/pdp-action-box';

export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: { slug: string };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const product = await fetchProductBySlug(params.slug);

  if (!product) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 max-w-lg mx-auto">
        <span className="text-4xl">🔍</span>
        <h2 className="text-lg font-bold text-slate-800">Product Not Found</h2>
        <p className="text-xs text-slate-500">The product you are looking for may have been archived or does not exist.</p>
        <Link href="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">
          Return to Storefront
        </Link>
      </div>
    );
  }

  const mainImage = product.images[0]?.url || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>
        <span>/</span>
        <span className="capitalize">{product.category?.name || 'Category'}</span>
        <span>/</span>
        <span className="font-semibold text-slate-900 truncate max-w-xs">{product.title}</span>
      </div>

      {/* Main PDP Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
        {/* Left Column: Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center">
            <img
              src={mainImage}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images.map((img) => (
                <div key={img.id} className="w-20 h-20 rounded-xl overflow-hidden border-2 border-blue-600 shrink-0">
                  <img src={img.url} alt={img.altText || ''} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Buying Box & Specifications */}
        <PdpActionBox product={product} />
      </div>

      {/* Dynamic Specifications Sheet */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">Universal Dynamic Specifications</h3>
        <p className="text-xs text-slate-500">Attributes governed dynamically by category rules</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {Object.entries(product.attributesJson).map(([code, val]) => (
            <div key={code} className="flex justify-between p-3 bg-slate-50 rounded-xl text-xs">
              <span className="font-medium text-slate-600 capitalize">{code.replace(/_/g, ' ')}</span>
              <span className="font-bold text-slate-900">{String(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
