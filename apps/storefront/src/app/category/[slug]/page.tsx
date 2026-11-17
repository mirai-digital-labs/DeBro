import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchCategoryBySlug, fetchProducts } from '@/lib/api';
import { ArrowLeft, Sparkles, Filter } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface CategoryPageProps {
  params: { slug: string };
  searchParams: Record<string, string>;
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const category = await fetchCategoryBySlug(params.slug);
  
  // If backend is not running during build or category not found, provide graceful fallback
  const categoryName = category?.name || (params.slug === 'tech' ? 'Laptops & Tech' : 'Fashion & Apparel');
  const categoryDesc = category?.description || 'Universal Dynamic Catalog';

  const products = await fetchProducts({
    categorySlug: params.slug === 'tech' ? 'laptops-computing' : params.slug === 'fashion' ? 'fashion-apparel' : params.slug,
    ...searchParams,
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">{categoryName}</span>
      </div>

      {/* Category Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Dynamic Category</span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">{categoryName}</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">{categoryDesc}</p>
        </div>
        <div className="px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Faceted Attribute Filters Active</span>
        </div>
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Dynamic Attributes Sidebar */}
        <aside className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6 h-fit">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
              <Filter className="w-4 h-4 text-blue-600" />
              <span>Dynamic Filters</span>
            </div>
            <Link href={`/category/${params.slug}`} className="text-xs text-blue-600 hover:underline">
              Clear
            </Link>
          </div>

          {/* Render Category's Registered Dynamic Attributes */}
          {category?.attributes && category.attributes.length > 0 ? (
            category.attributes
              .filter((attr) => attr.isFilterable)
              .map((attr) => (
                <div key={attr.id} className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    {attr.label} {attr.unit ? `(${attr.unit})` : ''}
                  </label>
                  {attr.options && attr.options.length > 0 ? (
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {attr.options.map((opt) => (
                        <Link
                          key={opt.id}
                          href={`/category/${params.slug}?attr_${attr.code}=${encodeURIComponent(opt.value)}`}
                          className="flex items-center justify-between hover:text-blue-600 py-0.5 group"
                        >
                          <span className="group-hover:translate-x-0.5 transition-transform">{opt.displayLabel}</span>
                          {opt.colorHex && (
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-slate-300"
                              style={{ backgroundColor: opt.colorHex }}
                            ></span>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder={`Filter by ${attr.label}`}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                    />
                  )}
                </div>
              ))
          ) : (
            <p className="text-xs text-slate-400">Loading dynamic filters from catalog engine...</p>
          )}
        </aside>

        {/* Product Cards Grid */}
        <section className="lg:col-span-3">
          {products.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <span className="text-4xl">📦</span>
              <h3 className="font-bold text-base text-slate-800">No products matching criteria</h3>
              <p className="text-xs text-slate-500">Try adjusting your dynamic attribute filters or search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((p) => {
                const primaryVariant = p.variants[0];
                const lowestPrice = Math.min(...p.variants.map((v) => v.price));
                const thumbnail = p.images.find((img) => img.isThumbnail) || p.images[0];

                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between group"
                  >
                    <div>
                      {/* Thumbnail */}
                      <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                        {thumbnail ? (
                          <img
                            src={thumbnail.url}
                            alt={thumbnail.altText || p.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <span className="text-4xl">🛍️</span>
                        )}
                        {p.brand && (
                          <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {p.brand}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-2">
                        <Link href={`/product/${p.slug}`}>
                          <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition line-clamp-1">
                            {p.title}
                          </h4>
                        </Link>
                        <p className="text-xs text-slate-500 line-clamp-2">{p.shortDescription}</p>

                        {/* Dynamic Specifications Preview */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {Object.entries(p.attributesJson).slice(0, 3).map(([key, val]) => (
                            <span key={key} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-medium rounded">
                              {String(val)}
                            </span>
                          ))}
                        </div>

                        {/* Price */}
                        <div className="pt-2 flex items-baseline gap-2">
                          <span className="text-base font-extrabold text-slate-900">
                            Rs. {lowestPrice.toLocaleString()}
                          </span>
                          {primaryVariant?.compareAtPrice && (
                            <span className="text-xs text-slate-400 line-through">
                              Rs. {primaryVariant.compareAtPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <Link
                        href={`/product/${p.slug}`}
                        className="w-full py-2 bg-slate-900 hover:bg-blue-600 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <span>View Details</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
