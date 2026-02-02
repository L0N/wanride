/**
 * K5 Rounding Utility for PNG Currency Compliance (Backend)
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
function roundToK5(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    console.error('roundToK5: Invalid input', amount);
    return 0;
  }
  
  // For negative amounts, round towards zero
  if (amount < 0) {
    const absAmount = Math.abs(amount);
    
    // If the absolute amount is very small, round to 0
    if (absAmount < 5) {
      return 0;
    }
    
    // Apply the same banker's rounding logic to the absolute value
    const divided = absAmount / 5;
    const floor = Math.floor(divided);
    const remainder = divided - floor;
    
    let roundedAbs;
    if (remainder < 0.5) {
      roundedAbs = floor * 5;
    } else if (remainder > 0.5) {
      roundedAbs = (floor + 1) * 5;
    } else {
      // Exactly 0.5 - round to even
      roundedAbs = (floor % 2 === 0 ? floor : floor + 1) * 5;
    }
    
    return -roundedAbs;
  }
  
  // For positive amounts, use round half to even (banker's rounding)
  const divided = amount / 5;
  const floor = Math.floor(divided);
  const remainder = divided - floor;
  
  if (remainder < 0.5) {
    return floor * 5;
  } else if (remainder > 0.5) {
    return (floor + 1) * 5;
  } else {
    // Exactly 0.5 - round to even
    return (floor % 2 === 0 ? floor : floor + 1) * 5;
  }
}

/**
 * Format currency for display (PNG Kina)
 * @param {number} amount - Amount to format
 * @param {boolean} roundFirst - Whether to round to K5 first (default: true)
 * @returns {string} Formatted currency string
 */
function formatKina(amount, roundFirst = true) {
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
function parseKina(input) {
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
function isK5Rounded(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return false;
  return amount % 5 === 0;
}

/**
 * Calculate percentage of amount and round to K5
 * @param {number} amount - Base amount
 * @param {number} percentage - Percentage (e.g., 20 for 20%)
 * @returns {number} K5-rounded percentage amount
 */
function calculatePercentageK5(amount, percentage) {
  const percentageAmount = (amount * percentage) / 100;
  return roundToK5(percentageAmount);
}

/**
 * Add multiple amounts and round the total to K5
 * @param {...number} amounts - Amounts to add
 * @returns {number} K5-rounded total
 */
function addAndRoundK5(...amounts) {
  const total = amounts.reduce((sum, amount) => sum + (amount || 0), 0);
  return roundToK5(total);
}

/**
 * Subtract amounts and round the result to K5
 * @param {number} base - Base amount
 * @param {...number} deductions - Amounts to subtract
 * @returns {number} K5-rounded result
 */
function subtractAndRoundK5(base, ...deductions) {
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
function formatKinaInput(amount, roundFirst = true) {
  const finalAmount = roundFirst ? roundToK5(amount) : amount;
  return finalAmount.toString();
}

/**
 * Create a currency formatter function with K5 rounding
 * @param {boolean} showSymbol - Whether to show K symbol (default: true)
 * @returns {function} Formatter function
 */
function createKinaFormatter(showSymbol = true) {
  return (amount) => {
    const rounded = roundToK5(amount);
    return showSymbol ? `K${rounded}` : rounded.toString();
  };
}

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
