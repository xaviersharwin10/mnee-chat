/**
 * Parse human-readable duration strings into seconds and clean interval
 * Examples: 
 * "1 min" -> { valid: true, seconds: 60, interval: "1 minute" }
 * "every 1 minute" -> { valid: true, seconds: 60, interval: "1 minute" }
 * "weekly" -> { valid: true, seconds: 604800, interval: "1 week" }
 */
export function parseDuration(input) {
    if (!input) return { valid: false };

    const text = input.trim().toLowerCase().replace('every ', ''); // remove "every" prefix

    // 1. Named intervals
    if (text === 'daily' || text === 'day' || text === 'every day') return { valid: true, seconds: 86400, interval: '1 day' };
    if (text === 'weekly' || text === 'week' || text === 'every week') return { valid: true, seconds: 604800, interval: '1 week' };
    if (text === 'monthly' || text === 'month') return { valid: true, seconds: 2592000, interval: '30 days' }; // Approx
    if (text === 'yearly' || text === 'year') return { valid: true, seconds: 31536000, interval: '365 days' }; // Approx

    // 2. Numeric intervals (e.g., "5 minutes")
    const match = text.match(/^(\d+)\s*([a-z]+)$/);
    if (!match) return { valid: false };

    const value = parseInt(match[1]);
    const unit = match[2];

    let multiplier = 0;
    let unitName = '';

    if (unit.match(/^s(ec|ecs|econd|econds)?$/)) {
        multiplier = 1;
        unitName = 'second';
    } else if (unit.match(/^m(in|ins|inute|inutes)?$/)) {
        multiplier = 60;
        unitName = 'minute';
    } else if (unit.match(/^h(r|rs|our|ours)?$/)) {
        multiplier = 3600;
        unitName = 'hour';
    } else if (unit.match(/^d(ay|ays)?$/)) {
        multiplier = 86400;
        unitName = 'day';
    } else if (unit.match(/^w(k|ks|eek|eeks)?$/)) {
        multiplier = 604800;
        unitName = 'week';
    }

    if (multiplier === 0) return { valid: false };

    return {
        valid: true,
        seconds: value * multiplier,
        interval: `${value} ${unitName}${value > 1 ? 's' : ''}`
    };
}
