/**
 * K5 Rounding Utility for PNG Currency Compliance
 * 
 * This utility ensures ALL currency amounts in WanRide are rounded to the nearest K5,
 * which is MANDATORY for PNG Kina currency compliance.
 * 
 * Examples:
 * - roundToK5(27) → 25 (round down)
 * - roundToK5(28) → 30 (round up)
 * - roundToK5(32.5) → 30 (exactly halfway - round down)
 * - roundToK5(37.5) → 40 (round up)
 * - roundToK5(30) → 30 (already K5, no change)
 */

/**
 * Round amount to nearest K5 Kina
 * This is CRITICAL for PNG compliance - ALL currency must be K5-rounded
 * 
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount (always divisible by 5)
 */
export function roundToK5(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    console.error('roundToK5: Invalid input', amount);
    return 0;
  }
  
  // Handle negative amounts (for deductions, refunds, etc.)
  if (amount < 0) {
    return -Math.round(Math.abs(amount) / 5) * 5;
  }
  
  return Math.round(amount / 5) * 5;
}

/**
 * Format currency for display (PNG Kina)
 * @param {number} amount - Amount to format
 * @param {boolean} roundFirst - Whether to round to K5 first (default: true)
 * @returns {string} Formatted currency string
 */
export function formatKina(amount, roundFirst = true) {
  const finalAmount = roundFirst ? roundToK5(amount) : amount;
  
  // Handle zero and negative amounts
  if (finalAmount === 0) return 'K0';
  if (finalAmount < 0) return `-K${Math.abs(finalAmount)}`;
  
  return `K${finalAmount}`;
}

/**
 * Parse currency input (remove 'K' and parse)
 * @param {string|number} input - Input string like "K30" or "30" or number
 * @returns {number} Parsed number
 */
export function parseKina(input) {
  if (typeof input === 'number') return input;
  if (typeof input !== 'string') return 0;
  
  const cleaned = input.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Validate that an amount is K5-rounded
 * @param {number} amount - Amount to validate
 * @returns {boolean} True if amount is K5-rounded
 */
export function isK5Rounded(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return false;
  return amount % 5 === 0;
}

/**
 * Calculate percentage of amount and round to K5
 * @param {number} amount - Base amount
 * @param {number} percentage - Percentage (e.g., 20 for 20%)
 * @returns {number} K5-rounded percentage amount
 */
export function calculatePercentageK5(amount, percentage) {
  const percentageAmount = (amount * percentage) / 100;
  return roundToK5(percentageAmount);
}

/**
 * Add multiple amounts and round the total to K5
 * @param {...number} amounts - Amounts to add
 * @returns {number} K5-rounded total
 */
export function addAndRoundK5(...amounts) {
  const total = amounts.reduce((sum, amount) => sum + (amount || 0), 0);
  return roundToK5(total);
}

/**
 * Subtract amounts and round the result to K5
 * @param {number} base - Base amount
 * @param {...number} deductions - Amounts to subtract
 * @returns {number} K5-rounded result
 */
export function subtractAndRoundK5(base, ...deductions) {
  const totalDeductions = deductions.reduce((sum, amount) => sum + (amount || 0), 0);
  const result = base - totalDeductions;
  return roundToK5(result);
}

/**
 * Format currency for input fields (without K prefix)
 * @param {number} amount - Amount to format
 * @param {boolean} roundFirst - Whether to round to K5 first (default: true)
 * @returns {string} Formatted amount without currency symbol
 */
export function formatKinaInput(amount, roundFirst = true) {
  const finalAmount = roundFirst ? roundToK5(amount) : amount;
  return finalAmount.toString();
}

/**
 * Create a currency formatter function with K5 rounding
 * @param {boolean} showSymbol - Whether to show K symbol (default: true)
 * @returns {function} Formatter function
 */
export function createKinaFormatter(showSymbol = true) {
  return (amount) => {
    const rounded = roundToK5(amount);
    return showSymbol ? `K${rounded}` : rounded.toString();
  };
}

// For backend (CommonJS) compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    roundToK5,
    formatKina,
    parseKina,
    isK5Rounded,
    calculatePercentageK5,
    addAndRoundK5,
    subtractAndRoundK5,
    formatKinaInput,
    createKinaFormatter
  };
}
