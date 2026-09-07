// SVI DigiCash Payment Portal - Frontend Application

// Configuration
const API_BASE = '/api';
let banksData = {};

// DOM Elements
const tabs = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

// State
let currentTab = 'pay';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadBanks();
  setupEventListeners();
  setupTabs();
  loadCallbackUrl();
  loadCallbacks();
  setInterval(loadCallbacks, 5000); // Poll callbacks every 5 seconds
});

// Load banks for payout dropdown
async function loadBanks() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    const data = await res.json();
    banksData = data.supportedBanks || {};
    populateBankDropdown();
  } catch (err) {
    console.error('Failed to load banks:', err);
  }
}

function populateBankDropdown() {
  const select = document.getElementById('payout-bank-id');
  if (!select) return;
  
  // Sort banks alphabetically by name
  const sortedBanks = Object.entries(banksData).sort((a, b) => a[1].localeCompare(b[1]));
  
  sortedBanks.forEach(([id, name]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${name} (${id})`;
    select.appendChild(option);
  });
}

// Tab Navigation
function setupTabs() {
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  currentTab = tab;
  tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  tabContents.forEach(content => content.classList.toggle('active', content.id === `tab-${tab}`));
}

// Event Listeners
function setupEventListeners() {
  // Pay Form
  document.getElementById('pay-form')?.addEventListener('submit', handlePaySubmit);
  
  // Payout Form
  document.getElementById('payout-form')?.addEventListener('submit', handlePayoutSubmit);
  
  // Status Form
  document.getElementById('status-form')?.addEventListener('submit', handleStatusSubmit);
  
  // Clear Callbacks
  document.getElementById('clear-callbacks')?.addEventListener('click', clearCallbacks);
  
  // Copy buttons (delegated)
  document.addEventListener('click', (e) => {
    if (e.target.matches('.btn-copy')) {
      copyToClipboard(e.target.dataset.copy);
    }
  });
  
  // Copy all buttons
  document.getElementById('pay-copy-all')?.addEventListener('click', () => copyPayResult());
  document.getElementById('payout-copy-all')?.addEventListener('click', () => copyPayoutResult());
}

// API Helpers
async function apiRequest(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const result = await res.json();
  
  if (!res.ok) {
    const err = new Error(formatApiError(result, res.status));
    err.details = result;
    throw err;
  }
  
  // DigiCash can also return HTTP 200 with an embedded failure
  // (e.g. operation.status === 'fail'), let the caller render it.
  return result;
}

// Build a human-readable message from a DigiCash error body
function formatApiError(result, httpStatus) {
  if (!result || typeof result !== 'object') {
    return `HTTP ${httpStatus}`;
  }
  const parts = [];
  if (result.operation?.provider_error_message) {
    parts.push(`Provider: ${result.operation.provider_error_message}`);
  }
  if (result.operation?.error_message) {
    parts.push(`Operation: ${result.operation.error_message}`);
  }
  if (result.request?.error_message) {
    parts.push(`Request [${result.request.error_code}]: ${result.request.error_message}`);
  }
  if (result.message && !parts.length) {
    parts.push(result.message);
  }
  if (result.error && typeof result.error === 'string' && !parts.length) {
    parts.push(result.error);
  }
  if (!parts.length) {
    parts.push(`HTTP ${httpStatus}`);
  }
  return parts.join(' | ');
}

// Pay Handler
async function handlePaySubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const submitBtn = document.getElementById('pay-submit');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');
  
  // Get form data
  const formData = new FormData(form);
  const payload = {
    method: formData.get('method'),
    amount: parseFloat(formData.get('amount')),
    currency: formData.get('currency') || 'PHP',
    operationId: formData.get('operationId') || undefined,
    paymentId: formData.get('paymentId') || undefined
  };
  
  // Validate
  if (!payload.amount || payload.amount < 1) {
    showError('pay-error', 'Please enter a valid amount (minimum ₱1.00)');
    return;
  }
  
  // Loading state
  setLoading(submitBtn, btnText, btnLoader, true);
  hideError('pay-error');
  hideResult('pay-result');
  
  try {
    const result = await apiRequest('/proxy/pay', payload);
    showPayResult(result);
    showToast('Payment created successfully!', 'success');
  } catch (err) {
    showError('pay-error', err.message, err.details);
    showToast(err.message, 'error');
  } finally {
    setLoading(submitBtn, btnText, btnLoader, false);
  }
}

// Payout Handler
async function handlePayoutSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const submitBtn = document.getElementById('payout-submit');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');
  
  // Get form data
  const formData = new FormData(form);
  const payload = {
    amount: parseFloat(formData.get('amount')),
    currency: formData.get('currency') || 'PHP',
    customer: {
      accountBankId: formData.get('accountBankId'),
      accountNumber: formData.get('accountNumber'),
      accountName: formData.get('accountName'),
      email: formData.get('email'),
      phoneNumber: formData.get('phoneNumber'),
      address: formData.get('address') || '-',
      remark: formData.get('remark') || '-'
    }
  };
  
  // Validate
  if (!payload.amount || payload.amount < 1) {
    showError('payout-error', 'Please enter a valid amount (minimum ₱1.00)');
    return;
  }
  
  if (!payload.customer.accountBankId) {
    showError('payout-error', 'Please select a bank/wallet');
    return;
  }
  
  const phoneRegex = /^(09\d{9}|\+63\d{10})$/;
  if (!phoneRegex.test(payload.customer.phoneNumber)) {
    showError('payout-error', 'Invalid phone format. Use 09xxxxxxxxx or +63xxxxxxxxxx');
    return;
  }
  
  // Loading state
  setLoading(submitBtn, btnText, btnLoader, true);
  hideError('payout-error');
  hideResult('payout-result');
  
  try {
    const result = await apiRequest('/proxy/payout', payload);
    showPayoutResult(result);
    showToast('Payout created successfully!', 'success');
  } catch (err) {
    showError('payout-error', err.message, err.details);
    showToast(err.message, 'error');
  } finally {
    setLoading(submitBtn, btnText, btnLoader, false);
  }
}

// Status Handler
async function handleStatusSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const submitBtn = document.getElementById('status-submit');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');
  
  const formData = new FormData(form);
  const requestId = formData.get('requestId').trim();
  
  if (!requestId) {
    showError('status-error', 'Please enter a Request ID');
    return;
  }
  
  setLoading(submitBtn, btnText, btnLoader, true);
  hideError('status-error');
  hideResult('status-result');
  
  try {
    const result = await apiRequest('/proxy/status', { requestId });
    showStatusResult(result);
    showToast('Status retrieved successfully!', 'success');
  } catch (err) {
    showError('status-error', err.message, err.details);
    showToast(err.message, 'error');
  } finally {
    setLoading(submitBtn, btnText, btnLoader, false);
  }
}

// Result Display Functions
function setResultTitle(resultId, ok, okText, failText) {
  const header = document.querySelector(`#${resultId} .result-header h3`);
  if (header) {
    header.textContent = ok ? okText : failText;
    header.style.color = ok ? 'var(--primary-dark)' : 'var(--danger)';
  }
}

function showPayResult(data) {
  const status = data.operation?.status || 'unknown';
  const ok = !['fail', 'expired'].includes(status.toLowerCase());
  setResultTitle('pay-result', ok, 'Payment Created Successfully', `Payment ${status.toUpperCase()}`);
  document.getElementById('res-request-id').textContent = data.request_id || data.trans_id || '-';
  document.getElementById('res-operation-id').textContent = data.operation_id || '-';
  document.getElementById('res-status').textContent = status;
  document.getElementById('res-status').className = `result-value status-badge ${status.toLowerCase()}`;
  document.getElementById('res-signature').textContent = data.signatureValid ? '✅ Valid' : '❌ Invalid';
  document.getElementById('res-signature').style.color = data.signatureValid ? 'var(--success)' : 'var(--danger)';
  
  // Redirect link
  const redirectUrl = data.redirect_url;
  if (redirectUrl) {
    document.getElementById('pay-redirect-link').href = redirectUrl;
    document.getElementById('pay-redirect-link').style.display = 'inline-flex';
  } else {
    document.getElementById('pay-redirect-link').style.display = 'none';
  }
  
  // Provider/request error messages (shown when not successful)
  renderResultErrors('pay-result', data);
  
  // Raw response
  document.getElementById('pay-raw-response').textContent = JSON.stringify(data, null, 2);
  
  showResult('pay-result');
}

function showPayoutResult(data) {
  const status = data.operation?.status || 'unknown';
  const ok = !['fail', 'expired'].includes(status.toLowerCase());
  setResultTitle('payout-result', ok, 'Payout Created Successfully', `Payout ${status.toUpperCase()}`);
  document.getElementById('res-ext-id').textContent = data.external_id || data.trans_id || '-';
  document.getElementById('res-po-operation-id').textContent = data.operation_id || '-';
  document.getElementById('res-po-status').textContent = status;
  document.getElementById('res-po-status').className = `result-value status-badge ${status.toLowerCase()}`;
  document.getElementById('res-po-signature').textContent = data.signatureValid ? '✅ Valid' : '❌ Invalid';
  document.getElementById('res-po-signature').style.color = data.signatureValid ? 'var(--success)' : 'var(--danger)';
  
  renderResultErrors('payout-result', data);
  
  document.getElementById('payout-raw-response').textContent = JSON.stringify(data, null, 2);
  
  showResult('payout-result');
}

// Show provider/request error messages inside a result card
function renderResultErrors(resultId, data) {
  let box = document.querySelector(`#${resultId} .result-errors`);
  if (!box) {
    box = document.createElement('div');
    box.className = 'result-errors';
    document.querySelector(`#${resultId} .result-grid`).after(box);
  }
  const msgs = [];
  if (data.operation?.provider_error_message) {
    msgs.push(`<div><strong>Provider:</strong> ${escapeHtml(data.operation.provider_error_message)}</div>`);
  }
  if (data.operation?.error_message) {
    msgs.push(`<div><strong>Operation:</strong> ${escapeHtml(String(data.operation.error_message))} ${data.operation.error_code ? `(code: ${escapeHtml(String(data.operation.error_code))})` : ''}</div>`);
  }
  if (data.request?.error_message) {
    msgs.push(`<div><strong>Request [${escapeHtml(String(data.request.error_code ?? ''))}]:</strong> ${escapeHtml(String(data.request.error_message))}</div>`);
  }
  box.innerHTML = msgs.join('');
  box.style.display = msgs.length ? 'block' : 'none';
}

function showStatusResult(data) {
  document.getElementById('res-st-request-id').textContent = data.request_id || '-';
  document.getElementById('res-st-operation-id').textContent = data.operation_id || '-';
  document.getElementById('res-st-op-status').textContent = data.operation?.status || 'unknown';
  document.getElementById('res-st-op-status').className = `result-value status-badge ${(data.operation?.status || '').toLowerCase()}`;
  document.getElementById('res-st-req-status').textContent = data.request?.status || 'unknown';
  document.getElementById('res-st-req-status').className = `result-value status-badge ${(data.request?.status || '').toLowerCase()}`;
  document.getElementById('res-st-signature').textContent = data.signatureValid ? '✅ Valid' : '❌ Invalid';
  document.getElementById('res-st-signature').style.color = data.signatureValid ? 'var(--success)' : 'var(--danger)';
  document.getElementById('res-st-timestamp').textContent = data.timestamp || '-';
  
  document.getElementById('status-raw-response').textContent = JSON.stringify(data, null, 2);
  
  showResult('status-result');
}

// UI Helpers
function setLoading(btn, textEl, loaderEl, loading) {
  btn.disabled = loading;
  textEl.style.display = loading ? 'none' : 'inline';
  loaderEl.style.display = loading ? 'inline-block' : 'none';
  loaderEl.classList.toggle('hidden', !loading);
}

function showResult(id) {
  document.getElementById(id).classList.remove('hidden');
  updateSidePanel(id);
}

function hideResult(id) {
  document.getElementById(id).classList.add('hidden');
  updateSidePanel(id);
}

// Show the "No response yet" placeholder only when both the
// result and error panels for that tab are hidden.
// Also resets the raw-response column to its waiting state.
const RAW_PANEL_IDS = {
  pay: 'pay-raw-response',
  payout: 'payout-raw-response',
  status: 'status-raw-response'
};
const RAW_WAITING_TEXT = '// Submit the form to see the raw response…';

function updateSidePanel(id) {
  const tab = id.split('-')[0]; // pay | payout | status
  const placeholder = document.getElementById(`${tab}-side-placeholder`);
  if (!placeholder) return;
  const result = document.getElementById(`${tab}-result`);
  const error = document.getElementById(`${tab}-error`);
  const anyVisible =
    (result && !result.classList.contains('hidden')) ||
    (error && !error.classList.contains('hidden'));
  placeholder.classList.toggle('hidden', anyVisible);
  if (!anyVisible) {
    const rawEl = document.getElementById(RAW_PANEL_IDS[tab]);
    if (rawEl) rawEl.textContent = RAW_WAITING_TEXT;
  }
}

function showError(id, message, details) {
  const el = document.getElementById(id);
  let html = `<div class="error-title">Error</div><div class="error-details">${escapeHtml(message)}</div>`;
  if (details && typeof details === 'object') {
    html += `<details class="error-raw"><summary>View full error body</summary><pre>${escapeHtml(JSON.stringify(details, null, 2))}</pre></details>`;
    // Also mirror into the always-visible raw column
    const rawEl = document.getElementById(id.replace('-error', '-raw-response'));
    if (rawEl) rawEl.textContent = JSON.stringify(details, null, 2);
  }
  el.innerHTML = html;
  el.classList.remove('hidden');
  updateSidePanel(id);
}

function hideError(id) {
  document.getElementById(id).classList.add('hidden');
  updateSidePanel(id);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Copy to Clipboard
function copyToClipboard(elementId) {
  const el = document.getElementById(elementId);
  const text = el.textContent;
  
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(`[data-copy="${elementId}"]`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 2000);
    }
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

function copyPayResult() {
  const requestId = document.getElementById('res-request-id').textContent;
  const operationId = document.getElementById('res-operation-id').textContent;
  const status = document.getElementById('res-status').textContent;
  const redirectUrl = document.getElementById('pay-redirect-link').href;
  
  const text = `Request ID: ${requestId}\nOperation ID: ${operationId}\nStatus: ${status}\nRedirect URL: ${redirectUrl}`;
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('All payment details copied!', 'success');
  });
}

function copyPayoutResult() {
  const externalId = document.getElementById('res-ext-id').textContent;
  const operationId = document.getElementById('res-po-operation-id').textContent;
  const status = document.getElementById('res-po-status').textContent;
  
  const text = `External ID: ${externalId}\nOperation ID: ${operationId}\nStatus: ${status}`;
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('All payout details copied!', 'success');
  });
}

