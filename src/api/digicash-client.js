const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { signRequest, verifySignature } = require('../utils/signature');

class DigiCashClient {
  constructor(options = {}) {
    this.serviceId = options.serviceId || config.digicash.serviceId;
    this.passwork = options.passwork || config.digicash.passwork;
    this.secretKey = options.secretKey || config.digicash.secretKey;
    this.baseUrl = options.baseUrl || config.digicash.baseUrl;
    this.callbackUrl = options.callbackUrl || config.callback.url;
    this.returnUrl = options.returnUrl || config.callback.returnUrl;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    // Add response interceptor for signature verification
    this.client.interceptors.response.use(
      (response) => {
        if (response.data && response.data.signature) {
          const isValid = verifySignature(response.data, this.secretKey);
          response.data.signatureValid = isValid;
          if (!isValid) {
            console.warn('⚠️  Response signature verification failed!');
            console.warn('Response:', JSON.stringify(response.data, null, 2));
          }
        }
        return response;
      },
      (error) => {
        if (error.response?.data) {
          console.error('API Error:', error.response.status, error.response.data);
        } else {
          console.error('Network Error:', error.message);
        }
        throw error;
      }
    );
  }

  /**
   * Generate unique operation/payment ID
   * @param {string} prefix - Prefix for the ID
   * @returns {string} - Unique ID
   */
  generateId(prefix = 'SVI') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Convert amount to minor units (cents/sentimos)
   * @param {number} amount - Amount in major units (e.g., 100.00)
   * @returns {string} - Amount in minor units (e.g., "10000")
   */
  toMinorUnits(amount) {
    return Math.round(amount * 100).toString();
  }

  /**
   * Convert amount from minor units to major units
   * @param {string|number} minorUnits - Amount in minor units
   * @returns {number} - Amount in major units
   */
  fromMinorUnits(minorUnits) {
    return parseInt(minorUnits, 10) / 100;
  }

  // ==================== PAY API ====================

  /**
   * Initiate a payment transaction
   * @param {Object} options - Payment options
   * @param {string} options.method - Payment method: 'gcash', 'palawanpay', 'qrph', 'qrph-vip'
   * @param {number|string} options.amount - Amount in major units (e.g., 100.00)
   * @param {string} [options.currency='PHP'] - Currency code
   * @param {string} [options.operationId] - Unique operation ID (auto-generated if not provided)
   * @param {string} [options.paymentId] - Unique payment ID (auto-generated if not provided)
   * @param {string} [options.callbackUrl] - Callback URL (uses default if not provided)
   * @param {string} [options.returnUrl] - Return URL (uses default if not provided)
   * @returns {Promise<Object>} - Payment response
   */
  async createPayment(options) {
    const {
      method,
      amount,
      currency = 'PHP',
      operationId = this.generateId('PAY'),
      paymentId = this.generateId('PAY'),
      callbackUrl = this.callbackUrl,
      returnUrl = this.returnUrl
    } = options;

    // Validate payment method
    if (!config.paymentMethods.pay.includes(method)) {
      throw new Error(`Invalid payment method: ${method}. Supported: ${config.paymentMethods.pay.join(', ')}`);
    }

    // Build request payload
    const payload = {
      service_id: this.serviceId,
      passwork: this.passwork,
      amount: this.toMinorUnits(amount),
      currency,
      operation_id: operationId,
      payment_id: paymentId,
      by_method: method,
      callback_url: callbackUrl,
      return_url: returnUrl
    };

    // Sign the request
    const signedPayload = signRequest(payload, this.secretKey);

    console.log('📤 Sending Pay Request:', {
      method,
      amount: this.toMinorUnits(amount),
      operationId,
      paymentId
    });

    const response = await this.client.post(config.digicash.endpoints.pay, signedPayload);
    
    console.log('📥 Pay Response:', {
      requestId: response.data.request_id,
      operationId: response.data.operation_id,
      status: response.data.operation?.status,
      requestStatus: response.data.request?.status,
      signatureValid: response.data.signatureValid
    });

    return response.data;
  }

  // Convenience methods for each payment method
  async payWithGCash(options) {
    return this.createPayment({ ...options, method: 'gcash' });
  }

  async payWithPalawanPay(options) {
    return this.createPayment({ ...options, method: 'palawanpay' });
  }

  async payWithQRPh(options) {
    return this.createPayment({ ...options, method: 'qrph' });
  }

  async payWithQRPhVIP(options) {
    return this.createPayment({ ...options, method: 'qrph-vip' });
  }

  // ==================== PAYOUT API ====================

