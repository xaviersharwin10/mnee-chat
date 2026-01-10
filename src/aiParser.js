import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { getOrCreateWallet } from './walletService.js';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI = null;
let model = null;

if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('🤖 AI Parser initialized with Gemini');
}

export function isAiParsingEnabled() {
    return !!model;
}

/**
 * Parse natural language message into structured command
 */
export async function parseNaturalLanguage(message) {
    if (!model) return null;

    const prompt = `You are a payment bot command parser. Parse the following message into a JSON command.
supported_commands:
1. SEND - Transfer money. Extract: amount (number), recipient (phone number)
2. CREATE_REQUEST - Request money. Extract: amount, payer (phone number)
3. CREATE_LOCK - Lock savings. Extract: amount, duration
4. CREATE_SCHEDULE - Recurring payment. Extract: amount, recipient (phone number), interval
5. BALANCE
6. HELP

Rules:
- "pay +12345 50" -> {"type":"SEND","amount":50,"recipient":"12345"}
- If recipient is a name (e.g. "Bob"), return it as "recipient":"Bob" (system will ask for number).
- Convert words to numbers ("fifty"->50).

Message: "${message}"

Respond with ONLY valid JSON.
`;

    try {
        const result = await model.generateContent(prompt);
        let cleanJson = result.response.text().replace(/```json|```/g, '').trim();
        if (cleanJson === 'null' || cleanJson === '') return null;

        const parsed = JSON.parse(cleanJson);
        console.log(`🤖 AI parsed: "${message}" -> ${JSON.stringify(parsed)}`);
        return parsed;
    } catch (error) {
        console.error('AI parsing error:', error.message);
        return null;
    }
}

/**
 * Resolve name to phone
 * @returns null always (Address book disabled)
 */
export function resolveNameToPhone(userPhone, name) {
    // Feature disabled: always return null to force manual number entry
    return null;
}
