const { execSync } = require('child_process');
const path = require('path');

console.log('================================================================================');
console.log('🌟 DeBro Universal AI Global Commerce Platform - Master Test Suite Runner');
console.log('================================================================================\n');

const testSuites = [
  { name: 'Phase 2: Universal Catalog Engine & Faceted Search', script: 'scripts/test-catalog-api.js' },
  { name: 'Phase 3: Core Cart, Multi-Vendor Items & Checkout', script: 'scripts/test-cart-checkout.js' },
  { name: 'Phase 4: Concurrency-Safe Inventory & Order Lifecycle', script: 'scripts/test-inventory-orders.js' },
  { name: 'Phase 5: Financial Gateways (JazzCash, Easypaisa, Stripe, COD)', script: 'scripts/test-payments.js' },
  { name: 'Phase 6: Multi-Vendor Marketplace & Tenant Isolation', script: 'scripts/test-marketplace.js' },
  { name: 'Phase 7: B2B Wholesale Commerce & RFQ Engine', script: 'scripts/test-b2b.js' },
  { name: 'Phase 8: International Multi-Currency, Tax & Localization', script: 'scripts/test-i18n.js' },
  { name: 'Phase 9: AI Commerce Engine, RAG & Shopping Assistant', script: 'scripts/test-ai-engine.js' },
  { name: 'Phase 10: Admin Dashboard, Operations, CMS & SEO', script: 'scripts/test-admin-ops.js' },
  { name: 'Phase 11: Security Hardening, Rate Limiting & Concurrency Stress', script: 'scripts/test-hardening-stress.js' },
];

let totalPassedAssertions = 0;
let totalFailedAssertions = 0;
const resultsTable = [];

const startTime = Date.now();

for (const suite of testSuites) {
  process.stdout.write(`⏳ Running ${suite.name}... `);
  const suiteStart = Date.now();

  try {
    const output = execSync(`node ${suite.script}`, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const suiteDuration = ((Date.now() - suiteStart) / 1000).toFixed(2);

    // Extract passed / failed counts from test output
    const passMatches = output.match(/✅ \[PASS\]/g);
    const failMatches = output.match(/❌ \[FAIL\]/g);

    const passedCount = passMatches ? passMatches.length : 0;
    const failedCount = failMatches ? failMatches.length : 0;

    totalPassedAssertions += passedCount;
    totalFailedAssertions += failedCount;

    if (failedCount === 0) {
      console.log(`✅ PASSED (${passedCount} checks, ${suiteDuration}s)`);
      resultsTable.push({
        Suite: suite.name,
        Status: 'PASSED',
        Passed: passedCount,
        Failed: failedCount,
        Duration: `${suiteDuration}s`,
      });
    } else {
      console.log(`❌ FAILED (${failedCount} failed, ${suiteDuration}s)`);
      resultsTable.push({
        Suite: suite.name,
        Status: 'FAILED',
        Passed: passedCount,
        Failed: failedCount,
        Duration: `${suiteDuration}s`,
      });
    }
  } catch (err) {
    const suiteDuration = ((Date.now() - suiteStart) / 1000).toFixed(2);
    console.log(`❌ EXECUTION ERROR (${suiteDuration}s)`);
    resultsTable.push({
      Suite: suite.name,
      Status: 'ERROR',
      Passed: 0,
      Failed: 1,
      Duration: `${suiteDuration}s`,
    });
    totalFailedAssertions += 1;
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n================================================================================');
console.log('📊 MASTER PLATFORM ACCEPTANCE VERIFICATION SUMMARY');
console.log('================================================================================');
console.table(resultsTable);

console.log(`\n🏆 Grand Total Assertions: ${totalPassedAssertions} PASSED, ${totalFailedAssertions} FAILED`);
console.log(`⏱ Total Execution Time: ${totalDuration}s`);
console.log('================================================================================');

if (totalFailedAssertions > 0) {
  process.exit(1);
} else {
  console.log('🎉 100% OF ACCEPTANCE CRITERIA PASSED ACROSS ALL MODULES!');
  process.exit(0);
}
