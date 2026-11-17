const { spawn } = require('child_process');
const http = require('http');

console.log('=================================================================');
console.log('🧪 Starting Phase 6 Multi-Vendor Marketplace & Order Splitting Test');
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
    // ------------------------------------------------------------------------
    // 1. Marketplace Sellers Discovery
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing Marketplace Sellers Discovery ---');
    const sellersRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/marketplace/sellers',
      method: 'GET',
    });
    assert(sellersRes.status === 200, 'GET /api/v1/marketplace/sellers returns 200 OK');
    assert(sellersRes.body.data.length >= 3, 'Found active platform and independent marketplace sellers');

    const techSeller = sellersRes.body.data.find((s) => s.id === 'seller_lahore_tech');
    const apparelSeller = sellersRes.body.data.find((s) => s.id === 'seller_karachi_apparel');
    assert(!!techSeller && techSeller.storeName === 'Lahore Tech Hub', 'Lahore Tech Hub seller is active (5% commission)');
    assert(!!apparelSeller && apparelSeller.storeName === 'Karachi Luxury Apparel', 'Karachi Luxury Apparel seller is active (10% commission)');

    // ------------------------------------------------------------------------
    // 2. Seller Onboarding & KYC Pipeline
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Seller Onboarding & KYC Submission ---');
    const registerRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/marketplace/sellers/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      storeName: 'Islamabad Hardware Works',
      email: 'admin@isbhardware.pk',
      phone: '03451234567',
      commissionRatePercent: 7,
      kyc: {
        businessName: 'Islamabad Hardware Tools Pvt Ltd',
        ntnNumber: '5544332-1',
        cnicNumber: '61101-1122334-5',
        bankName: 'Standard Chartered Bank',
        accountTitle: 'Islamabad Hardware Operating',
        iban: 'PK99SCBL0000123456789012',
        city: 'Islamabad',
      },
    });
    assert(registerRes.status === 201, 'POST /api/v1/marketplace/sellers/register returns 201 Created');
    const newSeller = registerRes.body.data;
    assert(newSeller.status === 'PENDING_APPROVAL', 'New seller initialized in PENDING_APPROVAL status');
    assert(newSeller.kyc.isVerified === false, 'Seller KYC marked unverified prior to admin audit');

    // ------------------------------------------------------------------------
    // 3. Admin KYC Verification & Approval Pipeline
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing Admin KYC Verification & Approval ---');
    const reviewRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/marketplace/sellers/${newSeller.id}/kyc-review`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, {
      decision: 'APPROVE',
      adminNotes: 'NTN verified with FBR portal. Bank IBAN matched with business name.',
    });
    assert(reviewRes.status === 200, 'Admin KYC review returns 200 OK');
    assert(reviewRes.body.data.status === 'ACTIVE', 'Seller transitioned to ACTIVE status');
    assert(reviewRes.body.data.kyc.isVerified === true, 'Seller KYC verified flag enabled');

    // ------------------------------------------------------------------------
    // 4. Multi-Seller Cart & Order Splitting Engine
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing Multi-Seller Order Splitting Engine ---');
    const cartRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/cart',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {});
    const cartId = cartRes.body.data.id;

    // Item 1: ThinkBook Workstation from Lahore Tech Hub (Rs. 340,000)
    await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartId}/items`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { variantId: 'var_think_32_1tb', quantity: 1 });

    // Item 2: Oxford Cotton Shirt from Karachi Luxury Apparel (Rs. 3,850)
    await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartId}/items`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { variantId: 'var_oxf_wht_m', quantity: 1 });

    // Checkout Multi-Vendor Cart
    const checkoutRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/cart/${cartId}/checkout`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      customerEmail: 'multi.vendor.buyer@example.pk',
      customerPhone: '03009988776',
      paymentGateway: 'COD',
      shippingAddress: {
        firstName: 'Zain',
        lastName: 'Abbas',
        phone: '03009988776',
        addressLine1: 'F-7/2, Street 15',
        city: 'Islamabad',
        postalCode: '44000',
        countryCode: 'PK',
      },
    });

    assert(checkoutRes.status === 201, 'Multi-vendor checkout returns 201 Created');
    const parentOrder = checkoutRes.body.data;
    const orderNumber = parentOrder.orderNumber;

    // Inspect Split Sub-Orders
    const subOrdersRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/marketplace/orders/${orderNumber}/sub-orders`,
      method: 'GET',
    });
    assert(subOrdersRes.status === 200, 'GET /api/v1/marketplace/orders/:orderNumber/sub-orders returns 200 OK');
    const subOrders = subOrdersRes.body.data;
    assert(subOrders.length === 2, 'Parent order correctly split into EXACTLY 2 distinct sub-orders');

    const subOrderTech = subOrders.find((so) => so.sellerId === 'seller_lahore_tech');
    const subOrderApparel = subOrders.find((so) => so.sellerId === 'seller_karachi_apparel');

    assert(!!subOrderTech, 'Sub-order 1 allocated to Lahore Tech Hub');
    assert(subOrderTech.items.length === 1 && subOrderTech.items[0].productTitle.includes('ThinkBook'), 'Tech sub-order contains only ThinkBook');
    assert(subOrderTech.subtotal === 340000, 'Tech sub-order subtotal is Rs. 340,000');
    assert(subOrderTech.platformCommission === 17000, '5% platform commission calculated correctly (Rs. 17,000)');
    assert(subOrderTech.sellerPayout === 323000, 'Net seller payout calculated correctly (Rs. 323,000)');

    assert(!!subOrderApparel, 'Sub-order 2 allocated to Karachi Luxury Apparel');
    assert(subOrderApparel.items.length === 1 && subOrderApparel.items[0].productTitle.includes('Oxford'), 'Apparel sub-order contains only Oxford Shirt');
    assert(subOrderApparel.subtotal === 3850, 'Apparel sub-order subtotal is Rs. 3,850');
    assert(subOrderApparel.platformCommission === 385, '10% platform commission calculated correctly (Rs. 385)');
    assert(subOrderApparel.sellerPayout === 3465, 'Net seller payout calculated correctly (Rs. 3,465)');

    // ------------------------------------------------------------------------
    // 5. Tenant Data Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing Tenant Data Isolation ---');
    const techSellerOrders = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/marketplace/sellers/seller_lahore_tech/orders',
      method: 'GET',
    });
    assert(techSellerOrders.status === 200, 'Lahore Tech Hub fetches their orders');
    const techOrdersList = techSellerOrders.body.data;
    const hasApparelInTech = techOrdersList.some((so) => so.sellerId !== 'seller_lahore_tech');
    assert(!hasApparelInTech, 'Tenant Isolation: Lahore Tech Hub CANNOT view other sellers orders');

    const apparelSellerOrders = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/marketplace/sellers/seller_karachi_apparel/orders',
      method: 'GET',
    });
    const apparelOrdersList = apparelSellerOrders.body.data;
    const hasTechInApparel = apparelOrdersList.some((so) => so.sellerId !== 'seller_karachi_apparel');
    assert(!hasTechInApparel, 'Tenant Isolation: Karachi Luxury Apparel CANNOT view other sellers orders');

    // ------------------------------------------------------------------------
    // 6. Cross-Tenant Authorization Barrier (RBAC)
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Testing Cross-Tenant Security Barrier ---');
    // Karachi Apparel tries to tamper with Lahore Tech's sub-order
    const tamperRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/marketplace/sellers/seller_karachi_apparel/sub-orders/${subOrderTech.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, {
      status: 'CANCELLED',
    });
    assert(tamperRes.status === 403, 'Cross-tenant status modification strictly blocked with 403 Forbidden');
    assert(tamperRes.body.error.message.includes('Access Denied (Tenant Isolation)'), 'Error message flags Tenant Isolation violation');

    // ------------------------------------------------------------------------
    // 7. Legitimate Seller Fulfillment & Tracking
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Testing Legitimate Seller Sub-Order Fulfillment ---');
    const fulfillRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/marketplace/sellers/seller_lahore_tech/sub-orders/${subOrderTech.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, {
      status: 'SHIPPED',
      trackingNumber: 'TCS-LHE-998877',
    });
    assert(fulfillRes.status === 200, 'Seller legitimately fulfills their own sub-order with 200 OK');
    assert(fulfillRes.body.data.orderStatus === 'SHIPPED', 'Sub-order status updated to SHIPPED');
    assert(fulfillRes.body.data.trackingNumber === 'TCS-LHE-998877', 'Logistics tracking number preserved');

    // ------------------------------------------------------------------------
    // 8. Marketplace Commission & Payouts Ledger
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Testing Marketplace Commission & Payout Ledger ---');
    const earningsRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/marketplace/sellers/seller_lahore_tech/earnings',
      method: 'GET',
    });
    assert(earningsRes.status === 200, 'GET /api/v1/marketplace/sellers/:sellerId/earnings returns 200 OK');
    const earnings = earningsRes.body.data;
    assert(earnings.grossSales >= 340000, 'Gross sales recorded correctly (Rs. 340,000)');
    assert(earnings.totalCommissionDeducted >= 17000, 'Platform commission ledger reflects Rs. 17,000 deduction');
    assert(earnings.netPayoutPayable >= 323000, 'Net seller payable ledger reflects Rs. 323,000');

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
