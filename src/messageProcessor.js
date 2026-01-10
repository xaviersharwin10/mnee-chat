import { sendWhatsAppMessage, sendContentMessage } from './whatsappHandler.js';
import { getHelpMenuSid } from './contentService.js';
import { getOrCreateWallet } from './walletService.js';
import { getBalance, transferMNEE } from './mneeService.js';
import { parseCommand } from './commandParser.js';
import { formatErrorMessage } from './utils/errorHandler.js';
import { checkRateLimit, getRemainingRequests } from './utils/rateLimiter.js';
import {
  isPaymentRequestConfigured,
  createPaymentRequest,
  fulfillPaymentRequest,
  cancelPaymentRequest,
  getPendingRequestsForPayer,
  getRequestsForRequester,
} from './paymentRequestService.js';
import {
  isSavingsLockConfigured,
  createSavingsLock,
  withdrawSavingsLock,
  getActiveSavingsLocks,
} from './savingsLockService.js';
import {
  isScheduledPaymentConfigured,
  createScheduledPayment,
  cancelScheduledPayment,
  getActiveSchedules,
} from './scheduledPaymentService.js';

// Track new users for welcome message
const seenUsers = new Set();

/**
 * Process incoming WhatsApp message
 */
export async function processMessage({ from, to, message, messageSid, profileName }) {
  try {
    // Check rate limit
    if (!checkRateLimit(from)) {
      return await sendWhatsAppMessage(
        from,
        `⏳ *Slow down!*\nPlease wait a moment before sending more commands.`
      );
    }

    // Welcome new users
    const isNewUser = !seenUsers.has(from);
    if (isNewUser) {
      seenUsers.add(from);
      await sendWelcomeMessage(from, profileName);
      return;
    }

    // Parse command
    let command = parseCommand(message);

    // AI fallback for natural language
    if (!command) {
      const { isAiParsingEnabled, parseNaturalLanguage, resolveNameToPhone } = await import('./aiParser.js');
      if (isAiParsingEnabled()) {
        const aiCommand = await parseNaturalLanguage(message);
        if (aiCommand) {
          if (aiCommand.recipient && !/^\d+$/.test(aiCommand.recipient)) {
            const phone = resolveNameToPhone(from, aiCommand.recipient);
            if (phone) {
              aiCommand.recipient = phone;
            } else {
              return await sendWhatsAppMessage(
                from,
                `🤖 Got it! You want to send *${aiCommand.amount} MNEE* to "${aiCommand.recipient}".\n\n` +
                `But I need their phone number.\n` +
                `Try: *send ${aiCommand.amount} to +91...*`
              );
            }
          }
          command = aiCommand;
        }
      }
    }

    if (!command) {
      return await sendHelpMessage(from);
    }

    // Route to handlers
    switch (command.type) {
      case 'HELP':
        return await sendHelpMessage(from);

      case 'SEND_HELP':
        return await sendWhatsAppMessage(
          from,
          `💸 *How to Send Money*\n\n` +
          `Type: *send [amount] to [number/username]*\n` +
          `Example: _send 10 to +919876543210_`
        );

      case 'SEND':
      case 'PAY':
        return await handleSendCommand(from, command, profileName);

      case 'BALANCE':
        return await handleBalanceCommand(from);

      case 'DEPOSIT_INFO':
        return await handleDepositInfoCommand(from);

      case 'ADDRESS':
        return await handleAddressCommand(from);

      case 'CREATE_REQUEST':
        return await handleCreateRequestCommand(from, command);
      case 'PAY_REQUEST':
        return await handlePayRequestCommand(from, command);
      case 'MY_REQUESTS':
        return await handleMyRequestsCommand(from);
      case 'CANCEL_REQUEST':
        return await handleCancelRequestCommand(from, command);

      case 'CREATE_LOCK':
        return await handleCreateLockCommand(from, command);
      case 'UNLOCK':
        return await handleUnlockCommand(from, command);
      case 'MY_LOCKS':
        return await handleMyLocksCommand(from);

      case 'CREATE_SCHEDULE':
        return await handleCreateScheduleCommand(from, command);
      case 'CANCEL_SCHEDULE':
        return await handleCancelScheduleCommand(from, command);
      case 'MY_SCHEDULES':
        return await handleMySchedulesCommand(from);

      default:
        return await sendHelpMessage(from);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await sendWhatsAppMessage(
      from,
      `❌ *Oops!* Something went wrong.\n\n` +
      `_${formatErrorMessage(error)}_\n\n` +
      `Try again or type *help* for commands.`
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// WELCOME & HELP
// ═══════════════════════════════════════════════════════════════

async function sendWelcomeMessage(to, profileName) {
  const name = profileName?.split(' ')[0] || 'there';
  const wallet = await getOrCreateWallet(to);

  const msg = `👋 *Hey ${name}! Welcome to MNEEChat*\n\n` +
    `I just created your personal crypto wallet! 🎉\n\n` +
    `💳 *Your Wallet Address:*\n` +
    `\`${wallet.address}\`\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✨ *What you can do:*\n\n` +
    `💸 *Send Money*\n` +
    `   "send 10 to +919876543210"\n\n` +
    `📩 *Request Payment*\n` +
    `   "request 50 from +91..."\n\n` +
    `🔒 *Save Money*\n` +
    `   "lock 100 for 7 days"\n\n` +
    `⏰ *Auto-Pay*\n` +
    `   "schedule 25 to +91... weekly"\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Type *help* anytime for all commands!\n\n` +
    `⚡ Powered by MNEE`;

  await sendWhatsAppMessage(to, msg);
}

async function sendHelpMessage(to) {
  const msg = `📚 *MNEEChat Commands*\n\n` +
    `━━━ 💰 *Wallet* ━━━\n` +
    `• *balance* - Check MNEE balance\n` +
    `• *address* - Your wallet address\n` +
    `• *deposit* - How to add funds\n\n` +
    `━━━ 💸 *Transfers* ━━━\n` +
    `• *send 50 to +91...*\n` +
    `• *request 20 from +91...*\n` +
    `• *my requests* - View pending\n` +
    `• *pay request 1* - Pay request\n\n` +
    `━━━ 🔒 *Savings* ━━━\n` +
    `• *lock 100 for 7 days*\n` +
    `• *my locks* - View savings\n` +
    `• *unlock 1* - Withdraw\n\n` +
    `━━━ ⏰ *Recurring* ━━━\n` +
    `• *schedule 25 to +91... weekly*\n` +
    `• *my schedules* - View active\n` +
    `• *cancel schedule 1*\n\n` +
    `💡 _You can also chat naturally!_\n` +
    `   "please send 10 to +91..."`;

  await sendWhatsAppMessage(to, msg);
}

// ═══════════════════════════════════════════════════════════════
// WALLET COMMANDS
// ═══════════════════════════════════════════════════════════════

async function handleBalanceCommand(from) {
  const wallet = await getOrCreateWallet(from);
  const balance = await getBalance(wallet.address);

  const msg = `💰 *Your Balance*\n\n` +
    `┌─────────────────────┐\n` +
    `│  *${balance} MNEE*  │\n` +
    `└─────────────────────┘\n\n` +
    `💳 Wallet: \`${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}\``;

  await sendWhatsAppMessage(from, msg);
}

async function handleAddressCommand(from) {
  const wallet = await getOrCreateWallet(from);

  const msg = `🔐 *Your MNEEChat Wallet*\n\n` +
    `\`${wallet.address}\`\n\n` +
    `📋 _Tap to copy, then paste anywhere!_\n\n` +
    `🔗 View on Etherscan:\n` +
    `https://sepolia.etherscan.io/address/${wallet.address}`;

  await sendWhatsAppMessage(from, msg);
}

async function handleDepositInfoCommand(from) {
  const wallet = await getOrCreateWallet(from);

  const msg = `💳 *Buy MNEE & Add Funds*\n\n` +
    `🚀 *MneePay.io is launching soon!*\n\n` +
    `Once live, you'll be able to:\n` +
    `• 💵 Buy MNEE with card/bank\n` +
    `• ⚡ Instant top-up to your wallet\n` +
    `• 🔄 Swap other crypto for MNEE\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📬 *For now, send tokens to:*\n\n` +
    `\`${wallet.address}\`\n\n` +
    `👉 *Stay tuned: mneepay.io*`;

  await sendWhatsAppMessage(from, msg);
}

// ═══════════════════════════════════════════════════════════════
// TRANSFER COMMANDS
// ═══════════════════════════════════════════════════════════════

async function handleSendCommand(from, command, senderName) {
  const { amount, recipient } = command;

  // Processing message
  await sendWhatsAppMessage(from, `⏳ *Sending ${amount} MNEE...*`);

  const recipientWallet = await getOrCreateWallet(recipient);
  const txHash = await transferMNEE(from, recipientWallet.address, parseFloat(amount));

  // Get new balance
  const senderWallet = await getOrCreateWallet(from);
  const newBalance = await getBalance(senderWallet.address);

  const msg = `✅ *Payment Sent!*\n\n` +
    `💸 *${amount} MNEE* → +${recipient}\n\n` +
    `💰 New balance: *${newBalance} MNEE*\n\n` +
    `🔗 Receipt:\n` +
    `https://sepolia.etherscan.io/tx/${txHash}`;

  await sendWhatsAppMessage(from, msg);

  // Notify recipient
  try {
    await sendWhatsAppMessage(
      recipient,
      `💰 *You received ${amount} MNEE!*\n\n` +
      `From: ${senderName || from}\n\n` +
      `Type *balance* to check your funds.`
    );
  } catch (e) {
    console.log('Could not notify recipient');
  }
}

// ═══════════════════════════════════════════════════════════════
// PAYMENT REQUESTS
// ═══════════════════════════════════════════════════════════════

async function handleCreateRequestCommand(from, command) {
  if (!isPaymentRequestConfigured()) {
    throw new Error('Payment requests not available');
  }

  const { amount, payer, note } = command;
  await sendWhatsAppMessage(from, `📩 *Creating payment request...*`);

  const payerWallet = await getOrCreateWallet(payer);
  const result = await createPaymentRequest(from, payerWallet.address, amount, note);

  await sendWhatsAppMessage(
    from,
    `✅ *Request Sent!*\n\n` +
    `📩 Requested *${amount} MNEE* from +${payer}\n` +
    (note ? `📝 Note: "${note}"\n\n` : '\n') +
    `They'll be notified to pay.`
  );

  // Notify payer
  try {
    await sendWhatsAppMessage(
      payer,
      `📩 *Payment Request*\n\n` +
      `${from} is requesting *${amount} MNEE*\n` +
      (note ? `📝 "${note}"\n\n` : '\n') +
      `Reply: *pay request ${result.requestId}*`
    );
  } catch (e) {
    console.log('Could not notify payer');
  }
}

async function handlePayRequestCommand(from, command) {
  const { requestId } = command;
  await sendWhatsAppMessage(from, `💳 *Processing payment...*`);

  const result = await fulfillPaymentRequest(from, requestId);

  await sendWhatsAppMessage(
    from,
    `✅ *Request Paid!*\n\n` +
    `You paid *${result.amount} MNEE* for request #${requestId}\n\n` +
    `🔗 https://sepolia.etherscan.io/tx/${result.txHash}`
  );
}

async function handleMyRequestsCommand(from) {
  const wallet = await getOrCreateWallet(from);

  // Parallel fetch
  const [incomingRequests, sentRequests] = await Promise.all([
    getPendingRequestsForPayer(wallet.address),
    getRequestsForRequester(from)
  ]);

  if (incomingRequests.length === 0 && sentRequests.length === 0) {
    return await sendWhatsAppMessage(
      from,
      `📭 *No Requests Found*\n\n` +
      `You don't have any pending or sent requests.`
    );
  }

  let msg = ``;

  // 1. Incoming (To Pay)
  if (incomingRequests.length > 0) {
    msg += `📉 *To Pay (Incoming)*\n`;
    incomingRequests.forEach(r => {
      msg += `━━━━━━━━━━\n`;
      msg += `#${r.id}: *${r.amount} MNEE*\n`;
      msg += `From: ${r.requester.slice(0, 6)}...${r.requester.slice(-4)}\n`;
      if (r.note) msg += `📝 "${r.note}"\n`;
      msg += `→ Reply: *pay request ${r.id}*\n`;
    });
    msg += `\n`;
  }

  // 2. Sent (By You)
  if (sentRequests.length > 0) {
    msg += `📈 *Sent Requests*\n`;
    sentRequests.slice(0, 5).forEach(r => { // Show last 5
      msg += `━━━━━━━━━━\n`;
      msg += `#${r.id}: *${r.amount} MNEE*\n`;
      msg += `To: ${r.payer.slice(0, 6)}...${r.payer.slice(-4)}\n`;

      let status = '🕒 Pending';
      if (r.fulfilled) status = '✅ Paid';
      if (r.cancelled) status = '❌ Cancelled';

      msg += `Status: ${status}\n`;
      if (r.note) msg += `📝 "${r.note}"\n`;
    });
    if (sentRequests.length > 5) {
      msg += `_...and ${sentRequests.length - 5} more_\n`;
    }
  }

  await sendWhatsAppMessage(from, msg);
}

async function handleCancelRequestCommand(from, command) {
  await cancelPaymentRequest(from, command.requestId);
  await sendWhatsAppMessage(from, `✅ Request #${command.requestId} cancelled.`);
}

// ═══════════════════════════════════════════════════════════════
// SAVINGS LOCKS
// ═══════════════════════════════════════════════════════════════

async function handleCreateLockCommand(from, command) {
  if (!isSavingsLockConfigured()) {
    throw new Error('Savings feature not available');
  }

  const { amount, duration } = command;
  await sendWhatsAppMessage(from, `🔒 *Locking ${amount} MNEE...*`);

  const result = await createSavingsLock(from, amount, duration);

  await sendWhatsAppMessage(
    from,
    `✅ *Savings Locked!*\n\n` +
    `🔒 *${amount} MNEE* locked for *${duration}*\n\n` +
    `📅 Unlocks: ${result.unlockTime?.toLocaleDateString() || 'Soon'}\n\n` +
    `_Your money is safe until then!_`
  );
}

async function handleUnlockCommand(from, command) {
  const { lockId } = command;
  await sendWhatsAppMessage(from, `🔓 *Withdrawing savings...*`);

  const result = await withdrawSavingsLock(from, lockId);

  await sendWhatsAppMessage(
    from,
    `✅ *Savings Withdrawn!*\n\n` +
    `💰 *${result.amount} MNEE* returned to your wallet!\n\n` +
    `🔗 https://sepolia.etherscan.io/tx/${result.txHash}`
  );
}

async function handleMyLocksCommand(from) {
  const locks = await getActiveSavingsLocks(from);

  if (locks.length === 0) {
    return await sendWhatsAppMessage(
      from,
      `🔒 *No Active Savings*\n\n` +
      `Start saving with:\n` +
      `*lock 100 for 7 days*`
    );
  }

  let msg = `🔒 *Your Savings*\n\n`;
  locks.forEach(l => {
    msg += `━━━━━━━━━━\n`;
    msg += `#${l.id}: *${l.amount} MNEE*\n`;
    if (l.canWithdraw) {
      msg += `✅ Ready! → *unlock ${l.id}*\n\n`;
    } else {
      msg += `⏳ ${l.timeRemaining}\n\n`;
    }
  });

  await sendWhatsAppMessage(from, msg);
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULED PAYMENTS
// ═══════════════════════════════════════════════════════════════

async function handleCreateScheduleCommand(from, command) {
  if (!isScheduledPaymentConfigured()) {
    throw new Error('Scheduled payments not available');
  }

  const { amount, recipient, interval } = command;
  await sendWhatsAppMessage(from, `⏰ *Setting up recurring payment...*`);

  const recipientWallet = await getOrCreateWallet(recipient);
  const result = await createScheduledPayment(from, recipientWallet.address, amount, interval);

  await sendWhatsAppMessage(
    from,
    `✅ *Auto-Pay Created!*\n\n` +
    `⏰ *${amount} MNEE* → +${recipient}\n` +
    `📆 Frequency: *${interval}*\n\n` +
    `Payments will run automatically!`
  );

  // Notify recipient
  try {
    await sendWhatsAppMessage(
      recipient,
      `⏰ *Recurring Payment*\n\n` +
      `You'll receive *${amount} MNEE* ${interval} from ${from}!`
    );
  } catch (e) {
    console.log('Could not notify recipient');
  }
}

async function handleCancelScheduleCommand(from, command) {
  await cancelScheduledPayment(from, command.scheduleId);
  await sendWhatsAppMessage(from, `✅ Auto-pay #${command.scheduleId} cancelled.`);
}

async function handleMySchedulesCommand(from) {
  const schedules = await getActiveSchedules(from);

  if (schedules.length === 0) {
    return await sendWhatsAppMessage(
      from,
      `⏰ *No Active Auto-Pays*\n\n` +
      `Set one up with:\n` +
      `*schedule 25 to +91... weekly*`
    );
  }

  let msg = `⏰ *Your Auto-Pays*\n\n`;
  schedules.forEach(s => {
    msg += `━━━━━━━━━━\n`;
    msg += `#${s.id}: *${s.amount} MNEE* ${s.interval}\n`;
    msg += `To: ${s.recipient.slice(0, 8)}...\n`;
    msg += `Next: ${s.nextPayment.toLocaleDateString()}\n\n`;
  });
  msg += `Cancel with: *cancel schedule [id]*`;

  await sendWhatsAppMessage(from, msg);
}
