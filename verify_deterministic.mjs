import { ethers } from 'ethers';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const phoneNumber = '919786313536';
const normalized = phoneNumber.replace(/[^\d]/g, '');

// Try with different salts
const salts = [
    process.env.WALLET_SALT,
    'default-salt',
    '',
    'change-this-to-a-random-string',
];

console.log('Looking for address: 0xf1A4fea0aa8c9aaeC7A855890Bd40e654669bdaE\n');

for (const salt of salts) {
    const seed = `squadwallet-${normalized}-${salt || 'default-salt'}`;
    const hash = createHash('sha256').update(seed).digest('hex');
    const privateKey = `0x${hash}`;
    const wallet = new ethers.Wallet(privateKey);
    
    const match = wallet.address.toLowerCase() === '0xf1A4fea0aa8c9aaeC7A855890Bd40e654669bdaE'.toLowerCase();
    console.log(`Salt: "${salt || '(empty)'}"`);
    console.log(`  => ${wallet.address} ${match ? '✅ MATCH!' : ''}`);
}
