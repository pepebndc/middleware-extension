// decode.js - ABI encoding/decoding helpers

// Decode Configuration constants
const DECODE_UNIVERSAL_ROUTER_ADDRESS = '0x66a9893cc07d91d95644aedd05d03f95e1dba8af';
const DECODE_EXECUTE_FUNCTION_SELECTOR = '0x24856bc3';
const DECODE_FEE_RECIPIENT = '0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed';

// Function signatures
const TRANSFER_COMMAND = '0x0a'; // TRANSFER command byte

// Common token addresses
const COMMON_TOKENS = {
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  USDC: '0xa0b86a33e6c3c73429c7e8adeef8f1c6b21d6c43',
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
};

/**
 * Pad hex string to 32 bytes (64 hex characters)
 * @param {string} hex - Hex string (with or without 0x prefix)
 * @returns {string} - Padded hex string without 0x prefix
 */
function padHexTo32Bytes(hex) {
  const cleanHex = hex.replace('0x', '');
  return cleanHex.padStart(64, '0');
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
 * Check if transaction is targeting Universal Router
 * @param {string} to - Transaction recipient address
 * @returns {boolean}
 */
function isUniversalRouterTransaction(to) {
  return to && to.toLowerCase() === DECODE_UNIVERSAL_ROUTER_ADDRESS.toLowerCase();
}

/**
 * Check if transaction data is calling execute function
 * @param {string} data - Transaction data
 * @returns {boolean}
 */
function isExecuteFunction(data) {
  return data && data.toLowerCase().startsWith(DECODE_EXECUTE_FUNCTION_SELECTOR.toLowerCase());
}

/**
 * Simple ABI decoder for execute function
 * @param {string} data - Transaction data
 * @returns {Object} - Decoded parameters {commands, inputs}
 */
function decodeExecuteFunction(data) {
  try {
    console.log('🔍 Decoding execute function data:', data.slice(0, 100) + '...');
    
    // Remove function signature (first 4 bytes)
    const paramData = data.slice(10);
    console.log('📋 Parameter data length:', paramData.length);
    
    // For simplicity, we'll use a basic parsing approach
    // In a production environment, you'd use a proper ABI decoder like ethers.js
    
    // Extract commands and inputs offsets
    const commandsOffset = parseInt(paramData.slice(0, 64), 16) * 2;
    const inputsOffset = parseInt(paramData.slice(64, 128), 16) * 2;
    
    console.log('📍 Commands offset:', commandsOffset, 'Inputs offset:', inputsOffset);
    
    // Extract commands (bytes)
    const commandsLength = parseInt(paramData.slice(commandsOffset, commandsOffset + 64), 16) * 2;
    const commands = '0x' + paramData.slice(commandsOffset + 64, commandsOffset + 64 + commandsLength);
    
    console.log('📦 Commands length:', commandsLength, 'Commands:', commands);
    
    // Extract inputs array
    const inputsArrayLength = parseInt(paramData.slice(inputsOffset, inputsOffset + 64), 16);
    console.log('📊 Inputs array length:', inputsArrayLength);
    
    const inputs = [];
    
    let currentOffset = inputsOffset + 64;
    for (let i = 0; i < inputsArrayLength; i++) {
      const inputOffset = parseInt(paramData.slice(currentOffset, currentOffset + 64), 16) * 2;
      const inputLength = parseInt(paramData.slice(inputsOffset + inputOffset, inputsOffset + inputOffset + 64), 16) * 2;
      const input = '0x' + paramData.slice(inputsOffset + inputOffset + 64, inputsOffset + inputOffset + 64 + inputLength);
      inputs.push(input);
      console.log(`📥 Input ${i}: length=${inputLength}, data=${input.slice(0, 50)}...`);
      currentOffset += 64;
    }
    
    console.log('✅ Decoded successfully - Commands:', commands, 'Inputs count:', inputs.length);
    return { commands, inputs };
  } catch (error) {
    console.error('Error decoding execute function:', error);
    return null;
  }
}

/**
 * Extract swap information from transaction data
 * @param {string} data - Transaction data
 * @param {string} value - Transaction value
 * @returns {Object|null} - Swap information or null
 */
function extractSwapInfo(data, value) {
  console.log('🔍 Extracting swap information from transaction');
  
  if (!data || data.length < 10) {
    console.log('❌ Invalid transaction data');
    return null;
  }
  
  const functionSignature = data.slice(0, 10);
  console.log('🔍 Function signature:', functionSignature);
  
  if (functionSignature === '0x3593564c') {
    return extractSwapInfoFrom3593564c(data, value);
  } else if (functionSignature === '0x24856bc3') {
    return extractSwapInfoFromExecute(data, value);
  } else {
    console.log('❌ Unsupported function signature for swap extraction');
    return null;
  }
}

/**
 * Extract swap info from 0x3593564c function call
 * @param {string} data - Transaction data
 * @param {string} value - Transaction value  
 * @returns {Object|null} - Swap information
 */
function extractSwapInfoFrom3593564c(data, value) {
  console.log('🔍 Extracting swap info from 0x3593564c function');
  
  try {
    // For now, use a simplified approach
    // Look for common token addresses and large numbers
    
    // Common token addresses
    const commonTokens = {
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
      '0xa0b86a33e6d8dfe69e9aca4b7c5ea3e8f9b1c1a1': 'USDC', 
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH'
    };
    
    // Look for token addresses in the data
    for (const [address, symbol] of Object.entries(commonTokens)) {
      const cleanAddress = address.toLowerCase().replace('0x', '');
      if (data.toLowerCase().includes(cleanAddress)) {
        console.log('💰 Found token:', symbol, address);
        
        // Try to find a reasonable amount near the token address
        const amount = findAmountNearToken(data, cleanAddress);
        if (amount) {
          console.log('💸 Found amount:', amount);
          return {
            token: address,
            amount: amount,
            symbol: symbol
          };
        }
      }
    }
    
    // Fallback: look for ETH value
    if (value && value !== '0x0' && value !== '0') {
      console.log('💰 Using ETH value as amount:', value);
      return {
        token: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
        amount: value,
        symbol: 'ETH'
      };
    }
    
    console.log('❌ Could not extract swap info from 0x3593564c');
    return null;
    
  } catch (error) {
    console.error('❌ Error extracting swap info:', error);
    return null;
  }
}

/**
 * Find amount near token address in transaction data
 * @param {string} data - Transaction data
 * @param {string} tokenAddress - Token address (without 0x)
 * @returns {string|null} - Amount in hex or null
 */
function findAmountNearToken(data, tokenAddress) {
  const tokenIndex = data.toLowerCase().indexOf(tokenAddress.toLowerCase());
  if (tokenIndex === -1) return null;
  
  // Look for large numbers (potential amounts) within 200 characters of the token
  const searchStart = Math.max(0, tokenIndex - 200);
  const searchEnd = Math.min(data.length, tokenIndex + tokenAddress.length + 200);
  const searchArea = data.slice(searchStart, searchEnd);
  
  // Look for 64-character hex numbers (32 bytes)
  const hexPattern = /[0-9a-f]{64}/gi;
  const matches = searchArea.match(hexPattern);
  
  if (matches) {
    for (const match of matches) {
      const value = BigInt('0x' + match);
      // Look for amounts that seem reasonable (> 1000 and < very large number)
      if (value > 1000n && value < BigInt('0x' + 'f'.repeat(20))) {
        return '0x' + value.toString(16);
      }
    }
  }
  
  return null;
}

/**
 * Extract swap info from execute function call  
 * @param {string} data - Transaction data
 * @param {string} value - Transaction value
 * @returns {Object|null} - Swap information
 */
function extractSwapInfoFromExecute(data, value) {
  console.log('🔍 Extracting swap info from execute function');
  
  // This is more complex - for now return a default
  if (value && value !== '0x0' && value !== '0') {
    return {
      token: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
      amount: value,
      symbol: 'ETH'
    };
  }
  
  return null;
}

/**
 * Create TRANSFER command input
 * @param {string} token - Token address
 * @param {BigInt} amount - Amount to transfer
 * @returns {string} - Encoded transfer input
 */
function createTransferInput(token, amount) {
  try {
    // ABI encode: TRANSFER(address token, address recipient, uint160 amount)
    const encodedToken = padHex(token, 32);
    const encodedRecipient = padHex(DECODE_FEE_RECIPIENT, 32);
    const encodedAmount = padHex(bigIntToHex(amount), 32);
    
    return encodedToken + encodedRecipient.slice(2) + encodedAmount.slice(2);
  } catch (error) {
    console.error('Error creating transfer input:', error);
    return '';
  }
}

/**
 * Modify execute function data to include fee
 * @param {string} originalData - Original transaction data
 * @param {string} token - Token address
 * @param {BigInt} feeAmount - Fee amount
 * @returns {string} - Modified transaction data
 */
function injectFeeIntoExecute(originalData, token, feeAmount) {
  try {
    const decoded = decodeExecuteFunction(originalData);
    if (!decoded) {
      return originalData;
    }
    
    // Add TRANSFER command to commands
    const newCommands = decoded.commands + TRANSFER_COMMAND.slice(2);
    
    // Create transfer input
    const transferInput = createTransferInput(token, feeAmount);
    
    // Add transfer input to inputs array
    const newInputs = [...decoded.inputs, '0x' + transferInput];
    
    // Re-encode the function call (simplified approach)
    const newData = reencodeExecuteFunction(newCommands, newInputs);
    
    return newData;
  } catch (error) {
    console.error('Error injecting fee:', error);
    return originalData;
  }
}

/**
 * Re-encode execute function with modified parameters
 * @param {string} commands - Commands bytes
 * @param {Array} inputs - Inputs array
 * @returns {string} - Re-encoded function data
 */
function reencodeExecuteFunction(commands, inputs) {
  try {
    // This is a simplified re-encoding
    // In production, use a proper ABI encoder
    
    let encoded = DECODE_EXECUTE_FUNCTION_SELECTOR;
    
    // Encode commands
    const commandsLength = (commands.length - 2) / 2;
    const commandsLengthHex = padHex(bigIntToHex(BigInt(commandsLength)), 32);
    const commandsData = commands.slice(2).padEnd(Math.ceil(commandsLength / 32) * 64, '0');
    
    // Encode inputs array
    const inputsArrayLength = inputs.length;
    const inputsLengthHex = padHex(bigIntToHex(BigInt(inputsArrayLength)), 32);
    
    // Calculate offsets
    const commandsOffset = 64; // 2 * 32 bytes for the two offset parameters
    const inputsOffset = commandsOffset + 64 + commandsData.length;
    
    // Build the encoded data
    encoded += padHex(bigIntToHex(BigInt(commandsOffset / 2)), 32).slice(2);
    encoded += padHex(bigIntToHex(BigInt(inputsOffset / 2)), 32).slice(2);
    encoded += commandsLengthHex.slice(2);
    encoded += commandsData;
    encoded += inputsLengthHex.slice(2);
    
    // Add input offsets and data
    let inputDataSection = '';
    let currentInputOffset = inputsArrayLength * 64;
    
    for (const input of inputs) {
      encoded += padHex(bigIntToHex(BigInt(currentInputOffset / 2)), 32).slice(2);
      
      const inputData = input.slice(2);
      const inputLength = inputData.length / 2;
      inputDataSection += padHex(bigIntToHex(BigInt(inputLength)), 32).slice(2);
      inputDataSection += inputData.padEnd(Math.ceil(inputLength / 32) * 64, '0');
      
      currentInputOffset += 64 + inputDataSection.length;
    }
    
    encoded += inputDataSection;
    
    return '0x' + encoded;
  } catch (error) {
    console.error('Error re-encoding execute function:', error);
    return '';
  }
}

/**
 * Encode TRANSFER command input: (token, recipient, amount)
 * @param {string} token - Token address
 * @param {string} recipient - Recipient address
 * @param {string} amount - Amount as hex string
 * @returns {string} - Encoded input
 */
function encodeTransferInput(token, recipient, amount) {
  console.log('🔧 Encoding TRANSFER input:', { token, recipient, amount });
  
  try {
    // Clean addresses (remove 0x and pad to 32 bytes)
    const tokenBytes = padHexTo32Bytes(token);
    const recipientBytes = padHexTo32Bytes(recipient);
    
    // Convert amount to BigInt and then to hex with 32 bytes padding
    let amountBigInt;
    if (typeof amount === 'bigint') {
      amountBigInt = amount;
    } else if (typeof amount === 'string' && amount.startsWith('0x')) {
      amountBigInt = BigInt(amount);
    } else {
      amountBigInt = BigInt(amount);
    }
    const amountBytes = padHexTo32Bytes('0x' + amountBigInt.toString(16));
    
    const encoded = tokenBytes + recipientBytes + amountBytes;
    console.log('✅ TRANSFER input encoded:', encoded.length / 2, 'bytes');
    return '0x' + encoded; // Return with 0x prefix for compatibility
    
  } catch (error) {
    console.error('❌ Error encoding TRANSFER input:', error);
    throw error;
  }
}

/**
 * Encode execute function parameters: (bytes commands, bytes[] inputs)
 * @param {string} commands - Command bytes (e.g., "0x0c")
 * @param {string[]} inputs - Array of encoded inputs
 * @returns {string} - Encoded parameters
 */
function encodeExecuteParameters(commands, inputs) {
  console.log('🔧 Encoding execute parameters');
  console.log('  Commands:', commands);
  console.log('  Inputs count:', inputs.length);
  
  try {
    // Clean commands hex
    const commandsHex = commands.replace('0x', '');
    
    // ABI encode: execute(bytes commands, bytes[] inputs)
    // Structure:
    // [0x00-0x1F] offset to commands (0x40)
    // [0x20-0x3F] offset to inputs array
    // [0x40-...] commands data (length + data)
    // [...] inputs array data
    
    // Calculate offsets
    const commandsOffset = '0000000000000000000000000000000000000000000000000000000000000040'; // 0x40
    
    // Commands data: length + padded data
    const commandsLength = padHexTo32Bytes('0x' + (commandsHex.length / 2).toString(16));
    const commandsPadded = commandsHex + '0'.repeat((64 - (commandsHex.length % 64)) % 64);
    const commandsData = commandsLength + commandsPadded;
    
    // Calculate inputs array offset (after commands data)
    const inputsOffset = padHexTo32Bytes('0x' + (64 + commandsData.length / 2).toString(16));
    
    // Inputs array encoding
    const arrayLength = padHexTo32Bytes('0x' + inputs.length.toString(16));
    
    // Calculate element offsets
    let inputOffsets = '';
    let inputData = '';
    let currentOffset = inputs.length * 32; // Each offset is 32 bytes
    
    for (let i = 0; i < inputs.length; i++) {
      // Add offset to this element
      inputOffsets += padHexTo32Bytes('0x' + currentOffset.toString(16));
      
      // Clean input data
      let elementHex = inputs[i];
      if (elementHex.startsWith('0x')) {
        elementHex = elementHex.slice(2);
      }
      
      // Element data: length + padded data
      const elementLength = padHexTo32Bytes('0x' + (elementHex.length / 2).toString(16));
      const elementPadded = elementHex + '0'.repeat((64 - (elementHex.length % 64)) % 64);
      const thisElementData = elementLength + elementPadded;
      
      inputData += thisElementData;
      currentOffset += thisElementData.length / 2;
    }
    
    const inputsData = arrayLength + inputOffsets + inputData;
    
    const result = commandsOffset + inputsOffset + commandsData + inputsData;
    console.log('✅ Execute parameters encoded:', result.length / 2, 'bytes');
    return result;
    
  } catch (error) {
    console.error('❌ Error encoding execute parameters:', error);
    throw error;
  }
}

/**
 * Encode a bytes parameter (simplified version)
 * @param {string} hexData - Hex data without 0x
 * @returns {string} - Encoded bytes parameter
 */
function encodeBytesParameter(hexData) {
  // Length of data
  const length = padHexTo32Bytes('0x' + (hexData.length / 2).toString(16));
  
  // Pad data to 32-byte boundary
  const paddedData = hexData + '0'.repeat((64 - (hexData.length % 64)) % 64);
  
  return length + paddedData;
}

/**
 * Encode a bytes[] array parameter (simplified version)
 * @param {string[]} bytesArray - Array of hex strings
 * @returns {string} - Encoded bytes[] parameter  
 */
function encodeBytesArrayParameter(bytesArray) {
  // For now, just return the first element with proper encoding
  if (bytesArray.length !== 1) {
    throw new Error('Only single-element bytes arrays supported');
  }
  
  // Array length
  const arrayLength = padHexTo32Bytes('0x1');
  
  // Offset to first element (0x20 = 32 bytes after array length)
  const elementOffset = padHexTo32Bytes('0x20');
  
  // Element data with length
  const elementData = encodeBytesParameter(bytesArray[0]);
  
  return arrayLength + elementOffset + elementData;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isUniversalRouterTransaction,
    isExecuteFunction,
    decodeExecuteFunction,
    extractSwapInfo,
    injectFeeIntoExecute,
    DECODE_UNIVERSAL_ROUTER_ADDRESS,
    DECODE_FEE_RECIPIENT
  };
} 