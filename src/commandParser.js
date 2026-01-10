/**
 * Parse user command from WhatsApp message
 */
export function parseCommand(message) {
  if (!message) return null;

  const text = message.trim().toLowerCase();

  // Help command
  if (text === 'help' || text === '/help' || text === '?') {
    return { type: 'HELP' };
  }

  // Balance command
  if (text === 'balance' || text === 'bal' || text === 'check balance' || text === '💰 check balance') {
    return { type: 'BALANCE' };
  }

  // Address
  if (text === 'address' || text === 'my address' || text === 'wallet') {
    return { type: 'ADDRESS' };
  }

  // Deposit Info
  if (text === 'deposit' || text === 'add money' || text.includes('add funds')) {
    return { type: 'DEPOSIT_INFO' };
  }

  // Interactive Button: "Send Money"
  if (text === 'send money' || text === '💸 send money') {
    return { type: 'SEND_HELP' };
  }

  // Send/Pay command
  const sendPattern = /(?:send|pay)\s+(\d+(?:\.\d+)?)\s*(?:mnee|mn|)?\s+to\s+(@?\w+|[\+\d]+)/i;
  const match = text.match(sendPattern);

  if (match) {
    const amount = parseFloat(match[1]);
    let recipient = match[2].trim();
    if (recipient.startsWith('@')) recipient = recipient.substring(1);
    if (recipient.startsWith('+')) recipient = recipient.substring(1);

    return {
      type: 'SEND',
      amount,
      recipient,
    };
  }

  // Payment Request Commands
  const requestPattern = /request\s+(\d+(?:\.\d+)?)\s*(?:mnee|mn|)?\s+from\s+(@?\w+|[\+\d]+)/i;
  const requestMatch = text.match(requestPattern);
  if (requestMatch) {
    return {
      type: 'CREATE_REQUEST',
      amount: parseFloat(requestMatch[1]),
      payer: requestMatch[2].replace('@', ''),
    };
  }

  const payRequestPattern = /pay\s+request\s+(\d+)/i;
  const payRequestMatch = text.match(payRequestPattern);
  if (payRequestMatch) {
    return { type: 'PAY_REQUEST', requestId: payRequestMatch[1] };
  }

  const cancelRequestPattern = /cancel\s+request\s+(\d+)/i;
  const cancelRequestMatch = text.match(cancelRequestPattern);
  if (cancelRequestMatch) {
    return { type: 'CANCEL_REQUEST', requestId: cancelRequestMatch[1] };
  }

  if (text === 'my requests' || text === 'show requests' || text === '📩 my requests') {
    return { type: 'MY_REQUESTS' };
  }

  // Savings Lock Commands
  // Pattern: lock [amount] [token?] for [duration]
  // Matches: "lock 1 for 10 minutes", "lock 1 for 1 min", "lock 1 for 1 hour"
  const lockPattern = /lock\s+(\d+(?:\.\d+)?)\s*(?:mnee|mn|)?\s+for\s+(.+)/i;
  const lockMatch = text.match(lockPattern);
  if (lockMatch) {
    return {
      type: 'CREATE_LOCK',
      amount: parseFloat(lockMatch[1]),
      duration: lockMatch[2].trim(), // Pass raw string (e.g. "10 mins") to service
    };
  }

  const unlockPattern = /(?:withdraw|unlock)\s+(?:lock\s+)?(\d+)/i;
  const unlockMatch = text.match(unlockPattern);
  if (unlockMatch) {
    return { type: 'UNLOCK', lockId: unlockMatch[1] };
  }

  if (text === 'my locks' || text === 'show locks' || text === 'savings') {
    return { type: 'MY_LOCKS' };
  }

  // Scheduled Payment Commands
  // Pattern: schedule [amount] [token?] to [recipient] [interval]
  // Matches: "schedule 1 to @bob every 1 min", "schedule 1 to @bob weekly"
  // Note: We make 'every' optional in the capture if needed, but the regex below captures everything after recipient as interval
  const schedulePattern = /schedule\s+(\d+(?:\.\d+)?)\s*(?:mnee|mn|)?\s+to\s+(@?\w+|[\+\d]+)\s+(.+)/i;
  const scheduleMatch = text.match(schedulePattern);
  if (scheduleMatch) {
    return {
      type: 'CREATE_SCHEDULE',
      amount: parseFloat(scheduleMatch[1]),
      recipient: scheduleMatch[2].replace('@', ''),
      interval: scheduleMatch[3].trim(), // "every 1 minute" or "weekly"
    };
  }

  const cancelSchedulePattern = /cancel\s+schedule\s+(\d+)/i;
  const cancelScheduleMatch = text.match(cancelSchedulePattern);
  if (cancelScheduleMatch) {
    return { type: 'CANCEL_SCHEDULE', scheduleId: cancelScheduleMatch[1] };
  }

  if (text === 'my schedules' || text === 'active schedules') {
    return { type: 'MY_SCHEDULES' };
  }

  return null;
}

export function extractAmount(message) {
  const amountPattern = /(\d+(?:\.\d+)?)/;
  const match = message.match(amountPattern);
  return match ? parseFloat(match[1]) : null;
}

export function extractRecipient(message) {
  const usernameMatch = message.match(/@(\w+)/);
  if (usernameMatch) return usernameMatch[1];
  const phoneMatch = message.match(/(\+?\d{10,15})/);
  if (phoneMatch) return phoneMatch[1].replace('+', '');
  return null;
}
