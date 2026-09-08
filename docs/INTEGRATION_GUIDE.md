# SVI DigiCash - API Integration Guide

## Overview

This document provides a comprehensive guide for integrating with the DigiCash/IOT ACH Payment API using the SVI DigiCash application.

## Environment

- **Base URL (Production)**: `https://api.fastpayph.com`
- **UAT URL**: `https://uat-api.fastpayph.com` (for testing only)

## Authentication

### Merchant Credentials

| Credential | Description | Example |
|------------|-------------|---------|
| `service_id` | Unique merchant identifier | `service.svi` |
| `passwork` | Merchant password (keep confidential, server-side only) | `••••••••••••` |
| `secret_key` | HMAC-SHA256 signing key (server-side only, never committed) | `••••••••••••••••••••••••••••••` |

### Signature Generation

All API requests must include a valid HMAC-SHA256 signature.

**Algorithm:**
1. Collect all request parameter **values** (not keys)
2. Sort parameters by key name alphabetically
3. Concatenate values in order
4. Replace empty/null values with hyphen (`-`)
5. For nested objects, recursively concatenate all values
6. Generate HMAC-SHA256 using `secret_key`
7. Add signature to request as `signature` field

**Example:**
```javascript
const params = {
  service_id: 'service.svi',
  passwork: '••••••••••••',
  amount: '10000',
  currency: 'PHP',
  operation_id: 'SVI1234567890',
  payment_id: 'SVI1234567890',
  by_method: 'gcash',
  callback_url: 'https://merchant.com/callback',
  return_url: 'https://merchant.com/return'
};

// Concatenated: "service.svi[passwork]10000PHPSVI1234567890SVI1234567890gcashhttps://merchant.com/callbackhttps://merchant.com/return"
// Signature: HMAC-SHA256(concatenated, secret_key)
```

## API Endpoints

### 1. Pay API - `POST /pay`

Initiate a payment transaction.

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `service_id` | string | Yes | Merchant service ID |
| `passwork` | string | Yes | Merchant password |
| `amount` | string | Yes | Amount in **minor units** (e.g., 100.00 = "10000") |
| `currency` | string | Yes | Currency code (e.g., "PHP") |
| `operation_id` | string | Yes | Unique merchant transaction ID |
| `payment_id` | string | Yes | Another unique merchant transaction ID |
| `by_method` | string | Yes | Payment method (see below) |
| `callback_url` | string | Yes | Webhook URL for status updates |
| `return_url` | string | Yes | User redirect URL after payment |
| `signature` | string | Yes | HMAC-SHA256 signature |

**Supported Payment Methods:**

| Method | Description |
|--------|-------------|
| `gcash` | GCash e-wallet |
| `palawanpay` | PalawanPay |
| `qrph` | QR Ph (standard) |
| `qrph-vip` | QR Ph VIP |

**Response:**

