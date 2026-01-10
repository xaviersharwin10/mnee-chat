import { ethers } from 'ethers';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
import { isCdpConfigured, getOrCreateCdpWallet } from './cdpService.js';

dotenv.config();

// In-memory wallet storage (in production, use a database)
const walletCache = new Map();

/**
 * Generate a deterministic wallet from phone number
 * This creates a non-custodial wallet that can be recovered from phone number
 * FALLBACK: Used when CDP is not configured
 */
function generateWalletFromPhone(phoneNumber) {
  // Normalize phone number (remove +, spaces, etc.)
  const normalized = phoneNumber.replace(/[^\d]/g, '');

  // Create deterministic private key from phone number
  // In production, you'd use a more secure method with proper key derivation
  const seed = `squadwallet-${normalized}-${process.env.WALLET_SALT || 'default-salt'}`;
  const hash = createHash('sha256').update(seed).digest('hex');

  // Create wallet from private key (ethers v6 needs hex string with 0x prefix)
  const privateKey = `0x${hash}`;
  const wallet = new ethers.Wallet(privateKey);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    phoneNumber: normalized,
    isCdp: false,
  };
}

/**
 * Get or create wallet for a phone number
 * Uses CDP as PRIMARY wallet provider (secure key management)
 * Falls back to deterministic only if CDP is not configured
 */
export async function getOrCreateWallet(phoneNumber) {
  try {
    // Normalize phone number
    const normalized = phoneNumber.replace(/[^\d]/g, '');

    // Check cache first
    if (walletCache.has(normalized)) {
      return walletCache.get(normalized);
    }

    // Use CDP if configured (preferred for security)
    if (isCdpConfigured()) {
      console.log(`📱 Creating CDP wallet for: ${normalized}`);
      const cdpWallet = await getOrCreateCdpWallet(normalized);

      const wallet = {
        address: cdpWallet.address,
        phoneNumber: normalized,
        isCdp: true,
      };

      walletCache.set(normalized, wallet);
      console.log(`✅ CDP Wallet for ${normalized}: ${wallet.address}`);
      return wallet;
    }

    // Fallback to deterministic wallet if CDP not configured
    console.log(`📱 CDP not configured, using deterministic wallet for: ${normalized}`);
    const wallet = generateWalletFromPhone(normalized);

    // Cache the wallet
    walletCache.set(normalized, wallet);

    console.log(`✅ Deterministic Wallet for ${normalized}: ${wallet.address}`);
    return wallet;
  } catch (error) {
    console.error('Error getting/creating wallet:', error);
    throw error;
  }
}

/**
 * Create wallet using Coinbase CDP (Cloud Developer Platform)
 * This is a placeholder - implement based on Coinbase CDP SDK documentation
 */
async function createWalletWithCoinbaseCDP(phoneNumber) {
  // TODO: Implement Coinbase CDP integration
  // Example structure:
  // const coinbaseClient = new CoinbaseClient({
  //   apiKey: process.env.COINBASE_API_KEY,
  //   apiSecret: process.env.COINBASE_API_SECRET,
  // });
  // const wallet = await coinbaseClient.wallets.create({
  //   userId: phoneNumber,
  //   network: 'ethereum',
  // });

  console.log('Coinbase CDP integration not yet implemented, using deterministic wallet');
  return generateWalletFromPhone(phoneNumber);
}

/**
 * Create wallet using Privy
 * This is a placeholder - implement based on Privy SDK documentation
 */
async function createWalletWithPrivy(phoneNumber) {
  // TODO: Implement Privy integration
  // Example structure:
  // const privyClient = new PrivyClient({
  //   appId: process.env.PRIVY_APP_ID,
  //   appSecret: process.env.PRIVY_APP_SECRET,
  // });
  // const wallet = await privyClient.wallets.create({
  //   userId: phoneNumber,
  // });

  console.log('Privy integration not yet implemented, using deterministic wallet');
  return generateWalletFromPhone(phoneNumber);
}

/**
 * Get wallet address for a phone number
 */
export async function getWalletAddress(phoneNumber) {
  const wallet = await getOrCreateWallet(phoneNumber);
  return wallet.address;
}

/**
 * Get wallet signer for transactions
 */
export async function getWalletSigner(phoneNumber, provider) {
  const wallet = await getOrCreateWallet(phoneNumber);
  return new ethers.Wallet(wallet.privateKey, provider);
}

/**
 * Check if wallet exists for phone number
 */
export async function walletExists(phoneNumber) {
  const normalized = phoneNumber.replace(/[^\d]/g, '');
  return walletCache.has(normalized);
}

