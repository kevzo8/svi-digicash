# SVI DigiCash

DigiCash/IOT ACH Payment API Integration for SVI (CPS-471)

## Overview

This application provides a complete integration with the DigiCash Payment API, including:

- **Pay API**: GCash, PalawanPay, QRPh, QRPh VIP payments
- **Payout API**: Instapay disbursements to 70+ banks/wallets
- **Status API**: Transaction status polling
- **Callback Handling**: Real-time transaction status notifications
- **HMAC-SHA256**: Secure signature generation and verification

## Quick Start

### Prerequisites

- Node.js 18+
- DigiCash UAT credentials (provided)

### Installation

```bash
cd svi-digicash
npm install
```

### Configuration

Copy `.env.example` to `.env` and update with your credentials:

```env
DIGICASH_SERVICE_ID=service.svi
DIGICASH_PASSWORK=your_passwork
DIGICASH_SECRET_KEY=your_secret_key
DIGICASH_BASE_URL=https://uat-api.fastpayph.com
PORT=3000
CALLBACK_URL=https://your-ngrok-url.ngrok-free.app/api/callback
RETURN_URL=https://your-domain.com/payment/return
```

### Run Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server starts at `http://localhost:3000`

- Health check: `GET /api/health`
- Callback endpoint: `POST /api/callback`
- View callbacks: `GET /api/callbacks`
- Config info: `GET /api/config`

### Run Tests

```bash
# All tests
npm test

# Individual test suites
npm run test:signature   # HMAC-SHA256 signature tests
npm run test:pay         # Pay API tests
npm run test:payout      # Payout API tests
npm run test:status      # Status API tests
npm run test:callback    # Callback handling tests
```

## Project Structure

```
svi-digicash/
├── src/
│   ├── index.js              # Express server entry point
│   ├── config/
│   │   └── index.js          # Configuration & bank mappings
│   ├── api/
│   │   └── digicash-client.js # Main API client
│   ├── utils/
│   │   └── signature.js      # HMAC-SHA256 signature utilities
│   └── routes/
│       └── callback.js       # Callback webhook handler
├── tests/
│   ├── run-tests.js          # Test runner
│   ├── test-signature.js     # Signature utility tests
│   ├── test-pay.js           # Pay API tests
│   ├── test-payout.js        # Payout API tests
│   ├── test-status.js        # Status API tests
│   └── test-callback.js      # Callback tests
├── docs/
│   └── INTEGRATION_GUIDE.md  # Complete integration guide
├── .env                      # Environment configuration
├── package.json
└── DigiCash.png              # Logo
```

## API Client Usage

```javascript
const DigiCashClient = require('./src/api/digicash-client');

const client = new DigiCashClient({
  serviceId: 'service.svi',
  passwork: 'your_passwork',
  secretKey: 'your-secret-key',
  callbackUrl: 'https://your-domain.com/api/callback',
  returnUrl: 'https://your-domain.com/payment/return'
});

// Create payment
const payment = await client.payWithGCash({ amount: 100.00 });
// Redirect user to payment.redirect_url

// Create payout
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

## Supported Payment Methods

| Method | Code | Description |
|--------|------|-------------|
| GCash | `gcash` | GCash e-wallet |
| PalawanPay | `palawanpay` | PalawanPay |
| QR Ph | `qrph` | Standard QR Ph |
| QR Ph VIP | `qrph-vip` | QR Ph VIP |

## Supported Banks/Wallets (70+)

Major banks: BDO, BPI, Metrobank, PNB, Landbank, Security Bank, China Bank, RCBC, UnionBank, etc.

E-wallets: GCash, Maya, GrabPay, ShopeePay, Coins.ph, etc.

Full list in `src/config/index.js`

## Transaction Statuses

**Pay/Payout:** `awaiting_redirect`, `initiated`, `processing`, `paid`, `fail`, `expired`

**Callbacks:** `PROCESSING`, `PAID`, `FAIL`, `EXPIRED`

## Security

- All requests signed with HMAC-SHA256
- Callback signatures verified before processing
- Timing-safe comparison for signature validation
- Secrets stored in environment variables only

## Documentation

See `docs/INTEGRATION_GUIDE.md` for complete integration guide.

## License

Internal use only - SVI DigiCash Integration (CPS-471)