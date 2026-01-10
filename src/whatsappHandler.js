import twilio from 'twilio';
import dotenv from 'dotenv';
import { processMessage } from './messageProcessor.js';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Send a WhatsApp message using Twilio
 */
export async function sendWhatsAppMessage(to, message, options = {}) {
  try {
    const messageOptions = {
      from: twilioWhatsAppNumber,
      to: `whatsapp:${to}`,
      body: message,
    };

    if (options.mediaUrl) {
      messageOptions.mediaUrl = Array.isArray(options.mediaUrl)
        ? options.mediaUrl
        : [options.mediaUrl];
    }

    const result = await client.messages.create(messageOptions);
    console.log(`✅ Message sent to ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    console.error(`❌ Error sending WhatsApp message to ${to}:`, error);
    throw error;
  }
}

export async function sendWhatsAppMessageWithButtons(to, message, buttons) {
  let buttonText = message + '\n\n';
  buttons.forEach((button, index) => {
    buttonText += `${index + 1}. ${button.text}\n`;
  });
  return sendWhatsAppMessage(to, buttonText);
}

/**
 * Send a Content API message (Interactive)
 */
export async function sendContentMessage(to, contentSid, contentVariables = {}) {
  try {
    const messageOptions = {
      from: twilioWhatsAppNumber,
      to: `whatsapp:${to}`,
      contentSid: contentSid,
      contentVariables: JSON.stringify(contentVariables)
    };

    const result = await client.messages.create(messageOptions);
    console.log(`✅ Interactive Message sent to ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    console.error(`❌ Error sending Interactive message to ${to}:`, error);
    // Fallback to text if interactive fails
    await sendWhatsAppMessage(to, `(Interactive message failed)\n\nType 'help' for options.`);
    throw error;
  }
}

/**
 * Handle incoming WhatsApp webhook from Twilio
 */
export async function whatsappWebhook(req, res) {
  try {
    const incomingMessage = req.body.Body;
    const from = req.body.From?.replace('whatsapp:', '') || '';
    const to = req.body.To?.replace('whatsapp:', '') || '';
    const messageSid = req.body.MessageSid;
    const profileName = req.body.ProfileName || '';
    const numMedia = parseInt(req.body.NumMedia || '0');

    // Extract Media if present
    const media = [];
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        media.push({
          contentType: req.body[`MediaContentType${i}`],
          url: req.body[`MediaUrl${i}`],
        });
      }
    }

    console.log(`📨 Received message from ${from}: ${incomingMessage || '[Media Message]'}`);

    res.status(200).send('OK');

    processMessage({
      from,
      to,
      message: incomingMessage || '',
      messageSid,
      profileName,
      media, // Pass media to processor
    }).catch(error => {
      console.error('Error processing message:', error);
      sendWhatsAppMessage(from, '❌ Sorry, error (webhook level).').catch(console.error);
    });

  } catch (error) {
    console.error('Error in WhatsApp webhook:', error);
    res.status(500).send('Error');
  }
}

export function extractPhoneNumber(whatsappNumber) {
  return whatsappNumber.replace('whatsapp:', '').replace('+', '');
}

export function formatPhoneNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}
