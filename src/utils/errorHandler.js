/**
 * Centralized error handling utilities
 */

/**
 * Format error message for user display
 */
export function formatErrorMessage(error) {
  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    const message = error.message.toLowerCase();

    // Funds & Gas - Be specific
    if (message.includes('insufficient balance') || message.includes('transfer amount exceeds balance')) {
      return '❌ *Insufficient Funds*\nYou don\'t have enough MNEE wallet balance.';
    }
    if (message.includes('insufficient funds for gas')) {
      return '⛽ *Gas Error*\nYou need a tiny bit of ETH for gas fees (Sepolia).';
    }

    // Savings Locks - Specific "Wait" Handling
    if (message.includes('lock not expired')) {
      const waitMatch = message.match(/wait\s+(.+)\./);
      const waitTime = waitMatch ? waitMatch[1] : '';
      return `⏳ *Not Yet!*\nThis lock is still active.${waitTime ? `\nWait ${waitTime}.` : ''}`;
    }
    if (message.includes('already withdrawn')) {
      return '❌ *Already Withdrawn*\nThis lock has already been withdrawn.';
    }

    // Inputs
    if (message.includes('invalid address') || message.includes('resolver')) {
      return '❌ *Invalid Details*\nPlease check the phone number or address.';
    }
    if (message.includes('interval')) {
      return '❌ *Invalid Time Format*\nTry: "weekly", "every 5 minutes", "daily".';
    }
    if (message.includes('duration')) {
      return '❌ *Invalid Duration*\nTry: "lock 10 for 5 minutes" or "lock 10 for 1 week".';
    }

    // Network
    if (message.includes('network') || message.includes('rpc') || message.includes('timeout') || message.includes('call revert exception')) {
      return '⚠️ *Network Hiccup*\nThe blockchain is a bit busy. Please try again in 30 seconds.';
    }
    if (message.includes('gas') || message.includes('fee')) {
      return '⛽ *Gas Error*\nPlease try again.';
    }

    // Catch-all
    if (message.includes('undefined') || message.includes('cannot read properties')) {
      return '🤔 *I didn\'t catch that*\nCould you double check the command? Type *help* for examples.';
    }

    // Default fallback - Show first 50 chars of error for debugging
    return `❌ *Something went wrong*\n_${error.message.substring(0, 50)}..._`;
  }

  return '❌ *System Error*\nPlease try again later.';
}

/**
 * Log error with context
 */
export function logError(error, context = {}) {
  console.error('❌ Error:', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle async errors gracefully
 */
export async function handleAsyncError(fn, errorMessage = 'Operation failed') {
  try {
    return await fn();
  } catch (error) {
    logError(error);
    throw new Error(errorMessage);
  }
}
