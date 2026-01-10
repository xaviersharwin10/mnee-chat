/**
 * MNEE Native Service
 * Handles native MNEE transactions using the official MNEE SDK on 1Sat Ordinals
 * Benefits: Gasless, instant, low-fee transfers
 */

import Mnee from '@mnee/ts-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Initialize MNEE SDK
const mneeConfig = {
    environment: process.env.MNEE_ENVIRONMENT || 'sandbox',
    apiKey: process.env.MNEE_API_KEY,
};

let mneeClient = null;

/**
 * Get or initialize MNEE client
 */
export function getMneeClient() {
    if (!mneeClient && mneeConfig.apiKey) {
        try {
            mneeClient = new Mnee(mneeConfig);
            console.log(`✅ MNEE SDK initialized (${mneeConfig.environment})`);
        } catch (error) {
            console.error('❌ Failed to initialize MNEE SDK:', error.message);
        }
    }
    return mneeClient;
}

/**
 * Check if MNEE is configured
 */
export function isMneeConfigured() {
    return !!process.env.MNEE_API_KEY;
}

// In-memory wallet storage for MNEE addresses
// Maps phone number -> { address, wif, mnemonic }
const mneeWallets = new Map();

// Track faucet usage (phone -> last request timestamp)
const faucetUsage = new Map();
const FAUCET_AMOUNT = 1; // 1 MNEE per faucet request
const FAUCET_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in ms
/**
 * Generate or retrieve MNEE wallet for a phone number
 * Uses DETERMINISTIC HD wallet derivation based on phone number
 */
export async function getOrCreateMneeWallet(phoneNumber) {
    const normalized = phoneNumber.replace(/[^\d]/g, '');

    // Check cache first
    if (mneeWallets.has(normalized)) {
        return mneeWallets.get(normalized);
    }

    const mnee = getMneeClient();
    if (!mnee) {
        throw new Error('MNEE SDK not configured');
    }

    try {
        // Generate DETERMINISTIC mnemonic from phone number
        // This ensures the same phone always gets the same wallet
        const crypto = await import('crypto');
        const salt = process.env.MNEE_WALLET_SALT || process.env.WALLET_SALT || 'squadwallet-mnee-v1';
        const seed = `${salt}-${normalized}`;

        // Create 128-bit entropy from phone hash (for 12-word mnemonic)
        const hash = crypto.createHash('sha256').update(seed).digest();
        const entropy = hash.slice(0, 16); // 128 bits = 12 words

        // Convert entropy to mnemonic using BIP39
        const bip39 = await import('@scure/bip39');
        const { wordlist } = await import('@scure/bip39/wordlists/english.js');
        const mnemonic = bip39.entropyToMnemonic(entropy, wordlist);

        // Create HD wallet using the SDK with required options
        const hdWallet = mnee.HDWallet(mnemonic, {
            derivationPath: "m/44'/236'/0'",  // BIP44 path for MNEE
        });

        // Derive first receive address
        const addressInfo = hdWallet.deriveAddress(0, false);

        const walletData = {
            address: addressInfo.address,
            wif: addressInfo.privateKey,
            path: addressInfo.path,
            phoneNumber: normalized,
            mnemonic: mnemonic,
        };

        // Cache the wallet
        mneeWallets.set(normalized, walletData);

        console.log(`✅ MNEE wallet created for ${normalized}: ${addressInfo.address}`);
        return walletData;
    } catch (error) {
        console.error('❌ MNEE wallet creation failed:', error.message);
        throw error;
    }
}

/**
 * Get MNEE balance for an address
 */
export async function getMneeBalance(address) {
    const mnee = getMneeClient();
    if (!mnee) {
        throw new Error('MNEE SDK not configured');
    }

    try {
        const balance = await mnee.balance(address);
        return {
            address: balance.address,
            amount: balance.decimalAmount || balance.amount / 100000, // Convert atomic to MNEE
            atomicAmount: balance.amount,
        };
    } catch (error) {
        console.error('Error getting MNEE balance:', error.message);
        throw error;
    }
}

/**
 * Transfer MNEE tokens (gasless!)
 * @param {string} fromPhoneNumber - Sender's phone number
 * @param {string} toAddress - Recipient's MNEE address
 * @param {number} amount - Amount in MNEE (not atomic units)
 */
