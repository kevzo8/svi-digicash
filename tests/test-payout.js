const DigiCashClient = require('../src/api/digicash-client');
const config = require('../src/config');

console.log('🧪 =========================================');
console.log('   Testing DigiCash Payout API');
console.log('===========================================\n');

const client = new DigiCashClient();

async function runPayoutTests() {
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

  // Test 1: Create Payout to Maya (PAPH)
  await test('Create Payout to Maya/PayMaya (₱500.00)', async () => {
    const response = await client.createPayout({
      amount: 500.00,
      currency: 'PHP',
      customer: {
        accountBankId: 'PAPH', // Maya / Paymaya Philippines, Inc.
        accountNumber: '09271528945',
        accountName: 'Juan Dela Cruz',
        email: 'juandelacruz@gmail.com',
        phoneNumber: '09271528945',
        address: 'Manila, Philippines',
        remark: 'Test payout to Maya wallet'
      }
    });
    
    if (!response.external_id) throw new Error('Missing external_id');
    if (!response.operation_id) throw new Error('Missing operation_id');
    if (response.request?.status !== 'success') throw new Error('Request status not success');
    
    console.log(`   External ID: ${response.external_id}`);
    console.log(`   Operation ID: ${response.operation_id}`);
    console.log(`   Status: ${response.operation?.status}`);
    console.log(`   Signature Valid: ${response.signatureValid}`);
    
    return response;
  });

  // Test 2: Create Payout to GCash (GXCH)
  await test('Create Payout to GCash (₱250.00)', async () => {
    const response = await client.createPayout({
      amount: 250.00,
      currency: 'PHP',
      customer: {
        accountBankId: 'GXCH', // G-Xchange / GCash
        accountNumber: '09171234567',
        accountName: 'Maria Santos',
        email: 'maria.santos@gmail.com',
        phoneNumber: '09171234567',
        remark: 'Test payout to GCash'
      }
    });
    
    console.log(`   External ID: ${response.external_id}`);
    console.log(`   Status: ${response.operation?.status}`);
    
    return response;
  });

  // Test 3: Create Payout to BDO (BNOR)
  await test('Create Payout to BDO Unibank (₱1000.00)', async () => {
    const response = await client.createPayout({
      amount: 1000.00,
      currency: 'PHP',
      customer: {
        accountBankId: 'BNOR', // BDO Unibank, Inc.
        accountNumber: '001234567890',
        accountName: 'Pedro Reyes',
        email: 'pedro.reyes@yahoo.com',
        phoneNumber: '+639181234567',
        address: 'Makati, Philippines',
        remark: 'Salary disbursement'
      }
    });
    
    console.log(`   External ID: ${response.external_id}`);
    console.log(`   Status: ${response.operation?.status}`);
    
    return response;
  });

  // Test 4: Create Payout to BPI (BOPI)
  await test('Create Payout to BPI (₱750.25)', async () => {
    const response = await client.createPayout({
      amount: 750.25,
      currency: 'PHP',
      customer: {
        accountBankId: 'BOPI', // BPI / VYBE by BPI
        accountNumber: '1234567890',
        accountName: 'Ana Garcia',
        email: 'ana.garcia@outlook.com',
        phoneNumber: '09191234567',
        remark: 'Freelance payment'
      }
    });
    
    console.log(`   External ID: ${response.external_id}`);
    console.log(`   Status: ${response.operation?.status}`);
    
    return response;
  });

  // Test 5: Missing required customer fields
  await test('Missing Required Customer Fields (should fail)', async () => {
    try {
      await client.createPayout({
        amount: 100,
        customer: {
          accountBankId: 'PAPH',
          // missing accountNumber, accountName, email, phoneNumber
        }
      });
      throw new Error('Should have thrown error for missing fields');
    } catch (error) {
      if (error.message.includes('Missing required customer field')) {
        console.log('   Correctly rejected missing fields');
        return { success: true };
      }
      throw error;
    }
  });

  // Test 6: Unknown bank ID (warning but should work)
  await test('Unknown Bank ID (warning only)', async () => {
    // This should work but show a warning
    try {
      const response = await client.createPayout({
        amount: 100,
        customer: {
          accountBankId: 'UNKNOWN_BANK',
          accountNumber: '1234567890',
          accountName: 'Test User',
          email: 'test@example.com',
          phoneNumber: '09171234567'
        }
      });
      console.log('   Request sent (unknown bank ID accepted by API)');
      return response;
    } catch (error) {
      // API might reject unknown bank IDs
      console.log('   API rejected unknown bank ID (expected behavior)');
      return { rejected: true };
    }
  });

  // Test 7: Get bank name utility
  await test('Get Bank Name Utility', () => {
    const maya = client.getBankName('PAPH');
    const gCash = client.getBankName('GXCH');
    const bdo = client.getBankName('BNOR');
    const unknown = client.getBankName('INVALID');
    
    console.log(`   PAPH → ${maya}`);
    console.log(`   GXCH → ${gCash}`);
    console.log(`   BNOR → ${bdo}`);
    console.log(`   INVALID → ${unknown}`);
    
    if (maya !== 'Maya / Paymaya Philippines, Inc.') throw new Error('Wrong bank name for PAPH');
    if (gCash !== 'G-Xchange / GCash') throw new Error('Wrong bank name for GXCH');
    if (bdo !== 'BDO Unibank, Inc.') throw new Error('Wrong bank name for BNOR');
    if (unknown !== 'Unknown Bank/Wallet') throw new Error('Wrong default for unknown');
    
    return { maya, gCash, bdo, unknown };
  });

  // Test 8: Get supported banks
  await test('Get Supported Banks', () => {
    const banks = client.getSupportedBanks();
    const count = Object.keys(banks).length;
    
    console.log(`   Total supported banks/wallets: ${count}`);
    
    if (count < 50) throw new Error('Expected at least 50 bank mappings');
    
    // Show first 10
    const entries = Object.entries(banks).slice(0, 10);
    entries.forEach(([id, name]) => console.log(`   ${id}: ${name}`));
    console.log(`   ... and ${count - 10} more`);
    
    return { count, sample: entries };
  });

  // Summary
  console.log('\n===========================================');
  console.log('   Payout API Test Summary');
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
  
  console.log('\n🎉 All Payout API tests passed!');
}

runPayoutTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});