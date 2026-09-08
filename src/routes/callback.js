const express = require('express');
const config = require('../config');
const { validateCallback } = require('../utils/signature');

const router = express.Router();

// In-memory storage for callback logs (replace with database in production)
// Capped to avoid unbounded memory growth.
const callbackLogs = [];
const MAX_CALLBACK_LOGS = 200;

/**
 * DigiCash Callback Endpoint
 * Receives transaction status notifications from DigiCash
 * 
 * Expected callback payload:
 * {
 *   "request_id": "string",
 *   "external_id": "string",
 *   "provider_id": "string",
 *   "provider_name": "string",
 *   "operation_id": "string",
 *   "payment_method": "string",
 *   "amount": "string",
 *   "currency": "string",
 *   "fee_amount": "string",
 *   "operation": {
 *     "status": "PROCESSING|PAID|FAIL|EXPIRED",
 *     "error_code": "string|null",
 *     "error_message": "string|null"
 *   },
 *   "customer": {
 *     "account_number": "string",
 *     "name": "string",
 *     "email": "string",
 *     "address": "string",
 *     "phone_number": "string",
 *     "remark": "string"
 *   },
 *   "signature": "string"
 * }
 */
router.post('/callback', (req, res) => {
  const timestamp = new Date().toISOString();
  const payload = req.body;
  
  console.log('\n🔔 ========== CALLBACK RECEIVED ==========');
  console.log('⏰ Timestamp:', timestamp);
  console.log('📦 Payload:', JSON.stringify(payload, null, 2));
  
  // Validate signature
  const secretKey = config.digicash.secretKey;
  const validation = validateCallback(payload, secretKey);
  
  const logEntry = {
    id: Date.now().toString(),
    timestamp,
    payload,
    signatureValid: validation.valid,
    validationError: validation.error
  };
  
  callbackLogs.push(logEntry);
  if (callbackLogs.length > MAX_CALLBACK_LOGS) {
    callbackLogs.splice(0, callbackLogs.length - MAX_CALLBACK_LOGS);
  }
  
  if (!validation.valid) {
    console.error('❌ Signature validation FAILED:', validation.error);
    if (validation.details) {
      console.error('   Received:', validation.details.received);
      console.error('   Expected:', validation.details.expected);
    }
    
    // Still return 200 to acknowledge receipt (per webhook best practices)
    // but log the failure
    return res.status(200).json({ 
      received: true, 
      signatureValid: false,
      error: validation.error 
    });
  }
  
  console.log('✅ Signature validation PASSED');
  console.log('📊 Transaction Status:', payload.operation?.status);
  console.log('💰 Amount:', payload.amount, payload.currency);
  console.log('🆔 Operation ID:', payload.operation_id);
  console.log('🔄 Request ID:', payload.request_id);
  console.log('==========================================\n');
  
  // Process the callback based on status
  const status = payload.operation?.status;
  switch (status) {
    case 'PAID':
      console.log('✅ Payment successful! Process order fulfillment.');
      // TODO: Update order status in database, send confirmation, etc.
      break;
    case 'FAIL':
      console.log('❌ Payment failed:', payload.operation?.error_message);
      // TODO: Handle failed payment, notify customer, etc.
      break;
    case 'EXPIRED':
      console.log('⏰ Payment expired');
      // TODO: Handle expired payment
      break;
    case 'PROCESSING':
      console.log('⏳ Payment processing...');
      // TODO: Update status to processing
      break;
    default:
      console.log('❓ Unknown status:', status);
  }
  
  // Always return 200 OK to acknowledge receipt
  res.status(200).json({ 
    received: true, 
    signatureValid: true,
    status: 'processed'
  });
});

/**
 * Get callback logs (for debugging/testing)
 */
router.get('/callbacks', (req, res) => {
  res.json({
    total: callbackLogs.length,
    logs: callbackLogs.slice(-50) // Return last 50 entries
  });
});

/**
 * Clear callback logs
 */
router.delete('/callbacks', (req, res) => {
  callbackLogs.length = 0;
  res.json({ message: 'Callback logs cleared' });
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'SVI DigiCash',
    timestamp: new Date().toISOString() 
  });
});

/**
 * Get configuration info (without secrets)
 * Includes credential LENGTHS only (no values) to help diagnose
 * signature issues like trailing whitespace or CRLF contamination.
 */
router.get('/config', (req, res) => {
  const secretKey = config.digicash.secretKey || '';
  res.json({
    serviceId: config.digicash.serviceId,
    baseUrl: config.digicash.baseUrl,
    callbackUrl: config.callback.url,
    returnUrl: config.callback.returnUrl,
    supportedPaymentMethods: config.paymentMethods.pay,
    supportedPayoutMethods: config.paymentMethods.payout,
    supportedBanksCount: Object.keys(config.bankMappings).length,
    supportedBanks: config.bankMappings,
    upstreamEndpoints: {
      pay: 'POST /pay',
      payout: 'POST /payout',
      status: 'POST /status',
      callback: 'POST {your callback_url}'
    },
    transactionStatuses: config.transactionStatuses,
    docsUrl: 'https://documenter.getpostman.com/view/40991288/2sB3dLTB3U',
    credentials: {
      serviceIdLength: (config.digicash.serviceId || '').length,
      passworkLength: (config.digicash.passwork || '').length,
      secretKeyLength: secretKey.length,
      // First/last chars only (safe to expose, helps spot whitespace issues)
      secretKeyFirstChar: secretKey.charAt(0) || null,
      secretKeyLastChar: secretKey.charAt(secretKey.length - 1) || null,
      secretKeyHasCRLF: secretKey.includes('\r') || secretKey.includes('\n'),
      serviceIdHasWhitespace: /\s/.test(config.digicash.serviceId || ''),
      passworkHasWhitespace: /\s/.test(config.digicash.passwork || '')
    }
  });
});

module.exports = router;