```json
{
  "request_id": "01JX4PFRAY0NEM43EJ9NVQVFZ2",
  "operation_id": "IOTTEST1749283233638",
  "redirect_url": "https://checkout-sandbox.palawanpay.com/...",
  "operation": {
    "status": "initiated",
    "error_code": 0,
    "error_message": "",
    "provider_error_message": ""
  },
  "request": {
    "status": "success",
    "error_code": 0,
    "error_message": ""
  },
  "timestamp": "2025-06-07 15:00:34",
  "signature": "4f3301f875ba23fbd97daf6c221221bb6d7c08fb91e75e4f8867369906e876ff"
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `request_id` | DigiCash unique request identifier |
| `operation_id` | Merchant's operation ID |
| `redirect_url` | URL to redirect customer for payment |
| `operation.status` | Transaction status |
| `request.status` | API request status (success/fail) |
| `signature` | Response signature for verification |

---

### 2. Payout API - `POST /payout`

Initiate a disbursement/payout transaction via Instapay.

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `service_id` | string | Yes | Merchant service ID |
| `passwork` | string | Yes | Merchant password |
| `amount` | string | Yes | Amount in minor units |
| `currency` | string | Yes | Currency code (PHP) |
| `operation_id` | string | Yes | Unique merchant transaction ID |
| `payment_id` | string | Yes | Another unique merchant transaction ID |
| `by_method` | string | Yes | Always "instapay" |
| `callback_url` | string | Yes | Webhook URL for status updates |
| `return_url` | string | Yes | Return URL (may not be used) |
| `customer` | object | Yes | Customer details (see below) |
| `signature` | string | Yes | HMAC-SHA256 signature |

**Customer Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `account_bank_id` | string | Yes | Bank/wallet ID (see mappings) |
| `account_number` | string | Yes | Account number |
| `account_name` | string | Yes | Account holder name |
| `email` | string | Yes | Customer email |
| `phone_number` | string | Yes | Phone (09xxxxxxxxx or +63xxxxxxxxxx) |
| `address` | string | No | Customer address |
| `remark` | string | No | Additional remarks |

**Supported Banks/Wallets (Partial List):**

| Bank ID | Name |
|---------|------|
| `PAPH` | Maya / PayMaya Philippines |
| `GXCH` | GCash (G-Xchange) |
| `BNOR` | BDO Unibank |
| `BOPI` | BPI / VYBE |
| `MBTC` | Metropolitan Bank (Metrobank) |
| `PNBM` | Philippine National Bank |
| `RCBC` | RCBC / DiskarTech |
| `UBPH` | Union Bank |
| `SETC` | Security Bank |
| `CHBK` | China Banking Corporation |
| `TLBP` | LANDBANK / OFBank |
| `DBPH` | Development Bank of PH |
| `HSBC` | HSBC |
| `INGB` | ING Bank |
| `GOTY` | GoTyme Bank |
| `TDBI` | Tonik Bank |
| `UNOD` | UnionDigital Bank |
| `MYDB` | Maya Bank |
| `CIPH` | CIMB Bank |
| `SHPH` | ShopeePay |
| `GHPE` | GrabPay |
| `DCPH` | DCPay / Coins.ph |
| `PPSF` | PalawanPay |
| `PAEY` | PayMongo |
| `PDAX` | PDAX |
| ... and 60+ more |

*Full list available in `src/config/index.js`*

**Response:**

```json
{
  "external_id": "DIGICASH_EXT_123456",
  "operation_id": "PO1234567890",
  "redirect_url": "",
  "operation": {
    "status": "initiated",
    "error_code": 0,
    "error_message": "",
    "provider_error_message": ""
  },
  "request": {
    "status": "success",
    "error_code": 0,
    "error_message": ""
  },
  "timestamp": "2025-06-07 15:00:34",
  "signature": "..."
}
```

---

### 3. Status API - `POST /status`

Check transaction status.

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `passwork` | string | Yes | Merchant password |
| `service_id` | string | Yes | Merchant service ID |
| `request_id` | string | Yes | Request ID from Pay/Payout response |
| `signature` | string | Yes | HMAC-SHA256 signature |

**Response:**

```json
{
  "request_id": "01JX4PFRAY0NEM43EJ9NVQVFZ2",
  "operation_id": "IOTTEST1749283233638",
  "redirect_url": "https://checkout-sandbox.palawanpay.com/...",
  "operation": {
    "status": "paid",
    "error_code": 0,
    "error_message": "",
    "provider_error_message": ""
  },
  "request": {
    "status": "success",
    "error_code": 0,
    "error_message": ""
  },
  "timestamp": "2025-06-07 15:00:34",
  "signature": "..."
}
```

---

### 4. Callback Notifications

DigiCash sends POST requests to your `callback_url` for transaction status updates.

**Callback Payload:**

```json
{
  "external_id": "7105563620335199",
  "provider_id": "STARPAY_PAY",
  "provider_name": "STARPAY",
  "operation_id": "IOTTEST1749280392147",
  "payment_method": "gcash",
  "amount": "15000",
  "currency": "PHP",
  "fee_amount": "0",
  "operation": {
    "status": "PAID",
    "error_code": null,
    "error_message": null
  },
  "customer": {
    "account_number": "1234567890",
    "name": "Juan Dela Cruz",
    "email": "juan.dela_cruz@gmail.com",
    "address": "Manila, PH",
    "phone_number": "09160000000",
    "remark": "this is a testing"
  },
  "signature": "hmac_sha256_signature"
}
```

**Callback Status Values:**

| Status | Description |
|--------|-------------|
| `PROCESSING` | Transaction being processed |
| `PAID` | Payment successful |
| `FAIL` | Payment failed |
| `EXPIRED` | Payment expired |

**Requirements:**
- Endpoint must be publicly accessible (HTTPS)
- Must respond with 200 OK within 10 seconds
- Must validate signature before processing
- Handle duplicate notifications (idempotency)

---

## Transaction Statuses

### Pay/Payout Operation Statuses

| Status | Description |
|--------|-------------|
| `awaiting_redirect` | Waiting for customer to be redirected |
| `initiated` | Transaction initiated |
| `processing` | Payment processing |
| `paid` | Payment successful |
| `fail` | Payment failed |
| `expired` | Payment expired |

### Callback Statuses

| Status | Description |
|--------|-------------|
| `PROCESSING` | Transaction being processed |
| `PAID` | Payment successful |
| `FAIL` | Payment failed |
| `EXPIRED` | Payment expired |

---

## Error Handling

### Common Error Codes

| Error Code | Description | Action |
|------------|-------------|--------|
| `0` | Success | - |
| `1001` | Invalid signature | Check signature generation |
| `1002` | Invalid credentials | Verify service_id/passwork |
| `1003` | Invalid amount | Check amount format (minor units) |
| `1004` | Invalid payment method | Use supported methods only |
| `1005` | Duplicate operation_id | Use unique IDs |
| `2001` | Insufficient funds | Customer wallet balance low |
| `2002` | Account not found | Verify bank/account details |
| `2003` | Bank maintenance | Retry later |
| `3001` | Request not found | Invalid request_id |
| `3002` | Transaction expired | Create new transaction |

---

## Integration Checklist

### Pre-Integration
- [ ] Obtain merchant credentials (service_id, passwork, secret_key)
- [ ] Set up callback URL (publicly accessible HTTPS endpoint)
- [ ] Configure return URL for payment completion
- [ ] Review supported payment methods and bank mappings

### Development
- [ ] Implement HMAC-SHA256 signature generation
- [ ] Implement signature verification for responses/callbacks
- [ ] Build Pay API integration with all payment methods
- [ ] Build Payout API integration with bank selection
- [ ] Build Status API for transaction polling
- [ ] Build Callback handler with signature validation
- [ ] Implement idempotency for callback processing
- [ ] Add proper error handling and logging

### Testing (UAT)
- [ ] Test GCash payment flow
- [ ] Test PalawanPay payment flow
- [ ] Test QRPh payment flow
- [ ] Test QRPh VIP payment flow
- [ ] Test Payout to Maya/GCash
- [ ] Test Payout to major banks (BDO, BPI, Metrobank, etc.)
- [ ] Test Status API polling
- [ ] Test Callback handling (PAID, FAIL, EXPIRED, PROCESSING)
- [ ] Test signature validation on responses
- [ ] Test error scenarios (invalid amount, invalid bank, etc.)

### Production Readiness
- [ ] Switch to production credentials
- [ ] Update base URL to production
- [ ] Set up monitoring and alerting
- [ ] Implement retry logic for failed requests
- [ ] Add transaction reconciliation
- [ ] Document operational procedures
- [ ] Train support team

---

## SVI DigiCash Application Usage

### Installation

```bash
cd svi-digicash
npm install
```

### Configuration

Create `.env` file with your credentials:

```env
DIGICASH_SERVICE_ID=service.svi
DIGICASH_PASSWORK=your_passwork
DIGICASH_SECRET_KEY=your_secret_key
DIGICASH_BASE_URL=https://uat-api.fastpayph.com
PORT=3000
CALLBACK_URL=https://your-domain.com/api/callback
RETURN_URL=https://your-domain.com/payment/return
```

### Running the Server

```bash
# Development
npm run dev

