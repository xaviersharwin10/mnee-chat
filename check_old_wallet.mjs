import { CdpClient } from '@coinbase/cdp-sdk';
import dotenv from 'dotenv';
dotenv.config();

const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
});

// Try different naming conventions
const names = [
    'squadwallet-919786313536',
    'sw-919786313536', 
    'sw-9786313536',
    'wallet-919786313536',
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
