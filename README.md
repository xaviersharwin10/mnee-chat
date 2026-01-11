# MNEEchat 🚀

**MNEEchat** is an AI-powered financial agent that transforms WhatsApp into a programmable banking interface. By leveraging the **MNEE Stablecoin** and **Coinbase CDP**, it bridges the gap between complex blockchain infrastructure and the natural language interface used by billions.

[![Demo Video](https://img.youtube.com/vi/PLACEHOLDER/0.jpg)](https://youtube.com)
*(Link your demo video here)*

---

## 🏗 Architecture

## 🏗 System Architecture

The following sequence demonstrates how a single natural language message translates into verified on-chain value movement, powered by **Coinbase CDP**.

```mermaid
sequenceDiagram
    participant User as 👤 User (WhatsApp)
    participant Twilio as 💬 Twilio
    participant Server as ⚙️ MNEEchat Server
    participant CDP as 🛡️ Coinbase CDP (MPC)
    participant Chain as ⛓️ MNEE (Sepolia)

    User->>Twilio: "Send 10 MNEE to @Alice"
    Twilio->>Server: Webhook (Text)
    
    rect rgb(30, 30, 30)
        Note over Server: 🧠 NLP Processing
        Server->>Server: Parse Intent & Resolve @Alice
    end
    
    Server->>CDP: Request Transaction
    Note right of Server: "Sign transfer(Alice, 10) with Sender's MPC Key"
    
    CDP->>Chain: Broadcast Signed Tx
    Chain-->>CDP: Tx Hash (0x123...)
    CDP->>Server: Success Response
    
    Server->>Twilio: "✅ Sent! Hash: 0x123..."
    Twilio->>User: Confirmation Message
```

---

## 🚀 Why MNEEchat? (Value Proposition)

We bridge the gap between "Complex Crypto" and "Everyday Users".

| Consumer Pain Point 😫 | The MNEEchat Solution 💡 | Consumer Benefit 🎁 | Impact on MNEE Protocol 📈 |
| :--- | :--- | :--- | :--- |
| **"Wallets are confusing"** (Keys/Phrases) | **Invisible Wallet**: Zero-setup, phone-based accounts via CDP. | **Onboard in < 3 seconds**. No apps to download. | **Viral Growth**: Frictionless P2P acquisition. |
| **"I forget to pay rent"** (Manual Ops) | **Agent Automation**: "Pay landlord weekly" set-and-forget. | **100% Peace of Mind**. Never miss a due date. | **Consistent Volume**: Predictable on-chain transaction flow. |
| **"I spend too much"** (Impulse Buying) | **Smart Lockbox**: Time-locked savings contracts. | **Financial Discipline**. Forced savings goals. | **Sticky Liquidity**: Higher TVL locked in contracts. |
| **"Crypto addresses are scary"** (0x...) | **Natural Language**: Send to Phone Numbers. | **0 Anxiety**. Send money like a text message. | **Mass Appeal**:Usable by non-technical demographics. |

---

## 🎯 Hackathon Tracks & Features

We address the **Financial Automation** and **AI & Agent Payments** tracks by building a system where money effectively "programs itself."

### 1. 🤖 AI & Agent Payments
- **Context-Aware Parsing**: Uses **Google Gemini 1.5** to understand intent.
    - _"Send 10 bucks to mom every week"_ is parsed, recipient resolved, and schedule created.
- **Zero-UI**: No React frontend required. The "Interface" is English.

### 2. ⚡ Financial Automation
- **Recurring Payments**: Fully decentralized payroll/subscription agent.
    - `schedule 50 to @employee weekly`
- **Smart Savings**: Enforced savings accounts.
    - `lock 500 for 1 year`
- **Invoicing**: P2P request network.
    - `request 25 from @alice`

---

## 🛠 Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Stablecoin** | **MNEE** (Sepolia) | The core programmable money layer. |
| **Infrastructure** | **Coinbase CDP** | Server-Side Wallets (MPC) for secure, keyless UX. |
| **Intelligence** | **Google Gemini** | NLP to convert chat -> JSON commands. |
| **Messaging** | **Twilio API** | WhatsApp interface. |
| **Contracts** | **Solidity** | Custom logic for `SavingsLock` and `ScheduledPayment`. |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Twilio Account (Sandbox or Live)
- Coinbase CDP API Keys
- Google Gemini API Key

### Installation

1. **Clone & Install**
   ```bash
   git clone https://github.com/xaviersharwin10/mnee-chat.git
   cd mnee-chat
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Fill in CDP_API_KEY, TWILIO_AUTH_TOKEN, etc.
   ```

3. **Run Locally**
   ```bash
   npm start
   ```

4. **Connect Twilio**
   - Run `ngrok http 3000`
   - Paste the public URL into your Twilio Sandbox "When a message comes in" field.

---

## 📜 Smart Contracts

### Deployed Contracts (Sepolia Testnet)

| Contract | Address | Etherscan |
| :--- | :--- | :--- |
| **MockMNEE Token** | `0x7650906b48d677109F3C20C6B3B89eB0b793c63b` | [View →](https://sepolia.etherscan.io/address/0x7650906b48d677109F3C20C6B3B89eB0b793c63b) |
| **PaymentRequest** | `0x5E6669Dee4e5387D2D93f8fAf91A713555463Bd6` | [View →](https://sepolia.etherscan.io/address/0x5E6669Dee4e5387D2D93f8fAf91A713555463Bd6) |
| **SavingsLock** | *(See .env)* | Time-locked savings |
| **ScheduledPayment** | *(See .env)* | Recurring payments |

> **⚠️ Note on Mock Token**: Since there is no official MNEE contract on Sepolia testnet, we deployed a custom `MockMNEE` ERC-20 token that mimics the real MNEE:
> - **Name**: Mock MNEE Stablecoin
> - **Symbol**: MNEE  
> - **Decimals**: 6 (same as real MNEE)
> - **Features**: Public `mint()` and `faucet()` for testing
>
> This allows full functionality testing without real money. See "Mainnet Migration" below.

---

## 🚀 Mainnet Migration

To deploy on Ethereum Mainnet with **real MNEE**, update your `.env`:

```env
# Switch from MockMNEE (testnet) to Real MNEE (mainnet)
TOKEN_CONTRACT_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF

# Use mainnet RPC
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY

# Redeploy contracts to mainnet and update these:
PAYMENT_REQUEST_ADDRESS=0x...
SAVINGS_LOCK_ADDRESS=0x...
SCHEDULED_PAYMENT_ADDRESS=0x...
```

**Cost Estimate**: ~$50-100 for contract deployments + gas

---

_Built for the MNEE Hackathon 2025._

