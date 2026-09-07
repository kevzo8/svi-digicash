const express = require('express');
const path = require('path');
const config = require('./config');
const callbackRoutes = require('./routes/callback');
const DigiCashClient = require('./api/digicash-client');

const app = express();

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api', callbackRoutes);

// Proxy routes for frontend (handles CORS and credentials)
// Forward the FULL DigiCash error body so the UI can show
// provider_error_message, error codes, etc.
app.post('/api/proxy/pay', async (req, res) => {
  try {
    const result = await global.digicash.createPayment(req.body);
    res.json(result);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      res.status(status).json({ ...data, httpStatus: status });
    } else {
      res.status(status).json({ error: data || err.message, httpStatus: status });
    }
  }
});

app.post('/api/proxy/payout', async (req, res) => {
  try {
    const result = await global.digicash.createPayout(req.body);
    res.json(result);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      res.status(status).json({ ...data, httpStatus: status });
    } else {
      res.status(status).json({ error: data || err.message, httpStatus: status });
    }
  }
});

app.post('/api/proxy/status', async (req, res) => {
  try {
    const result = await global.digicash.checkStatus(req.body.requestId);
    res.json(result);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      res.status(status).json({ ...data, httpStatus: status });
    } else {
      res.status(status).json({ error: data || err.message, httpStatus: status });
    }
  }
});

// API documentation endpoint
app.get('/', (req, res) => {
  // Serve the frontend HTML for root path
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api', (req, res) => {
  res.json({
    name: 'SVI DigiCash',
    version: '1.0.0',
    description: 'DigiCash/IOT ACH Payment API Integration',
    endpoints: {
      'POST /api/callback': 'DigiCash transaction status callback',
      'GET /api/callbacks': 'View callback logs (for testing)',
      'DELETE /api/callbacks': 'Clear callback logs',
      'GET /api/health': 'Health check',
      'GET /api/config': 'Configuration info',
      'POST /api/proxy/pay': 'Create payment (frontend proxy)',
      'POST /api/proxy/payout': 'Create payout (frontend proxy)',
      'POST /api/proxy/status': 'Check transaction status (frontend proxy)'
    },
    frontend: 'http://localhost:3000',
    documentation: 'See docs/INTEGRATION_GUIDE.md'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: config.server.env === 'development' ? err.message : undefined
  });
});

// Serve specific static files (logo, etc.)
app.get('/DigiCash.png', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/DigiCash.png'));
});
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/DigiCash.png'));
});

// 404 handler - serve index.html for SPA routing
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// Initialize DigiCash client
const digicash = new DigiCashClient();

// Make client available globally for testing
global.digicash = digicash;

const PORT = config.server.port;

const server = app.listen(PORT, () => {
  console.log('\n🚀 =========================================');
  console.log('   SVI DigiCash Server Started');
  console.log('=========================================');
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`🎨 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 Callback: http://localhost:${PORT}/api/callback`);
  console.log(`📋 Logs: http://localhost:${PORT}/api/callbacks`);
  console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
  console.log('===========================================\n');
  console.log('📝 Configuration:');
  console.log(`   Service ID: ${config.digicash.serviceId}`);
  console.log(`   Base URL: ${config.digicash.baseUrl}`);
  console.log(`   Callback URL: ${config.callback.url}`);
  console.log(`   Return URL: ${config.callback.returnUrl}`);
  console.log('\n💡 Run tests with: npm test');
  console.log('💡 Test specific: npm run test:pay | test:payout | test:status\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

module.exports = { app, digicash };