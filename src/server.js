import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { whatsappWebhook, sendWhatsAppMessage } from './whatsappHandler.js';
import { getOrCreateWallet } from './walletService.js';
import { startKeeper } from './keeper.js';

dotenv.config();

// Start the scheduled payment keeper (cron job)
startKeeper();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (web frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SquadWallet WhatsApp Bot is running',
    version: '1.0.0'
  });
});

// API: Get wallet address for phone number
app.get('/api/wallet/:phone', async (req, res) => {
  try {
    const phone = req.params.phone.replace(/[^\d]/g, '');
    if (phone.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }
    const wallet = await getOrCreateWallet(phone);
    res.json({
      phone,
      address: wallet.address,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Notify recipient of transfer (called by frontend after successful tx)
app.post('/api/notify-transfer', async (req, res) => {
  try {
    const { toPhone, amount, txHash, fromAddress } = req.body;

    if (!toPhone || !amount) {
      return res.status(400).json({ error: 'Missing toPhone or amount' });
    }

    const phone = toPhone.replace(/[^\d]/g, '');

    // Send WhatsApp notification to recipient
    await sendWhatsAppMessage(
      phone,
      `💰 *You received ${amount} MNEE!*\n\n` +
      `From: ${fromAddress ? fromAddress.slice(0, 8) + '...' : 'External Wallet'}\n\n` +
      (txHash ? `🔗 https://sepolia.etherscan.io/tx/${txHash}\n\n` : '') +
      `Type *balance* to check your funds!`
    );

    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Notify error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// WhatsApp webhook endpoint
app.post('/webhook', whatsappWebhook);

// Webhook verification endpoint (for Twilio)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // For Twilio, we'll handle verification differently
  // This is a placeholder for Meta's webhook verification
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SquadWallet server running on port ${PORT}`);
  console.log(`📱 WhatsApp webhook: http://localhost:${PORT}/webhook`);
});

export { app, sendWhatsAppMessage };

