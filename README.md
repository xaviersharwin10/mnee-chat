# SquadWallet (MNEEChat) 🚀

> **Winner of the MNEE Hackathon: Financial Automation Track** (Hopefully! 😉)

**SquadWallet** turns WhatsApp into a powerful, programmable bank account powered by **MNEE Stablecoin**. It enables purely natural language interactions for complex financial tasks like recurring payments, savings locks, and invoicing.

[![Project Demo](https://img.youtube.com/vi/PLACEHOLDER/0.jpg)](https://youtube.com) 
*(Demo video link goes here)*

## 🏆 Hackathon Tracks
**Financial Automation**: We built a full **Treasurer Agent** that handles:
- **Scheduled Payments**: "Pay rent every month" (Automated via Keeper)
- **Savings Locks**: "Lock 100 MNEE for 1 week" (Smart Contract Escrow)
- **Invoicing**: "Request 50 MNEE for dinner" (Payment Requests)

**AI & Agent Payments**:
- Uses **Google Gemini** for natural language understanding (fallback from optimized Regex).
- "Schedule 10 MNEE to Mom every Friday" -> Parsed & Executed On-Chain.

---

## ✨ Features

### 1. 💬 Natural Language Banking
Chat naturally. No complex dApps.
- "Send 10 to +1234..."
- "What's my balance?"
- "Help"

### 2. ⏰ Recurring Payments (The "Keeper")
Set it and forget it. Perfect for payroll, rent, or subscriptions.
- `schedule 10 to @bob every week`
- **Auto-Notifications**: Both sender and receiver get a WhatsApp message when the payment executes!

### 3. 🔒 Savings Locks
Time-lock your funds to prevent spending.
- `lock 500 for 30 days`
- **Auto-Withdraw**: The Keeper automatically unlocks and returns funds when time is up.

### 4. 📝 Payment Requests
Send invoices easily.
- `request 20 from @alice for pizza`
- Alice types `pay request 1` to confirm.

---

## 🛠 Tech Stack

- **Blockchain**: MNEE Stablecoin (Sepolia Testnet: `0xCaC...`)
- **Wallet**: **Coinbase CDP** (Server-Side Wallets)
- **AI**: Google Gemini 1.5 Flash (for NLP)
- **Backend**: Node.js + Express
- **Messaging**: Twilio (WhatsApp API)
- **Automation**: Custom Keeper Service (Cron-based)

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Twilio Account (for WhatsApp)
- Coinbase CDP API Keys
- Google Gemini API Key
- Ethereum Sepolia RPC

### Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/squadwallet.git
   cd squadwallet
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your keys
   ```

4. **Deploy Contracts** (Optional - we use pre-deployed)
   ```bash
   npm run deploy
   ```

5. **Start Server**
   ```bash
   npm start
   ```

6. **Start Tunnel (for Twilio)**
   ```bash
   ngrok http 3000
   ```
   *Copy the ngrok URL to your Twilio Webhook settings.*

---

## 📜 Smart Contracts used

- **MNEE Token (Sepolia)**: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`
- **ScheduledPayment**: `0x...` (See .env)
- **SavingsLock**: `0x...` (See .env)
- **PaymentRequest**: `0x...` (See .env)

---

## 👥 Contributors

- **Sharwin** - Lead Developer
- **Antigravity** - AI Co-Pilot

_Built with ❤️ for the MNEE Ecosystem._
