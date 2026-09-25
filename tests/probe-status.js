/**
 * Status probe - finds which ID the live /status endpoint accepts.
 *
 * Run INSIDE the running container on EC2 (whitelisted IP):
 *   docker cp probe-status.js svi-digicash:/tmp/probe-status.js
 *   docker exec svi-digicash node /tmp/probe-status.js
 *
 * Uses only built-in node modules. Values below come from the
 * successful 2026-09-25 QRPh payment (trans 6151342).
 */
const crypto = require('crypto');
const https = require('https');

const SECRET = process.env.DIGICASH_SECRET_KEY;
const SERVICE_ID = process.env.DIGICASH_SERVICE_ID;
const PASSWORK = process.env.DIGICASH_PASSWORK;
const BASE = process.env.DIGICASH_BASE_URL || 'https://api.fastpayph.com';

if (!SECRET || !SERVICE_ID || !PASSWORK) {
  console.error('DIGICASH_SECRET_KEY, DIGICASH_SERVICE_ID and DIGICASH_PASSWORK must all be set');
  process.exit(1);
}

// Known-good transaction (HTTP 200 + awaiting_redirect)
const TRANS_ID = '6151342';
const OP_ID = 'PAY1790302177187SM6PHO';
const EXT_ID = '3999514817574738';

const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const dash = (v) => (v === null || v === undefined || v === '') ? '-' : String(v);

function sign(obj) {
  const raw = Object.keys(obj).filter((k) => k !== 'signature').map((k) => dash(obj[k])).join('');
  return { raw, signature: hmac(raw) };
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(BASE + path);
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
  const variants = {
    'S-A request_id=trans_id': { passwork: PASSWORK, service_id: SERVICE_ID, request_id: TRANS_ID },
    'S-B operation_id only': { passwork: PASSWORK, service_id: SERVICE_ID, operation_id: OP_ID },
    'S-C request_id+operation_id': { passwork: PASSWORK, service_id: SERVICE_ID, request_id: TRANS_ID, operation_id: OP_ID },
    'S-D request_id=external_id': { passwork: PASSWORK, service_id: SERVICE_ID, request_id: EXT_ID },
  };
  for (const [name, params] of Object.entries(variants)) {
    const { raw, signature } = sign(params);
    try {
      const r = await post('/status', { ...params, signature });
      const b = r.body || {};
      console.log(`\n### ${name}`);
      console.log('  raw:', raw);
      console.log('  http:', r.http, '| op.status:', b.operation?.status || '-', '| req:', b.request?.status, b.request?.error_code, (b.request?.error_message || '-').slice(0, 90));
      if (b.redirect_url) console.log('  redirect_url present');
      if (r.http === 200 && b.request?.status === 'success') console.log('  *** THIS VARIANT WORKS ***');
    } catch (e) {
      console.log(`\n### ${name} TRANSPORT ERROR: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('\nDone.');
})();
