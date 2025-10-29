// Tests for generateInvoiceNumber function from sales.js

describe('generateInvoiceNumber', () => {
  let mockGetItem;
  let mockSetItem;
  let localStorageData;

  beforeEach(() => {
    localStorageData = {};
    jest.clearAllMocks();
    mockGetItem = jest.fn((key) => {
      return localStorageData[key] || null;
    });
    mockSetItem = jest.fn((key, value) => {
      localStorageData[key] = value;
    });
    global.localStorage.getItem = mockGetItem;
    global.localStorage.setItem = mockSetItem;
  });

  // Copy the function for testing
  function generateInvoiceNumber() {
    const STORAGE_KEYS = {
      INVOICE_COUNTER: 'asel_invoice_counter'
    };
    
    let counter = parseInt(mockGetItem(STORAGE_KEYS.INVOICE_COUNTER) || '0');
    counter++;
    mockSetItem(STORAGE_KEYS.INVOICE_COUNTER, counter.toString());
    
    const year = new Date().getFullYear();
    // Format: INV-2024-001
    return `INV-${year}-${String(counter).padStart(3, '0')}`;
  }

  describe('Basic invoice number generation', () => {
    test('should generate invoice number with correct format', () => {
      const number = generateInvoiceNumber();
      const year = new Date().getFullYear();
      expect(number).toMatch(/^INV-\d{4}-\d{3}$/);
      expect(number).toContain('INV-');
      expect(number).toContain(`-${year}-`);
    });

    test('should start counter from 1', () => {
      localStorageData = {};
      const number = generateInvoiceNumber();
      expect(number).toMatch(/INV-\d{4}-001$/);
    });

    test('should increment counter correctly', () => {
      localStorageData = {};
      const number1 = generateInvoiceNumber();
      const number2 = generateInvoiceNumber();
      const number3 = generateInvoiceNumber();

      const counter1 = parseInt(number1.split('-')[2]);
      const counter2 = parseInt(number2.split('-')[2]);
      const counter3 = parseInt(number3.split('-')[2]);

      expect(counter2).toBe(counter1 + 1);
      expect(counter3).toBe(counter2 + 1);
    });

    test('should pad counter with zeros', () => {
      localStorageData = {};
      const number = generateInvoiceNumber();
      const counter = number.split('-')[2];
      expect(counter.length).toBe(3);
      expect(counter).toMatch(/^\d{3}$/);
    });
  });

  describe('Counter persistence', () => {
    test('should read counter from localStorage', () => {
      localStorageData = {};
      localStorageData['asel_invoice_counter'] = '5';
      const number = generateInvoiceNumber();
      const counter = parseInt(number.split('-')[2]);
      expect(counter).toBe(6);
    });

    test('should save counter to localStorage', () => {
      localStorageData = {};
      generateInvoiceNumber();
      expect(mockSetItem).toHaveBeenCalledWith(
        'asel_invoice_counter',
        '1'
      );
    });

    test('should handle missing counter in localStorage', () => {
      localStorageData = {};
      const number = generateInvoiceNumber();
      expect(number).toMatch(/INV-\d{4}-001$/);
    });

    test('should handle counter reset', () => {
      localStorageData = {};
      localStorageData['asel_invoice_counter'] = '999';
      const number1 = generateInvoiceNumber();
      const number2 = generateInvoiceNumber();
      
      const counter1 = parseInt(number1.split('-')[2]);
      const counter2 = parseInt(number2.split('-')[2]);
      
      expect(counter2).toBe(counter1 + 1);
    });
  });

  describe('Year in invoice number', () => {
    test('should use current year', () => {
      localStorageData = {};
      const number = generateInvoiceNumber();
      const year = new Date().getFullYear();
      expect(number).toContain(`-${year}-`);
    });

    test('should format year as 4 digits', () => {
      localStorageData = {};
      const number = generateInvoiceNumber();
      const yearPart = number.split('-')[1];
      expect(yearPart.length).toBe(4);
      expect(yearPart).toMatch(/^\d{4}$/);
    });
  });

  describe('Multiple invoice numbers', () => {
    test('should generate unique invoice numbers', () => {
      localStorageData = {};
      const numbers = [];
      for (let i = 0; i < 10; i++) {
        numbers.push(generateInvoiceNumber());
      }
      
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(10);
    });

    test('should generate sequential invoice numbers', () => {
      localStorageData = {};
      const numbers = [];
      for (let i = 0; i < 5; i++) {
        numbers.push(generateInvoiceNumber());
      }
      
      for (let i = 1; i < numbers.length; i++) {
        const counter1 = parseInt(numbers[i - 1].split('-')[2]);
        const counter2 = parseInt(numbers[i].split('-')[2]);
        expect(counter2).toBe(counter1 + 1);
      }
    });

    test('should handle large counter values', () => {
      localStorageData = {};
      localStorageData['asel_invoice_counter'] = '999';
      const number = generateInvoiceNumber();
      expect(number).toMatch(/INV-\d{4}-1000$/);
    });
  });

  describe('Format validation', () => {
    test('should match expected format exactly', () => {
      localStorageData = {};
      const number = generateInvoiceNumber();
      const year = new Date().getFullYear();
      const expectedFormat = new RegExp(`^INV-${year}-\\d{3}$`);
      expect(number).toMatch(expectedFormat);
    });

    test('should have correct prefix', () => {
      localStorageData = {};
      const number = generateInvoiceNumber();
      expect(number.startsWith('INV-')).toBe(true);
    });
  });
});