export async function transferMnee(fromPhoneNumber, toAddress, amount) {
    const mnee = getMneeClient();
    if (!mnee) {
        throw new Error('MNEE SDK not configured');
    }

    // Get sender's wallet
    const senderWallet = await getOrCreateMneeWallet(fromPhoneNumber);

    // Check balance
    const balance = await getMneeBalance(senderWallet.address);
    if (balance.amount < amount) {
        throw new Error(`Insufficient MNEE balance. You have ${balance.amount.toFixed(5)} MNEE`);
    }

    try {
        console.log(`📤 Transferring ${amount} MNEE to ${toAddress}...`);

        const recipients = [{ address: toAddress, amount }];

        const response = await mnee.transfer(recipients, senderWallet.wif, {
            broadcast: true,
        });

        console.log(`✅ MNEE transfer submitted: Ticket ${response.ticketId}`);

        // Get transaction status
        if (response.ticketId) {
            const status = await mnee.getTxStatus(response.ticketId);
            console.log(`📋 Transaction status: ${status.status}, txid: ${status.tx_id || 'pending'}`);
            return {
                ticketId: response.ticketId,
                txId: status.tx_id,
                status: status.status,
            };
        }

        return response;
    } catch (error) {
        console.error('❌ MNEE transfer failed:', error.message);
        throw error;
    }
}

/**
 * Transfer MNEE between phone numbers
 */
export async function transferMneeBetweenPhones(fromPhoneNumber, toPhoneNumber, amount) {
    // Get or create recipient's wallet
    const recipientWallet = await getOrCreateMneeWallet(toPhoneNumber);

    // Execute transfer
    return await transferMnee(fromPhoneNumber, recipientWallet.address, amount);
}

/**
 * Request test MNEE from sponsor faucet
 * Sponsor wallet sends 1 MNEE to the user
 */
export async function requestMneeFaucet(phoneNumber) {
    const mnee = getMneeClient();
    if (!mnee) {
        throw new Error('MNEE SDK not configured');
    }

    // Check sponsor wallet is configured
    const sponsorWif = process.env.MNEE_SPONSOR_WIF;
    if (!sponsorWif) {
        throw new Error('Sponsor wallet not configured. Set MNEE_SPONSOR_WIF in .env');
    }

    const normalized = phoneNumber.replace(/[^\d]/g, '');

    // Check cooldown
    const lastRequest = faucetUsage.get(normalized);
    if (lastRequest) {
        const timeSinceLastRequest = Date.now() - lastRequest;
        if (timeSinceLastRequest < FAUCET_COOLDOWN) {
            const hoursRemaining = Math.ceil((FAUCET_COOLDOWN - timeSinceLastRequest) / (60 * 60 * 1000));
            throw new Error(`Faucet cooldown: Please wait ${hoursRemaining} hours before requesting again.`);
        }
    }

    // Get user's wallet
    const userWallet = await getOrCreateMneeWallet(phoneNumber);

    try {
        console.log(`💧 Sending ${FAUCET_AMOUNT} MNEE to ${userWallet.address}...`);

        // Transfer from sponsor to user
        const recipients = [{ address: userWallet.address, amount: FAUCET_AMOUNT }];
        const response = await mnee.transfer(recipients, sponsorWif, {
            broadcast: true,
        });

        // Record usage
        faucetUsage.set(normalized, Date.now());

        console.log(`✅ Faucet sent: ${response.ticketId}`);

        // Get transaction ID for WOC link
        let txId = null;
        if (response.ticketId) {
            try {
                const status = await mnee.getTxStatus(response.ticketId);
                txId = status.tx_id;
            } catch (e) {
                console.log('Could not get tx status:', e.message);
            }
        }

        return {
            success: true,
            amount: FAUCET_AMOUNT,
            ticketId: response.ticketId,
            txId: txId,
            address: userWallet.address,
        };
    } catch (error) {
        console.error('❌ Faucet request failed:', error.message);
        throw error;
    }
}

/**
 * Get wallet address for a phone number (for deposits)
 */
export async function getMneeWalletAddress(phoneNumber) {
    const wallet = await getOrCreateMneeWallet(phoneNumber);
    return wallet.address;
}

/**
 * Get transaction history for an address
 */
export async function getMneeTransactionHistory(address, limit = 10) {
    const mnee = getMneeClient();
    if (!mnee) {
        throw new Error('MNEE SDK not configured');
    }

    try {
        const history = await mnee.recentTxHistory(address, undefined, limit);
        return history;
    } catch (error) {
        console.error('Error getting transaction history:', error.message);
        throw error;
    }
}

export { mneeClient };
