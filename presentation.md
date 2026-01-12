---
marp: true
theme: default
paginate: true
backgroundColor: #fff
---

<!--
To convert:
- Install: npm install -g @marp-team/marp-cli
- Run: marp presentation.md --pptx
- Or use: https://marp.app/
-->

# Live Demo Strategy 🎬

### The 3-Step "Wow" Flow:

1.  **Get Funds (Web)** 🚰
    *   Go to **[mnee-chat.vercel.app](https://mnee-chat.vercel.app)**
    *   Connect Wallet & Click "Get 100 Test MNEE"

2.  **Bridge to WhatsApp** 🌉
    *   On Web: Enter phone number -> Click "**Send MNEE**"
    *   *Voiceover: "I'm funding my phone number directly from the web."*

3.  **The Magic (WhatsApp)** 📱
    *   Open WhatsApp -> Text `balance` (See funds!)
    *   Text `send 10 to [Friend]` (Instant transfer)

---

# Why MNEE Wins 🏆🚀

### WhatsApp Payments Powered by MNEE

*Send and receive MNEE via WhatsApp — no wallets, just your phone number.*

**Try it**: [wa.me/14155238886](https://wa.me/14155238886?text=join%20depth-army) → Send `join depth-army`

---

# The Problem 😫

**Crypto has a friction problem.**

| Barrier | User Experience |
|---------|-----------------|
| 📱 Download apps | "Another app?!" |
| 🔑 Seed phrases | "What if I lose it?" |
| ⛽ Gas fees | "Why am I paying to pay?" |
| 😵 0x addresses | "Did I copy it right?" |

### Result: The average user gives up.

---

# The Solution 💡

> **"Send 50 MNEE to +919876543210"**

That's it. Done in 3 seconds.

| Old Way | MNEEchat Way |
|---------|--------------|
| Download wallet app | ❌ None needed |
| Create account | ❌ Text "Hi" |
| Backup seed phrase | ❌ Phone number = wallet |
| Copy 0x address | ❌ Use phone number |
| Set gas, confirm | ❌ Just type amount |

---

# 🏗 System Architecture

```text
[ 👤 User ]
    │
    │  (1) "send 10 to +91..." 💬
    👇
[ 📲 Twilio / WhatsApp ]
    │
    │  (2) SMS Webhook ⚡
    👇
[ ⚙️ MNEEchat Server ] ──────▶ [ 🛡️ Coinbase CDP (MPC) ]
    │    (3) Parse & Resolve          │
    │                                 │ (4) Sign & Send Tx ✍️
    │                                 👇
    │                         [ ⛓️ Ethereum / MNEE ]
    │                                 │
    │    (6) Confirmation ✅          │ (5) Confirm on-chain 🧱
    │                                 │
    ◀─────────────────────────────────┘
    │
    │  (7) "✅ Sent! Tx: 0x123..."
    👇
[ 👤 User ]
```

---

**Key**: Coinbase CDP provides secure MPC wallets — users never see private keys.

---

# Features ⚡

| Feature | Command | What It Does |
|---------|---------|--------------|
| 🚰 **Get Test MNEE** | `faucet` | Get 100 Free MNEE |
| 💸 **Send Money** | `send 10 to +91...` | Instant P2P transfer |
| 📩 **Request Payment** | `request 50 from +91...` | Invoice via WhatsApp |
| 🔒 **Lock Savings** | `lock 10 for 2 minutes` | Time-locked smart contract |
| ⏰ **Auto-Pay** | `schedule 1 every 2 mins` | Recurring payments |
| 💰 **Check Balance** | `balance` | View MNEE holdings |

**Web Portal**: [mnee-chat.vercel.app](https://mnee-chat.vercel.app) — Send MNEE/ETH to any phone

---

# Business Value Proposition 📈

| Metric | Impact |
|--------|--------|
| 🌍 **TAM** | 2 billion WhatsApp users worldwide |
| 📈 **Viral Coefficient** | >1 — Each user onboards 5+ recipients |
| 💰 **Zero CAC** | Users invite friends naturally via payments |
| 🔁 **Recurring Revenue** | Auto-pay = predictable transaction volume |
| 🏦 **TVL Growth** | Savings locks = MNEE held off exchanges |
| 👵 **New Demographics** | 60+ age group using crypto for first time |

### Every WhatsApp payment = MNEE adoption.
### Every recipient = new MNEE wallet created automatically.

---

# Thank You! 🙏

## Try MNEEchat Now

| Channel | Link |
|---------|------|
| 📱 **WhatsApp** | [wa.me/14155238886](https://wa.me/14155238886?text=join%20depth-army) → Send `join depth-army` |
| 🌐 **Web Portal** | [mnee-chat.vercel.app](https://mnee-chat.vercel.app) |
| 💻 **GitHub** | [github.com/xaviersharwin10/mnee-chat](https://github.com/xaviersharwin10/mnee-chat) |

---

*Built for MNEE Hackathon 2026* 🏆
