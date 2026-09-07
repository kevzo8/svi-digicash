const { generateSignature, verifySignature, signRequest, validateCallback, flattenParams } = require('../src/utils/signature');

console.log('🧪 =========================================');
console.log('   Testing HMAC-SHA256 Signature Utilities');
console.log('===========================================\n');

// Test secret key from documentation example
const testSecretKey = 'your_secret_key';

// Test 1: Signature generation follows the official Postman pre-request
// script mechanics (concat values in key order, '-' for empty, HMAC-SHA256).
// NOTE: the written docs show two different example signatures for the same
// payload, so no hard assertion against the docs vector is possible here.
// Ground truth is the live API response (provider_error_message).
console.log('📋 Test 1: Signature Generation Mechanics (Postman parity)');
const testParams1 = {
  passwork: 'yourpassword',
  service_id: 'yourserviceid',
  amount: '100',
  currency: 'PHP',
  operation_id: 'IOTTEST1731462534301',
  payment_id: 'IOTTEST1731462534301',
  callback_url: 'https://your.callback.here/',
  return_url: 'https://your.url.here/'
};

const signature1 = generateSignature(testParams1, testSecretKey);
console.log('Generated Signature:', signature1);
console.log('(informational only - docs contain inconsistent example vectors)');
console.log();

// Test 2: Signature verification
console.log('📋 Test 2: Signature Verification');
const signedParams1 = { ...testParams1, signature: signature1 };
const isValid1 = verifySignature(signedParams1, testSecretKey);
console.log('Verification Result:', isValid1 ? '✅ PASS' : '❌ FAIL');
console.log();

// Test 3: Empty values handling (should become '-')
console.log('📋 Test 3: Empty Values Handling');
const testParams3 = {
  service_id: 'test',
  passwork: 'test',
  amount: '1000',
  currency: 'PHP',
  operation_id: 'TEST123',
  payment_id: 'TEST123',
  by_method: 'gcash',
  callback_url: 'https://callback.url/',
  return_url: '',
  extra_field: null,
  another_field: undefined
};
const flattened = flattenParams(testParams3);
console.log('Flattened:', flattened);
console.log('Contains hyphens for empty:', flattened.includes('-') ? '✅ PASS' : '❌ FAIL');
const signature3 = generateSignature(testParams3, testSecretKey);
console.log('Signature generated:', signature3);
console.log();

// Test 4: Nested object handling (customer object in payout)
console.log('📋 Test 4: Nested Object Handling (Payout Customer)');
const testParams4 = {
  service_id: 'service.svi',
  passwork: 'passw0rd@SVI',
  amount: '1000',
  currency: 'PHP',
  operation_id: 'PO123',
  payment_id: 'PO123',
  by_method: 'instapay',
  callback_url: 'https://callback.url/',
  return_url: 'https://return.url/',
  customer: {
    account_bank_id: 'PAPH',
    account_number: '09271528945',
    account_name: 'juan dela cruz',
    email: 'juandelacruz@gmail.com',
    phone_number: '09271528945',
    address: 'Manila, PH',
    remark: 'test payout'
  }
};
const flattened4 = flattenParams(testParams4);
console.log('Flattened:', flattened4);
const signature4 = generateSignature(testParams4, 'dl)m38(0BDyXhPJpLH)T!Rz|E?,v[<');
console.log('Signature:', signature4);
console.log();

// Test 5: signRequest function
console.log('📋 Test 5: signRequest Function');
const signed = signRequest(testParams1, testSecretKey);
console.log('Has signature:', !!signed.signature);
console.log('Signature matches:', signed.signature === signature1 ? '✅ PASS' : '❌ FAIL');
console.log();

// Test 6: validateCallback function
console.log('📋 Test 6: validateCallback Function');
const callbackPayload = {
  external_id: '7105563620335199',
  provider_id: 'STARPAY_PAY',
  provider_name: 'STARPAY',
  operation_id: 'IOTTEST1749280392147',
  payment_method: 'gcash',
  amount: '15000',
  currency: 'PHP',
  fee_amount: '0',
  operation: {
    status: 'paid',
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
  },
  signature: 'invalid_signature'
};

const validation = validateCallback(callbackPayload, testSecretKey);
console.log('Validation result:', validation);
console.log('Invalid signature detected:', !validation.valid ? '✅ PASS' : '❌ FAIL');
console.log();

// Test 7: Validate with correct signature
console.log('📋 Test 7: validateCallback with Correct Signature');
const correctCallbackPayload = { ...callbackPayload };
const correctSignature = generateSignature(
  Object.fromEntries(Object.entries(correctCallbackPayload).filter(([k]) => k !== 'signature')),
  testSecretKey
);
correctCallbackPayload.signature = correctSignature;
const validation2 = validateCallback(correctCallbackPayload, testSecretKey);
console.log('Validation result:', validation2);
console.log('Valid signature accepted:', validation2.valid ? '✅ PASS' : '❌ FAIL');
console.log();

// Test 8: Real credentials test
console.log('📋 Test 8: Real Credentials (SVI DigiCash)');
const realParams = {
  service_id: 'service.svi',
  passwork: 'passw0rd@SVI',
  amount: '10000',
  currency: 'PHP',
  operation_id: 'SVI' + Date.now(),
  payment_id: 'SVI' + Date.now(),
  by_method: 'gcash',
  callback_url: 'https://callback.url/',
  return_url: 'https://return.url/'
};
const realSignature = generateSignature(realParams, 'dl)m38(0BDyXhPJpLH)T!Rz|E?,v[<');
console.log('Real credentials signature:', realSignature);
const realSigned = { ...realParams, signature: realSignature };
const realValid = verifySignature(realSigned, 'dl)m38(0BDyXhPJpLH)T!Rz|E?,v[<');
console.log('Verification:', realValid ? '✅ PASS' : '❌ FAIL');
console.log();

console.log('===========================================');
console.log('   All Signature Tests Completed');
console.log('===========================================\n');