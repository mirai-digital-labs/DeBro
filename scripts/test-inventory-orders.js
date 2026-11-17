const { spawn } = require('child_process');
const http = require('http');

console.log('=================================================================');
console.log('🧪 Starting Phase 4 Concurrency-Safe Inventory & Order Lifecycle Test');
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
    // 1. Warehouse Hub Discovery
    console.log('\n--- 1. Testing Warehouse Fulfillment Hubs ---');
    const whRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/warehouses',
      method: 'GET',
    });
    assert(whRes.status === 200, 'GET /api/v1/inventory/warehouses returns 200 OK');
    assert(whRes.body.data.length >= 2, 'Found at least 2 active fulfillment hubs (Karachi & Lahore)');
    const hasKhi = whRes.body.data.some((w) => w.code === 'WH-KHI-01');
    assert(hasKhi, 'Karachi Central Fulfillment Hub (WH-KHI-01) is active');

    // 2. Stock Lookup & Multi-Warehouse Breakdown
    console.log('\n--- 2. Testing Stock Lookup & Warehouse Allocation ---');
    const stockRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/stock/var_ub14_16_512',
      method: 'GET',
    });
    assert(stockRes.status === 200, 'GET /api/v1/inventory/stock/:variantId returns 200 OK');
    assert(stockRes.body.data.availableStock >= 14, 'Ultrabook variant has 14 units available in stock');

    // 3. Temporary Reservation & Rollback
    console.log('\n--- 3. Testing Two-Phase Stock Reservation & Release ---');
    const resvRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/reserve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      cartId: 'test_cart_hold_01',
      variantId: 'var_ub14_16_512',
      quantity: 2,
      ttlMinutes: 15,
    });
    assert(resvRes.status === 201, 'POST /api/v1/inventory/reserve creates 15-min TTL hold (201 Created)');

    const afterHold = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/stock/var_ub14_16_512',
      method: 'GET',
    });
    assert(afterHold.body.data.availableStock === 12, 'Available stock correctly decremented to 12 during hold');

    // Release Hold
    const relRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/release',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { cartId: 'test_cart_hold_01' });
    assert(relRes.status === 200, 'POST /api/v1/inventory/release rolls back reservation');

    const afterRel = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/stock/var_ub14_16_512',
      method: 'GET',
    });
    assert(afterRel.body.data.availableStock === 14, 'Stock restored to 14 after reservation release');

    // 4. Concurrency & Flash Sale Overselling Prevention
    console.log('\n--- 4. Testing Concurrency & Flash Sale Overselling Prevention ---');
    // var_flash_rare_01 has only 1 unit in Karachi warehouse
    const rareStock = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/stock/var_flash_rare_01',
      method: 'GET',
    });
    assert(rareStock.body.data.availableStock === 1, 'Limited flash sale item has exactly 1 unit in stock');

    // Create Cart A and Cart B
    const cartARes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/cart',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {});
    const cartBRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/cart',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {});
    const cartAId = cartARes.body.data.id;
    const cartBId = cartBRes.body.data.id;

    // Both carts add the rare 1-unit item
    await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartAId}/items`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { variantId: 'var_ub14_16_512', quantity: 1 });

    await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartBId}/items`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { variantId: 'var_ub14_16_512', quantity: 1 });

    // Manually test direct concurrent reservation of rare item
    console.log('Simulating 2 concurrent buyers rushing for 1 rare item...');
    const buyer1Promise = request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/reserve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { cartId: cartAId, variantId: 'var_flash_rare_01', quantity: 1 });

    const buyer2Promise = request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/reserve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { cartId: cartBId, variantId: 'var_flash_rare_01', quantity: 1 });

    const [buyer1Res, buyer2Res] = await Promise.all([buyer1Promise, buyer2Promise]);
    const onePassed = (buyer1Res.status === 201 && buyer2Res.status === 400) ||
                      (buyer2Res.status === 201 && buyer1Res.status === 400);
    assert(onePassed, 'Concurrency test: Exactly 1 reservation succeeded (201) and 1 was rejected (400)');

    const failedBuyer = buyer1Res.status === 400 ? buyer1Res : buyer2Res;
    assert(
      failedBuyer.body.error && failedBuyer.body.error.message.includes('Overselling prevented'),
      'Overselling error correctly raised: "Overselling prevented: Insufficient available inventory"'
    );

    // 5. Order Placement & State Machine Strict Transitions
    console.log('\n--- 5. Testing Order State Machine Transitions ---');
    const checkoutRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartAId}/checkout`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      customerEmail: 'ahmed.khi@gmail.com',
      customerPhone: '03001234567',
      paymentGateway: 'COD',
      shippingAddress: {
        firstName: 'Ahmed',
        lastName: 'Khan',
        phone: '03001234567',
        addressLine1: 'House 42, Street 5, DHA Phase 6',
        city: 'Karachi',
        postalCode: '75500',
        countryCode: 'PK',
      },
    });

    assert(checkoutRes.status === 201, 'Cart A checkout succeeds with 201 Created');
    const orderNumber = checkoutRes.body.data.orderNumber;
    assert(orderNumber && orderNumber.startsWith('ORD-'), 'Order Number generated');

    // Illegal Transition: CONFIRMED -> DELIVERED (illegal skip)
    const illegalRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${orderNumber}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, { status: 'DELIVERED', actor: 'ADMIN' });
    assert(illegalRes.status === 400, 'State Machine rejects illegal skip transition (CONFIRMED -> DELIVERED) with 400');
    assert(illegalRes.body.error.message.includes('State Machine Violation'), 'Error flags State Machine Violation');

    // Legal Step-by-Step Transition Sequence
    const procRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${orderNumber}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, { status: 'PROCESSING', actor: 'ADMIN', notes: 'Warehouse allocated for packaging' });
    assert(procRes.status === 200, 'CONFIRMED -> PROCESSING transition successful (200 OK)');

    const shipRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${orderNumber}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, { status: 'SHIPPED', actor: 'COURIER', notes: 'Handed over to TCS Logistics (Tracking: TCS-998822)' });
    assert(shipRes.status === 200, 'PROCESSING -> SHIPPED transition successful (200 OK)');

    const delivRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${orderNumber}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, { status: 'DELIVERED', actor: 'COURIER', notes: 'Customer signed delivery receipt' });
    assert(delivRes.status === 200, 'SHIPPED -> DELIVERED transition successful (200 OK)');

    // 6. Immutable Audit Event Ledger
    console.log('\n--- 6. Testing Immutable Audit Event Ledger ---');
    const eventsRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${orderNumber}/events`,
      method: 'GET',
    });
    assert(eventsRes.status === 200, 'GET /api/v1/orders/:orderNumber/events returns 200 OK');
    assert(eventsRes.body.data.length >= 3, 'Audit ledger records all state transition events');
    const courierEvent = eventsRes.body.data.find((e) => e.actor === 'COURIER' && e.toStatus === 'SHIPPED');
    assert(!!courierEvent, 'Courier transition event preserved with actor attribution');

    // 7. RMA (Returns & Refunds) Lifecycle
    console.log('\n--- 7. Testing Returns & Refunds (RMA Engine) ---');
    const returnReqRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${orderNumber}/returns`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      reason: 'Wrong size requested, packaging intact.',
      items: [{ sku: 'LAP-UB14-16-512', quantity: 1 }],
    });
    assert(returnReqRes.status === 201, 'POST /api/v1/orders/:orderNumber/returns creates Return Request with 201 Created');
    const rmaId = returnReqRes.body.data.id;
    assert(rmaId && rmaId.startsWith('rma_'), 'RMA ID generated with rma_ prefix');

    // Admin Approves Return
    const decisionRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/returns/${rmaId}/decision`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      decision: 'APPROVED',
      adminNotes: 'Item verified in warehouse. Refund authorized.',
    });
    assert(decisionRes.status === 200, 'Return approved by Admin returns 200 OK');
    assert(decisionRes.body.data.status === 'APPROVED', 'Return request status updated to APPROVED');

    // Check Order is now REFUNDED
    const finalOrderRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${orderNumber}`,
      method: 'GET',
    });
    assert(finalOrderRes.body.data.orderStatus === 'REFUNDED', 'Order state machine automatically transitioned to REFUNDED');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    server.kill();
    console.log('\n=================================================================');
    console.log(`📊 Test Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
