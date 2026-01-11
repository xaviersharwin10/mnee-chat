import { CdpClient } from '@coinbase/cdp-sdk';
import dotenv from 'dotenv';
dotenv.config();

const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
});

// Try MANY more naming conventions
const names = [
    '919786313536',
    '+919786313536',
    'phone-919786313536',
    '9786313536',
    'user-919786313536',
    'wa-919786313536',
    'whatsapp-919786313536',
    'mnee-919786313536',
    'wamnee-919786313536',
];

for (const name of names) {
    try {
        console.log(`Checking: ${name}`);
        const account = await cdp.evm.getAccount({ name });
        console.log(`✅ FOUND: ${name} => ${account.address}`);
    } catch (e) {
        console.log(`❌ Not found: ${name}`);
    }
}

// Also check the target address directly
console.log('\n--- Target address to find: 0xf1A4fea0aa8c9aaeC7A855890Bd40e654669bdaE ---');
