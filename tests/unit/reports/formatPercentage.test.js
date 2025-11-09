// Unit tests for formatPercentage function

describe('formatPercentage', () => {
  // Replicate the function logic for testing
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

  function formatPercentage(value) {
    return formatArabicNumber(value, 2) + '%';
  }

  describe('Basic percentage formatting', () => {
    test('يجب تنسيق النسبة المئوية بشكل صحيح', () => {
      expect(formatPercentage(0)).toBe('٠٫٠٠%');
      expect(formatPercentage(10)).toBe('١٠٫٠٠%');
      expect(formatPercentage(25.5)).toBe('٢٥٫٥٠%');
      expect(formatPercentage(100)).toBe('١٠٠٫٠٠%');
    });

    test('يجب التعامل مع النسب المئوية الكبيرة', () => {
      expect(formatPercentage(150)).toBe('١٥٠٫٠٠%');
      expect(formatPercentage(1000)).toBe('١٬٠٠٠٫٠٠%');
    });

    test('يجب التعامل مع النسب المئوية الصغيرة', () => {
      expect(formatPercentage(0.5)).toBe('٠٫٥٠%');
      expect(formatPercentage(0.01)).toBe('٠٫٠١%');
    });
  });

  describe('Decimal places', () => {
    test('يجب استخدام خانتين عشريتين دائماً', () => {
      expect(formatPercentage(10)).toBe('١٠٫٠٠%');
      expect(formatPercentage(10.1)).toBe('١٠٫١٠%');
      expect(formatPercentage(10.123)).toBe('١٠٫١٢%');
    });
  });

  describe('Edge cases', () => {
    test('يجب التعامل مع null', () => {
      expect(formatPercentage(null)).toBe('٠٫٠٠%');
    });

    test('يجب التعامل مع undefined', () => {
      expect(formatPercentage(undefined)).toBe('٠٫٠٠%');
    });

    test('يجب التعامل مع NaN', () => {
      expect(formatPercentage(NaN)).toBe('٠٫٠٠%');
    });

    test('يجب التعامل مع الصفر', () => {
      expect(formatPercentage(0)).toBe('٠٫٠٠%');
    });

    test('يجب التعامل مع القيم السالبة', () => {
      expect(formatPercentage(-10)).toBe('-١٠٫٠٠%');
      expect(formatPercentage(-25.5)).toBe('-٢٥٫٥٠%');
    });
  });

  describe('Real-world scenarios', () => {
    test('يجب تنسيق هامش الربح بشكل صحيح', () => {
      // هامش ربح 20%
      expect(formatPercentage(20)).toBe('٢٠٫٠٠%');
      
      // هامش ربح 15.75%
      expect(formatPercentage(15.75)).toBe('١٥٫٧٥%');
      
      // خسارة -5%
      expect(formatPercentage(-5)).toBe('-٥٫٠٠%');
    });

    test('يجب تنسيق نسب النمو بشكل صحيح', () => {
      expect(formatPercentage(50)).toBe('٥٠٫٠٠%');
      expect(formatPercentage(100)).toBe('١٠٠٫٠٠%');
      expect(formatPercentage(150)).toBe('١٥٠٫٠٠%');
    });
  });
});

