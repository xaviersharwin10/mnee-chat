import OpenAI from 'openai';
import dotenv from 'dotenv';
import { sendWhatsAppMessage, sendWhatsAppMessageWithButtons } from './whatsappHandler.js';
import { createProposal } from './votingService.js';
import { getGroup } from './groupManager.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a Treasurer Agent managing a group treasury on WhatsApp. Your role is to:

1. Parse natural language messages from group members
2. Extract financial transaction intents
3. Return structured JSON data for transaction proposals

Extract from chat messages:
- Intent: TRANSFER, DEPOSIT, QUERY_BALANCE, PROPOSE_EXPENSE, or OTHER
- Amount: number in MNEE (if applicable)
- Recipient: phone number, @username, or description (if applicable)
- Description: reason for transaction or expense purpose

Return ONLY valid JSON in this format:
{
  "intent": "TRANSFER" | "DEPOSIT" | "QUERY_BALANCE" | "PROPOSE_EXPENSE" | "OTHER",
  "amount": number (if applicable),
  "recipient": "string" (if applicable),
  "description": "string",
  "confidence": number (0-1)
}

Examples:
- "Pay the designer 50 MNEE" → {"intent": "PROPOSE_EXPENSE", "amount": 50, "recipient": "designer", "description": "Payment for design work", "confidence": 0.9}
- "We need to book flights for 200 MNEE" → {"intent": "PROPOSE_EXPENSE", "amount": 200, "recipient": "airline", "description": "Book flights for team", "confidence": 0.85}
- "What's our balance?" → {"intent": "QUERY_BALANCE", "confidence": 0.95}
- "Deposit 100 MNEE" → {"intent": "DEPOSIT", "amount": 100, "description": "Member deposit", "confidence": 0.9}

If the message is not related to treasury or payments, return {"intent": "OTHER", "confidence": 0.5}`;

/**
 * Process AI command from natural language
 */
export async function processAICommand(groupId, from, message, group) {
  try {
    // Check if treasury exists
    if (!group || !group.treasuryDeployed) {
      // If it's a treasury-related command, suggest creating one
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('pay') || lowerMessage.includes('expense') || 
          lowerMessage.includes('transfer') || lowerMessage.includes('send')) {
        await sendWhatsAppMessage(
          from,
          `💡 I detected a payment request, but no treasury exists yet.\n\n` +
          `Type "create treasury" to set up a shared treasury first!`
        );
        return;
      }
      return;
    }

    // Parse message with AI
    const parsed = await parseMessageWithAI(message, group);

    if (!parsed || parsed.intent === 'OTHER' || parsed.confidence < 0.7) {
      // Low confidence or not a treasury command
      return;
    }

    // Handle based on intent
    switch (parsed.intent) {
      case 'PROPOSE_EXPENSE':
      case 'TRANSFER':
        await handleExpenseProposal(groupId, from, parsed, group);
        break;
      
      case 'QUERY_BALANCE':
        // This is handled in groupManager.js
        break;
      
      case 'DEPOSIT':
        // This is handled in groupManager.js via command parser
        break;
      
      default:
        console.log('Unhandled AI intent:', parsed.intent);
    }
  } catch (error) {
    console.error('Error processing AI command:', error);
    // Don't send error to user for AI parsing failures
  }
}

/**
 * Parse message with OpenAI GPT-4o
 */
async function parseMessageWithAI(message, group) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Group context: ${group.members.length} members, Treasury: ${group.treasuryAddress}\n\nMessage: "${message}"` 
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0].message.content;
    const parsed = JSON.parse(response);

    console.log('🤖 AI parsed message:', parsed);
    return parsed;
  } catch (error) {
    console.error('Error parsing message with AI:', error);
    return null;
  }
}

/**
 * Handle expense proposal from AI
 */
async function handleExpenseProposal(groupId, from, parsed, group) {
  try {
    if (!parsed.amount || parsed.amount <= 0) {
      await sendWhatsAppMessage(
        from,
        `❌ I couldn't determine the amount. Please specify: "Pay [amount] MNEE to [recipient]"`
      );
      return;
    }

    // Create proposal
    const proposalId = await createProposal(
      groupId,
      from,
      {
        to: parsed.recipient || 'Unknown',
        amount: parsed.amount,
        description: parsed.description || `Payment: ${parsed.recipient || 'expense'}`,
      }
    );

    // Send proposal to group with voting buttons
    const proposalMessage = `📋 *New Proposal Created*\n\n` +
      `💰 Amount: ${parsed.amount} MNEE\n` +
      `👤 Recipient: ${parsed.recipient || 'TBD'}\n` +
      `📝 Description: ${parsed.description || 'Group expense'}\n` +
      `👤 Proposed by: ${from}\n\n` +
      `Proposal ID: #${proposalId}\n\n` +
      `Vote using the buttons below:`;

    // Send to all group members (in production, send to group chat)
    // For now, send to proposer with voting options
    await sendWhatsAppMessageWithButtons(
      from,
      proposalMessage,
      [
        { text: '✅ Approve', id: `approve_${proposalId}` },
        { text: '❌ Reject', id: `reject_${proposalId}` },
      ]
    );

    // Notify other members (in production, this would be a group broadcast)
    for (const member of group.members) {
      if (member !== from) {
        await sendWhatsAppMessage(
          member,
          `📢 New proposal in group!\n\n${proposalMessage}`
        );
      }
    }

  } catch (error) {
    console.error('Error handling expense proposal:', error);
    await sendWhatsAppMessage(
      from,
      `❌ Error creating proposal: ${error.message}`
    );
  }
}

/**
 * Get AI response for general queries
 */
export async function getAIResponse(message, context = {}) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful treasurer assistant for SquadWallet. Answer questions about treasury management, proposals, and payments concisely.',
        },
        {
          role: 'user',
          content: `Context: ${JSON.stringify(context)}\n\nQuestion: ${message}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error getting AI response:', error);
    return null;
  }
}

