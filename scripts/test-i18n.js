const { spawn } = require('child_process');
const http = require('http');

console.log('=================================================================');
console.log('🧪 Starting Phase 8 International Commerce & Localization Test');
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
    // 1. Multi-Currency FX Engine & Conversion
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing Multi-Currency Rates & Conversions ---');
    const ratesRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/currencies',
      method: 'GET',
    });
    assert(ratesRes.status === 200, 'GET /api/v1/i18n/currencies returns 200 OK');
    assert(ratesRes.body.baseCurrency === 'PKR', 'Base currency confirmed as PKR');
    assert(ratesRes.body.rates.USD > 0, 'Live USD rate configured');
    assert(ratesRes.body.rates.AED > 0, 'Live AED rate configured');
    assert(ratesRes.body.rates.SAR > 0, 'Live SAR rate configured');

    // Direct Conversion: PKR to USD
    const pkrToUsdRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/currencies/convert',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      amount: 285000,
      from: 'PKR',
      to: 'USD',
    });
    assert(pkrToUsdRes.status === 200, 'POST /api/v1/i18n/currencies/convert returns 200 OK');
    assert(pkrToUsdRes.body.data.convertedAmount === 1026, 'Rs. 285,000 PKR converted accurately to $1,026 USD');

    // Direct Conversion: PKR to AED
    const pkrToAedRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/currencies/convert',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      amount: 285000,
      from: 'PKR',
      to: 'AED',
    });
    assert(pkrToAedRes.body.data.convertedAmount === 3762, 'Rs. 285,000 PKR converted accurately to 3,762 AED');

    // Cross-Currency Conversion: USD to AED
    const usdToAedRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/currencies/convert',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      amount: 1000,
      from: 'USD',
      to: 'AED',
    });
    assert(usdToAedRes.body.data.convertedAmount === 3666.67, 'Cross currency: $1,000 USD converted to 3,666.67 AED');

    // ------------------------------------------------------------------------
    // 2. Regional Compliance & Tax Engine
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Regional Compliance & Tax Calculations ---');
    const regionsRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/regions',
      method: 'GET',
    });
    assert(regionsRes.status === 200, 'GET /api/v1/i18n/regions returns 200 OK');
    assert(regionsRes.body.data.length >= 5, 'Configured regions include PK, AE, SA, US, GB');

    // Pakistan Tax Compliance (18% GST)
    const pkTaxRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/tax/calculate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      subtotal: 10000,
      countryCode: 'PK',
    });
    assert(pkTaxRes.status === 200, 'Pakistan tax calculated with 200 OK');
    assert(pkTaxRes.body.data.taxRatePercent === 18, '18% Pakistan GST rate applied');
    assert(pkTaxRes.body.data.taxAmount === 1800, 'GST tax amount is Rs. 1,800 on Rs. 10,000');
    assert(pkTaxRes.body.data.totalWithTax === 11800, 'Gross total with GST is Rs. 11,800');
    assert(pkTaxRes.body.data.taxRegistrationNumber.value === 'STRN-9988776-1', 'Tax invoice includes FBR STRN number');

    // UAE Tax Compliance (5% VAT)
    const aeTaxRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/tax/calculate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      subtotal: 1000,
      countryCode: 'AE',
    });
    assert(aeTaxRes.body.data.taxRatePercent === 5, '5% UAE VAT rate applied');
    assert(aeTaxRes.body.data.taxAmount === 50, 'UAE VAT amount is 50 AED on 1,000 AED');
    assert(aeTaxRes.body.data.taxRegistrationNumber.value.includes('TRN-'), 'Tax invoice includes UAE FTA TRN number');

    // Saudi Arabia Tax Compliance (15% ZATCA VAT)
    const saTaxRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/tax/calculate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      subtotal: 1000,
      countryCode: 'SA',
    });
    assert(saTaxRes.body.data.taxRatePercent === 15, '15% Saudi Arabia ZATCA VAT rate applied');
    assert(saTaxRes.body.data.taxAmount === 150, 'KSA VAT amount is 150 SAR on 1,000 SAR');

    // ------------------------------------------------------------------------
    // 3. Multilingual & RTL Text Direction Engine
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing Multilingual & RTL Direction Engine ---');
    // English (LTR)
    const enRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/translations/en',
      method: 'GET',
    });
    assert(enRes.status === 200, 'GET /api/v1/i18n/translations/en returns 200 OK');
    assert(enRes.body.data.direction === 'ltr', 'English direction is LTR');
    assert(enRes.body.data.strings.cart === 'Shopping Cart', 'English translation verified');

    // Urdu (RTL)
    const urRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/translations/ur',
      method: 'GET',
    });
    assert(urRes.status === 200, 'GET /api/v1/i18n/translations/ur returns 200 OK');
    assert(urRes.body.data.direction === 'rtl', 'Urdu direction correctly configured as RTL');
    assert(urRes.body.data.strings.cart === 'خریداری کی ٹوکری', 'Urdu Nastaliq translation verified');
    assert(urRes.body.data.strings.free_delivery === 'مفت ڈیلیوری', 'Urdu free delivery banner verified');

    // Arabic (RTL)
    const arRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/translations/ar',
      method: 'GET',
    });
    assert(arRes.status === 200, 'GET /api/v1/i18n/translations/ar returns 200 OK');
    assert(arRes.body.data.direction === 'rtl', 'Arabic direction correctly configured as RTL');
    assert(arRes.body.data.strings.cart === 'عربة التسوق', 'Arabic translation verified');

    // ------------------------------------------------------------------------
    // 4. International Shipping Zones & Carrier Routing
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing International Shipping Zones ---');
    // Domestic Zone (Pakistan)
    const pkShipRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/shipping/calculate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      countryCode: 'PK',
      subtotal: 1500,
    });
    assert(pkShipRes.status === 200, 'Domestic shipping calculated successfully');
    assert(pkShipRes.body.data.carrier.includes('TCS'), 'Domestic carrier routed through TCS Express');
    assert(pkShipRes.body.data.shippingFee === 250, 'Standard domestic delivery fee applied (Rs. 250)');

    // Middle East Zone (UAE)
    const aeShipRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/shipping/calculate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      countryCode: 'AE',
      subtotal: 100,
    });
    assert(aeShipRes.status === 200, 'Middle East shipping quote calculated');
    assert(aeShipRes.body.data.carrier.includes('DHL Express'), 'International carrier routed through DHL Express');
    assert(aeShipRes.body.data.shippingFee === 35, 'Regional fee of 35 AED applied');

    // Free Shipping Threshold (UAE order >= 250 AED)
    const aeFreeShipRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/shipping/calculate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      countryCode: 'AE',
      subtotal: 300,
    });
    assert(aeFreeShipRes.body.data.isFreeShipping === true, 'International order qualifies for FREE shipping threshold');
    assert(aeFreeShipRes.body.data.shippingFee === 0, 'Shipping fee waived (0 AED)');

    // ------------------------------------------------------------------------
    // 5. Formal Export Customs Declaration & Tariff Codes
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing Export Customs Declaration & Tariff Codes ---');
    const customsRes = await request({
      hostname: '127.0.0.1',
      port: 9000,
      path: '/api/v1/i18n/customs/declaration',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      orderNumber: 'ORD-202611-1001',
      destinationCountry: 'AE',
      declaredValue: 1250,
      declaredCurrency: 'USD',
      hsCode: '8471.30.00', // Laptops / Automatic data processing machines
    });
    assert(customsRes.status === 201, 'POST /api/v1/i18n/customs/declaration returns 201 Created');
    const declaration = customsRes.body.data;
    assert(declaration.exportCountry === 'Pakistan (PK)', 'Export origin set to Pakistan');
    assert(declaration.destinationCountry === 'AE', 'Destination set to United Arab Emirates');
    assert(declaration.hsCode === '8471.30.00', 'Harmonized System (HS) Tariff Code 8471.30.00 assigned');
    assert(declaration.customsInvoiceNumber.startsWith('EXP-CUST-'), 'Customs commercial invoice number generated');

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
