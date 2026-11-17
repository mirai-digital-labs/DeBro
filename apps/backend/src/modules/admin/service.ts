import {
  AdminExecutiveMetrics,
  CMSBanner,
  Coupon,
  CouponValidationResult,
  Product,
  SEOProductMeta,
} from '@platform/types';
import { cartService } from '../cart/service.js';
import { marketplaceService } from '../marketplace/service.js';
import { inventoryService } from '../inventory/service.js';
import { catalogService } from '../catalog/service.js';

export class AdminService {
  private banners: Map<string, CMSBanner> = new Map();
  private coupons: Map<string, Coupon> = new Map();

  constructor() {
    this.seedDefaultBanners();
    this.seedDefaultCoupons();
  }

  // --------------------------------------------------------------------------
  // Seed Initial Content & Promotions
  // --------------------------------------------------------------------------
  private seedDefaultBanners() {
    const banners: CMSBanner[] = [
      {
        id: 'ban_hero_01',
        title: 'Next-Gen Intel Core Ultra & OLED Performance',
        subtitle: 'Experience lightning-fast AI workflows with the Ultrabook Pro 14 OLED.',
        imageUrl:
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1600&q=80',
        targetUrl: '/products/ultrabook-pro-14-oled',
        placement: 'HERO',
        displayOrder: 1,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ban_hero_02',
        title: 'Heavy Workstation Compute for Developers',
        subtitle: 'AMD Ryzen 7 8845HS with dedicated RTX graphics for engineering builds.',
        imageUrl:
          'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1600&q=80',
        targetUrl: '/products/thinkbook-workstation-x1-max',
        placement: 'HERO',
        displayOrder: 2,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ban_promo_strip_01',
        title: '100% Free Nationwide Delivery across Pakistan on Orders Above Rs. 2,999!',
        targetUrl: '/catalog',
        placement: 'PROMO_STRIP',
        displayOrder: 1,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ban_announcement_01',
        title: 'JazzCash, Easypaisa & Cash on Delivery supported nationwide.',
        targetUrl: '/policies',
        placement: 'ANNOUNCEMENT',
        displayOrder: 1,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const b of banners) {
      this.banners.set(b.id, b);
    }
  }

  private seedDefaultCoupons() {
    const coupons: Coupon[] = [
      {
        id: 'coup_welcome10',
        code: 'WELCOME10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        minOrderAmount: 2000,
        maxDiscountAmount: 10000,
        usageLimit: 500,
        timesUsed: 12,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'coup_flat500',
        code: 'FLAT500',
        discountType: 'FIXED_AMOUNT',
        discountValue: 500,
        minOrderAmount: 2999,
        usageLimit: 200,
        timesUsed: 4,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'coup_techvip',
        code: 'TECHVIP',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        minOrderAmount: 50000,
        maxDiscountAmount: 25000,
        usageLimit: 50,
        timesUsed: 50, // Exhausted coupon for test verification
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const c of coupons) {
      this.coupons.set(c.code.toUpperCase(), c);
    }
  }

  // --------------------------------------------------------------------------
  // 1. Super Admin Executive Dashboard Metrics
  // --------------------------------------------------------------------------
  public getExecutiveMetrics(): AdminExecutiveMetrics {
    const orders = cartService.getAllOrders();
    const sellers = marketplaceService.getAllSellers();
    const lowStock = inventoryService.getLowStockAlerts(10);

    const gmv = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = orders.length;
    const aov = totalOrders > 0 ? Math.round(gmv / totalOrders) : 0;

    // Estimate platform commission revenue
    const netRevenue = Math.round(gmv * 0.08); // Blended ~8% average commission

    const activeSellersCount = sellers.filter((s) => s.status === 'ACTIVE').length;
    const pendingSellerKycCount = sellers.filter(
      (s) => s.status === 'PENDING_APPROVAL'
    ).length;

    return {
      grossMerchandiseValue: gmv,
      netRevenue,
      totalOrders,
      averageOrderValue: aov,
      activeSellersCount,
      pendingSellerKycCount,
      lowStockAlertsCount: lowStock.length,
      currency: 'PKR',
      generatedAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // 2. CMS Banner Management
  // --------------------------------------------------------------------------
  public getBanners(placement?: string, activeOnly: boolean = true): CMSBanner[] {
    let list = Array.from(this.banners.values());
    if (activeOnly) {
      list = list.filter((b) => b.isActive);
    }
    if (placement) {
      list = list.filter((b) => b.placement === placement.toUpperCase());
    }
    return list.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public createBanner(payload: Omit<CMSBanner, 'id' | 'createdAt'>): CMSBanner {
    const id = `ban_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const banner: CMSBanner = {
      ...payload,
      id,
      createdAt: new Date().toISOString(),
    };
    this.banners.set(id, banner);
    return banner;
  }

  public updateBanner(id: string, updates: Partial<CMSBanner>): CMSBanner {
    const existing = this.banners.get(id);
    if (!existing) {
      throw new Error(`Banner with ID '${id}' not found.`);
    }
    const updated = { ...existing, ...updates };
    this.banners.set(id, updated);
    return updated;
  }

  public deleteBanner(id: string): boolean {
    return this.banners.delete(id);
  }

  // --------------------------------------------------------------------------
  // 3. Marketing & Promotions Engine
  // --------------------------------------------------------------------------
  public getAllCoupons(): Coupon[] {
    return Array.from(this.coupons.values());
  }

  public createCoupon(payload: Omit<Coupon, 'id' | 'timesUsed' | 'createdAt'>): Coupon {
    const code = payload.code.toUpperCase().trim();
    if (this.coupons.has(code)) {
      throw new Error(`Coupon with code '${code}' already exists.`);
    }

    const coupon: Coupon = {
      ...payload,
      id: `coup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code,
      timesUsed: 0,
      createdAt: new Date().toISOString(),
    };

    this.coupons.set(code, coupon);
    return coupon;
  }

  public validateCoupon(code: string, cartTotal: number): CouponValidationResult {
    const coupon = this.coupons.get(code.toUpperCase().trim());

    if (!coupon) {
      return {
        valid: false,
        discountAmount: 0,
        finalCartTotal: cartTotal,
        reason: 'Invalid coupon code.',
      };
    }

    if (!coupon.isActive) {
      return {
        valid: false,
        discountAmount: 0,
        finalCartTotal: cartTotal,
        reason: 'This promotion is no longer active.',
      };
    }

    // Check usage limits
    if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
      return {
        valid: false,
        discountAmount: 0,
        finalCartTotal: cartTotal,
        reason: 'This coupon has reached its maximum global usage limit.',
      };
    }

    // Check min order threshold
    if (coupon.minOrderAmount && cartTotal < coupon.minOrderAmount) {
      return {
        valid: false,
        discountAmount: 0,
        finalCartTotal: cartTotal,
        reason: `Minimum cart value of Rs. ${coupon.minOrderAmount.toLocaleString('en-PK')} required to apply this coupon.`,
      };
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = Math.round((cartTotal * coupon.discountValue) / 100);
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      discount = coupon.discountValue;
    }

    // Ensure discount does not exceed cart total
    discount = Math.min(discount, cartTotal);
    const finalCartTotal = cartTotal - discount;

    return {
      valid: true,
      discountAmount: discount,
      finalCartTotal,
      coupon,
    };
  }

  public redeemCoupon(code: string, cartTotal: number): CouponValidationResult {
    const result = this.validateCoupon(code, cartTotal);
    if (result.valid && result.coupon) {
      result.coupon.timesUsed++;
      this.coupons.set(result.coupon.code, result.coupon);
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // 4. Automated SEO & Structured Data (Schema.org JSON-LD + Sitemap)
  // --------------------------------------------------------------------------
  public async generateProductSEO(slug: string, baseUrl: string = 'https://debro.pk'): Promise<SEOProductMeta> {
    const product = await catalogService.getProductByIdOrSlug(slug);
    if (!product) {
      throw new Error(`Product not found with slug '${slug}'`);
    }

    const primaryVariant = product.variants[0];
    const availableStock = inventoryService.getAvailableStock(primaryVariant?.id || '');
    const canonicalUrl = `${baseUrl}/products/${product.slug}`;
    const primaryImg = product.images[0]?.url || `${baseUrl}/og-default.jpg`;

    const jsonLd = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.title,
      image: product.images.map((i) => i.url),
      description: product.shortDescription || product.description,
      brand: {
        '@type': 'Brand',
        name: product.brand || 'DeBro',
      },
      offers: {
        '@type': 'Offer',
        url: canonicalUrl,
        priceCurrency: 'PKR',
        price: primaryVariant?.price || 0,
        priceValidUntil: '2027-12-31',
        itemCondition: 'https://schema.org/NewCondition',
        availability: availableStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: 'DeBro Global Commerce',
        },
      },
    };

    return {
      productId: product.id,
      title: `${product.title} - Best Price in Pakistan | DeBro`,
      canonicalUrl,
      metaDescription: product.shortDescription || product.title,
      openGraph: {
        title: product.title,
        description: product.shortDescription || '',
        image: primaryImg,
        type: 'product',
        url: canonicalUrl,
      },
      jsonLd,
    };
  }

  public async generateSitemapXml(baseUrl: string = 'https://debro.pk'): Promise<string> {
    const categories = await catalogService.getCategories();
    const products = (await catalogService.getProducts({ limit: 1000 })).items;
    const now = new Date().toISOString().split('T')[0];

    let urls = `
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/catalog</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

    for (const cat of categories) {
      urls += `
  <url>
    <loc>${baseUrl}/category/${cat.slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    for (const prod of products) {
      urls += `
  <url>
    <loc>${baseUrl}/products/${prod.slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  }
}

export const adminService = new AdminService();
