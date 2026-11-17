const { spawn } = require('child_process');
const http = require('http');

console.log('=================================================================');
console.log('🧪 Starting Phase 7 B2B Wholesale Commerce & RFQ Engine Test');
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
    // 1. Seeded Enterprise Company Discovery
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing Seeded B2B Company Discovery ---');
    const compRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/b2b/companies/comp_systems_pk',
      method: 'GET',
    });
    assert(compRes.status === 200, 'GET /api/v1/b2b/companies/:id returns 200 OK');
    const sysComp = compRes.body.data;
    assert(sysComp.name === 'Systems Pakistan Technologies Ltd', 'Systems Pakistan corporate account active');
    assert(sysComp.creditLimit === 5000000, 'Corporate credit line configured at Rs. 5,000,000');
    assert(sysComp.paymentTerm === 'NET_30', 'Payment term configured as NET_30');
    assert(sysComp.users.length >= 2, 'Company hierarchy contains Purchaser and Approver users');

    // ------------------------------------------------------------------------
    // 2. Company Registration & Admin Verification Pipeline
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Company Registration & Verification ---');
    const regRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/b2b/companies/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      name: 'Packages Limited Industrial Packaging',
      ntnNumber: '7788990-2',
      gstNumber: 'GST-7788990',
      primaryUser: {
        name: 'Adnan Malik',
        email: 'adnan.malik@packages.com.pk',
        role: 'ADMIN',
      },
    });
    assert(regRes.status === 201, 'POST /api/v1/b2b/companies/register returns 201 Created');
    const newComp = regRes.body.data;
    assert(newComp.status === 'PENDING_VERIFICATION', 'New company initialized in PENDING_VERIFICATION status');

    // Admin Verifies & Grants Rs. 2,000,000 Credit Line
    const verifyRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/b2b/companies/${newComp.id}/verify`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, {
      creditLimit: 2000000,
      paymentTerm: 'NET_30',
    });
    assert(verifyRes.status === 200, 'Admin verification returns 200 OK');
    assert(verifyRes.body.data.status === 'ACTIVE', 'Company status updated to ACTIVE');
    assert(verifyRes.body.data.availableCredit === 2000000, 'Available credit line set to Rs. 2,000,000');

    // ------------------------------------------------------------------------
    // 3. Organizational Hierarchy & Role-Based Users
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing Organizational Hierarchy & Roles ---');
    const addUserRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/b2b/companies/${newComp.id}/users`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      name: 'Sara Khan (Procurement Lead)',
      email: 'sara.procurement@packages.com.pk',
      role: 'APPROVER',
    });
    assert(addUserRes.status === 201, 'POST /api/v1/b2b/companies/:id/users adds APPROVER user');
    const approverUser = addUserRes.body.data.users.find((u) => u.email === 'sara.procurement@packages.com.pk');
    assert(approverUser && approverUser.role === 'APPROVER', 'User successfully registered with APPROVER authority');

    // ------------------------------------------------------------------------
    // 4. Wholesale Pricing Tiers & Minimum Order Quantity (MOQ)
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing Wholesale Pricing Tiers & MOQ ---');
    // Attempting to buy below MOQ (MOQ for apparel is 10)
    const moqFailRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/b2b/pricing/calculate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      variantId: 'var_oxf_wht_m',
      quantity: 3,
    });
    assert(moqFailRes.status === 400, 'Below-MOQ order rejected with 400 Bad Request');
    assert(moqFailRes.body.error.message.includes('Minimum Order Quantity (MOQ) Violation'), 'Error flags MOQ violation');

    // Tier 1 Volume Pricing (15 units -> 10% discount)
    const tier1Res = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/b2b/pricing/calculate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      variantId: 'var_oxf_wht_m',
      quantity: 15,
    });
    assert(tier1Res.status === 200, 'Tier 1 volume pricing calculated successfully');
    assert(tier1Res.body.data.discountPercent === 10, '10% volume discount applied for Tier 1 (15 units)');

    // Tier 2 Volume Pricing (50 units -> 20% discount)
    const tier2Res = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/b2b/pricing/calculate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      variantId: 'var_oxf_wht_m',
      quantity: 50,
    });
    assert(tier2Res.status === 200, 'Tier 2 bulk pricing calculated successfully');
    assert(tier2Res.body.data.discountPercent === 20, '20% bulk discount applied for Tier 2 (50 units)');

    // ------------------------------------------------------------------------
    // 5. Request for Quotation (RFQ) Negotiation Engine
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing Request for Quotation (RFQ) Workflow ---');
    // Purchaser submits RFQ for 10 units of Ultrabook
    const rfqSubmitRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/b2b/rfq',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      companyId: 'comp_systems_pk',
      submittedByEmail: 'hamza.procurement@systemspk.com',
      items: [
        {
          variantId: 'var_ub14_16_512',
          quantity: 10,
          targetUnitPrice: 250000, // Target Rs. 250,000 (normal: Rs. 285,000)
        },
      ],
      notes: 'Procurement for engineering department. Requires Net 30 corporate payment terms.',
    });
    assert(rfqSubmitRes.status === 201, 'POST /api/v1/b2b/rfq creates RFQ with 201 Created');
    const rfq = rfqSubmitRes.body.data;
    assert(rfq.status === 'SUBMITTED', 'RFQ initialized in SUBMITTED status');
    assert(rfq.rfqNumber.startsWith('RFQ-'), 'RFQ Number generated with standard format');

    // Seller / Admin issues custom quote
    const quoteRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/b2b/rfq/${rfq.id}/quote`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      offeredItems: [
        { variantId: 'var_ub14_16_512', offeredUnitPrice: 260000 },
      ],
      paymentTermOffered: 'NET_30',
      adminQuoteNotes: 'Special enterprise pricing approved. Free delivery to Systems PK Lahore campus.',
    });
    assert(quoteRes.status === 200, 'Admin quotes RFQ with 200 OK');
    const quotedRfq = quoteRes.body.data;
    assert(quotedRfq.status === 'QUOTED', 'RFQ status updated to QUOTED');
    assert(quotedRfq.quotedTotal === 2600000, 'Quoted total calculated as Rs. 2,600,000 (10 x Rs. 260,000)');

    // ------------------------------------------------------------------------
    // 6. Corporate Role-Based Approval Barrier (RBAC)
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Testing Corporate Approval Authority Barrier ---');
    // Purchaser tries to sign off quote (Must be blocked!)
    const unauthorizedAcceptRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/b2b/rfq/${rfq.id}/accept`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      approverEmail: 'hamza.procurement@systemspk.com', // Purchaser role
    });
    assert(unauthorizedAcceptRes.status === 403, 'Unauthorized role (PURCHASER) blocked from signing off quote (403)');
    assert(
      unauthorizedAcceptRes.body.error.message.includes('Authorization Denied'),
      'Error message enforces APPROVER / ADMIN authority'
    );

    // ------------------------------------------------------------------------
    // 7. Corporate Credit & Net 30 Order Conversion
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Testing Quote Acceptance & Net 30 Order Generation ---');
    // Authorized Approver signs off quote
    const authorizedAcceptRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/b2b/rfq/${rfq.id}/accept`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      approverEmail: 'bilal.farooq@systemspk.com', // Approver role
      shippingAddress: {
        firstName: 'Systems Pakistan Ltd',
        lastName: 'Procurement Dept',
        phone: '03001234567',
        addressLine1: 'Plot 5-A, Sector 30, Korangi Industrial Area',
        city: 'Karachi',
        postalCode: '74900',
        countryCode: 'PK',
      },
    });
    assert(authorizedAcceptRes.status === 201, 'Quote accepted and B2B Order generated with 201 Created');
    const b2bOrder = authorizedAcceptRes.body.data;
    assert(b2bOrder.orderNumber.startsWith('ORD-B2B-'), 'B2B Order Number generated (ORD-B2B-...)');
    assert(b2bOrder.total === 2600000, 'Order total matches quoted amount (Rs. 2,600,000)');
    assert(b2bOrder.orderStatus === 'CONFIRMED', 'Net 30 Order confirmed');

    // Verify Corporate Credit Ledger Updated
    const compAfterOrderRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/b2b/companies/comp_systems_pk',
      method: 'GET',
    });
    const updatedSysComp = compAfterOrderRes.body.data;
    assert(updatedSysComp.usedCredit === 2600000, 'Used credit incremented to Rs. 2,600,000');
    assert(updatedSysComp.availableCredit === 2400000, 'Available credit decremented to Rs. 2,400,000');

    // ------------------------------------------------------------------------
    // 8. Corporate Credit Limit Exceeded Protection
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Testing Corporate Credit Limit Exceeded Protection ---');
    // Submit RFQ that exceeds the remaining Rs. 2,400,000 credit limit
    const hugeRfqRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/b2b/rfq',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      companyId: 'comp_systems_pk',
      submittedByEmail: 'hamza.procurement@systemspk.com',
      items: [{ variantId: 'var_ub14_16_512', quantity: 15 }],
    });
    const hugeRfq = hugeRfqRes.body.data;

    // Quote for Rs. 3,900,000 (exceeds Rs. 2,400,000 available)
    await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/b2b/rfq/${hugeRfq.id}/quote`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      offeredItems: [{ variantId: 'var_ub14_16_512', offeredUnitPrice: 260000 }],
      paymentTermOffered: 'NET_30',
    });

    // Approver attempts to accept quote
    const creditExceedRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/b2b/rfq/${hugeRfq.id}/accept`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      approverEmail: 'bilal.farooq@systemspk.com',
    });
    assert(creditExceedRes.status === 400, 'Credit limit exceed strictly blocks order creation (400 Bad Request)');
    assert(
      creditExceedRes.body.error.message.includes('Corporate Credit Limit Exceeded'),
      'Error message explicitly flags Corporate Credit Limit Exceeded'
    );

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
