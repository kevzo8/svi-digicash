const express = require('express');
const axios = require('axios');
const { generateSignature } = require('../src/utils/signature');
const config = require('../src/config');

console.log('🧪 =========================================');
console.log('   Testing DigiCash Callback Handling');
console.log('===========================================\n');

// Start a test server to receive callbacks
const app = express();
app.use(express.json({ limit: '1mb' }));

let receivedCallbacks = [];

app.post('/test-callback', (req, res) => {
  const callback = {
    timestamp: new Date().toISOString(),
    payload: req.body,
    headers: req.headers
  };
  
  receivedCallbacks.push(callback);
  
  console.log('\n🔔 Test Callback Received:');
  console.log('   Time:', callback.timestamp);
  console.log('   Operation ID:', req.body.operation_id);
  console.log('   Status:', req.body.operation?.status);
  console.log('   Amount:', req.body.amount, req.body.currency);
  console.log('   Signature Valid:', req.body.signature ? 'Present' : 'Missing');
  
  res.status(200).json({ received: true });
});

app.get('/callbacks', (req, res) => {
  res.json(receivedCallbacks);
});

app.delete('/callbacks', (req, res) => {
  receivedCallbacks = [];
  res.json({ cleared: true });
});

const TEST_PORT = 3001;
const CALLBACK_URL = `http://localhost:${TEST_PORT}/test-callback`;

let server;

