const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');

console.log('=================================================================');
console.log('🧪 Starting Phase 5 Financial Infrastructure & Payment Gateways Test');
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
    // Setup: Create base cart & order for testing
    // ------------------------------------------------------------------------
    async function createTestOrder(paymentGateway = 'JAZZCASH') {
      const cartRes = await request({
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/cart',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, {});
      const cartId = cartRes.body.data.id;

      await request({
        hostname: '127.0.0.1',
        port: 9000,
        path: `/api/v1/cart/${cartId}/items`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, { variantId: 'var_oxf_wht_m', quantity: 1 });

      const checkoutRes = await request({
        hostname: '127.0.0.1',
        port: 9000,
        path: `/api/v1/cart/${cartId}/checkout`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, {
        customerEmail: 'test.buyer@example.pk',
        customerPhone: '03001234567',
        paymentGateway,
        shippingAddress: {
          firstName: 'Usman',
          lastName: 'Tariq',
          phone: '03001234567',
          addressLine1: 'Gulberg III',
          city: 'Lahore',
          postalCode: '54000',
          countryCode: 'PK',
        },
      });

      return checkoutRes.body.data;
    }

    // ------------------------------------------------------------------------
    // 1. JazzCash Sandbox Flow
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing JazzCash Sandbox Flow ---');
    const jcOrder = await createTestOrder('JAZZCASH');
    assert(jcOrder && jcOrder.orderStatus === 'PENDING_PAYMENT', 'Order created in PENDING_PAYMENT status for JazzCash');

    const jcSessionRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/initiate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      orderId: jcOrder.orderNumber,
      gateway: 'JAZZCASH',
    });
    assert(jcSessionRes.status === 201, 'POST /api/v1/payments/initiate returns 201 Created');
    const jcSession = jcSessionRes.body.data;
    assert(jcSession.id.startsWith('jzc_sess_'), 'JazzCash session ID generated with jzc_sess_ prefix');
    assert(jcSession.redirectUrl.includes('sandbox.jazzcash.com.pk'), 'JazzCash hosted sandbox URL populated');

    // Confirm Payment via Mobile Wallet
    const jcConfirmRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/confirm',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      sessionId: jcSession.id,
      paymentDetails: { mobileNumber: '03001234567', mpin: '1234' },
      idempotencyKey: 'idemp_key_jc_001',
    });
    assert(jcConfirmRes.status === 200, 'POST /api/v1/payments/confirm returns 200 OK');
    const jcTx = jcConfirmRes.body.data;
    assert(jcTx.status === 'CAPTURED', 'JazzCash transaction captured in real-time');
    assert(jcTx.transactionReference.startsWith('JC-'), 'JazzCash transaction reference generated (JC-...)');

    // Verify Order Transitioned to PAID
    const orderAfterJc = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${jcOrder.orderNumber}`,
      method: 'GET',
    });
    assert(orderAfterJc.body.data.orderStatus === 'PAID', 'Order automatically transitioned to PAID state');

    // ------------------------------------------------------------------------
    // 2. Idempotency Enforcement (Anti-Double Charge)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Idempotency & Replay Defense ---');
    const duplicateConfirmRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/confirm',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      sessionId: jcSession.id,
      paymentDetails: { mobileNumber: '03001234567', mpin: '1234' },
      idempotencyKey: 'idemp_key_jc_001', // Exact same key
    });
    assert(duplicateConfirmRes.status === 200, 'Duplicate submission handled gracefully with 200 OK');
    assert(duplicateConfirmRes.body.data.id === jcTx.id, 'Idempotency returns identical transaction ID without re-billing');

    // ------------------------------------------------------------------------
    // 3. Easypaisa Sandbox Flow
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing Easypaisa Sandbox Flow ---');
    const epOrder = await createTestOrder('EASYPAISA');
    const epSessionRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/initiate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      orderId: epOrder.orderNumber,
      gateway: 'EASYPAISA',
    });
    assert(epSessionRes.status === 201, 'Easypaisa payment session initiated');
    const epSession = epSessionRes.body.data;
    assert(epSession.redirectUrl.includes('easypaystg.easypaisa.com.pk'), 'Easypaisa hosted URL populated');

    const epConfirmRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/confirm',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      sessionId: epSession.id,
      paymentDetails: { mobileNumber: '03339876543' },
    });
    assert(epConfirmRes.status === 200, 'Easypaisa payment captured with 200 OK');
    assert(epConfirmRes.body.data.transactionReference.startsWith('EP-'), 'Easypaisa transaction reference generated (EP-...)');

    // ------------------------------------------------------------------------
    // 4. Stripe International Gateway (Cards, Client Secret)
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing Stripe International Payment Flow ---');
    const stripeOrder = await createTestOrder('STRIPE');
    const stripeSessionRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/initiate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      orderId: stripeOrder.orderNumber,
      gateway: 'STRIPE',
    });
    assert(stripeSessionRes.status === 201, 'Stripe session created with 201 Created');
    const stripeSession = stripeSessionRes.body.data;
    assert(stripeSession.clientSecret.includes('_secret_'), 'Stripe PaymentIntent clientSecret generated');

    // Successful Stripe Card Charge
    const stripeConfirmRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/confirm',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      sessionId: stripeSession.id,
      paymentDetails: { cardToken: 'tok_visa_4242' },
    });
    assert(stripeConfirmRes.status === 200, 'Stripe card authorization captured (200 OK)');
    assert(stripeConfirmRes.body.data.transactionReference.startsWith('ch_'), 'Stripe charge reference generated (ch_...)');

    // Card Decline Simulation
    const stripeDeclinedSessionRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/initiate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      orderId: stripeOrder.orderNumber,
      gateway: 'STRIPE',
      idempotencyKey: 'stripe_decline_test',
    });
    const stripeDeclineRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/confirm',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      sessionId: stripeDeclinedSessionRes.body.data.id,
      paymentDetails: { cardToken: 'tok_card_declined' },
    });
    assert(stripeDeclineRes.status === 402, 'Card decline triggers 402 Payment Required');
    assert(stripeDeclineRes.body.error.message.includes('card was declined'), 'Declined error message correctly returned');

    // ------------------------------------------------------------------------
    // 5. Webhook Security & HMAC Verification
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing Webhook Security & HMAC Signature Verification ---');
    const salt = 'salt_secret_key_12345';
    const webhookPayload = {
      pp_ResponseCode: '000',
      pp_BillReference: jcOrder.orderNumber,
      pp_TxnRefNo: 'JC-WEBHOOK-99',
      pp_Amount: '3850',
    };

    // Calculate valid HMAC-SHA256
    const keys = Object.keys(webhookPayload).sort();
    const strToHash = keys.map((k) => `${k}=${webhookPayload[k]}`).join('&');
    const validHmac = crypto.createHmac('sha256', salt).update(strToHash).digest('hex');

    // 5a. Webhook with INVALID signature (Spoofing attempt)
    const badWebhookRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/webhooks/JAZZCASH',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jazzcash-signature': 'tampered_invalid_signature_hash',
      },
    }, webhookPayload);
    assert(badWebhookRes.status === 401, 'Webhook with forged signature rejected with 401 Unauthorized');

    // 5b. Webhook with VALID HMAC-SHA256 signature
    const validWebhookRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/webhooks/JAZZCASH',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jazzcash-signature': validHmac,
        'x-webhook-id': 'evt_webhook_unique_001',
      },
    }, webhookPayload);
    assert(validWebhookRes.status === 200, 'Authenticated HMAC webhook processed successfully (200 OK)');
    assert(validWebhookRes.body.data.status === 'CAPTURED', 'Webhook correctly captured payment');

    // 5c. Webhook Replay Attack
    const replayWebhookRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/webhooks/JAZZCASH',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jazzcash-signature': validHmac,
        'x-webhook-id': 'evt_webhook_unique_001', // Duplicate event ID
      },
    }, webhookPayload);
    assert(replayWebhookRes.status === 200, 'Replayed webhook dropped safely');
    assert(replayWebhookRes.body.data.metadata?.replayIgnored === true, 'Replay protection logged and dropped duplicate execution');

    // ------------------------------------------------------------------------
    // 6. Cash on Delivery (COD) Workflow & Thresholds
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Testing Cash on Delivery (COD) Rules ---');
    const codOrder = await createTestOrder('COD');
    assert(codOrder.orderStatus === 'CONFIRMED', 'COD order initialized in CONFIRMED status');

    const codSessionRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/initiate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      orderId: codOrder.orderNumber,
      gateway: 'COD',
    });
    assert(codSessionRes.status === 201, 'COD session created');

    const codConfirmRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/confirm',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      sessionId: codSessionRes.body.data.id,
      paymentDetails: { codVerified: true },
    });
    assert(codConfirmRes.status === 200, 'COD pre-authorization verified');
    assert(codConfirmRes.body.data.status === 'AUTHORIZED', 'COD transaction holds in AUTHORIZED state until courier delivery');

    // ------------------------------------------------------------------------
    // 7. Refund Processing & Order Lifecycle Sync
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Testing Refund Processing & Order Sync ---');
    const refundRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/payments/refund',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      transactionId: jcTx.id,
      amount: jcTx.amount,
      reason: 'Customer requested order cancellation before shipment',
    });
    assert(refundRes.status === 200, 'POST /api/v1/payments/refund returns 200 OK');
    assert(refundRes.body.data.status === 'REFUNDED', 'Payment transaction marked as REFUNDED');

    // Verify Order is now REFUNDED
    const refundedOrderRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: `/api/v1/orders/${jcOrder.orderNumber}`,
      method: 'GET',
    });
    assert(refundedOrderRes.body.data.orderStatus === 'REFUNDED', 'Order state machine updated to REFUNDED upon payment reversal');

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
