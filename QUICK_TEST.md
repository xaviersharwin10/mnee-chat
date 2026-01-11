# Quick Testing Steps

## 1. Start Server
```bash
npm start
```

## 2. Expose with ngrok (in a new terminal)
```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

## 3. Configure Twilio Webhook

Go to: https://console.twilio.com/us1/develop/sms/sandbox

Set:
- **When a message comes in**: `https://your-ngrok-url.ngrok.io/webhook`
- **HTTP Method**: `POST`
- **Save**

## 4. Test

Send WhatsApp message to your Twilio sandbox number:
- First time: `join <your-sandbox-code>`
- Then: `Help`

You should get a response!

## 5. Verify Webhook is Working

Check your server logs - you should see:
```
📨 Received message from +1234567890: Help
```

## Troubleshooting

**No response?**
- Check server is running
- Check ngrok is running
- Verify webhook URL in Twilio matches ngrok URL
- Check Twilio Console → Monitor → Logs for webhook status

**500 Error?**
- Check server logs for errors
- Verify .env file has all required variables
- Check RPC endpoint is accessible

