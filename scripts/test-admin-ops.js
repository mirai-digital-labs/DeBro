const { spawn } = require('child_process');
const http = require('http');

console.log('=================================================================');
console.log('🧪 Starting Phase 10 Admin Dashboard, Operations & CMS Test');
console.log('=================================================================');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const server = spawn('node', ['apps/backend/dist/index.js'], { stdio: 'inherit' });

async function runTests() {
  await new Promise((r) => setTimeout(r, 2000));

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // 1. Super Admin Executive Dashboard Metrics
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing Super Admin Dashboard Metrics ---');
    const metricsRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/admin/dashboard/metrics',
      method: 'GET',
    });
    assert(metricsRes.status === 200, 'GET /api/v1/admin/dashboard/metrics returns 200 OK');
    assert(metricsRes.body.data.currency === 'PKR', 'Metrics base currency is PKR');
    assert(typeof metricsRes.body.data.grossMerchandiseValue === 'number', 'GMV tracked as number');
    assert(typeof metricsRes.body.data.netRevenue === 'number', 'Platform net revenue calculated');
    assert(metricsRes.body.data.activeSellersCount >= 2, 'Active verified marketplace sellers tracked');
    assert(metricsRes.body.data.lowStockAlertsCount >= 1, 'Inventory low stock alerts active');

    // ------------------------------------------------------------------------
    // 2. Dynamic Content & CMS Banners Management
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing CMS Banner & Content Management ---');
    const allBanners = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/admin/cms/banners',
      method: 'GET',
    });
    assert(allBanners.status === 200, 'GET /api/v1/admin/cms/banners returns 200 OK');
    assert(allBanners.body.data.count >= 4, 'Initial seeded CMS banners active');

    // Filter by placement: HERO
    const heroBanners = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/admin/cms/banners?placement=HERO',
      method: 'GET',
    });
    assert(heroBanners.body.data.banners.length >= 2, 'Hero placement filter returns active sliders');
    assert(
      heroBanners.body.data.banners.every((b) => b.placement === 'HERO'),
      'All returned banners strictly belong to HERO placement'
    );

    // Create New Promotional Banner
    const createBannerRes = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/admin/cms/banners',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        title: 'Ramadan Tech Gala Mega Deals',
        subtitle: 'Up to 20% off on all Laptops and Workstations.',
        imageUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1',
        targetUrl: '/promotions/ramadan-gala',
        placement: 'HERO',
        displayOrder: 3,
      }
    );
    assert(createBannerRes.status === 201, 'POST /api/v1/admin/cms/banners returns 201 Created');
    const newBannerId = createBannerRes.body.data.id;
    assert(newBannerId.startsWith('ban_'), 'Banner ID formatted with prefix');

    // Update Banner
    const updateBannerRes = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: `/api/v1/admin/cms/banners/${newBannerId}`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        title: 'Ramadan Tech Gala - FINAL 24 HOURS',
      }
    );
    assert(updateBannerRes.status === 200, 'PATCH /api/v1/admin/cms/banners/:id returns 200 OK');
    assert(
      updateBannerRes.body.data.title === 'Ramadan Tech Gala - FINAL 24 HOURS',
      'Banner title successfully updated'
    );

    // Delete Banner
    const deleteBannerRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/admin/cms/banners/${newBannerId}`,
      method: 'DELETE',
    });
    assert(deleteBannerRes.status === 200, 'DELETE /api/v1/admin/cms/banners/:id returns 200 OK');
    assert(deleteBannerRes.body.success === true, 'Banner successfully removed');

    // ------------------------------------------------------------------------
    // 3. Marketing Promotions & Coupon Validation Engine
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing Marketing Promotions & Coupon Validation ---');
    const couponsRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/admin/promotions/coupons',
      method: 'GET',
    });
    assert(couponsRes.status === 200, 'GET /api/v1/admin/promotions/coupons returns 200 OK');
    assert(couponsRes.body.data.count >= 3, 'Seeded promotional coupons active');

    // Test 3.1: Valid Percentage Coupon (WELCOME10 - 10% off Rs. 10,000 cart)
    const valPercent = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/admin/promotions/validate-coupon',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { code: 'WELCOME10', cartTotal: 10000 }
    );
    assert(valPercent.status === 200, 'Percentage coupon validation returns 200 OK');
    assert(valPercent.body.data.valid === true, 'WELCOME10 accepted');
    assert(valPercent.body.data.discountAmount === 1000, '10% discount correctly computed (Rs. 1,000)');
    assert(valPercent.body.data.finalCartTotal === 9000, 'Final cart total calculated (Rs. 9,000)');

    // Test 3.2: Max Discount Cap Enforcement (WELCOME10 max Rs. 10,000 cap on Rs. 200,000 cart)
    const valCap = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/admin/promotions/validate-coupon',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { code: 'WELCOME10', cartTotal: 200000 }
    );
    assert(
      valCap.body.data.discountAmount === 10000,
      'Discount capped at maximum allowed limit (Rs. 10,000)'
    );
    assert(valCap.body.data.finalCartTotal === 190000, 'Final cart total respects max discount cap');

    // Test 3.3: Fixed Amount Coupon (FLAT500 on Rs. 4,000 cart)
    const valFixed = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/admin/promotions/validate-coupon',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { code: 'FLAT500', cartTotal: 4000 }
    );
    assert(valFixed.body.data.valid === true, 'FLAT500 accepted');
    assert(valFixed.body.data.discountAmount === 500, 'Flat Rs. 500 discount deducted');
    assert(valFixed.body.data.finalCartTotal === 3500, 'Final cart total Rs. 3,500');

    // Test 3.4: Minimum Cart Threshold Enforcement (FLAT500 requires Rs. 2,999)
    const valMinFail = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/admin/promotions/validate-coupon',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { code: 'FLAT500', cartTotal: 1500 }
    );
    assert(valMinFail.body.data.valid === false, 'Sub-threshold cart rejected');
    assert(
      valMinFail.body.data.reason.includes('Minimum cart value'),
      'Clear descriptive error for minimum order requirement'
    );

    // Test 3.5: Usage Limit Exhaustion (TECHVIP has 50/50 used)
    const valExhausted = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/admin/promotions/validate-coupon',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { code: 'TECHVIP', cartTotal: 80000 }
    );
    assert(valExhausted.body.data.valid === false, 'Exhausted coupon rejected');
    assert(
      valExhausted.body.data.reason.includes('maximum global usage limit'),
      'Clear reason indicating usage exhaustion'
    );

    // Test 3.6: Redeem Coupon increments timesUsed
    const redeemRes = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/admin/promotions/redeem-coupon',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { code: 'WELCOME10', cartTotal: 5000 }
    );
    assert(redeemRes.status === 200, 'Redeem coupon returns 200 OK');
    assert(redeemRes.body.data.coupon.timesUsed === 13, 'Usage counter incremented from 12 to 13');

    // ------------------------------------------------------------------------
    // 4. Automated SEO & Schema.org JSON-LD Structured Data
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing SEO & Structured Data Generation ---');
    const seoRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/seo/product/ultrabook-pro-14-oled',
      method: 'GET',
    });
    assert(seoRes.status === 200, 'GET /api/v1/seo/product/:slug returns 200 OK');
    assert(
      seoRes.body.data.canonicalUrl === 'https://debro.pk/products/ultrabook-pro-14-oled',
      'Canonical URL correctly structured'
    );
    assert(
      seoRes.body.data.openGraph.type === 'product',
      'OpenGraph metadata configured with product type'
    );
    assert(
      seoRes.body.data.openGraph.image.length > 0,
      'OpenGraph primary product image attached'
    );

    // Verify Schema.org JSON-LD Specification
    const jsonLd = seoRes.body.data.jsonLd;
    assert(jsonLd['@context'] === 'https://schema.org/', 'Schema.org @context verified');
    assert(jsonLd['@type'] === 'Product', 'Schema.org @type is Product');
    assert(jsonLd.name.includes('Ultrabook'), 'Product name embedded in JSON-LD');
    assert(jsonLd.offers['@type'] === 'Offer', 'Offer specification embedded');
    assert(jsonLd.offers.priceCurrency === 'PKR', 'Currency specified as PKR');
    assert(jsonLd.offers.price === 285000, 'Accurate product variant price embedded');
    assert(
      jsonLd.offers.availability === 'https://schema.org/InStock',
      'Inventory-aware schema availability set to InStock'
    );

    // Test XML Sitemap
    const sitemapRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/seo/sitemap.xml',
      method: 'GET',
    });
    assert(sitemapRes.status === 200, 'GET /api/v1/seo/sitemap.xml returns 200 OK');
    assert(
      sitemapRes.headers['content-type'].includes('application/xml'),
      'Content-Type is application/xml'
    );
    assert(
      sitemapRes.body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'),
      'Valid sitemap XML schema declaration'
    );
    assert(sitemapRes.body.includes('https://debro.pk/products/ultrabook-pro-14-oled'), 'Product URL present in sitemap');
    assert(sitemapRes.body.includes('https://debro.pk/category/laptops-computing'), 'Category URL present in sitemap');
    assert(sitemapRes.body.includes('<priority>1.0</priority>'), 'Homepage priority assigned');

    // ------------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log(`📊 Phase 10 Admin & Operations Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected test error:', err);
    process.exit(1);
  } finally {
    server.kill();
  }
}

runTests();
