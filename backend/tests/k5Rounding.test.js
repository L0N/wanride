const { 
  roundToK5, 
  formatKina, 
  parseKina, 
  isK5Rounded, 
  calculatePercentageK5,
  addAndRoundK5,
  subtractAndRoundK5
} = require('../utils/k5Rounding');

describe('K5 Rounding Utility', () => {
  describe('roundToK5', () => {
    test('rounds down from X.0 to X.4', () => {
      expect(roundToK5(27)).toBe(25);
      expect(roundToK5(31)).toBe(30);
      expect(roundToK5(22)).toBe(20);
      expect(roundToK5(48)).toBe(50);
    });

    test('rounds up from X.5 to X.9', () => {
      expect(roundToK5(28)).toBe(30);
      expect(roundToK5(33)).toBe(35);
      expect(roundToK5(26)).toBe(25);
      expect(roundToK5(49)).toBe(50);
    });

    test('handles exact K5 amounts', () => {
      expect(roundToK5(30)).toBe(30);
      expect(roundToK5(45)).toBe(45);
      expect(roundToK5(5)).toBe(5);
      expect(roundToK5(100)).toBe(100);
    });

    test('handles edge cases', () => {
      expect(roundToK5(32.5)).toBe(30); // Exactly halfway - round down
      expect(roundToK5(37.5)).toBe(40); // Round up
      expect(roundToK5(0)).toBe(0);
      expect(roundToK5(2.5)).toBe(0); // Round down
      expect(roundToK5(7.5)).toBe(10); // Round up
    });

    test('handles negative amounts', () => {
      expect(roundToK5(-27)).toBe(-25);
      expect(roundToK5(-28)).toBe(-30);
      expect(roundToK5(-30)).toBe(-30);
      expect(roundToK5(-32.5)).toBe(-30);
    });

    test('handles invalid inputs', () => {
      expect(roundToK5(NaN)).toBe(0);
      expect(roundToK5(null)).toBe(0);
      expect(roundToK5(undefined)).toBe(0);
      expect(roundToK5('invalid')).toBe(0);
    });

    test('handles decimal inputs correctly', () => {
      expect(roundToK5(27.1)).toBe(25);
      expect(roundToK5(27.4)).toBe(25);
      expect(roundToK5(27.6)).toBe(30);
      expect(roundToK5(27.9)).toBe(30);
    });
  });

  describe('formatKina', () => {
    test('formats positive amounts with K prefix', () => {
      expect(formatKina(30)).toBe('K30');
      expect(formatKina(27)).toBe('K25'); // Should round first
      expect(formatKina(100)).toBe('K100');
    });

    test('formats zero amount', () => {
      expect(formatKina(0)).toBe('K0');
    });

    test('formats negative amounts', () => {
      expect(formatKina(-30)).toBe('-K30');
      expect(formatKina(-27)).toBe('-K25'); // Should round first
    });

    test('respects roundFirst parameter', () => {
      expect(formatKina(27, true)).toBe('K25'); // Round first (default)
      expect(formatKina(27, false)).toBe('K27'); // Don't round
    });
  });

  describe('parseKina', () => {
    test('parses currency strings', () => {
      expect(parseKina('K30')).toBe(30);
      expect(parseKina('K100')).toBe(100);
      expect(parseKina('K0')).toBe(0);
    });

    test('parses plain numbers', () => {
      expect(parseKina('30')).toBe(30);
      expect(parseKina('100')).toBe(100);
      expect(parseKina('0')).toBe(0);
    });

    test('handles number inputs', () => {
      expect(parseKina(30)).toBe(30);
      expect(parseKina(100)).toBe(100);
      expect(parseKina(0)).toBe(0);
    });

    test('handles invalid inputs', () => {
      expect(parseKina('')).toBe(0);
      expect(parseKina('invalid')).toBe(0);
      expect(parseKina(null)).toBe(0);
      expect(parseKina(undefined)).toBe(0);
    });

    test('handles negative amounts', () => {
      expect(parseKina('-K30')).toBe(-30);
      expect(parseKina('-30')).toBe(-30);
    });

    test('handles decimal amounts', () => {
      expect(parseKina('K27.50')).toBe(27.5);
      expect(parseKina('27.50')).toBe(27.5);
    });
  });

  describe('isK5Rounded', () => {
    test('validates K5-rounded amounts', () => {
      expect(isK5Rounded(30)).toBe(true);
      expect(isK5Rounded(45)).toBe(true);
      expect(isK5Rounded(5)).toBe(true);
      expect(isK5Rounded(0)).toBe(true);
      expect(isK5Rounded(100)).toBe(true);
    });

    test('rejects non-K5-rounded amounts', () => {
      expect(isK5Rounded(27)).toBe(false);
      expect(isK5Rounded(33)).toBe(false);
      expect(isK5Rounded(1)).toBe(false);
      expect(isK5Rounded(99)).toBe(false);
    });

    test('handles negative amounts', () => {
      expect(isK5Rounded(-30)).toBe(true);
      expect(isK5Rounded(-27)).toBe(false);
    });

    test('handles invalid inputs', () => {
      expect(isK5Rounded(NaN)).toBe(false);
      expect(isK5Rounded(null)).toBe(false);
      expect(isK5Rounded(undefined)).toBe(false);
      expect(isK5Rounded('30')).toBe(false);
    });
  });

  describe('calculatePercentageK5', () => {
    test('calculates percentage and rounds to K5', () => {
      expect(calculatePercentageK5(100, 20)).toBe(20); // 20% of 100 = 20
      expect(calculatePercentageK5(130, 20)).toBe(25); // 20% of 130 = 26 → K25
      expect(calculatePercentageK5(105, 20)).toBe(20); // 20% of 105 = 21 → K20
    });

    test('handles edge cases', () => {
      expect(calculatePercentageK5(0, 20)).toBe(0);
      expect(calculatePercentageK5(100, 0)).toBe(0);
      expect(calculatePercentageK5(25, 100)).toBe(25); // 100% of 25 = 25
    });

    test('handles decimal percentages', () => {
      expect(calculatePercentageK5(100, 22.5)).toBe(25); // 22.5% of 100 = 22.5 → K25
      expect(calculatePercentageK5(200, 12.5)).toBe(25); // 12.5% of 200 = 25
    });
  });

  describe('addAndRoundK5', () => {
    test('adds multiple amounts and rounds to K5', () => {
      expect(addAndRoundK5(27, 28)).toBe(55); // 27 + 28 = 55
      expect(addAndRoundK5(26, 27)).toBe(55); // 26 + 27 = 53 → K55
      expect(addAndRoundK5(25, 25, 25)).toBe(75); // 25 + 25 + 25 = 75
    });

    test('handles zero and negative amounts', () => {
      expect(addAndRoundK5(0, 30)).toBe(30);
      expect(addAndRoundK5(30, -5)).toBe(25);
      expect(addAndRoundK5(-10, -15)).toBe(-25);
    });

    test('handles null/undefined values', () => {
      expect(addAndRoundK5(30, null, undefined)).toBe(30);
      expect(addAndRoundK5(null, null)).toBe(0);
    });
  });

  describe('subtractAndRoundK5', () => {
    test('subtracts amounts and rounds to K5', () => {
      expect(subtractAndRoundK5(100, 27)).toBe(75); // 100 - 27 = 73 → K75
      expect(subtractAndRoundK5(100, 25)).toBe(75); // 100 - 25 = 75
      expect(subtractAndRoundK5(100, 20, 30)).toBe(50); // 100 - 20 - 30 = 50
    });

    test('handles negative results', () => {
      expect(subtractAndRoundK5(30, 50)).toBe(-20); // 30 - 50 = -20
      expect(subtractAndRoundK5(27, 30)).toBe(0); // 27 - 30 = -3 → K0
    });

    test('handles null/undefined values', () => {
      expect(subtractAndRoundK5(30, null, undefined)).toBe(30);
      expect(subtractAndRoundK5(30, 0)).toBe(30);
    });
  });
});

