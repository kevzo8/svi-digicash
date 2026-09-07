const crypto = require('crypto');

/**
 * DigiCash Signature Utility
 *
 * Verified against the official Postman collection pre-request scripts
 * (IOT ACH Payment API Documentation 1.0):
 *
 * 1. Concatenate all payload VALUES (not keys) in the order the keys
 *    appear in the JSON body, SKIPPING the "signature" key wherever it is.
 *    - PAY:    service_id, passwork, amount, currency, operation_id,
 *              payment_id, by_method, callback_url, return_url
 *    - PAYOUT: service_id, passwork, amount, currency, operation_id,
 *              payment_id, by_method, callback_url, return_url, customer{...}
 *    - STATUS: passwork, service_id, request_id
 * 2. Use hyphen (-) in place of any null/empty ("") values,
 *    including inside nested objects.
 * 3. For nested objects, concatenate each value in key order.
 * 4. HMAC-SHA256 over the resulting string with the merchant secret_key,
 *    hex-encoded lowercase (equivalent to CryptoJS.HmacSHA256(s, k).toString()).
 * 5. Put the generated signature in the request payload "signature".
 */

/**
 * Flattens an object and returns values in order, replacing empty values with '-'
 * @param {Object} params - The parameters object
 * @returns {string} - Concatenated parameter values
 */
function flattenParams(params) {
  const values = [];
  
  function processValue(value) {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      // For nested objects, process each property value in key order
      const objValues = [];
      for (const key of Object.keys(value)) {
        objValues.push(processValue(value[key]));
      }
      return objValues.join('');
    }
    return String(value);
  }
  
  // Process parameters in the order they appear in the object (not sorted)
  for (const key of Object.keys(params)) {
    if (key !== 'signature') {
      values.push(processValue(params[key]));
    }
  }
  
  return values.join('');
}

/**
 * Generates HMAC-SHA256 signature for DigiCash API requests
 * @param {Object} params - Request parameters (without signature)
 * @param {string} secretKey - Merchant secret key
 * @returns {string} - Hex encoded HMAC-SHA256 signature
 */
function generateSignature(params, secretKey) {
  const concatenated = flattenParams(params);
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(concatenated);
  return hmac.digest('hex');
}

/**
 * Verifies HMAC-SHA256 signature from DigiCash API response/callback
 * @param {Object} params - Full response parameters including signature
 * @param {string} secretKey - Merchant secret key
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(params, secretKey) {
  if (!params.signature) {
    return false;
  }
  
  const { signature, ...paramsWithoutSignature } = params;
  const expectedSignature = generateSignature(paramsWithoutSignature, secretKey);
  
  // Use timing-safe comparison to prevent timing attacks
  // Handle case where signatures have different lengths
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Adds signature to request parameters
 * @param {Object} params - Request parameters
 * @param {string} secretKey - Merchant secret key
 * @returns {Object} - Parameters with signature added
 */
function signRequest(params, secretKey) {
  const signature = generateSignature(params, secretKey);
  return { ...params, signature };
}

/**
 * Validates callback signature from DigiCash
 * @param {Object} callbackPayload - Full callback payload
 * @param {string} secretKey - Merchant secret key
 * @returns {Object} - Validation result { valid: boolean, error?: string }
 */
function validateCallback(callbackPayload, secretKey) {
  if (!callbackPayload) {
    return { valid: false, error: 'Empty callback payload' };
  }
  
  if (!callbackPayload.signature) {
    return { valid: false, error: 'Missing signature in callback' };
  }
  
  const isValid = verifySignature(callbackPayload, secretKey);
  
  if (!isValid) {
    const { signature, ...paramsWithoutSig } = callbackPayload;
    return { 
      valid: false, 
      error: 'Invalid callback signature',
      details: {
        received: signature,
        expected: generateSignature(paramsWithoutSig, secretKey)
      }
    };
  }
  
  return { valid: true };
}

module.exports = {
  generateSignature,
  verifySignature,
  signRequest,
  validateCallback,
  flattenParams
};