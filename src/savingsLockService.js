import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { getOrCreateWallet } from './walletService.js';
import { isCdpConfigured, sendTransactionViaCdp } from './cdpService.js';

dotenv.config();

// SavingsLock Contract ABI
const SAVINGS_LOCK_ABI = [
    'function createLock(uint256 amount, uint256 durationSeconds, string note) external returns (uint256)',
    'function withdraw(uint256 lockId) external',
    'function getLock(uint256 lockId) external view returns (tuple(uint256 id, address owner, uint256 amount, uint256 unlockTime, bool withdrawn, string note))',
    'function getActiveLocks(address owner) external view returns (tuple(uint256 id, address owner, uint256 amount, uint256 unlockTime, bool withdrawn, string note)[])',
    'function canWithdraw(uint256 lockId) external view returns (bool)',
    'function getTimeRemaining(uint256 lockId) external view returns (uint256)',
    'event LockCreated(uint256 indexed id, address indexed owner, uint256 amount, uint256 unlockTime, string note)',
    'event LockWithdrawn(uint256 indexed id, address indexed owner, uint256 amount)',
];

// Token ABI for approvals
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
];

// Provider setup
const rpcUrl = process.env.ETHEREUM_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Contract addresses
const SAVINGS_LOCK_ADDRESS = process.env.SAVINGS_LOCK_ADDRESS;
const TOKEN_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9';

// Interfaces for encoding
const savingsLockInterface = new ethers.Interface(SAVINGS_LOCK_ABI);
const tokenInterface = new ethers.Interface(ERC20_ABI);

/**
 * Check if Savings Lock is configured
 */
export function isSavingsLockConfigured() {
    return !!SAVINGS_LOCK_ADDRESS;
}

/**
 * Get SavingsLock contract (read-only)
 */
function getSavingsLockContract() {
    if (!SAVINGS_LOCK_ADDRESS) {
        throw new Error('SAVINGS_LOCK_ADDRESS not configured in .env');
    }
    return new ethers.Contract(SAVINGS_LOCK_ADDRESS, SAVINGS_LOCK_ABI, provider);
}

/**
 * Get Token contract (read-only)
 */
function getTokenContract() {
    return new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
}

import { parseDuration } from './utils/timeParser.js';

/**
 * Format duration in human readable form
 */
function formatDuration(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
}

/**
 * Create a savings lock using CDP
 */
export async function createSavingsLock(phoneNumber, amount, durationStr, note = '') {
    const tokenContract = getTokenContract();
    const decimals = await tokenContract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    const { valid, seconds: durationSeconds, interval: formattedDuration } = parseDuration(durationStr);
    if (!valid) throw new Error('Invalid duration format (e.g. 10 minutes, 1 week)');

    // Approve token spend via CDP
    console.log('📝 Approving token spend via CDP...');
    const approveData = tokenInterface.encodeFunctionData('approve', [
        SAVINGS_LOCK_ADDRESS,
        amountWei
    ]);
    await sendTransactionViaCdp(phoneNumber, TOKEN_ADDRESS, approveData, 'ethereum-sepolia');

    console.log(`🔒 Creating lock: ${amount} MNEE for ${formattedDuration} via CDP...`);

    // Create lock via CDP
    const lockData = savingsLockInterface.encodeFunctionData('createLock', [
        amountWei,
        durationSeconds,
        note
    ]);
    const result = await sendTransactionViaCdp(
        phoneNumber,
        SAVINGS_LOCK_ADDRESS,
        lockData,
        'ethereum-sepolia'
    );

    console.log(`✅ Lock created: ${result.hash}`);

    return {
        lockId: 'pending', // Would need event parsing for actual ID
        txHash: result.hash,
        amount,
        txHash: result.hash,
        amount,
        duration: formattedDuration,
        unlockTime: new Date(Date.now() + durationSeconds * 1000),
    };
}

/**
 * Withdraw from an expired lock using CDP
 */
export async function withdrawSavingsLock(phoneNumber, lockId) {
    const contract = getSavingsLockContract();
    const tokenContract = getTokenContract();

    // Check if can withdraw
    const canWithdraw = await contract.canWithdraw(lockId);
    if (!canWithdraw) {
        const timeRemaining = await contract.getTimeRemaining(lockId);
        if (timeRemaining > 0) {
            throw new Error(`Lock not expired yet. ${formatDuration(Number(timeRemaining))} remaining.`);
        }
        throw new Error('Lock already withdrawn or does not exist.');
    }

    console.log(`🔓 Withdrawing lock #${lockId} via CDP...`);

    const withdrawData = savingsLockInterface.encodeFunctionData('withdraw', [lockId]);
    const result = await sendTransactionViaCdp(
        phoneNumber,
        SAVINGS_LOCK_ADDRESS,
        withdrawData,
        'ethereum-sepolia'
    );

    // Get amount from lock details
    const lock = await contract.getLock(lockId);
    const decimals = await tokenContract.decimals();
    const amountFormatted = ethers.formatUnits(lock.amount, decimals);

    console.log(`✅ Lock #${lockId} withdrawn: ${amountFormatted} MNEE`);

    return {
        lockId,
        txHash: result.hash,
        amount: amountFormatted,
    };
}

/**
 * Get active locks for a user
 */
export async function getActiveSavingsLocks(phoneNumber) {
    const wallet = await getOrCreateWallet(phoneNumber);
    const contract = getSavingsLockContract();
    const tokenContract = getTokenContract();

    const decimals = await tokenContract.decimals();
    const locks = await contract.getActiveLocks(wallet.address);

    return locks.map(lock => {
        const timeRemaining = Number(lock.unlockTime) - Math.floor(Date.now() / 1000);
        return {
            id: lock.id.toString(),
            amount: ethers.formatUnits(lock.amount, decimals),
            unlockTime: new Date(Number(lock.unlockTime) * 1000),
            timeRemaining: timeRemaining > 0 ? formatDuration(timeRemaining) : 'Ready to withdraw!',
            canWithdraw: timeRemaining <= 0,
            note: lock.note,
        };
    });
}
