import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { getWalletSigner } from './walletService.js';
import { isCdpConfigured, sendTokenViaCdp, getOrCreateCdpWallet } from './cdpService.js';

dotenv.config();

// Token Contract Address (MockMNEE on Sepolia for testing, or real MNEE on mainnet)
const TOKEN_CONTRACT_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || process.env.MNEE_CONTRACT_ADDRESS || '0x7650906b48d677109F3C20C6B3B89eB0b793c63b';

// ERC20 ABI (minimal for transfer and balance)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

// Provider setup (Sepolia testnet for testing)
const rpcUrl = process.env.ETHEREUM_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Gas sponsor wallet (for sponsoring user transactions)
let gasSponsorWallet = null;
if (process.env.PRIVATE_KEY) {
  gasSponsorWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`⛽ Gas sponsor wallet: ${gasSponsorWallet.address}`);
}

// Virtual balance tracking for custodial MVP
// In production, this would be stored in a database
const userVirtualBalances = new Map(); // phoneNumber -> balance
const INITIAL_DEMO_BALANCE = 100; // Give new users 100 tokens for demo

/**
 * Get user's virtual balance (for custodial MVP)
 */
export function getVirtualBalance(phoneNumber) {
  const normalized = phoneNumber.replace(/[^\d]/g, '');
  if (!userVirtualBalances.has(normalized)) {
    // Credit initial demo balance for new users
    userVirtualBalances.set(normalized, INITIAL_DEMO_BALANCE);
    console.log(`💰 Credited ${INITIAL_DEMO_BALANCE} tokens to new user ${normalized}`);
  }
  return userVirtualBalances.get(normalized);
}

/**
 * Update user's virtual balance
 */
function updateVirtualBalance(phoneNumber, newBalance) {
  const normalized = phoneNumber.replace(/[^\d]/g, '');
  userVirtualBalances.set(normalized, newBalance);
}

/**
 * Credit tokens to a user (for admin/testing)
 */
export function creditUserBalance(phoneNumber, amount) {
  const normalized = phoneNumber.replace(/[^\d]/g, '');
  const current = getVirtualBalance(normalized);
  userVirtualBalances.set(normalized, current + amount);
  console.log(`💰 Credited ${amount} tokens to ${normalized}. New balance: ${current + amount}`);
  return current + amount;
}

/**
 * Dispense Faucet tokens (100 MNEE) to a user via on-chain transfer (or virtual if no wallet)
 * @param {string} recipient - Phone number OR Ethereum address (0x...)
 */
export async function dispenseFaucet(recipient) {
  try {
    let toAddress;

    // Check if recipient is already an address
    if (recipient.startsWith('0x') && recipient.length === 42) {
      toAddress = recipient;
      console.log(`🚰 Faucet requested for Address: ${toAddress}`);
    } else {
      // It's a phone number, resolve address
      const { getWalletAddress } = await import('./walletService.js');
      toAddress = await getWalletAddress(recipient);
      console.log(`🚰 Faucet requested for Phone ${recipient} -> ${toAddress}`);
    }

    // If we have a gas sponsor wallet (deployer), use it to fund the user
    if (gasSponsorWallet) {
      const contract = getMNEEContract(gasSponsorWallet);
      const decimals = await contract.decimals();
      const amountWei = ethers.parseUnits('100', decimals);

      const tx = await contract.transfer(toAddress, amountWei);
      console.log(`✅ Faucet TX: ${tx.hash}`);

      // Also send some ETH for gas if on testnet (optional, requires funded deployer)
      // await gasSponsorWallet.sendTransaction({ to: toAddress, value: ethers.parseEther("0.001") });

      return tx.hash;
    } else {
      console.warn('⚠️ No gas sponsor wallet configured for Faucet. Crediting virtual balance.');
      // Only credit virtual balance if identified by phone
      if (!recipient.startsWith('0x')) {
        return creditUserBalance(recipient, 100);
      } else {
        throw new Error('Cannot credit virtual balance to an address. Faucet requires sponsor wallet.');
      }
    }
  } catch (error) {
    console.error('Faucet error:', error);
    // Fallback to virtual balance for reliability during demo (only for phone numbers)
    if (!recipient.startsWith('0x')) {
      return creditUserBalance(recipient, 100);
    }
    throw error;
  }
}

/**
 * Get token contract instance (MockMNEE on Sepolia for testing)
 */