describe('Real-world PNG Fare Scenarios', () => {
  test('Commission calculation (20% of K5-rounded fare)', () => {
    const ride1Fare = 105; // K105 fare
    const commission1 = calculatePercentageK5(ride1Fare, 20);
    expect(commission1).toBe(20); // 105 * 0.20 = 21 → K20

    const ride2Fare = 130; // K130 fare
    const commission2 = calculatePercentageK5(ride2Fare, 20);
    expect(commission2).toBe(25); // 130 * 0.20 = 26 → K25
  });

  test('Return fee calculation (25% of base fare)', () => {
    const baseFare = 102; // K102 base fare (after rounding)
    const returnFee = calculatePercentageK5(baseFare, 25);
    expect(returnFee).toBe(25); // 102 * 0.25 = 25.5 → K25

    const baseFare2 = 120; // K120 base fare
    const returnFee2 = calculatePercentageK5(baseFare2, 25);
    expect(returnFee2).toBe(30); // 120 * 0.25 = 30
  });

  test('Complex fare calculation with multiple components', () => {
    const baseFare = 30;
    const distanceCharge = 22.50; // 11.25km * K2/km
    const timeCharge = 15.00; // 30min * K0.50/min
    
    // Add components and round
    const subtotal = addAndRoundK5(baseFare, distanceCharge, timeCharge); // 67.5 → K70
    expect(subtotal).toBe(70);
    
    // Calculate return fee (25%)
    const returnFee = calculatePercentageK5(subtotal, 25); // 70 * 0.25 = 17.5 → K20
    expect(returnFee).toBe(20);
    
    // Final fare
    const finalFare = addAndRoundK5(subtotal, returnFee); // 70 + 20 = 90
    expect(finalFare).toBe(90);
  });

  test('Airport addon calculation', () => {
    const ncdFlatRate = 30;
    const airportAddon = 10;
    const finalFare = addAndRoundK5(ncdFlatRate, airportAddon);
    expect(finalFare).toBe(40); // K30 + K10 = K40
  });

  test('Edge case: Very small amounts', () => {
    expect(roundToK5(2)).toBe(0); // K2 → K0
    expect(roundToK5(3)).toBe(5); // K3 → K5
    expect(roundToK5(7)).toBe(5); // K7 → K5
    expect(roundToK5(8)).toBe(10); // K8 → K10
  });
});
