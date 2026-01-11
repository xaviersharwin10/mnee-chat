# SquadWallet Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Twilio account with WhatsApp Business API access
- OpenAI API key
- Ethereum RPC endpoint (Alchemy, Infura, or public RPC)
- Private key for gas sponsorship (optional but recommended)

## Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Required Environment Variables**

   ```env
   # WhatsApp (Twilio)
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key
   
   # Blockchain
   MNEE_CONTRACT_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
   ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key
   PRIVATE_KEY=your_private_key_for_gas_sponsorship
   
   # Server
   PORT=3000
   NODE_ENV=development
   ```

## Compile Smart Contracts

```bash
npm run compile
```

This compiles the SquadVault.sol contract using Hardhat.

## Deploy Smart Contracts (Optional)

For testing, you can deploy to a local Hardhat network:

```bash
npx hardhat node  # Start local node
npm run deploy    # Deploy contracts
```

For mainnet deployment, configure your network in `hardhat.config.js` and run:

```bash
npm run deploy -- --network mainnet
```

## Start the Server

```bash
npm start
# Or for development with auto-reload
npm run dev
```

## Configure WhatsApp Webhook

1. **Get your webhook URL**
   - Use ngrok for local testing: `ngrok http 3000`
   - Or deploy to a server with a public URL

2. **Configure Twilio Webhook**
   - Go to Twilio Console → Messaging → Settings → WhatsApp Sandbox
   - Set webhook URL to: `https://your-domain.com/webhook`
   - Method: POST

## Testing

### 1-to-1 Payments (MVP)
1. Send WhatsApp message to your bot number
2. Try: `Send 5 MNEE to +1234567890`
3. Check balance: `Balance`

### Group Treasury
1. Add bot to a WhatsApp group
2. Type: `create treasury`
3. Deposit: `Deposit 50 MNEE`
4. Propose expense: `Pay the designer 50 MNEE`
5. Vote on proposals via buttons

## Troubleshooting

### Contract Not Compiled
If you see "Contract not compiled" errors:
```bash
npm run compile
```

### RPC Errors
- Check your `ETHEREUM_RPC_URL` is correct
- Try a public RPC: `https://eth.llamarpc.com`

### WhatsApp Not Receiving Messages
- Verify Twilio webhook is configured correctly
- Check webhook URL is accessible
- Verify phone numbers are in correct format

### Gas Sponsorship Issues
- Ensure `PRIVATE_KEY` has ETH for gas
- Check wallet balance on Etherscan

## Development Notes

- Wallet abstraction uses deterministic wallet generation for MVP
- For production, integrate Coinbase CDP or Privy
- Smart contracts use OpenZeppelin for security
- Rate limiting is implemented to prevent abuse

## Security Considerations

- Never commit `.env` file
- Use environment variables for all secrets
- Private keys should be stored securely
- Consider using hardware wallets for production

## Next Steps

1. Set up production database (replace in-memory storage)
2. Integrate Coinbase CDP or Privy for wallet abstraction
3. Implement proper gas sponsorship with meta-transactions
4. Add comprehensive testing
5. Deploy to production server