// Callbacks
async function loadCallbackUrl() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    const data = await res.json();
    document.getElementById('callback-url-display').textContent = `${window.location.origin}/api/callback`;
  } catch (err) {
    console.error('Failed to load config:', err);
  }
}

async function loadCallbacks() {
  try {
    const res = await fetch(`${API_BASE}/callbacks`);
    const data = await res.json();
    renderCallbacks(data.logs || []);
  } catch (err) {
    console.error('Failed to load callbacks:', err);
  }
}

function renderCallbacks(logs) {
  const container = document.getElementById('callbacks-list');
  
  if (!logs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No callbacks received yet.</p>
        <p class="form-hint">Callback URL: <code>${window.location.origin}/api/callback</code></p>
      </div>
    `;
    return;
  }
  
  // Sort newest first
  const sorted = [...logs].reverse();
  
  container.innerHTML = sorted.map(log => `
    <div class="callback-item">
      <div class="callback-header">
        <div class="callback-status">
          <span class="status-badge ${(log.payload?.operation?.status || '').toLowerCase()}">
            ${log.payload?.operation?.status || 'UNKNOWN'}
          </span>
        </div>
        <span class="callback-time">${formatTime(log.timestamp)}</span>
      </div>
      <div class="callback-body">
        <div class="callback-field">
          <span class="callback-field-label">Operation ID</span>
          <span class="callback-field-value">${log.payload?.operation_id || '-'}</span>
        </div>
        <div class="callback-field">
          <span class="callback-field-label">External ID</span>
          <span class="callback-field-value">${log.payload?.external_id || '-'}</span>
        </div>
        <div class="callback-field">
          <span class="callback-field-label">Method</span>
          <span class="callback-field-value">${log.payload?.payment_method || '-'}</span>
        </div>
        <div class="callback-field">
          <span class="callback-field-label">Amount</span>
          <span class="callback-field-value">${log.payload?.amount} ${log.payload?.currency}</span>
        </div>
        <div class="callback-field">
          <span class="callback-field-label">Customer</span>
          <span class="callback-field-value">${log.payload?.customer?.name || '-'}</span>
        </div>
        <div class="callback-field">
          <span class="callback-field-label">Signature</span>
          <span class="callback-field-value">${log.signatureValid ? '✅ Valid' : '❌ Invalid'}</span>
        </div>
      </div>
      <details class="callback-raw">
        <summary>Raw Payload</summary>
        <pre>${JSON.stringify(log.payload, null, 2)}</pre>
      </details>
    </div>
  `).join('');
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
}

async function clearCallbacks() {
  try {
    await fetch(`${API_BASE}/callbacks`, { method: 'DELETE' });
    loadCallbacks();
    showToast('Callback logs cleared', 'success');
  } catch (err) {
    showToast('Failed to clear logs', 'error');
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="toast-close">&times;</button>
  `;
  
  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  
  setTimeout(() => toast.remove(), 5000);
}