function getMNEEContract(signerOrProvider) {
  return new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, signerOrProvider);
}

/**
 * Get MNEE balance for an address
 */
export async function getBalance(address) {
  try {
    const contract = getMNEEContract(provider);
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    const formattedBalance = ethers.formatUnits(balance, decimals);
    return parseFloat(formattedBalance).toFixed(6);
  } catch (error) {
    console.error('Error getting balance:', error);
    throw new Error(`Failed to get balance: ${error.message}`);
  }
}

/**
 * Transfer tokens - uses CDP for secure transaction signing
 */
export async function transferMNEE(fromPhoneNumber, toAddress, amount) {
  try {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Import CDP service
    const { isCdpConfigured, sendTokenViaCdp, getOrCreateCdpWallet } = await import('./cdpService.js');
    const { getOrCreateWallet } = await import('./walletService.js');

    // Get sender's wallet
    const senderWallet = await getOrCreateWallet(fromPhoneNumber);

    // Get token contract for balance check (read-only)
    const contract = getMNEEContract(provider);
    const decimals = await contract.decimals();

    // Check sender's on-chain balance
    const balance = await contract.balanceOf(senderWallet.address);
    const formattedBalance = ethers.formatUnits(balance, decimals);

    if (parseFloat(formattedBalance) < parseFloat(amount)) {
      throw new Error(`Insufficient balance. You have ${formattedBalance} MNEE.`);
    }

    console.log(`📤 Transferring ${amount} MNEE to ${toAddress} via CDP...`);

    // Use CDP for signing if configured
    if (isCdpConfigured()) {
      const txHash = await sendTokenViaCdp(
        fromPhoneNumber,
        toAddress,
        TOKEN_CONTRACT_ADDRESS,
        amount.toString(),
        Number(decimals),
        'ethereum-sepolia'
      );
      console.log(`✅ CDP Transfer confirmed: ${txHash}`);
      return txHash;
    }

    // Fallback to deterministic wallet (only if CDP not configured)
    return await transferViaDeterministicWallet(fromPhoneNumber, toAddress, amount);
  } catch (error) {
    console.error('Error transferring tokens:', error);
    throw error;
  }
}

/**
 * Transfer tokens using deterministic wallet (FALLBACK only)
 */
async function transferViaDeterministicWallet(fromPhoneNumber, toAddress, amount) {
  // Get sender's wallet signer
  const signer = await getWalletSigner(fromPhoneNumber, provider);

  // Get token contract with signer
  const contract = getMNEEContract(signer);
  const decimals = await contract.decimals();

  // Parse amount to wei
  const amountWei = ethers.parseUnits(amount.toString(), decimals);

  console.log(`📤 Transferring ${amount} tokens to ${toAddress} (deterministic wallet)...`);

  // Execute transfer
  const tx = await contract.transfer(toAddress, amountWei);
  console.log(`⏳ Transaction submitted: ${tx.hash}`);

  // Wait for confirmation
  const receipt = await tx.wait();
  console.log(`✅ Transfer confirmed: ${receipt.hash}`);

  return receipt.hash;
}

/**
 * Transfer tokens via Coinbase CDP (user's wallet signs the transaction)
 */
async function transferViaCdp(fromPhoneNumber, toAddress, amount) {
  console.log(`🔐 Using CDP to transfer ${amount} tokens from ${fromPhoneNumber}...`);

  // Get token decimals
  const contract = getMNEEContract(provider);
  const decimals = await contract.decimals();

  // Check sender's on-chain balance
  const senderWallet = await getOrCreateCdpWallet(fromPhoneNumber);
  const balance = await contract.balanceOf(senderWallet.address);
  const formattedBalance = ethers.formatUnits(balance, decimals);

  if (parseFloat(formattedBalance) < parseFloat(amount)) {
    throw new Error(`Insufficient balance. You have ${formattedBalance} tokens on-chain.`);
  }

  // Send via CDP (CDP handles signing)
  const txHash = await sendTokenViaCdp(
    fromPhoneNumber,
    toAddress,
    TOKEN_CONTRACT_ADDRESS,
    amount,
    Number(decimals),
    'ethereum-sepolia' // Change to 'ethereum' for mainnet
  );

  console.log(`✅ CDP transaction sent: ${txHash}`);
  return txHash;
}

/**
 * Transfer tokens via sponsor wallet (custodial fallback)
 */
