import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Cache for content SIDs to avoid constant API calls
const contentSidCache = {
    helpMenu: null
};

/**
 * Get or create the Help Menu content template
 */
export async function getHelpMenuSid() {
    if (contentSidCache.helpMenu) return contentSidCache.helpMenu;

    try {
        // 1. Check if it already exists (by friendly name)
        // Twilio list returns paginated results
        const contents = await client.content.v1.contents.list({ limit: 20 });
        const existing = contents.find(c => c.friendlyName === 'mnee_help_v1');

        if (existing) {
            console.log(`✅ Found existing Help Menu template: ${existing.sid}`);
            contentSidCache.helpMenu = existing.sid;
            return existing.sid;
        }

        // 2. Create if not exists (Using raw request since SDK method might be missing in this version)
        console.log('📝 Creating new Help Menu template...');

        const createResponse = await client.request({
            method: 'POST',
            uri: 'https://content.twilio.com/v1/Content',
            data: {
                FriendlyName: 'mnee_help_v1',
                Language: 'en',
                Variables: {},
                Types: {
                    'twilio/quick-reply': {
                        body: '👋 *Welcome to MNEEChat!*\n\nWhat would you like to do today?',
                        actions: [
                            { title: '💰 Check Balance', id: 'balance' },
                            { title: '💸 Send Money', id: 'help_send' },
                            { title: '📩 My Requests', id: 'my requests' }
                        ]
                    }
                }
            }
        });

        let content;
        if (createResponse.body && typeof createResponse.body === 'string') {
            content = JSON.parse(createResponse.body);
        } else if (createResponse.body) {
            content = createResponse.body;
        } else {
            content = createResponse;
        }

        // 3. Approval is usually automatic for session messages, but good to check
        console.log(`✅ Created Help Menu template: ${content.sid}`);
        contentSidCache.helpMenu = content.sid;
        return content.sid;

    } catch (error) {
        console.error('❌ Error getting/creating Help Menu:', error);
        // Fallback or rethrow? 
        // If this fails, the caller should probably fall back to text.
        return null;
    }
}
