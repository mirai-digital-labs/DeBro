const { spawn } = require('child_process');
const http = require('http');

console.log('=================================================================');
console.log('🧪 Starting Phase 11 Security, Reliability & Stress Test');
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
    // 1. OWASP Security Headers Verification
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing OWASP Security Headers ---');
    const secRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/health',
      method: 'GET',
    });
    assert(secRes.status === 200, 'GET /health returns 200 OK');
    assert(secRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff enforced');
    assert(secRes.headers['x-frame-options'] === 'DENY', 'X-Frame-Options: DENY enforced (clickjacking defense)');
    assert(secRes.headers['x-xss-protection'] === '1; mode=block', 'X-XSS-Protection enabled');
    assert(
      secRes.headers['strict-transport-security'] &&
        secRes.headers['strict-transport-security'].includes('max-age'),
      'Strict-Transport-Security (HSTS) enforced'
    );
    assert(
      secRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin',
      'Referrer-Policy: strict-origin-when-cross-origin verified'
    );
    assert(
      secRes.headers['x-powered-by'] === undefined,
      'X-Powered-By header stripped (server footprint obfuscation)'
    );

    // ------------------------------------------------------------------------
    // 2. Anti-DDoS Rate Limiting & Sliding Window Throttling
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Rate Limiting & Sliding Window Throttling ---');
    const rateLimitHits = [];
    for (let i = 1; i <= 5; i++) {
      const res = await request({
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/security/rate-limit-test',
        method: 'GET',
      });
      rateLimitHits.push(res);
    }
    const allWithinLimit = rateLimitHits.every((r) => r.status === 200);
    assert(allWithinLimit, 'First 5 requests within rate limit pass (200 OK)');
    assert(
      Number(rateLimitHits[4].headers['x-ratelimit-remaining']) === 0,
      'Remaining rate limit quota accurately tracked down to 0'
    );

    // 6th Request: Must trigger 429 Too Many Requests
    const blockedRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/security/rate-limit-test',
      method: 'GET',
    });
    assert(blockedRes.status === 429, '6th request throttled with 429 Too Many Requests');
    assert(
      blockedRes.body.error.code === 'RATE_LIMIT_EXCEEDED',
      'Throttling error code RATE_LIMIT_EXCEEDED'
    );
    assert(
      blockedRes.body.error.retryAfterSeconds > 0,
      'Retry-After window provided for client backoff'
    );

    // ------------------------------------------------------------------------
    // 3. Concurrency Stress Test: 10 Simultaneous Shoppers for 1 Item
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing High-Concurrency Stock Race Condition ---');
    // var_flash_rare_01 has exactly 1 unit stocked in WH-KHI-01
    const shoppers = Array.from({ length: 10 }, (_, i) => `shopper_session_${i + 1}`);

    // Fire all 10 reservations simultaneously in parallel
    const reservationPromises = shoppers.map((cartId) =>
      request(
        {
          hostname: '127.0.0.1',
          port: 9000,
          path: '/api/v1/inventory/reserve',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          cartId,
          variantId: 'var_flash_rare_01',
          quantity: 1,
        }
      )
    );

    const raceResults = await Promise.all(reservationPromises);
    const successfulReservations = raceResults.filter((r) => r.status === 200 || r.status === 201);
    const rejectedReservations = raceResults.filter((r) => r.status === 409 || r.status === 400);

    assert(
      successfulReservations.length === 1,
      `Exactly 1 winner secured the flash reservation (Actual: ${successfulReservations.length})`
    );
    assert(
      rejectedReservations.length === 9,
      `Exactly 9 losers rejected with insufficient stock (Actual: ${rejectedReservations.length})`
    );

    // Check available stock: must be 0, never negative!
    const stockCheck = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/stock/var_flash_rare_01',
      method: 'GET',
    });
    assert(stockCheck.body.data.availableStock === 0, 'Available stock is strictly 0 (no overselling)');

    // Release the winning reservation
    const winningCartId = successfulReservations[0].body.data.cartId;
    const releaseRes = await request(
      {
        hostname: '127.0.0.1',
        port: 9000,
        path: '/api/v1/inventory/release',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { cartId: winningCartId }
    );
    assert(releaseRes.status === 200, 'Winning reservation released back to stock pool');

    const stockRecovered = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/inventory/stock/var_flash_rare_01',
      method: 'GET',
    });
    assert(
      stockRecovered.body.data.availableStock === 1,
      'Stock level cleanly recovered to 1 after release'
    );

    // ------------------------------------------------------------------------
    // 4. Input Sanitation & Injection Payloads
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing Input Sanitation & Injection Resilience ---');
    const sqlInjectionRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/products?search=' + encodeURIComponent("' OR '1'='1; DROP TABLE products; --"),
      method: 'GET',
    });
    assert(sqlInjectionRes.status === 200, 'SQL injection query handled safely without crash');
    assert(Array.isArray(sqlInjectionRes.body.data), 'Catalog schema remains intact');

    // ------------------------------------------------------------------------
    // 5. System Health & Readiness Diagnostics
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing Health & Readiness Probes ---');
    const health = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/health',
      method: 'GET',
    });
    assert(health.status === 200, 'GET /health returns 200 OK');
    assert(health.body.status === 'healthy', 'Health probe reports healthy status');
    assert(health.body.uptime > 0, 'Uptime counter is active');

    const ready = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/ready',
      method: 'GET',
    });
    assert(ready.status === 200, 'GET /ready returns 200 OK');
    assert(ready.body.ready === true, 'Readiness probe reports true');
    assert(ready.body.db === 'connected', 'Database pool connected');

    // ------------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log(`📊 Phase 11 Hardening & Stress Results: ${passed} PASSED, ${failed} FAILED`);
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