  /**
   * Initiate a payout/disbursement transaction
   * @param {Object} options - Payout options
   * @param {Object} options.customer - Customer information
   * @param {string} options.customer.accountBankId - Bank/wallet ID (e.g., 'PAPH' for Maya)
   * @param {string} options.customer.accountNumber - Account number
   * @param {string} options.customer.accountName - Account holder name
   * @param {string} options.customer.email - Customer email
   * @param {string} options.customer.phoneNumber - Customer phone (format: 09xxxxxxxxx or +63xxxxxxxxxx)
   * @param {string} [options.customer.address] - Customer address (optional)
   * @param {string} [options.customer.remark] - Additional remarks (optional)
   * @param {number|string} options.amount - Amount in major units
   * @param {string} [options.currency='PHP'] - Currency code
   * @param {string} [options.operationId] - Unique operation ID (auto-generated)
   * @param {string} [options.paymentId] - Unique payment ID (auto-generated)
   * @param {string} [options.callbackUrl] - Callback URL
   * @param {string} [options.returnUrl] - Return URL
   * @returns {Promise<Object>} - Payout response
   */
  async createPayout(options) {
    const {
      customer,
      amount,
      currency = 'PHP',
      operationId = this.generateId('PO'),
      paymentId = this.generateId('PO'),
      callbackUrl = this.callbackUrl,
      returnUrl = this.returnUrl
    } = options;

    // Validate required customer fields
    const requiredFields = ['accountBankId', 'accountNumber', 'accountName', 'email', 'phoneNumber'];
    for (const field of requiredFields) {
      if (!customer[field]) {
        throw new Error(`Missing required customer field: ${field}`);
      }
    }

    // Validate bank ID
    if (!config.bankMappings[customer.accountBankId]) {
      console.warn(`⚠️  Unknown bank ID: ${customer.accountBankId}. Please verify this is correct.`);
    }

    // Build request payload
    // NOTE: field order must match the official Postman collection exactly,
    // as the HMAC signature concatenates values in key order.
    const payload = {
      service_id: this.serviceId,
      passwork: this.passwork,
      amount: this.toMinorUnits(amount),
      currency,
      operation_id: operationId,
      payment_id: paymentId,
      by_method: 'instapay',
      callback_url: callbackUrl,
      return_url: returnUrl,
      customer: {
        account_bank_id: customer.accountBankId,
        account_number: customer.accountNumber,
        account_name: customer.accountName,
        email: customer.email,
        phone_number: customer.phoneNumber
      }
    };

    // Only include optional customer fields when actually provided.
    // The official Postman sample omits them, so sending '-' placeholders
    // would change the signed string and break the signature.
    if (customer.address && customer.address !== '-') {
      payload.customer.address = customer.address;
    }
    if (customer.remark && customer.remark !== '-') {
      payload.customer.remark = customer.remark;
    }

    // Sign the request
    const signedPayload = signRequest(payload, this.secretKey);

    console.log('📤 Sending Payout Request:', {
      amount: this.toMinorUnits(amount),
      operationId,
      bankId: customer.accountBankId,
      accountNumber: customer.accountNumber
    });

    const response = await this.client.post(config.digicash.endpoints.payout, signedPayload);
    
    console.log('📥 Payout Response:', {
      externalId: response.data.external_id,
      operationId: response.data.operation_id,
      status: response.data.operation?.status,
      requestStatus: response.data.request?.status,
      signatureValid: response.data.signatureValid
    });

    return response.data;
  }

  // ==================== STATUS API ====================

  /**
   * Check transaction status
   * @param {string} requestId - Request ID from Pay/Payout response
   * @returns {Promise<Object>} - Status response
   */
  async checkStatus(requestId) {
    const payload = {
      passwork: this.passwork,
      service_id: this.serviceId,
      request_id: requestId
    };

    const signedPayload = signRequest(payload, this.secretKey);

    console.log('📤 Checking Status for Request ID:', requestId);

    const response = await this.client.post(config.digicash.endpoints.status, signedPayload);
    
    console.log('📥 Status Response:', {
      requestId: response.data.request_id,
      operationId: response.data.operation_id,
      operationStatus: response.data.operation?.status,
      requestStatus: response.data.request?.status,
      signatureValid: response.data.signatureValid
    });

    return response.data;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get bank/wallet name from bank ID
   * @param {string} bankId - Bank ID
   * @returns {string} - Bank name or 'Unknown'
   */
  getBankName(bankId) {
    return config.bankMappings[bankId] || 'Unknown Bank/Wallet';
  }

  /**
   * Get all supported banks/wallets
   * @returns {Object} - Bank mappings
   */
  getSupportedBanks() {
    return config.bankMappings;
  }

  /**
   * Get supported payment methods
   * @returns {Object} - Payment methods
   */
  getSupportedPaymentMethods() {
    return config.paymentMethods;
  }
}

module.exports = DigiCashClient;