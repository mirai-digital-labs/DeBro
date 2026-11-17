const { spawn } = require('child_process');
const http = require('http');

console.log('=================================================================');
console.log('🧪 Starting Phase 2 Dynamic Catalog Acceptance Test Suite');
console.log('=================================================================');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
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
    // Test 1: Fetch Categories
    console.log('\n--- 1. Testing Category & Dynamic Attribute Retrieval ---');
    const catRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/categories',
      method: 'GET',
    });
    assert(catRes.status === 200, 'GET /api/v1/categories returns 200 OK');
    assert(catRes.body.count >= 2, 'Categories include both Tech and Fashion');
    const techCat = catRes.body.data.find((c) => c.slug === 'laptops-computing');
    assert(techCat && techCat.attributes.length > 0, 'Tech category includes dynamic attribute definitions');

    // Test 2: Fetch Products
    console.log('\n--- 2. Testing Universal Product Retrieval ---');
    const prodRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/products',
      method: 'GET',
    });
    assert(prodRes.status === 200, 'GET /api/v1/products returns 200 OK');
    assert(prodRes.body.data.length >= 3, 'Returns seeded products across Tech and Fashion');

    // Test 3: Dynamic Faceted Attribute Filter (Tech: RAM 16GB)
    console.log('\n--- 3. Testing Dynamic Attribute Faceted Filtering (Tech) ---');
    const techFilterRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/products?categorySlug=laptops-computing&attr_ram_gb=16GB',
      method: 'GET',
    });
    assert(techFilterRes.status === 200, 'Filter by dynamic attribute attr_ram_gb=16GB returns 200 OK');
    assert(techFilterRes.body.data.length === 1, 'Correctly matched Ultrabook Pro 14 OLED with 16GB RAM');
    assert(techFilterRes.body.data[0].slug === 'ultrabook-pro-14-oled', 'Correct product returned');

    // Test 4: Dynamic Faceted Attribute Filter (Fashion: White Cotton Shirt)
    console.log('\n--- 4. Testing Dynamic Attribute Filtering (Fashion) ---');
    const fashionFilterRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/products?categorySlug=fashion-apparel&attr_color=White',
      method: 'GET',
    });
    assert(fashionFilterRes.status === 200, 'Filter by dynamic attribute attr_color=White returns 200 OK');
    assert(fashionFilterRes.body.data.length === 1, 'Correctly matched Oxford Cotton Shirt with White variant');

    // Test 5: Dynamic Category Validation (Rejection on Missing Required Attributes)
    console.log('\n--- 5. Testing Dynamic Category Validation (Rejection) ---');
    const invalidTechProduct = {
      categoryId: 'cat_tech_laptops',
      title: 'Invalid Fake Laptop',
      slug: 'invalid-fake-laptop',
      attributesJson: {
        // Missing required 'processor' and 'warranty_months'
        screen_size_inch: 15.6,
      },
      variants: [
        {
          sku: 'LAP-FAKE-01',
          title: 'Fake Variant',
          price: 50000,
        },
      ],
    };
    const invalidRes = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/products',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      invalidTechProduct
    );
    assert(invalidRes.status === 422, 'POST /api/v1/products rejects missing category attributes with 422 Unprocessable Entity');
    assert(
      invalidRes.body.error.details.some((d) => d.field.includes('processor')),
      'Validation error explicitly flags missing mandatory processor'
    );

    // Test 6: Dynamic Category Validation (Success on Valid Creation)
    console.log('\n--- 6. Testing Valid Product Creation ---');
    const validTechProduct = {
      categoryId: 'cat_tech_laptops',
      title: 'NexBook Ultra Stealth 15',
      slug: 'nexbook-ultra-stealth-15',
      brand: 'NexStore Tech',
      attributesJson: {
        processor: 'Intel Core Ultra 7',
        warranty_months: 24,
        ram_gb: '32GB',
        storage_ssd: '1TB',
      },
      variants: [
        {
          sku: 'LAP-NBUS-32-1TB',
          title: '32GB / 1TB / Stealth Black',
          price: 320000,
          inventoryQuantity: 10,
        },
      ],
      images: [
        {
          url: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80',
          altText: 'Stealth Black Laptop',
        },
      ],
    };
    const createRes = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/products',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      validTechProduct
    );
    assert(createRes.status === 201, 'POST /api/v1/products creates conforming product with 201 Created');
    assert(createRes.body.data.slug === 'nexbook-ultra-stealth-15', 'Created product has correct slug and id');

    // Test 7: Product Lifecycle Transition
    console.log('\n--- 7. Testing Product Lifecycle State Machine ---');
    const transitionRes = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: `/api/v1/products/${createRes.body.data.id}/status`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { status: 'PENDING_REVIEW' }
    );
    assert(transitionRes.status === 200, 'State transition from DRAFT to PENDING_REVIEW returns 200 OK');
    assert(transitionRes.body.data.status === 'PENDING_REVIEW', 'Product status updated to PENDING_REVIEW');

    console.log('=================================================================');
    console.log(`📊 Test Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================================');
    
    server.kill();
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test Suite Error:', err);
    server.kill();
    process.exit(1);
  }
}

runTests();