# Production
npm start
```

### Running Tests

```bash
# All tests
npm test

# Individual tests
npm run test:signature
npm run test:pay
npm run test:payout
npm run test:status
npm run test:callback
```

### Using the Client

```javascript
const DigiCashClient = require('./src/api/digicash-client');

const client = new DigiCashClient();

// Create GCash payment
const payment = await client.payWithGCash({
  amount: 100.00,  // ₱100.00
  currency: 'PHP'
});

console.log('Redirect user to:', payment.redirect_url);

// Create payout to Maya
const payout = await client.createPayout({
  amount: 500.00,
  customer: {
    accountBankId: 'PAPH',  // Maya
    accountNumber: '09271528945',
    accountName: 'Juan Dela Cruz',
    email: 'juan@gmail.com',
    phoneNumber: '09271528945'
  }
});

// Check status
const status = await client.checkStatus(payment.request_id);
```

### Callback Handler

The server includes a callback endpoint at `POST /api/callback` that:
- Validates HMAC-SHA256 signature
- Logs all callbacks
- Processes status updates (PAID, FAIL, EXPIRED, PROCESSING)
- Returns 200 OK acknowledgment

View callback logs at: `GET /api/callbacks`

---

## Security Best Practices

1. **Never expose secret_key** in client-side code or logs
2. **Use HTTPS** for all API communications
3. **Validate signatures** on all responses and callbacks
4. **Implement idempotency** for callback processing
5. **Log all transactions** for audit trail
6. **Rotate credentials** periodically
7. **Monitor for suspicious activity**
8. **Implement rate limiting** on callback endpoints

---

## Troubleshooting

### Signature Validation Fails

1. Ensure parameter order is alphabetical by key
2. Verify empty values are replaced with `-`
3. Check nested object values are included
4. Confirm secret_key is correct
5. Verify no extra whitespace in concatenated string

### Payment Not Redirecting

1. Check `redirect_url` is present in response
2. Verify `operation.status` is `initiated` or `awaiting_redirect`
3. Ensure customer follows redirect in browser

### Callback Not Received

1. Verify callback_url is publicly accessible
2. Check firewall allows inbound HTTPS
3. Ensure endpoint responds 200 OK within 10s
4. Check DigiCash dashboard for callback logs

### Payout Fails

1. Verify bank ID is correct and supported
2. Check account number format for the bank
3. Ensure name matches bank records
4. Verify phone number format (09xxxxxxxxx or +63xxxxxxxxxx)

---

## Support

For technical issues:
- Check API documentation: https://documenter.getpostman.com/view/40991288/2sB3dLTB3U
- Contact DigiCash support for credential issues
- Review callback logs in SVI DigiCash dashboard

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-09-04 | Initial release with full API integration |

---

*Generated by SVI DigiCash POC - CPS-471*