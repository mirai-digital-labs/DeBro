const { spawn } = require('child_process');
const http = require('http');

console.log('=================================================================');
console.log('🧪 Starting Phase 3 Cart & Checkout Acceptance Test Suite');
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
    // 1. Initialize Cart
    console.log('\n--- 1. Testing Cart Initialization ---');
    const initRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/cart',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {});
    assert(initRes.status === 201, 'POST /api/v1/cart creates new shopping cart with 201 Created');
    const cartId = initRes.body.data.id;
    assert(cartId && cartId.startsWith('cart_'), 'Cart ID generated with correct prefix');

    // 2. Add Fashion Item (Oxford Cotton Shirt: Rs. 3,850)
    console.log('\n--- 2. Testing Adding Item & Free Shipping Rule (Pakistan) ---');
    const addItemRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartId}/items`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      variantId: 'var_oxf_wht_m',
      quantity: 1,
    });
    assert(addItemRes.status === 200, 'POST /api/v1/cart/:id/items adds item with 200 OK');
    assert(addItemRes.body.data.items.length === 1, 'Cart has 1 line item');
    assert(addItemRes.body.data.subtotal === 3850, 'Subtotal correctly calculated as Rs. 3,850');
    assert(addItemRes.body.data.shippingTotal === 0, 'Qualifies for FREE shipping (subtotal >= Rs. 2,999)');

    // 3. Add Tech Item (Ultrabook Pro 14 OLED: Rs. 285,000)
    console.log('\n--- 3. Testing Cross-Category Universal Cart ---');
    const addTechRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartId}/items`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      variantId: 'var_ub14_16_512',
      quantity: 1,
    });
    assert(addTechRes.status === 200, 'Cross-category item added successfully');
    assert(addTechRes.body.data.items.length === 2, 'Cart contains items from both Fashion and Tech');
    assert(addTechRes.body.data.subtotal === (3850 + 285000), 'Combined subtotal calculated correctly (Rs. 288,850)');

    // 4. Update Item Quantity
    console.log('\n--- 4. Testing Quantity Modification ---');
    const shirtItemId = addTechRes.body.data.items.find((i) => i.variantId === 'var_oxf_wht_m').id;
    const updateRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartId}/items/${shirtItemId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, {
      quantity: 2,
    });
    assert(updateRes.status === 200, 'PATCH /api/v1/cart/:id/items/:itemId updates quantity');
    const updatedShirt = updateRes.body.data.items.find((i) => i.id === shirtItemId);
    assert(updatedShirt.quantity === 2, 'Quantity updated to 2');
    assert(updatedShirt.totalPrice === 3850 * 2, 'Line item total recalculated (Rs. 7,700)');

    // 5. Checkout Validation (Rejection on Invalid Phone)
    console.log('\n--- 5. Testing Pakistani Phone Validation ---');
    const invalidCheckoutRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartId}/checkout`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      customerEmail: 'customer@nexstore.pk',
      customerPhone: '12345', // Invalid
      paymentGateway: 'COD',
      shippingAddress: {
        firstName: 'Ali',
        lastName: 'Khan',
        phone: '12345',
        addressLine1: 'House 42, Street 5, DHA Phase 6',
        city: 'Karachi',
        province: 'Sindh',
        postalCode: '75500',
        countryCode: 'PK',
      },
    });
    assert(invalidCheckoutRes.status === 400, 'Checkout rejects invalid phone format with 400 Bad Request');

    // 6. Valid Checkout (COD in Karachi)
    console.log('\n--- 6. Testing Valid Checkout Execution ---');
    const validCheckoutRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartId}/checkout`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      customerEmail: 'ali.khan@gmail.com',
      customerPhone: '03001234567', // Valid Pakistani mobile
      paymentGateway: 'COD',
      shippingAddress: {
        firstName: 'Ali',
        lastName: 'Khan',
        phone: '03001234567',
        addressLine1: 'House 42, Street 5, DHA Phase 6',
        city: 'Karachi',
        province: 'Sindh',
        postalCode: '75500',
        countryCode: 'PK',
      },
    });
    assert(validCheckoutRes.status === 201, 'POST /api/v1/cart/:id/checkout creates Order with 201 Created');
    const order = validCheckoutRes.body.data;
    assert(order && order.orderNumber.startsWith('ORD-'), 'Order Number generated with standard format');
    assert(order.orderStatus === 'CONFIRMED', 'COD Order initialized in CONFIRMED state');
    assert(order.shippingAddress.city === 'Karachi', 'Order preserves shipping address');
    assert(order.items.length === 2, 'Order preserves itemized line items');

    // 7. Order Lookup by Order Number
    console.log('\n--- 7. Testing Order Tracking Lookup ---');
    const lookupRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${order.orderNumber}`,
      method: 'GET',
    });
    assert(lookupRes.status === 200, 'GET /api/v1/orders/:orderNumber returns 200 OK');
    assert(lookupRes.body.data.orderNumber === order.orderNumber, 'Retrieved order matches placed order number');

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
