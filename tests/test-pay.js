const DigiCashClient = require('../src/api/digicash-client');
const config = require('../src/config');

console.log('🧪 =========================================');
console.log('   Testing DigiCash Pay API');
console.log('===========================================\n');

const client = new DigiCashClient();

async function runPayTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  async function test(name, fn) {
    console.log(`\n📋 Test: ${name}`);
    try {
      const result = await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASSED', result });
      console.log(`✅ PASSED`);
      return result;
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: 'FAILED', error: error.message });
      console.log(`❌ FAILED: ${error.message}`);
      return null;
    }
  }

  // Test 1: Create GCash Payment
  await test('Create GCash Payment (₱100.00)', async () => {
    const response = await client.payWithGCash({
      amount: 100.00,
      currency: 'PHP'
    });
    
    if (!response.request_id) throw new Error('Missing request_id');
    if (!response.redirect_url) throw new Error('Missing redirect_url');
    if (response.request?.status !== 'success') throw new Error('Request status not success');
    
    console.log(`   Request ID: ${response.request_id}`);
    console.log(`   Operation ID: ${response.operation_id}`);
    console.log(`   Redirect URL: ${response.redirect_url}`);
    console.log(`   Status: ${response.operation?.status}`);
    console.log(`   Signature Valid: ${response.signatureValid}`);
    
    return response;
  });

  // Test 2: Create PalawanPay Payment
  await test('Create PalawanPay Payment (₱250.50)', async () => {
    const response = await client.payWithPalawanPay({
      amount: 250.50,
      currency: 'PHP'
    });
    
    if (!response.request_id) throw new Error('Missing request_id');
    if (!response.redirect_url) throw new Error('Missing redirect_url');
    
    console.log(`   Request ID: ${response.request_id}`);
    console.log(`   Redirect URL: ${response.redirect_url}`);
    console.log(`   Status: ${response.operation?.status}`);
    
    return response;
  });

  // Test 3: Create QRPh Payment
  await test('Create QRPh Payment (₱500.00)', async () => {
    const response = await client.payWithQRPh({
      amount: 500.00,
      currency: 'PHP'
    });
    
    if (!response.request_id) throw new Error('Missing request_id');
    
    console.log(`   Request ID: ${response.request_id}`);
    console.log(`   Status: ${response.operation?.status}`);
    
    return response;
  });

  // Test 4: Create QRPh VIP Payment
  await test('Create QRPh VIP Payment (₱1000.00)', async () => {
    const response = await client.payWithQRPhVIP({
      amount: 1000.00,
      currency: 'PHP'
    });
    
    if (!response.request_id) throw new Error('Missing request_id');
    
    console.log(`   Request ID: ${response.request_id}`);
    console.log(`   Status: ${response.operation?.status}`);
    
    return response;
  });

  // Test 5: Invalid payment method
  await test('Invalid Payment Method (should fail)', async () => {
    try {
      await client.createPayment({
        method: 'invalid_method',
        amount: 100
      });
      throw new Error('Should have thrown error for invalid method');
    } catch (error) {
      if (error.message.includes('Invalid payment method')) {
        console.log('   Correctly rejected invalid method');
        return { success: true };
      }
      throw error;
    }
  });

  // Test 6: Amount conversion (minor units)
  await test('Amount Conversion (Minor Units)', () => {
    const minor = client.toMinorUnits(100.00);
    const major = client.fromMinorUnits(minor);
    
    console.log(`   ₱100.00 → ${minor} minor units`);
    console.log(`   ${minor} minor units → ₱${major}`);
    
    if (minor !== '10000') throw new Error('Minor units conversion failed');
    if (major !== 100) throw new Error('Major units conversion failed');
    
    return { minor, major };
  });

  // Test 7: ID Generation
  await test('Unique ID Generation', () => {
    const id1 = client.generateId('TEST');
    const id2 = client.generateId('TEST');
    
    console.log(`   ID 1: ${id1}`);
    console.log(`   ID 2: ${id2}`);
    
    if (id1 === id2) throw new Error('IDs should be unique');
    if (!id1.startsWith('TEST')) throw new Error('ID should have prefix');
    
    return { id1, id2 };
  });

  // Summary
  console.log('\n===========================================');
  console.log('   Pay API Test Summary');
  console.log('===========================================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total:  ${results.passed + results.failed}`);
  
  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests.filter(t => t.status === 'FAILED').forEach(t => {
      console.log(`   - ${t.name}: ${t.error}`);
    });
    process.exit(1);
  }
  
  console.log('\n🎉 All Pay API tests passed!');
}

runPayTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});