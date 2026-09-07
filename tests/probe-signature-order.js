/**
 * Signature order probe - finds which field concatenation the DigiCash
 * production API actually accepts.
 *
 * Run INSIDE the running container on EC2 (whitelisted IP):
 *   docker cp probe-signature-order.js svi-digicash:/tmp/probe.js
 *   docker exec svi-digicash node /tmp/probe.js
 *
 * Uses only built-in node modules. Each variant creates one throwaway
 * transaction (amount = PHP 1.00 in minor units).
 */
const crypto = require('crypto');
const https = require('https');

const SECRET = process.env.DIGICASH_SECRET_KEY;
const SERVICE_ID = process.env.DIGICASH_SERVICE_ID || 'service.svi';
const PASSWORK = process.env.DIGICASH_PASSWORK || 'passw0rd@SVI';
const BASE = process.env.DIGICASH_BASE_URL || 'https://api.fastpayph.com';

if (!SECRET) {
  console.error('DIGICASH_SECRET_KEY not set in container env');
  process.exit(1);
}

const AMOUNT = '100'; // minor units = PHP 1.00
const CURRENCY = 'PHP';
const BY_METHOD = 'gcash';
const CALLBACK = 'http://18.246.254.97:3000/api/callback';
const RETURN = 'http://18.246.254.97:3000/payment/return';

const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const dash = (v) => (v === null || v === undefined || v === '') ? '-' : String(v);
const uid = (p) => `${p}${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// Each variant: [name, orderedValuesFn(ids), payloadKeyOrder]
function variants(opId, payId) {
  const V = { service_id: SERVICE_ID, passwork: PASSWORK, amount: AMOUNT, currency: CURRENCY, operation_id: opId, payment_id: payId, by_method: BY_METHOD, callback_url: CALLBACK, return_url: RETURN };
  const order = (keys) => keys.map((k) => dash(V[k])).join('');
  return [
    ['V1_postman_service_first', order(['service_id', 'passwork', 'amount', 'currency', 'operation_id', 'payment_id', 'by_method', 'callback_url', 'return_url'])],
    ['V2_docs_passwork_first', order(['passwork', 'service_id', 'amount', 'currency', 'operation_id', 'payment_id', 'by_method', 'callback_url', 'return_url'])],
    ['V3_alphabetical', order(['amount', 'by_method', 'callback_url', 'currency', 'operation_id', 'passwork', 'payment_id', 'return_url', 'service_id'])],
    ['V4_V1_same_ids', null], // built below with opId === payId
    ['V5_V2_same_ids', null],
    ['V6_V1_no_bymethod', order(['service_id', 'passwork', 'amount', 'currency', 'operation_id', 'payment_id', 'callback_url', 'return_url'])],
    ['V7_V2_no_bymethod', order(['passwork', 'service_id', 'amount', 'currency', 'operation_id', 'payment_id', 'callback_url', 'return_url'])],
  ];
}

function post(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(BASE + '/pay');
    const req = https.request(
      { hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, timeout: 20000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ http: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ http: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('Base:', BASE, '| service:', SERVICE_ID);
  for (const [name] of variants('x', 'x')) {
    const opId = uid('PROBE');
    const payId = name.includes('same_ids') ? opId : uid('PROBE');
    const V = { service_id: SERVICE_ID, passwork: PASSWORK, amount: AMOUNT, currency: CURRENCY, operation_id: opId, payment_id: payId, by_method: BY_METHOD, callback_url: CALLBACK, return_url: RETURN };
    const order = (keys) => keys.map((k) => dash(V[k])).join('');
    const ORDERS = {
      V1_postman_service_first: ['service_id', 'passwork', 'amount', 'currency', 'operation_id', 'payment_id', 'by_method', 'callback_url', 'return_url'],
      V2_docs_passwork_first: ['passwork', 'service_id', 'amount', 'currency', 'operation_id', 'payment_id', 'by_method', 'callback_url', 'return_url'],
      V3_alphabetical: ['amount', 'by_method', 'callback_url', 'currency', 'operation_id', 'passwork', 'payment_id', 'return_url', 'service_id'],
      V4_V1_same_ids: ['service_id', 'passwork', 'amount', 'currency', 'operation_id', 'payment_id', 'by_method', 'callback_url', 'return_url'],
      V5_V2_same_ids: ['passwork', 'service_id', 'amount', 'currency', 'operation_id', 'payment_id', 'by_method', 'callback_url', 'return_url'],
      V6_V1_no_bymethod: ['service_id', 'passwork', 'amount', 'currency', 'operation_id', 'payment_id', 'callback_url', 'return_url'],
      V7_V2_no_bymethod: ['passwork', 'service_id', 'amount', 'currency', 'operation_id', 'payment_id', 'callback_url', 'return_url'],
    };
    const raw = order(ORDERS[name]);
    const sig = hmac(raw);
    // Always SEND fields in Postman body order; only the signature input varies
    const body = { service_id: V.service_id, passwork: V.passwork, amount: V.amount, currency: V.currency, operation_id: V.operation_id, payment_id: V.payment_id, by_method: V.by_method, callback_url: V.callback_url, return_url: V.return_url, signature: sig };
    try {
      const r = await post(body);
      const b = r.body || {};
      console.log(`\n### ${name}`);
      console.log('  raw:', raw);
      console.log('  sig:', sig);
      console.log('  http:', r.http, '| op.status:', b.operation?.status, '| provider_msg:', b.operation?.provider_error_message || '-', '| req:', b.request?.status, b.request?.error_code, b.request?.error_message || '-');
      if (b.operation?.provider_error_message && b.operation.provider_error_message !== 'Invalid signature') {
        console.log('  *** NOT an Invalid-signature error - investigate this one ***');
      }
      if (b.redirect_url) {
        console.log('  *** HAS redirect_url - THIS ORDER WORKS ***');
      }
    } catch (e) {
      console.log(`\n### ${name} TRANSPORT ERROR: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('\nDone.');
})();
