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
    // User-friendly error messages
    const message = error.message.toLowerCase();
    
    if (message.includes('insufficient balance')) {
      return '❌ Insufficient MNEE balance. Please check your balance and try again.';
    }
    
    if (message.includes('invalid address')) {
      return '❌ Invalid recipient address. Please check the phone number or wallet address.';
    }
    
    if (message.includes('network') || message.includes('rpc')) {
      return '❌ Network error. Please try again in a moment.';
    }
    
    if (message.includes('gas') || message.includes('fee')) {
      return '❌ Transaction failed due to gas issues. Please try again.';
    }
    
    if (message.includes('not a member')) {
      return '❌ You are not a member of this group treasury.';
    }
    
    if (message.includes('already voted')) {
      return 'ℹ️ You have already voted on this proposal.';
    }
    
    if (message.includes('proposal not found')) {
      return '❌ Proposal not found. Please check the proposal ID.';
    }
    
    if (message.includes('treasury not deployed')) {
      return '❌ No treasury exists for this group. Type "create treasury" to set one up.';
    }
    
    // Default error message
    return `❌ Error: ${error.message}`;
  }
  
  return '❌ An unexpected error occurred. Please try again.';
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

