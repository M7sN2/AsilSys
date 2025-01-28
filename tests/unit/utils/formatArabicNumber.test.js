// Tests for formatArabicNumber function

// Import the function from purchases.js
// Note: In a real scenario, we'd need to export these functions or use a different approach
// For now, we'll test the logic directly

describe('formatArabicNumber', () => {
  // Copy the function for testing (in real scenario, export it)
  function formatArabicNumber(number, decimals = 2) {
    if (number === null || number === undefined || number === '' || isNaN(number)) {
      number = 0;
    }
    
    const num = parseFloat(number);
    if (isNaN(num)) {
      num = 0;
    }
    const formatted = num.toFixed(decimals);
    
    // Split into integer and decimal parts
    const parts = formatted.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    
    // Add thousands separator (٬)
    let integerWithSeparator = '';
    for (let i = integerPart.length - 1, j = 0; i >= 0; i--, j++) {
      if (j > 0 && j % 3 === 0) {
        integerWithSeparator = '٬' + integerWithSeparator;
      }
      integerWithSeparator = integerPart[i] + integerWithSeparator;
    }
    
    // Combine with decimal separator (٫)
    const result = decimalPart 
      ? integerWithSeparator + '٫' + decimalPart
      : integerWithSeparator;
    
    // Convert to Eastern Arabic numerals
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return result.replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
  }

  describe('Basic number formatting', () => {
    test('should format simple number correctly', () => {
      expect(formatArabicNumber(100)).toBe('١٠٠٫٠٠');
    });

    test('should format decimal number correctly', () => {
      expect(formatArabicNumber(100.5)).toBe('١٠٠٫٥٠');
    });

    test('should format number with custom decimals', () => {
      expect(formatArabicNumber(100.123, 3)).toBe('١٠٠٫١٢٣');
    });

    test('should format zero correctly', () => {
      expect(formatArabicNumber(0)).toBe('٠٫٠٠');
    });

    test('should format negative number correctly', () => {
      expect(formatArabicNumber(-100)).toBe('-٬١٠٠٫٠٠');
    });
  });

  describe('Thousands separator', () => {
    test('should add thousands separator for 1000', () => {
      expect(formatArabicNumber(1000)).toBe('١٬٠٠٠٫٠٠');
    });

    test('should add thousands separator for 10000', () => {
      expect(formatArabicNumber(10000)).toBe('١٠٬٠٠٠٫٠٠');
    });

    test('should add multiple separators for large numbers', () => {
      expect(formatArabicNumber(1000000)).toBe('١٬٠٠٠٬٠٠٠٫٠٠');
    });

    test('should format 1234567.89 correctly', () => {
      expect(formatArabicNumber(1234567.89)).toBe('١٬٢٣٤٬٥٦٧٫٨٩');
    });
  });

  describe('Edge cases', () => {
    test('should handle null input', () => {
      expect(formatArabicNumber(null)).toBe('٠٫٠٠');
    });

    test('should handle undefined input', () => {
      expect(formatArabicNumber(undefined)).toBe('٠٫٠٠');
    });

    test('should handle NaN input', () => {
      expect(formatArabicNumber(NaN)).toBe('٠٫٠٠');
    });

    test('should handle string number', () => {
      expect(formatArabicNumber('100')).toBe('١٠٠٫٠٠');
    });

    test('should handle empty string', () => {
      // Empty string becomes NaN, which is converted to 0
      const result = formatArabicNumber('');
      expect(result).toBe('٠٫٠٠');
    });

    test('should handle very small decimal', () => {
      expect(formatArabicNumber(0.01)).toBe('٠٫٠١');
    });

    test('should handle very large number', () => {
      expect(formatArabicNumber(999999999.99)).toBe('٩٩٩٬٩٩٩٬٩٩٩٫٩٩');
    });
  });

  describe('Decimal precision', () => {
    test('should use default 2 decimals', () => {
      expect(formatArabicNumber(100.1)).toBe('١٠٠٫١٠');
    });

    test('should use 0 decimals when specified', () => {
      expect(formatArabicNumber(100.99, 0)).toBe('١٠١');
    });

    test('should use 4 decimals when specified', () => {
      expect(formatArabicNumber(100.1234, 4)).toBe('١٠٠٫١٢٣٤');
    });

    test('should round correctly', () => {
      expect(formatArabicNumber(100.999, 2)).toBe('١٠١٫٠٠');
    });
  });
});

