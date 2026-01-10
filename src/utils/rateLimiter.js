/**
 * Simple rate limiter to prevent abuse
 */

const rateLimitMap = new Map(); // phoneNumber -> { count, resetTime }

const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
};

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(phoneNumber) {
  const now = Date.now();
  const record = rateLimitMap.get(phoneNumber);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitMap.set(phoneNumber, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Get remaining requests for a phone number
 */
export function getRemainingRequests(phoneNumber) {
  const record = rateLimitMap.get(phoneNumber);
  if (!record || Date.now() > record.resetTime) {
    return RATE_LIMIT.maxRequests;
  }
  return Math.max(0, RATE_LIMIT.maxRequests - record.count);
}

/**
 * Clear rate limit for a phone number (for testing)
 */
export function clearRateLimit(phoneNumber) {
  rateLimitMap.delete(phoneNumber);
}

