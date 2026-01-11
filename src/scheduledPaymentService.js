import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { getOrCreateWallet } from './walletService.js';
import { isCdpConfigured, sendTransactionViaCdp } from './cdpService.js';

dotenv.config();

// ScheduledPayment Contract ABI
const SCHEDULED_PAYMENT_ABI = [
    'function createSchedule(address recipient, uint256 amount, uint256 intervalSeconds, uint256 numPayments, string note) external returns (uint256)',
    'function executePayment(uint256 scheduleId) external',
    'function cancelSchedule(uint256 scheduleId) external',
    'function getSchedule(uint256 scheduleId) external view returns (tuple(uint256 id, address sender, address recipient, uint256 amount, uint256 intervalSeconds, uint256 nextPaymentTime, uint256 remainingPayments, bool active, string note))',
    'function getActiveSchedulesBySender(address sender) external view returns (tuple(uint256 id, address sender, address recipient, uint256 amount, uint256 intervalSeconds, uint256 nextPaymentTime, uint256 remainingPayments, bool active, string note)[])',
    'function isPaymentDue(uint256 scheduleId) external view returns (bool)',
    'event ScheduleCreated(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount, uint256 intervalSeconds, string note)',
    'event PaymentExecuted(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount)',
];

// Token ABI
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
];

// Provider setup
const rpcUrl = process.env.ETHEREUM_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Contract addresses
const SCHEDULED_PAYMENT_ADDRESS = process.env.SCHEDULED_PAYMENT_ADDRESS;
const TOKEN_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || '0x7650906b48d677109F3C20C6B3B89eB0b793c63b';

// Interfaces for encoding
const scheduledPaymentInterface = new ethers.Interface(SCHEDULED_PAYMENT_ABI);
const tokenInterface = new ethers.Interface(ERC20_ABI);

/**
 * Check if Scheduled Payment is configured
 */
export function isScheduledPaymentConfigured() {
    return !!SCHEDULED_PAYMENT_ADDRESS;
}

/**
 * Get contract instance (read-only)
 */
function getScheduledPaymentContract() {
    if (!SCHEDULED_PAYMENT_ADDRESS) {
        throw new Error('SCHEDULED_PAYMENT_ADDRESS not configured');
    }
    return new ethers.Contract(SCHEDULED_PAYMENT_ADDRESS, SCHEDULED_PAYMENT_ABI, provider);
}

function getTokenContract() {
    return new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
}

/**
 * Parse interval string to seconds
 */
import { parseDuration } from './utils/timeParser.js';

/**
 * Parse interval string to seconds
 */
export function parseInterval(intervalStr) {
    const result = parseDuration(intervalStr);
    if (!result.valid) {
        throw new Error('Invalid interval format. Use: daily, weekly, or "every X minutes"');
    }
    return result.seconds;
}

/**
 * Format interval in human readable form
 */
function formatInterval(seconds) {
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks`;
    return `${Math.floor(seconds / 2592000)} months`;
}

/**
 * Create a scheduled payment using CDP
 */
export async function createScheduledPayment(senderPhone, recipientAddress, amount, intervalStr, numPayments = 0, note = '') {
    const tokenContract = getTokenContract();
    const decimals = await tokenContract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);
    const { valid, seconds: intervalSeconds, interval: formattedInterval } = parseDuration(intervalStr);
    if (!valid) throw new Error('Invalid interval');

    // Approve unlimited for recurring payments via CDP
    console.log('📝 Approving token spend for recurring payments via CDP...');
    const maxApproval = ethers.MaxUint256;
    const approveData = tokenInterface.encodeFunctionData('approve', [
        SCHEDULED_PAYMENT_ADDRESS,
        maxApproval
    ]);
    await sendTransactionViaCdp(senderPhone, TOKEN_ADDRESS, approveData, 'ethereum-sepolia');

    console.log(`⏰ Creating schedule: ${amount} MNEE ${intervalStr} via CDP...`);

    const createData = scheduledPaymentInterface.encodeFunctionData('createSchedule', [
        recipientAddress,
        amountWei,
        intervalSeconds,
        numPayments,
        note
    ]);
    const result = await sendTransactionViaCdp(
        senderPhone,
        SCHEDULED_PAYMENT_ADDRESS,
        createData,
        'ethereum-sepolia'
    );

    console.log(`✅ Schedule created: ${result.hash}`);

    return {
        scheduleId: 'pending', // Would need event parsing for actual ID
        txHash: result.hash,
        amount,
        txHash: result.hash,
        amount,
        interval: formattedInterval,
        numPayments: numPayments || 'unlimited',
    };
}

/**
 * Execute a due payment (called by keeper/cron)
 * Note: This uses the sponsor wallet, not CDP
 */
export async function executeScheduledPayment(scheduleId) {
    const sponsorKey = process.env.PRIVATE_KEY;
    if (!sponsorKey) throw new Error('No sponsor key for executing payments');

    const signer = new ethers.Wallet(sponsorKey, provider);
    const contract = getScheduledPaymentContract();

    // Check if payment is due
    const isDue = await contract.isPaymentDue(scheduleId);
    if (!isDue) throw new Error('Payment not due yet');

    console.log(`⏰ Executing payment for schedule #${scheduleId}...`);

    // Use sponsor wallet for execution (not CDP)
    const contractWithSigner = new ethers.Contract(
        SCHEDULED_PAYMENT_ADDRESS,
        SCHEDULED_PAYMENT_ABI,
        signer
    );
    const tx = await contractWithSigner.executePayment(scheduleId);
    const receipt = await tx.wait();

    console.log(`✅ Payment executed: ${receipt.hash}`);

    return { scheduleId, txHash: receipt.hash };
}

/**
 * Cancel a scheduled payment using CDP
 */
export async function cancelScheduledPayment(senderPhone, scheduleId) {
    console.log(`❌ Cancelling schedule #${scheduleId} via CDP...`);

    const cancelData = scheduledPaymentInterface.encodeFunctionData('cancelSchedule', [scheduleId]);
    const result = await sendTransactionViaCdp(
        senderPhone,
        SCHEDULED_PAYMENT_ADDRESS,
        cancelData,
        'ethereum-sepolia'
    );

    console.log(`✅ Schedule cancelled`);

    return { scheduleId, txHash: result.hash };
}

/**
 * Get active schedules for a user
 */
export async function getActiveSchedules(senderPhone) {
    const wallet = await getOrCreateWallet(senderPhone);
    const contract = getScheduledPaymentContract();
    const tokenContract = getTokenContract();

    const decimals = await tokenContract.decimals();
    const schedules = await contract.getActiveSchedulesBySender(wallet.address);

    return schedules.map(s => ({
        id: s.id.toString(),
        recipient: s.recipient,
        amount: ethers.formatUnits(s.amount, decimals),
        interval: formatInterval(Number(s.intervalSeconds)),
        nextPayment: new Date(Number(s.nextPaymentTime) * 1000),
        remainingPayments: s.remainingPayments.toString() === '0' ? 'unlimited' : s.remainingPayments.toString(),
        note: s.note,
    }));
}