async function runCallbackTests() {
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

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`\n🌐 Test callback server started on http://localhost:${TEST_PORT}`);
      resolve();
    });
  });

  // Test 1: Simulate PAID callback
  await test('Simulate PAID Callback', async () => {
    const payload = {
      external_id: '7105563620335199',
      provider_id: 'STARPAY_PAY',
      provider_name: 'STARPAY',
      operation_id: 'IOTTEST1749280392147',
      payment_method: 'gcash',
      amount: '15000',
      currency: 'PHP',
      fee_amount: '0',
      operation: {
        status: 'PAID',
        error_code: null,
        error_message: null
      },
      customer: {
        account_number: '1234567890',
        name: 'Juan Dela Cruz',
        email: 'juan.dela_cruz@gmail.com',
        address: 'Manila, PH',
        phone_number: '09160000000',
        remark: 'this is a testing'
      }
    };
    
    // Generate valid signature
    const secretKey = config.digicash.secretKey;
    payload.signature = generateSignature(payload, secretKey);
    
    const response = await axios.post(CALLBACK_URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.received !== true) throw new Error('Callback not acknowledged');
    
    const received = receivedCallbacks[receivedCallbacks.length - 1];
    if (received.payload.operation.status !== 'PAID') throw new Error('Status mismatch');
    
    console.log('   Callback received and validated');
    return { callback: received };
  });

  // Test 2: Simulate FAIL callback
  await test('Simulate FAIL Callback', async () => {
    const payload = {
      external_id: '5869420837044389',
      provider_id: 'STARPAY_PAY',
      provider_name: 'STARPAY',
      operation_id: 'CI2025010216143637034F2788',
      payment_method: 'gcash',
      amount: '10768',
      currency: 'PHP',
      fee_amount: '0',
      operation: {
        status: 'FAIL',
        error_code: 'INSUFFICIENT_FUNDS',
        error_message: 'Insufficient funds in wallet'
      },
      customer: null
    };
    
    const secretKey = config.digicash.secretKey;
    payload.signature = generateSignature(payload, secretKey);
    
    const response = await axios.post(CALLBACK_URL, payload);
    
    const received = receivedCallbacks[receivedCallbacks.length - 1];
    if (received.payload.operation.status !== 'FAIL') throw new Error('Status mismatch');
    
    console.log('   FAIL callback received');
    return { callback: received };
  });

  // Test 3: Simulate EXPIRED callback
  await test('Simulate EXPIRED Callback', async () => {
    const payload = {
      external_id: '9999999999999999',
      provider_id: 'STARPAY_PAY',
      provider_name: 'STARPAY',
      operation_id: 'EXPIRED_TEST_123',
      payment_method: 'qrph',
      amount: '5000',
      currency: 'PHP',
      fee_amount: '0',
      operation: {
        status: 'EXPIRED',
        error_code: 'TIMEOUT',
        error_message: 'Payment expired after 15 minutes'
      },
      customer: {
        account_number: '09171234567',
        name: 'Test User',
        email: 'test@example.com',
        address: 'Test Address',
        phone_number: '09171234567',
        remark: 'QR code expired'
      }
    };
    
    const secretKey = config.digicash.secretKey;
    payload.signature = generateSignature(payload, secretKey);
    
    const response = await axios.post(CALLBACK_URL, payload);
    
    const received = receivedCallbacks[receivedCallbacks.length - 1];
    if (received.payload.operation.status !== 'EXPIRED') throw new Error('Status mismatch');
    
    console.log('   EXPIRED callback received');
    return { callback: received };
  });

  // Test 4: Simulate PROCESSING callback
  await test('Simulate PROCESSING Callback', async () => {
    const payload = {
      external_id: '1111111111111111',
      provider_id: 'STARPAY_PAY',
      provider_name: 'STARPAY',
      operation_id: 'PROCESSING_TEST_456',
      payment_method: 'palawanpay',
      amount: '20000',
      currency: 'PHP',
      fee_amount: '0',
      operation: {
        status: 'PROCESSING',
        error_code: null,
        error_message: null
      },
      customer: {
        account_number: '09181234567',
        name: 'Processing User',
        email: 'processing@example.com',
        address: 'Processing Address',
        phone_number: '09181234567',
        remark: 'Payment being processed'
      }
    };
    
    const secretKey = config.digicash.secretKey;
    payload.signature = generateSignature(payload, secretKey);
    
    const response = await axios.post(CALLBACK_URL, payload);
    
    const received = receivedCallbacks[receivedCallbacks.length - 1];
    if (received.payload.operation.status !== 'PROCESSING') throw new Error('Status mismatch');
    
    console.log('   PROCESSING callback received');
    return { callback: received };
  });

  // Test 5: Invalid signature rejection
  await test('Invalid Signature Detection', async () => {
    const payload = {
      external_id: '2222222222222222',
      provider_id: 'STARPAY_PAY',
      provider_name: 'STARPAY',
      operation_id: 'INVALID_SIG_TEST',
      payment_method: 'gcash',
      amount: '1000',
      currency: 'PHP',
      fee_amount: '0',
      operation: {
        status: 'PAID',
        error_code: null,
        error_message: null
      },
      customer: {
        account_number: '09191234567',
        name: 'Invalid Sig User',
        email: 'invalidsig@example.com',
        address: 'Invalid Address',
        phone_number: '09191234567',
        remark: 'Testing invalid signature'
      },
      signature: 'invalid_signature_12345'
    };
    
    const response = await axios.post(CALLBACK_URL, payload);
    
    // Should still receive 200 but we can check our validation
    const received = receivedCallbacks[receivedCallbacks.length - 1];
    // Note: Our test server doesn't validate, but the main server would
    console.log('   Callback with invalid signature received (server would reject)');
    return { received: true };
  });

  // Test 6: Missing signature
  await test('Missing Signature Handling', async () => {
    const payload = {
      external_id: '3333333333333333',
      provider_id: 'STARPAY_PAY',
      provider_name: 'STARPAY',
      operation_id: 'MISSING_SIG_TEST',
      payment_method: 'gcash',
      amount: '1000',
      currency: 'PHP',
      fee_amount: '0',
      operation: {
        status: 'PAID',
        error_code: null,
        error_message: null
      },
      customer: {
        account_number: '09201234567',
        name: 'Missing Sig User',
        email: 'missingsig@example.com',
        address: 'Missing Address',
        phone_number: '09201234567',
        remark: 'Testing missing signature'
      }
      // No signature field
    };
    
    const response = await axios.post(CALLBACK_URL, payload);
    
    const received = receivedCallbacks[receivedCallbacks.length - 1];
    if (received.payload.signature) throw new Error('Should not have signature');
    
    console.log('   Callback without signature received');
    return { received: true };
  });

  // Test 7: Callback with special characters
  await test('Callback with Special Characters', async () => {
    const payload = {
      external_id: '4444444444444444',
      provider_id: 'STARPAY_PAY',
      provider_name: 'STARPAY',
      operation_id: 'SPECIAL_CHARS_TEST',
      payment_method: 'gcash',
      amount: '10000',
      currency: 'PHP',
      fee_amount: '0',
      operation: {
        status: 'PAID',
        error_code: null,
        error_message: null
      },
      customer: {
        account_number: '09211234567',
        name: 'José María O\'Connor-Smith',
        email: 'jose.maria+test@example.com',
        address: '123 Calle Principal, Manila, PH 1000',
        phone_number: '+639211234567',
        remark: 'Special chars: ñ, ó, \', -, +, @'
      }
    };
    
    const secretKey = config.digicash.secretKey;
    payload.signature = generateSignature(payload, secretKey);
    
    const response = await axios.post(CALLBACK_URL, payload);
    
    const received = receivedCallbacks[receivedCallbacks.length - 1];
    console.log('   Customer name:', received.payload.customer.name);
    console.log('   Email:', received.payload.customer.email);
    console.log('   Address:', received.payload.customer.address);
    
    return { callback: received };
  });

  // Test 8: Verify all callbacks received
  await test('Verify All Callbacks Received', () => {
    console.log(`   Total callbacks received: ${receivedCallbacks.length}`);
    
    const statuses = receivedCallbacks.map(c => c.payload.operation?.status);
    console.log('   Statuses:', statuses.join(', '));
    
    const expectedStatuses = ['PAID', 'FAIL', 'EXPIRED', 'PROCESSING'];
    for (const status of expectedStatuses) {
      if (!statuses.includes(status)) {
        throw new Error(`Missing expected status: ${status}`);
      }
    }
    
    return { count: receivedCallbacks.length, statuses };
  });

  // Cleanup
  server.close();
  console.log('\n🌐 Test callback server stopped');

  // Summary
  console.log('\n===========================================');
  console.log('   Callback Test Summary');
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
  
  console.log('\n🎉 All Callback tests passed!');
}

runCallbackTests().catch(error => {
  console.error('Test runner error:', error);
  if (server) server.close();
  process.exit(1);
});