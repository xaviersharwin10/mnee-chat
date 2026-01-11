import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { sendWhatsAppMessage } from './whatsappHandler.js';

dotenv.config();

// Contract ABI (minimal for keeper)
const SCHEDULED_PAYMENT_ABI = [
    'function executePayment(uint256 scheduleId) external',
    'function isPaymentDue(uint256 scheduleId) external view returns (bool)',
    'function getSchedule(uint256 scheduleId) external view returns (tuple(uint256 id, address sender, address recipient, uint256 amount, uint256 intervalSeconds, uint256 nextPaymentTime, uint256 remainingPayments, bool active, string note))',
    'function nextScheduleId() external view returns (uint256)',
    'event PaymentExecuted(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount)',
];

const SAVINGS_LOCK_ABI = [
    'function withdraw(uint256 lockId) external',
    'function canWithdraw(uint256 lockId) external view returns (bool)',
    'function getLock(uint256 lockId) external view returns (tuple(uint256 id, address owner, uint256 amount, uint256 unlockTime, bool withdrawn, string note))',
    'function nextLockId() external view returns (uint256)',
    'event LockWithdrawn(uint256 indexed id, address indexed owner, uint256 amount)',
];

const TOKEN_ABI = [
    'function decimals() external view returns (uint8)',
];

// Configuration
const rpcUrl = process.env.ETHEREUM_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
const SCHEDULED_PAYMENT_ADDRESS = process.env.SCHEDULED_PAYMENT_ADDRESS;
const SAVINGS_LOCK_ADDRESS = process.env.SAVINGS_LOCK_ADDRESS;
const TOKEN_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || '0x7650906b48d677109F3C20C6B3B89eB0b793c63b';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Check every 60 seconds
const KEEPER_INTERVAL_MS = 60 * 1000;

let isRunning = false;

/**
 * Start the scheduled payment keeper
 */
export function startKeeper() {
    if (!SCHEDULED_PAYMENT_ADDRESS) {
        console.log('⏰ Keeper: SCHEDULED_PAYMENT_ADDRESS not configured, skipping...');
        return;
    }

    if (!PRIVATE_KEY) {
        console.log('⏰ Keeper: PRIVATE_KEY not configured for gas sponsoring, skipping...');
        return;
    }

    console.log('⏰ Keeper: Starting scheduled payment keeper (every 60s)...');

    // Run immediately on start
    runKeeperCycle();

    // Then run every interval
    setInterval(() => {
        if (!isRunning) {
            runKeeperCycle();
        }
    }, KEEPER_INTERVAL_MS);
}

/**
 * Single keeper cycle - check and execute all due payments
 */
async function runKeeperCycle() {
    isRunning = true;

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = new ethers.Wallet(PRIVATE_KEY, provider);
        const scheduleContract = new ethers.Contract(SCHEDULED_PAYMENT_ADDRESS, SCHEDULED_PAYMENT_ABI, signer);
        const lockContract = SAVINGS_LOCK_ADDRESS ? new ethers.Contract(SAVINGS_LOCK_ADDRESS, SAVINGS_LOCK_ABI, signer) : null;
        const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);

        console.log(`⏰ Keeper: 🔍 Checking specific schedules & locks...`);

        let executedCount = 0;

        // 1. Process Scheduled Payments
        if (SCHEDULED_PAYMENT_ADDRESS) {
            const nextId = await scheduleContract.nextScheduleId();
            const maxId = Number(nextId) - 1;

            if (maxId >= 1) {
                const decimals = await tokenContract.decimals();

                // Check each schedule
                for (let id = 1; id <= maxId; id++) {
                    try {
                        const isDue = await scheduleContract.isPaymentDue(id);

                        if (isDue) {
                            console.log(`⏰ Keeper: Payment #${id} is due, executing...`);

                            const schedule = await scheduleContract.getSchedule(id);
                            const tx = await scheduleContract.executePayment(id);
                            await tx.wait();

                            const amountFormatted = ethers.formatUnits(schedule.amount, decimals);
                            console.log(`✅ Keeper: Executed payment #${id}: ${amountFormatted} MNEE`);

                            executedCount++;

                            // Notify Sender & Recipient
                            try {
                                const { getPhoneByAddress } = await import('./cdpService.js');
                                const senderPhone = getPhoneByAddress(schedule.sender);
                                const recipientPhone = getPhoneByAddress(schedule.recipient);

                                if (senderPhone) {
                                    await sendWhatsAppMessage(
                                        senderPhone,
                                        `✅ *Auto-Pay Executed*\n\n` +
                                        `Sent *${amountFormatted} MNEE* to +${recipientPhone || 'Recipient'}\n` +
                                        `Schedule #${id}\n\n` +
                                        `🔗 https://sepolia.etherscan.io/tx/${tx.hash}`
                                    );
                                }

                                if (recipientPhone) {
                                    await sendWhatsAppMessage(
                                        recipientPhone,
                                        `💰 *Payment Received*\n\n` +
                                        `You received *${amountFormatted} MNEE* from auto-pay #${id}!\n\n` +
                                        `🔗 https://sepolia.etherscan.io/tx/${tx.hash}`
                                    );
                                }
                            } catch (notifyError) {
                                console.log(`⚠️ Keeper: Notification failed: ${notifyError.message}`);
                            }
                        }
                    } catch (err) {
                        console.log(`⚠️ Keeper: Could not execute schedule #${id}: ${err.message}`);
                    }
                }
            }
        }

        // 2. Process Expired Savings Locks
        if (lockContract) {
            try {
                const nextLockId = await lockContract.nextLockId();
                const maxLockId = Number(nextLockId) - 1;

                if (maxLockId >= 1) {
                    const decimals = await tokenContract.decimals();

                    for (let id = 1; id <= maxLockId; id++) {
                        try {
                            // Check if valid to withdraw (time passed + not withdrawn)
                            const canWithdraw = await lockContract.canWithdraw(id);

                            if (canWithdraw) {
                                console.log(`🔓 Keeper: Lock #${id} is expired, auto-withdrawing...`);

                                const lock = await lockContract.getLock(id);
                                const tx = await lockContract.withdraw(id);
                                await tx.wait();

                                const amountFormatted = ethers.formatUnits(lock.amount, decimals);
                                console.log(`✅ Keeper: Withdrew lock #${id}: ${amountFormatted} MNEE`);
                                executedCount++;

                                // Try to notify user if we can mapping logic (skipped for now as we need address->phone map which is in memory or DB)
                            }
                        } catch (err) {
                            // Ignore "already withdrawn" if logic slipped through, but log others
                            if (!err.message.includes('withdrawn')) {
                                console.log(`⚠️ Keeper: Could not withdraw lock #${id}: ${err.message}`);
                            }
                        }
                    }
                }

            } catch (err) {
                console.log(`⚠️ Keeper: Error checking locks: ${err.message}`);
            }
        }

        if (executedCount > 0) {
            console.log(`⏰ Keeper: Executed ${executedCount} scheduled payments`);
        }

    } catch (error) {
        console.error('⏰ Keeper: Error in cycle:', error.message);
    }

    isRunning = false;
}

/**
 * Manually trigger a keeper run (for testing)
 */
export async function triggerKeeperRun() {
    if (isRunning) {
        return { status: 'already_running' };
    }
    await runKeeperCycle();
    return { status: 'completed' };
}
