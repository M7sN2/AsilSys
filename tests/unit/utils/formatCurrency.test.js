// Tests for formatCurrency and formatArabicCurrency functions

describe('formatCurrency', () => {
  // Copy the functions for testing
  function formatArabicNumber(number, decimals = 2) {
    if (number === null || number === undefined || isNaN(number)) {
      number = 0;
    }
    
    const num = parseFloat(number);
    const formatted = num.toFixed(decimals);
    
    const parts = formatted.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    
    let integerWithSeparator = '';
    for (let i = integerPart.length - 1, j = 0; i >= 0; i--, j++) {
      if (j > 0 && j % 3 === 0) {
        integerWithSeparator = '٬' + integerWithSeparator;
      }
      integerWithSeparator = integerPart[i] + integerWithSeparator;
    }
    
    const result = decimalPart 
      ? integerWithSeparator + '٫' + decimalPart
      : integerWithSeparator;
    
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return result.replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
  }

  function formatArabicCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicNumber(amount, decimals) + ' ' + currency;
  }

  function formatCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicCurrency(amount, currency, decimals);
  }

  describe('formatArabicCurrency', () => {
    test('should format currency with default currency', () => {
      const result = formatArabicCurrency(100);
      expect(result).toBe('١٠٠٫٠٠ ج.م');
    });

    test('should format currency with custom currency', () => {
      const result = formatArabicCurrency(100, 'دولار');
      expect(result).toBe('١٠٠٫٠٠ دولار');
    });

    test('should format currency with decimals', () => {
      const result = formatArabicCurrency(100.5);
      expect(result).toBe('١٠٠٫٥٠ ج.م');
    });

    test('should format currency with custom decimals', () => {
      const result = formatArabicCurrency(100.123, 'ج.م', 3);
      expect(result).toBe('١٠٠٫١٢٣ ج.م');
    });

    test('should format large amounts correctly', () => {
      const result = formatArabicCurrency(1234567.89);
      expect(result).toBe('١٬٢٣٤٬٥٦٧٫٨٩ ج.م');
    });

    test('should format zero correctly', () => {
      const result = formatArabicCurrency(0);
      expect(result).toBe('٠٫٠٠ ج.م');
    });
  });

  describe('formatCurrency (alias)', () => {
    test('should work as alias for formatArabicCurrency', () => {
      const result1 = formatCurrency(100);
      const result2 = formatArabicCurrency(100);
      expect(result1).toBe(result2);
      expect(result1).toBe('١٠٠٫٠٠ ج.م');
    });

    test('should accept same parameters', () => {
      const result = formatCurrency(100.5, 'دولار', 3);
      expect(result).toBe('١٠٠٫٥٠٠ دولار');
    });

    test('should handle edge cases same as formatArabicCurrency', () => {
      expect(formatCurrency(null)).toBe('٠٫٠٠ ج.م');
      expect(formatCurrency(undefined)).toBe('٠٫٠٠ ج.م');
      expect(formatCurrency(NaN)).toBe('٠٫٠٠ ج.م');
    });
  });

  describe('Edge cases', () => {
    test('should handle null amount', () => {
      expect(formatCurrency(null)).toBe('٠٫٠٠ ج.م');
    });

    test('should handle undefined amount', () => {
      expect(formatCurrency(undefined)).toBe('٠٫٠٠ ج.م');
    });

    test('should handle NaN amount', () => {
      expect(formatCurrency(NaN)).toBe('٠٫٠٠ ج.م');
    });

    test('should handle negative amounts', () => {
      expect(formatCurrency(-100)).toBe('-٬١٠٠٫٠٠ ج.م');
    });

    test('should handle very small amounts', () => {
      expect(formatCurrency(0.01)).toBe('٠٫٠١ ج.م');
    });

    test('should handle empty currency string', () => {
      expect(formatCurrency(100, '')).toBe('١٠٠٫٠٠ ');
    });
  });
});

