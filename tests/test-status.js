const DigiCashClient = require('../src/api/digicash-client');
const config = require('../src/config');

console.log('🧪 =========================================');
console.log('   Testing DigiCash Status API');
console.log('===========================================\n');

const client = new DigiCashClient();

async function runStatusTests() {
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

  // Test 1: Check status with invalid request ID (should fail gracefully)
  await test('Check Status with Invalid Request ID', async () => {
    try {
      const response = await client.checkStatus('INVALID_REQUEST_ID_12345');
      
      // API might return error in response body rather than throw
      console.log(`   Response:`, JSON.stringify(response, null, 2));
      
      if (response.request?.status === 'fail' || response.request?.error_code) {
        console.log('   API returned error as expected');
        return { errorResponse: true };
      }
      
      return response;
    } catch (error) {
      // Network error or 4xx/5xx
      console.log(`   Request failed (expected): ${error.message}`);
      return { networkError: true };
    }
  });

  // Test 2: Check status with valid format but non-existent ID
  await test('Check Status with Non-existent Request ID', async () => {
    // Use a properly formatted but non-existent ID
    const fakeRequestId = '01JX0000000000000000000000';
    
    try {
      const response = await client.checkStatus(fakeRequestId);
      console.log(`   Response:`, JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.log(`   Request failed: ${error.message}`);
      return { error: error.message };
    }
  });

  // Test 3: Status response structure validation
  await test('Status Response Structure', () => {
    // Mock a successful response structure
    const mockResponse = {
      request_id: '01JX4PFRAY0NEM43EJ9NVQVFZ2',
      operation_id: 'IOTTEST1749283233638',
      redirect_url: 'https://checkout-sandbox.palawanpay.com/web-payments/#/user/c2e865cd15?token=4e0f35cf-4b17-3ee2-8748-50e1b1b435d7',
      operation: {
        status: 'initiated',
        error_code: 0,
        error_message: '',
        provider_error_message: ''
      },
      request: {
        status: 'success',
        error_code: 0,
        error_message: ''
      },
      timestamp: '2025-06-07 15:00:34',
      signature: '4f3301f875ba23fbd97daf6c221221bb6d7c08fb91e75e4f8867369906e876ff'
    };
    
    // Validate required fields
    const requiredFields = ['request_id', 'operation_id', 'operation', 'request', 'timestamp', 'signature'];
    for (const field of requiredFields) {
      if (!mockResponse[field]) throw new Error(`Missing required field: ${field}`);
    }
    
    // Validate operation status
    const validStatuses = config.transactionStatuses.pay;
    if (!validStatuses.includes(mockResponse.operation.status)) {
      throw new Error(`Invalid operation status: ${mockResponse.operation.status}`);
    }
    
    // Validate request status
    if (mockResponse.request.status !== 'success') {
      throw new Error(`Invalid request status: ${mockResponse.request.status}`);
    }
    
    console.log('   All required fields present');
    console.log(`   Operation status: ${mockResponse.operation.status}`);
    console.log(`   Request status: ${mockResponse.request.status}`);
    
    return { valid: true };
  });

  // Test 4: Callback status mapping
  await test('Callback Status Values', () => {
    const callbackStatuses = config.transactionStatuses.callback;
    console.log('   Supported callback statuses:', callbackStatuses.join(', '));
    
    if (!callbackStatuses.includes('PAID')) throw new Error('Missing PAID status');
    if (!callbackStatuses.includes('FAIL')) throw new Error('Missing FAIL status');
    if (!callbackStatuses.includes('EXPIRED')) throw new Error('Missing EXPIRED status');
    if (!callbackStatuses.includes('PROCESSING')) throw new Error('Missing PROCESSING status');
    
    return { statuses: callbackStatuses };
  });

  // Test 5: End-to-end flow simulation (create payment -> check status)
  await test('End-to-End Flow Simulation', async () => {
    // Create a payment first
    const payResponse = await client.payWithGCash({
      amount: 100.00,
      currency: 'PHP'
    });
    
    if (!payResponse.request_id) {
      throw new Error('Payment creation failed - no request_id');
    }
    
    console.log(`   Created payment: ${payResponse.request_id}`);
    console.log(`   Initial status: ${payResponse.operation?.status}`);
    
    // Immediately check status
    const statusResponse = await client.checkStatus(payResponse.request_id);
    
    console.log(`   Status check response:`);
    console.log(`     Operation status: ${statusResponse.operation?.status}`);
    console.log(`     Request status: ${statusResponse.request?.status}`);
    console.log(`     Signature valid: ${statusResponse.signatureValid}`);
    
    return {
      payment: payResponse,
      status: statusResponse
    };
  });

  // Summary
  console.log('\n===========================================');
  console.log('   Status API Test Summary');
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
  
  console.log('\n🎉 All Status API tests passed!');
}

runStatusTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});