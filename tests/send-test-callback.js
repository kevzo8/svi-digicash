/**
 * Send a test callback to the SVI DigiCash portal.
 *
 * Usage:
 *   node tests/send-test-callback.js [STATUS] [URL] [--bad-sig]
 *
 *   STATUS   PAID (default) | FAIL | EXPIRED | PROCESSING
 *   URL      callback endpoint (default http://localhost:3001/api/callback)
 *   --bad-sig  send an invalid signature to demo rejection
 *
 * Examples:
 *   node tests/send-test-callback.js PAID
 *   node tests/send-test-callback.js FAIL http://localhost:3000/api/callback
 *   node tests/send-test-callback.js EXPIRED https://0k8ccb3k-3000.asse.devtunnels.ms/api/callback
 *
 * Signs with the secret from config.env using the same algorithm
 * DigiCash uses (see src/utils/signature.js).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { generateSignature } = require('../src/utils/signature');

const STATUS = (process.argv[2] || 'PAID').toUpperCase();
const URL = process.argv[3] || 'http://localhost:3001/api/callback';
const BAD_SIG = process.argv.includes('--bad-sig');

const ALLOWED = ['PAID', 'FAIL', 'EXPIRED', 'PROCESSING'];
if (!ALLOWED.includes(STATUS)) {
  console.error(`Invalid status "${STATUS}". Use one of: ${ALLOWED.join(', ')}`);
  process.exit(1);
}
if (!process.env.DIGICASH_SECRET_KEY) {
  console.error('DIGICASH_SECRET_KEY missing — check config.env');
  process.exit(1);
}

const uid = `TEST${Date.now().toString().slice(-8)}`;
const payload = {
  external_id: '7105563620335199',
  provider_id: 'TESTPROV_PAY',
  provider_name: 'TESTPROV',
  operation_id: uid,
  payment_method: 'qrph',
  amount: '10000',
  currency: 'PHP',
  fee_amount: '0',
  operation: {
    status: STATUS,
    error_code: STATUS === 'PAID' || STATUS === 'PROCESSING' ? null : 'TEST_' + STATUS,
    error_message: STATUS === 'PAID' || STATUS === 'PROCESSING' ? null : `Simulated ${STATUS} for testing`
  },
  customer: {
    account_number: '09171234567',
    name: 'Callback Script Demo',
    email: 'demo@example.com',
    address: 'Manila, PH',
    phone_number: '09171234567',
    remark: 'sent by send-test-callback.js'
  }
};
payload.signature = BAD_SIG ? 'invalid_signature_demo' : generateSignature(payload, process.env.DIGICASH_SECRET_KEY);

(async () => {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(`POST ${URL}`);
  console.log(`  operation_id : ${uid}`);
  console.log(`  status       : ${STATUS}`);
  console.log(`  signature    : ${BAD_SIG ? 'INVALID (demo)' : 'valid, server-verified'}`);
  console.log(`  server reply :`, JSON.stringify(data));
})().catch((err) => {
  console.error('Request failed:', err.message);
  process.exit(1);
});
