    # Phase 1 Testing Guide

## Step 1: Start Your Server

```bash
# Make sure you have .env file configured
npm install
npm start
```

You should see:
```
🚀 SquadWallet server running on port 3000
📱 WhatsApp webhook: http://localhost:3000/webhook
```

## Step 2: Expose Your Local Server (Choose One Method)

### Option A: Using ngrok (Recommended for Testing)

1. **Install ngrok**
   - Download from: https://ngrok.com/download
   - Or install via package manager:
     ```bash
     # macOS
     brew install ngrok
     
     # Linux
     wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
     tar -xzf ngrok-v3-stable-linux-amd64.tgz
     sudo mv ngrok /usr/local/bin/
     ```

2. **Start ngrok**
   ```bash
   ngrok http 3000
   ```

3. **Copy the HTTPS URL**
   You'll see something like:
   ```
   Forwarding  https://abc123xyz.ngrok.io -> http://localhost:3000
   ```
   Copy the HTTPS URL (e.g., `https://abc123xyz.ngrok.io`)

### Option B: Using Cloudflare Tunnel (Alternative)

```bash
# Install cloudflared
# Then run:
cloudflared tunnel --url http://localhost:3000
```

### Option C: Deploy to a Public Server

Deploy your server to:
- Heroku
- Railway
- Render
- DigitalOcean
- Any VPS with public IP

## Step 3: Configure Twilio Webhook

1. **Go to Twilio Console**
   - Visit: https://console.twilio.com/
   - Navigate to: **Messaging** → **Settings** → **WhatsApp Sandbox**

2. **Set Webhook URL**
   - **When a message comes in**: `https://your-ngrok-url.ngrok.io/webhook`
     - Replace with your actual ngrok URL or deployed server URL
   - **HTTP Method**: `POST`
   - Click **Save**

3. **Verify Configuration**
   - Your webhook URL should be accessible
   - Test it: `curl https://your-ngrok-url.ngrok.io/`
   - Should return: `{"status":"ok","message":"SquadWallet WhatsApp Bot is running"}`

## Step 4: Test Basic Flow

### Test 1: Send a Message to Your Bot

1. **Send WhatsApp message** to your Twilio sandbox number
   - Format: `join <your-sandbox-code>` (first time only)
   - Then send: `Help`

2. **Check Server Logs**
   You should see:
   ```
   📨 Received message from +1234567890: Help
   ```

3. **Check WhatsApp**
   You should receive a help message with available commands

### Test 2: Check Balance

1. **Send**: `Balance`
2. **Expected Response**:
   ```
   💰 Your Balance: 0.000000 tokens
   
   Wallet: 0x...
   View on Etherscan: https://sepolia.etherscan.io/address/0x...
   ```

### Test 3: Send Tokens (Requires PyUSD in Wallet)

1. **Get PyUSD tokens** (if available on Sepolia)
2. **Send**: `Send 1 tokens to +1234567890`
3. **Expected Response**:
   ```
   ⏳ Processing transfer of 1 tokens to +1234567890...
   ✅ Successfully sent 1 tokens to +1234567890!
   
   Transaction: https://sepolia.etherscan.io/tx/0x...
   ```

## Step 5: Debugging

### Check if Webhook is Receiving Requests

1. **Watch server logs** when you send a message
2. **Check Twilio Console** → **Monitor** → **Logs** → **Messaging**
   - You should see webhook requests
   - Check if they're successful (200) or failing

### Common Issues

#### Issue: "No response from webhook"
- **Check**: Is your server running?
- **Check**: Is ngrok running?
- **Check**: Is the webhook URL correct in Twilio?

#### Issue: "Webhook returns 500 error"
- **Check server logs** for error messages
- **Check**: Are all environment variables set correctly?
- **Check**: Is the RPC endpoint working?

#### Issue: "Message not received"
- **Verify**: You sent message to correct Twilio number
- **Verify**: You joined the sandbox (first message: `join <code>`)
- **Check**: Twilio webhook logs for incoming requests

### Test Webhook Manually

```bash
# Test webhook endpoint
curl -X POST https://your-ngrok-url.ngrok.io/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+1234567890" \
  -d "Body=Help" \
  -d "To=whatsapp:+14155238886"
```

## Step 6: Verify Everything Works

### Checklist:
- [ ] Server starts without errors
- [ ] ngrok is running and forwarding to port 3000
- [ ] Twilio webhook URL is configured correctly
- [ ] Can send WhatsApp message to bot
- [ ] Bot responds to "Help" command
- [ ] Bot responds to "Balance" command
- [ ] Wallet address is generated correctly
- [ ] Etherscan link works (shows wallet on Sepolia)

## Testing Commands

Try these commands in order:

1. `Help` - Should show help message
2. `Balance` - Should show balance (0 if no tokens)
3. `Send 1 tokens to +1234567890` - Will fail if no tokens, but should show proper error

## Next Steps After Testing

Once basic flow works:
1. Get Sepolia ETH for gas (if not sponsoring)
2. Get PyUSD tokens for testing
3. Test actual token transfers
4. Verify transactions on Sepolia Etherscan

