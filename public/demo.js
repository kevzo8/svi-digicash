// SVI Wallet Demo - mobile prototype (pay in / pay out / activity)
// Uses the LIVE DigiCash API via /api/proxy/*; all calls are logged and
// persisted on-device. Balances are simulated for demo purposes.

const DEMO_STATE_KEY = 'svi_demo_state';
const DEMO_LOG_KEY = 'svi_api_log';
const DEMO_MAX_LOG = 100;
const DEMO_START_BALANCE_MINOR = 5000000; // ₱50,000.00 demo funds

function demoState() {
  try {
    const s = JSON.parse(localStorage.getItem(DEMO_STATE_KEY) || '{}');
    if (typeof s.balanceMinor !== 'number') s.balanceMinor = DEMO_START_BALANCE_MINOR;
    if (!Array.isArray(s.txs)) s.txs = [];
    return s;
  } catch (e) {
    return { balanceMinor: DEMO_START_BALANCE_MINOR, txs: [] };
  }
}

function saveDemoState(s) {
  try { localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

// Called by app.js apiRequest wrapper for EVERY portal + demo call
window.logApiCall = function (entry) {
  try {
    const log = JSON.parse(localStorage.getItem(DEMO_LOG_KEY) || '[]');
    log.push({ id: 'log' + Date.now() + Math.floor(Math.random() * 1000), ts: new Date().toISOString(), ...entry });
    while (log.length > DEMO_MAX_LOG) log.shift();
    localStorage.setItem(DEMO_LOG_KEY, JSON.stringify(log));
    renderDemoSession();
    if (currentTab === 'demo' && !document.getElementById('d-activity').classList.contains('hidden')) {
      renderDemoActivity();
    }
    renderBackendFeed();
  } catch (e) { /* logging must never break calls */ }
};

function getApiLog() {
  try { return JSON.parse(localStorage.getItem(DEMO_LOG_KEY) || '[]'); }
  catch (e) { return []; }
}

// Owner map: portal route → upstream DigiCash call.
// Outbound rows show both hops (SVI chip → DIGICASH chip);
// inbound callbacks show the reverse (DIGICASH → SVI).
const UPSTREAM = {
  '/api/proxy/pay': '/pay',
  '/api/proxy/payout': '/payout',
  '/api/proxy/status': '/status'
};

function routeHtml(e) {
  const portal = 'POST /api' + (e.endpoint || '').replace(/^\/api/, '');
  if (e.dir === 'in') {
    return `<div class="route"><span class="who digi">DIGICASH</span><code>POST /api/callback</code></div>` +
      `<div class="route"><span class="who svi">SVI</span><code>webhook receiver</code><span class="arr">↓ inbound</span></div>`;
  }
  const up = UPSTREAM['/api' + (e.endpoint || '').replace(/^\/api/, '')];
  let html = `<div class="route"><span class="who svi">SVI</span><code>${escapeHtml(portal)}</code></div>`;
  if (up) {
    const base = (typeof apiConfig !== 'undefined' && apiConfig.baseUrl ? apiConfig.baseUrl : 'https://api.fastpayph.com').replace(/\/$/, '');
    html += `<div class="route"><span class="who digi">DIGICASH</span><code>POST ${escapeHtml(base + up)}</code><span class="arr">↑ upstream</span></div>`;
  } else {
    html += `<div class="form-hint">local only</div>`;
  }
  return html;
}

function callBadge(e) {
  const ms = e.ms > 0 ? ` · ${e.ms}ms` : '';
  if (e.dir === 'in') return `<span class="act-badge ok">RECEIVED${ms}</span>`;
  return `<span class="act-badge ${e.httpOk ? 'ok' : 'bad'}">${e.httpOk ? 'OK' : 'FAIL'}${ms}</span>`;
}

function fmtPeso(minor) {
  return '₱' + (minor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function demoTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

// ---------- navigation ----------
function dnav(id) {
  document.querySelectorAll('.dscreen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
  const scroller = document.querySelector('.phone-screen');
  if (scroller) scroller.scrollTop = 0;
  if (id === 'd-home') renderDemoHome();
  if (id === 'd-activity') renderDemoActivity();
  renderDemoSession();
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) dnav(go.dataset.go);
});

// ---------- home / session ----------
function renderDemoHome() {
  const s = demoState();
  document.getElementById('d-balance').textContent = fmtPeso(s.balanceMinor);
  const recent = [...s.txs].reverse().slice(0, 3);
  const box = document.getElementById('d-recent');
  box.innerHTML = recent.length ? recent.map(txRow).join('') : '<p class="form-hint">No transactions yet — try Pay In.</p>';
  renderDemoSession();
}

function renderDemoSession() {
  const s = demoState();
  const log = getApiLog();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('d-session-balance', fmtPeso(s.balanceMinor));
  set('d-session-calls', String(log.length));
  set('d-session-tx', String(s.txs.length));
  // Closest thing to a real balance: DigiCash has no balance endpoint,
  // so we surface the last funds verdict from an actual payout attempt.
  const w = s.walletSignal;
  set('d-wallet-signal', w
    ? `${w.state} (tested ${fmtPeso(w.amountMinor)})`
    : 'unknown — no payout tested yet');
}

function txRow(t) {
  const up = t.kind === 'payin';
  const amtCls = t.kind === 'payout' ? 'neg' : (t.status === 'paid' ? 'pos' : '');
  const sign = t.kind === 'payout' ? '−' : '+';
  const amt = (t.amountMinor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<div class="tx-row">
    <span class="tx-kind ${t.kind === 'payout' ? 'out' : ''}"><svg class="ic"><use href="#${up ? 'i-in' : 'i-out'}"/></svg></span>
    <div class="tx-main">
      <div class="tx-title">${up ? 'Pay in' : 'Pay out'} · ${escapeHtml(t.bankLabel || t.methodLabel || (up ? 'QRPh' : ''))}</div>
      <div class="tx-sub">${escapeHtml(t.operationId || '')} · ${demoTime(t.ts)}</div>
    </div>
    <span class="tx-amt ${amtCls}">${sign}₱${amt}</span>
  </div>`;
}

// ---------- pay in ----------
let demoPayinTx = null;

async function handleDemoPayin(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('d-amount').value);
  if (!amount || amount < 1) { demoPayinMsg('Enter at least ₱1.00'); return; }
  const btn = document.getElementById('d-payin-btn');
  setLoading(btn, btn.querySelector('.btn-text'), btn.querySelector('.btn-loader'), true);
  hidePayinMsg();
  try {
    const res = await apiRequest('/proxy/pay', { method: 'qrph', amount, currency: 'PHP' }, 'demo');
    const s = demoState();
    demoPayinTx = {
      id: 'tx' + Date.now(), kind: 'payin', amountMinor: Math.round(amount * 100),
      operationId: res.operation_id, transId: res.trans_id || res.request_id || '',
      status: (res.operation?.status || 'initiated').toLowerCase(), methodLabel: 'QRPh',
      redirectUrl: res.redirect_url || '', qr: res.qr_content || '', ts: new Date().toISOString(), credited: false
    };
    s.txs.push(demoPayinTx);
    saveDemoState(s);
    renderDemoPayinResult();
    renderDemoHome();
  } catch (err) {
    demoPayinMsg(err.message, err.details);
  } finally {
    setLoading(btn, btn.querySelector('.btn-text'), btn.querySelector('.btn-loader'), false);
  }
}

function renderDemoPayinResult() {
  const t = demoPayinTx;
  if (!t) return;
  document.getElementById('d-payin-result').classList.remove('hidden');
  document.getElementById('d-payin-op').textContent = t.operationId || '-';
  const st = document.getElementById('d-payin-status');
  st.textContent = t.status;
  st.className = 'status-badge ' + t.status;
  const box = document.getElementById('d-qr');
  box.innerHTML = '';
  if (t.qr && window.qrcode) {
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(t.qr);
      qr.make();
      box.innerHTML = qr.createImgTag(4, 6);
    } catch (e) { box.innerHTML = '<p class="form-hint">QR unavailable — use the redirect link in Pay In tab.</p>'; }
  }
}

function demoPayinMsg(msg, details) {
  const el = document.getElementById('d-payin-error');
  el.innerHTML = `<div class="error-title">Error</div><div class="error-details">${escapeHtml(msg)}</div>`;
  el.classList.remove('hidden');
}

function hidePayinMsg() {
  document.getElementById('d-payin-error').classList.add('hidden');
}

async function demoCheckPayinStatus() {
  const t = demoPayinTx;
  if (!t) return;
  try {
    showToast('Checking status…', 'info');
    const res = await apiRequest('/proxy/status', { operationId: t.operationId }, 'demo');
    t.status = (res.operation?.status || t.status).toLowerCase();
    if (t.transId === '' && (res.trans_id || res.request_id)) t.transId = res.trans_id || res.request_id;
    persistTx(t);
    if (t.status === 'paid') creditTx(t, 'status poll');
    renderDemoPayinResult();
    renderDemoHome();
    showToast('Status: ' + t.status, t.status === 'paid' ? 'success' : 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function demoSimulatePaid() {
  const t = demoPayinTx;
  if (!t || t.status === 'paid') return;
  t.status = 'paid';
  t.simulated = true;
  creditTx(t, 'simulated receipt');
  persistTx(t);
  renderDemoPayinResult();
  renderDemoHome();
  showToast('Marked paid (simulated) — balance credited', 'success');
}

function creditTx(t, why) {
  if (t.credited || t.kind !== 'payin') return;
  const s = demoState();
  const stored = s.txs.find((x) => x.id === t.id) || t;
  if (stored.credited) return;
  stored.credited = true;
  s.balanceMinor += stored.amountMinor;
  saveDemoState(s);
  t.credited = true;
  console.log(`Credited ${stored.amountMinor} (${why})`);
}

function persistTx(t) {
  const s = demoState();
  const i = s.txs.findIndex((x) => x.id === t.id);
  if (i >= 0) s.txs[i] = t;
  else s.txs.push(t);
  saveDemoState(s);
}

// ---------- pay out ----------
async function handleDemoPayout(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('d-po-amount').value);
  const bankId = document.getElementById('d-bank').value;
  const account = document.getElementById('d-acct').value.trim();
  const name = document.getElementById('d-name').value.trim();
  if (!amount || amount < 1) return demoPayoutMsg('Enter at least ₱1.00');
  if (!bankId) return demoPayoutMsg('Select a bank / wallet');
  const bankLabel = (banksData[bankId] || bankId);
  const btn = document.getElementById('d-payout-btn');
  setLoading(btn, btn.querySelector('.btn-text'), btn.querySelector('.btn-loader'), true);
  document.getElementById('d-payout-error').classList.add('hidden');
  document.getElementById('d-payout-result').classList.add('hidden');
  try {
    const res = await apiRequest('/proxy/payout', {
      amount, currency: 'PHP',
      customer: {
        accountBankId: bankId, accountNumber: account, accountName: name,
        email: 'demo@svi.ph', phoneNumber: '09171234567'
      }
    }, 'demo');
    const ok = res.request?.status === 'success' && (res.operation?.status || '') !== 'fail';
    const s = demoState();
    // Record the real wallet verdict (7015 = insufficient for this amount)
    s.walletSignal = {
      state: res.request?.error_code === 7015 ? 'insufficient' : (ok ? 'sufficient' : 'unknown'),
      amountMinor: Math.round(amount * 100),
      ts: new Date().toISOString()
    };
    const t = {
      id: 'tx' + Date.now(), kind: 'payout', amountMinor: Math.round(amount * 100),
      operationId: res.operation_id, transId: res.external_id || res.trans_id || '',
      status: (res.operation?.status || (ok ? 'processing' : 'fail')).toLowerCase(),
      bankLabel, account, ts: new Date().toISOString(), balanceApplied: null
    };
    if (ok) {
      s.balanceMinor -= t.amountMinor;
      t.balanceApplied = 'deducted';
      showToast('Payout sent — balance deducted', 'success');
    } else {
      showToast('Payout rejected: ' + (res.request?.error_message || res.operation?.error_message || 'failed'), 'error');
    }
    s.txs.push(t);
    saveDemoState(s);
    document.getElementById('d-po-op').textContent = t.operationId || '-';
    const st = document.getElementById('d-po-status');
    st.textContent = t.status;
    st.className = 'status-badge ' + t.status;
    document.getElementById('d-po-msg').textContent = res.request?.error_message || res.operation?.error_message || (ok ? 'Submitted for processing' : 'Rejected');
    document.getElementById('d-payout-result').classList.remove('hidden');
    renderDemoHome();
  } catch (err) {
    demoPayoutMsg(err.message, err.details);
  } finally {
    setLoading(btn, btn.querySelector('.btn-text'), btn.querySelector('.btn-loader'), false);
  }
}

function demoPayoutMsg(msg) {
  const el = document.getElementById('d-payout-error');
  el.innerHTML = `<div class="error-title">Error</div><div class="error-details">${escapeHtml(msg)}</div>`;
  el.classList.remove('hidden');
}

// ---------- callbacks → wallet sync ----------
const CB_PAID = 'paid', CB_FAIL = 'fail', CB_EXPIRED = 'expired';
const SEEN_CB_KEY = 'svi_seen_callbacks';
function seenCallbacks() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_CB_KEY) || '[]')); }
  catch (e) { return new Set(); }
}
function saveSeenCallbacks(set) {
  try { localStorage.setItem(SEEN_CB_KEY, JSON.stringify([...set].slice(-200))); } catch (e) { /* ignore */ }
}
async function syncDemoWithCallbacks() {
  let logs = [];
  try {
    const res = await fetch('/api/callbacks');
    logs = (await res.json()).logs || [];
  } catch (e) { return; }
  const seen = seenCallbacks();
  let seenChanged = false;
  const s = demoState();
  let changed = false;
  for (const log of logs) {
    // Record every received callback in the API log (inbound direction)
    if (log.id && !seen.has(log.id)) {
      seen.add(log.id);
      seenChanged = true;
      if (typeof window.logApiCall === 'function') {
        try {
          window.logApiCall({ source: 'callback', dir: 'in', endpoint: '/api/callback', request: null, response: log.payload, httpOk: true, httpStatus: 200, ms: 0 });
        } catch (e) { /* ignore */ }
      }
    }
    const opId = log.payload?.operation_id;
    const cbStatus = (log.payload?.operation?.status || '').toUpperCase();
    if (!opId || !['PAID', 'FAIL', 'EXPIRED', 'PROCESSING'].includes(cbStatus)) continue;
    const t = s.txs.find((x) => x.operationId === opId && ['awaiting_redirect', 'initiated', 'processing'].includes(x.status));
    if (!t) continue;
    // Only trust server-verified callbacks for balance movement
    if (!log.signatureValid) continue;
    t.status = cbStatus.toLowerCase();
    if (t.kind === 'payin' && cbStatus === 'PAID') {
      if (!t.credited) {
        t.credited = true;
        s.balanceMinor += t.amountMinor;
        showToast(`Payment received: ${fmtPeso(t.amountMinor)}`, 'success');
      }
    }
    if (t.kind === 'payout' && (cbStatus === 'FAIL' || cbStatus === 'EXPIRED') && t.balanceApplied === 'deducted') {
      t.balanceApplied = 'refunded';
      s.balanceMinor += t.amountMinor;
      showToast('Payout failed — amount refunded to demo balance', 'error');
    }
    if (demoPayinTx && demoPayinTx.id === t.id) { demoPayinTx.status = t.status; renderDemoPayinResult(); }
    changed = true;
  }
  if (seenChanged) saveSeenCallbacks(seen);
  if (changed) {
    saveDemoState(s);
    renderDemoHome();
  }
}
setInterval(() => { if (currentTab === 'demo') syncDemoWithCallbacks(); }, 5000);

// ---------- live backend feed (middle column) + selected call ----------
let selectedCallId = null;

function renderBackendFeed() {
  const feed = document.getElementById('d-feed');
  if (!feed) return;
  const log = getApiLog();
  const count = document.getElementById('d-feed-count');
  if (count) count.textContent = `${log.length} call${log.length === 1 ? '' : 's'}`;
  if (!log.length) {
    feed.innerHTML = '<p class="form-hint">No calls yet — try Pay In on the phone.</p>';
    return;
  }
  feed.innerHTML = [...log].reverse().map((e) => {
    const op = e.response?.operation?.status || e.response?.request?.status || (e.httpOk ? 'ok' : 'error');
    return `<div class="feed-row${e.id === selectedCallId ? ' sel' : ''}" data-log="${e.id}">
      <div class="tx-title">POST ${escapeHtml((e.endpoint || '').replace('/proxy', ''))} ${callBadge(e)}</div>
      <div class="tx-sub">${demoTime(e.ts)} · ${escapeHtml(e.source || '')} · <span class="status-badge ${(op || '').toLowerCase()}">${escapeHtml(String(op))}</span></div>
      ${routeHtml(e)}
    </div>`;
  }).join('');
}

function renderSelectedCall() {
  const empty = document.getElementById('d-selected-empty');
  const body = document.getElementById('d-selected-body');
  if (!empty || !body) return;
  const e = getApiLog().find((x) => x.id === selectedCallId);
  if (!e) {
    empty.classList.remove('hidden');
    body.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  body.classList.remove('hidden');
  document.getElementById('d-selected-routes').innerHTML = routeHtml(e);
  const maskedReq = { ...(e.request || {}) };
  if (maskedReq.passwork) maskedReq.passwork = '•••';
  document.getElementById('d-selected-req').textContent = JSON.stringify(maskedReq, null, 2);
  document.getElementById('d-selected-res').textContent = JSON.stringify(e.response || {}, null, 2);
}

document.getElementById('d-feed')?.addEventListener('click', (e) => {
  const row = e.target.closest('.feed-row');
  if (!row) return;
  selectedCallId = row.dataset.log;
  document.querySelectorAll('#d-feed .feed-row').forEach((r) => r.classList.toggle('sel', r.dataset.log === selectedCallId));
  renderSelectedCall();
});
function renderDemoActivity() {
  const log = getApiLog();
  const box = document.getElementById('d-activity-list');
  if (!box) return;
  if (!log.length) {
    box.innerHTML = '<p class="form-hint">No API calls yet — try Pay In.</p>';
    return;
  }
  box.innerHTML = [...log].reverse().map((e) => {
    const op = e.response?.operation?.status || e.response?.request?.status || (e.httpOk ? 'ok' : 'error');
    return `<div class="tx-row act-row" data-log="${e.id}">
      <div class="tx-main">
        <div class="tx-title">POST ${escapeHtml((e.endpoint || '').replace('/proxy', ''))} ${callBadge(e)}</div>
        <div class="tx-sub">${demoTime(e.ts)} · ${escapeHtml(e.source || '')} · <span class="status-badge ${(op || '').toLowerCase()}">${escapeHtml(String(op))}</span></div>
        ${routeHtml(e)}
      </div>
    </div>`;
  }).join('');
  box.querySelectorAll('.act-row').forEach((row) => {
    row.addEventListener('click', () => showDemoDetail(row.dataset.log));
  });
}

function showDemoDetail(id) {
  const e = getApiLog().find((x) => x.id === id);
  if (!e) return;
  document.getElementById('d-detail-title').textContent = 'POST ' + (e.endpoint || '');
  const maskedReq = { ...(e.request || {}) };
  if (maskedReq.passwork) maskedReq.passwork = '•••';
  document.getElementById('d-detail-req').textContent = JSON.stringify(maskedReq, null, 2);
  const detailRoute = document.getElementById('d-detail-route');
  if (detailRoute) detailRoute.innerHTML = routeHtml(e);
  document.getElementById('d-detail-res').textContent = JSON.stringify(e.response || {}, null, 2);
  dnav('d-detail');
}

// ---------- misc ----------
function resetDemo() {
  localStorage.removeItem(DEMO_STATE_KEY);
  localStorage.removeItem(DEMO_LOG_KEY);
  localStorage.removeItem(SEEN_CB_KEY);
  demoPayinTx = null;
  document.getElementById('d-payin-result').classList.add('hidden');
  document.getElementById('d-payout-result').classList.add('hidden');
  renderDemoHome();
  renderDemoActivity();
  showToast('Demo data cleared', 'success');
}

function tickDemoClock() {
  const el = document.getElementById('demo-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false });
}

document.getElementById('d-payin-form')?.addEventListener('submit', handleDemoPayin);
document.getElementById('d-payout-form')?.addEventListener('submit', handleDemoPayout);
document.getElementById('d-check-status')?.addEventListener('click', demoCheckPayinStatus);
document.getElementById('d-simulate-paid')?.addEventListener('click', demoSimulatePaid);
document.getElementById('d-reset')?.addEventListener('click', resetDemo);
tickDemoClock();
setInterval(tickDemoClock, 30000);
renderDemoHome();
renderBackendFeed();
