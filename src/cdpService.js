/**
 * Coinbase CDP Service
 * Handles wallet creation and transaction signing via CDP Server Wallet v2
 */

import { CdpClient } from '@coinbase/cdp-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Initialize CDP client (automatically reads from env vars:
// CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET)
let cdpClient = null;

/**
 * Get or initialize CDP client
 */
export function getCdpClient() {
    if (!cdpClient && process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
        try {
            cdpClient = new CdpClient();
            console.log('✅ CDP Client initialized');
        } catch (error) {
            console.error('❌ Failed to initialize CDP client:', error.message);
        }
    }
    return cdpClient;
}

/**
 * Check if CDP is configured
 */
export function isCdpConfigured() {
    return !!(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET && process.env.CDP_WALLET_SECRET);
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_MAP_PATH = path.join(__dirname, '../user_map.json');

// Phone number to CDP account mapping (Persistent)
const phoneToAccountMap = new Map();

function loadUserMap() {
    try {
        if (fs.existsSync(USER_MAP_PATH)) {
            const data = JSON.parse(fs.readFileSync(USER_MAP_PATH, 'utf8'));
            for (const [phone, address] of Object.entries(data.users)) {
                // We only need basic data for reverse lookup, accountId isn't strictly needed for that
                phoneToAccountMap.set(phone, { address, phoneNumber: phone, accountId: address });
            }
            console.log(`✅ Loaded ${phoneToAccountMap.size} users from map.`);
        }
    } catch (e) {
        console.error('⚠️ Could not load user map:', e.message);
    }
}

function saveUserMap() {
    try {
        const users = {};
        for (const [phone, data] of phoneToAccountMap.entries()) {
            users[phone] = data.address;
        }
        fs.writeFileSync(USER_MAP_PATH, JSON.stringify({ users }, null, 2));
    } catch (e) {
        console.error('⚠️ Could not save user map:', e.message);
    }
}

// Load on start
loadUserMap();

/**
 * Get or create a CDP wallet for a phone number
 * @param {string} phoneNumber - Normalized phone number
 * @returns {Promise<{address: string, phoneNumber: string}>}
 */
export async function getOrCreateCdpWallet(phoneNumber) {
    const normalized = phoneNumber.replace(/[^\d]/g, '');
    // Account name: mneechat-{phone} (max 36 chars, plenty of room)
    const accountName = `mneechat-${normalized}`;

    // Check cache first
    if (phoneToAccountMap.has(normalized)) {
        return phoneToAccountMap.get(normalized);
    }

    const cdp = getCdpClient();
    if (!cdp) {
        throw new Error('CDP client not configured');
    }

    try {
        // First try to get existing account
        console.log(`🔍 CDP: Looking for existing account: ${accountName}`);
        const account = await cdp.evm.getAccount({
            name: accountName,
        });

        const walletData = {
            address: account.address,
            phoneNumber: normalized,
            accountId: account.address,
        };

        phoneToAccountMap.set(normalized, walletData);
        saveUserMap();
        console.log(`✅ CDP wallet FOUND for ${normalized}: ${account.address}`);
        return walletData;
    } catch (getError) {
        // Log the FULL error to understand what's happening
        console.log(`⚠️ CDP getAccount error:`, {
            message: getError.message,
            statusCode: getError.statusCode,
            errorType: getError.errorType,
            code: getError.code,
            name: getError.name,
        });

        // If account doesn't exist, create it
        const isNotFound = getError.statusCode === 404 ||
            getError.errorType === 'not_found' ||
            getError.message?.includes('not found') ||
            getError.code === 'NOT_FOUND';

        if (isNotFound) {
            try {
                console.log(`📝 CDP: Creating NEW account: ${accountName}`);
                const account = await cdp.evm.createAccount({
                    name: accountName,
                });

                const walletData = {
                    address: account.address,
                    phoneNumber: normalized,
                    accountId: account.address,
                };

                phoneToAccountMap.set(normalized, walletData);
                saveUserMap();
                console.log(`✅ CDP wallet CREATED for ${normalized}: ${account.address}`);
                return walletData;
            } catch (createError) {
                console.error('❌ CDP wallet creation failed:', createError.message);
                throw createError;
            }
        }

        console.error('❌ CDP wallet retrieval failed:', getError.message);
        throw getError;
    }
}

/**
 * Send a generic transaction via CDP (for smart contract calls)
 * @param {string} fromPhoneNumber - Sender's phone number
 * @param {string} toAddress - Contract address
 * @param {string} data - Encoded transaction data (e.g., from ethers.Interface.encodeFunctionData)
 * @param {string} network - Network name (e.g., 'ethereum-sepolia')
 */
export async function sendTransactionViaCdp(fromPhoneNumber, toAddress, data, network = 'ethereum-sepolia') {
    const cdp = getCdpClient();
    if (!cdp) {
        throw new Error('CDP client not configured');
    }

    // Get sender's CDP account
    const senderWallet = await getOrCreateCdpWallet(fromPhoneNumber);

    try {
        // Send transaction via CDP
        const result = await cdp.evm.sendTransaction({
            address: senderWallet.address,
            transaction: {
                to: toAddress,
                data: data,
            },
            network: network,
        });

        console.log(`✅ CDP transaction sent: ${result.transactionHash}`);
        return {
            hash: result.transactionHash,
            from: senderWallet.address,
        };
    } catch (error) {
        console.error('❌ CDP transaction failed:', error.message);
        throw error;
    }
}

/**
 * Send ERC20 token transfer via CDP
 * @param {string} fromPhoneNumber - Sender's phone number
 * @param {string} toAddress - Recipient's address
 * @param {string} tokenAddress - ERC20 token contract address
 * @param {string} amount - Amount to send (in token units, not wei)
 * @param {number} decimals - Token decimals
 * @param {string} network - Network name (e.g., 'ethereum-sepolia')
 */
export async function sendTokenViaCdp(fromPhoneNumber, toAddress, tokenAddress, amount, decimals, network = 'ethereum-sepolia') {
    const cdp = getCdpClient();
    if (!cdp) {
        throw new Error('CDP client not configured');
    }

    // Get sender's CDP account
    const senderWallet = await getOrCreateCdpWallet(fromPhoneNumber);

    // Convert amount to wei
    const amountWei = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

    // ERC20 transfer function signature: transfer(address,uint256)
    const transferData = encodeERC20Transfer(toAddress, amountWei);

    try {
        // Send transaction via CDP
        const result = await cdp.evm.sendTransaction({
            address: senderWallet.address,
            transaction: {
                to: tokenAddress,
                data: transferData,
            },
            network: network,
        });

        console.log(`✅ CDP token transfer sent: ${result.transactionHash}`);
        return result.transactionHash;
    } catch (error) {
        console.error('❌ CDP token transfer failed:', error.message);
        throw error;
    }
}

/**
 * Request testnet funds from CDP faucet
 */
export async function requestFaucet(address, network = 'base-sepolia', token = 'eth') {
    const cdp = getCdpClient();
    if (!cdp) {
        throw new Error('CDP client not configured');
    }

    try {
        const result = await cdp.evm.requestFaucet({
            address,
            network,
            token,
        });
        console.log(`💧 Faucet request sent: ${result.transactionHash}`);
        return result.transactionHash;
    } catch (error) {
        console.error('❌ Faucet request failed:', error.message);
        throw error;
    }
}

/**
 * Encode ERC20 transfer function call
 */
function encodeERC20Transfer(to, amount) {
    // Function selector for transfer(address,uint256)
    const selector = '0xa9059cbb';

    // Pad address to 32 bytes (remove 0x, pad to 64 chars)
    const paddedAddress = to.slice(2).padStart(64, '0');

    // Pad amount to 32 bytes
    const paddedAmount = amount.toString(16).padStart(64, '0');

    return selector + paddedAddress + paddedAmount;
}

/**
 * Get account address from cache
 */
export function getCachedWalletAddress(phoneNumber) {
    const normalized = phoneNumber.replace(/[^\d]/g, '');
    const wallet = phoneToAccountMap.get(normalized);
    return wallet?.address || null;
}

/**
 * Reverse lookup: Get phone number from address
 * (Only works for cached wallets)
 */
export function getPhoneByAddress(address) {
    if (!address) return null;
    const searchAddr = address.toLowerCase();

    for (const [phone, data] of phoneToAccountMap.entries()) {
        if (data.address.toLowerCase() === searchAddr) {
            return phone;
        }
    }
    return null;
}

export { cdpClient };