async function transferViaSponsor(fromPhoneNumber, toAddress, amount) {
  // Check sender's virtual balance
  const senderBalance = getVirtualBalance(fromPhoneNumber);
  if (senderBalance < amount) {
    throw new Error(`Insufficient balance. You have ${senderBalance} tokens`);
  }

  // Check if sponsor wallet is configured
  if (!gasSponsorWallet) {
    throw new Error('Sponsor wallet not configured. Set PRIVATE_KEY in .env');
  }

  // Get contract with sponsor wallet
  const contract = getMNEEContract(gasSponsorWallet);
  const decimals = await contract.decimals();
  const amountWei = ethers.parseUnits(amount.toString(), decimals);

  // Check sponsor wallet has enough tokens
  const sponsorBalance = await contract.balanceOf(gasSponsorWallet.address);
  if (sponsorBalance < amountWei) {
    throw new Error(`Sponsor wallet has insufficient tokens.`);
  }

  console.log(`📤 Transferring ${amount} tokens from sponsor to ${toAddress}...`);

  // Execute transfer from sponsor wallet
  const tx = await contract.transfer(toAddress, amountWei);
  console.log(`⏳ Transaction submitted: ${tx.hash}`);

  // Wait for confirmation
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed: ${receipt.hash}`);

  // Update virtual balances
  const normalizedFrom = fromPhoneNumber.replace(/[^\d]/g, '');
  updateVirtualBalance(normalizedFrom, senderBalance - amount);

  return receipt.hash;
}

/**
 * Transfer tokens between phone numbers
 * With CDP: Real on-chain transfer from sender's CDP wallet
 * Without CDP: Virtual balance + sponsor wallet transfer
 */
export async function transferBetweenPhones(fromPhoneNumber, toPhoneNumber, amount) {
  try {
    // Get recipient's wallet address
    const { getWalletAddress } = await import('./walletService.js');
    const toAddress = await getWalletAddress(toPhoneNumber);

    // Execute the transfer
    const txHash = await transferMNEE(fromPhoneNumber, toAddress, amount);

    // Only update virtual balances if NOT using CDP
    if (!isCdpConfigured()) {
      const recipientBalance = getVirtualBalance(toPhoneNumber);
      const normalizedTo = toPhoneNumber.replace(/[^\d]/g, '');
      updateVirtualBalance(normalizedTo, recipientBalance + amount);
      console.log(`💰 Credited ${amount} to recipient ${toPhoneNumber}`);
    }

    return txHash;
  } catch (error) {
    console.error('Error in phone-to-phone transfer:', error);
    throw error;
  }
}

/**
 * Transfer with gas sponsorship
 * Uses a meta-transaction pattern where the sponsor pays gas
 */
async function transferWithGasSponsorship(senderSigner, toAddress, amountWei, contract) {
  // For MVP, we'll use a simple approach:
  // The sponsor wallet sends on behalf of the user after verifying they have balance

  // Check sender has enough balance
  const balance = await contract.balanceOf(senderSigner.address);
  if (balance < amountWei) {
    throw new Error('Insufficient balance');
  }

  // For a true gasless experience, you'd implement:
  // 1. User signs a message (off-chain)
  // 2. Sponsor wallet submits transaction with user's signature
  // 3. Smart contract verifies signature and executes

  // For MVP, we'll do a simpler approach: direct transfer
  // User still needs ETH for gas, but we can optimize this later

  return await contract.transfer(toAddress, amountWei);
}

/**
 * Approve spending for a spender address
 */
export async function approveSpending(phoneNumber, spenderAddress, amount) {
  try {
    const signer = await getWalletSigner(phoneNumber, provider);
    const contract = getMNEEContract(signer);

    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    const tx = await contract.approve(spenderAddress, amountWei);
    await tx.wait();

    return tx.hash;
  } catch (error) {
    console.error('Error approving spending:', error);
    throw error;
  }
}

/**
 * Get token info
 */
export async function getTokenInfo() {
  try {
    const contract = getMNEEContract(provider);
    const [symbol, decimals] = await Promise.all([
      contract.symbol(),
      contract.decimals(),
    ]);

    return {
      address: TOKEN_CONTRACT_ADDRESS,
      symbol,
      decimals: Number(decimals),
    };
  } catch (error) {
    console.error('Error getting token info:', error);
    throw error;
  }
}

