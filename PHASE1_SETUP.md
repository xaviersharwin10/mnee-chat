# Phase 1 MVP - Quick Setup Guide

## Step 1: Create .env File

```bash
cp .env.example .env
```

## Step 2: Fill in Required Values

### Minimum Required for Phase 1:

1. **Twilio WhatsApp Setup**
   - Sign up at https://www.twilio.com/
   - Go to Console → Messaging → Settings → WhatsApp Sandbox
   - Copy your Account SID and Auth Token
   - Note your WhatsApp Sandbox number (usually `whatsapp:+14155238886`)

2. **Ethereum RPC**
   - Option A: Use free public RPC (already set in .env.example)
   - Option B: Get Alchemy API key (recommended for production)
     - Sign up at https://www.alchemy.com/
     - Create app → Ethereum → Mainnet
     - Copy HTTP URL

3. **Private Key (Optional)**
   - Only needed if you want to sponsor gas fees
   - Create a test wallet with minimal ETH
   - **NEVER use your main wallet private key!**

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Start Server

```bash
npm start
```

You should see:
```
🚀 SquadWallet server running on port 3000
📱 WhatsApp webhook: http://localhost:3000/webhook
```

## Step 5: Configure Twilio Webhook

### For Local Testing (using ngrok):

1. Install ngrok: https://ngrok.com/
2. Start ngrok:
   ```bash
   ngrok http 3000
   ```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. In Twilio Console:
   - Go to Messaging → Settings → WhatsApp Sandbox
   - Set "When a message comes in" to: `https://abc123.ngrok.io/webhook`
   - Method: POST
   - Save

### For Production:

1. Deploy your server to a public URL (Heroku, Railway, etc.)
2. Set webhook URL in Twilio to: `https://your-domain.com/webhook`

## Step 6: Test Phase 1

1. Send a WhatsApp message to your Twilio sandbox number
2. Try these commands:
   - `Help` - See available commands
   - `Balance` - Check your MNEE balance
   - `Send 5 MNEE to +1234567890` - Send MNEE (requires MNEE in wallet)

## Important Notes

- **Wallet Creation**: Wallets are created deterministically from phone numbers
- **MNEE Required**: Users need MNEE tokens in their wallet to send
- **Gas Fees**: If `ENABLE_GAS_SPONSORSHIP=false`, users need ETH for gas
- **Testing**: Use testnet or small amounts for testing

## Troubleshooting

### "Contract not compiled"
```bash
npm run compile
```

### "RPC Error"
- Check your `ETHEREUM_RPC_URL` is correct
- Try a different public RPC endpoint

### "WhatsApp not receiving messages"
- Verify webhook URL is accessible
- Check Twilio webhook configuration
- Ensure phone number format is correct (with country code)

### "Insufficient balance"
- User needs MNEE tokens in their wallet
- Check wallet address on Etherscan
- Transfer MNEE to the wallet address

## Phase 1 Commands

- `Send 5 MNEE to +1234567890` - Send MNEE to phone number
- `Pay 10 MNEE to @username` - Alternative send format
- `Balance` - Check MNEE balance
- `Help` - Show help message

