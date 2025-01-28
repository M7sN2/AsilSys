// Tests for generateInvoiceNumber function

describe('generateInvoiceNumber', () => {
  // Mock localStorage
  let localStorageData = {};
  let mockGetItem;
  let mockSetItem;

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
      INVOICE_COUNTER: 'asel_purchase_invoice_counter'
    };
    
    let counter = parseInt(mockGetItem(STORAGE_KEYS.INVOICE_COUNTER) || '0');
    counter++;
    mockSetItem(STORAGE_KEYS.INVOICE_COUNTER, counter.toString());
    
    const year = new Date().getFullYear();
    // Format: PUR-2024-001
    return `PUR-${year}-${String(counter).padStart(3, '0')}`;
  }

  describe('Basic invoice number generation', () => {
    test('should generate invoice number with correct format', () => {
      const invoiceNumber = generateInvoiceNumber();
      const year = new Date().getFullYear();
      expect(invoiceNumber).toMatch(/^PUR-\d{4}-\d{3}$/);
      expect(invoiceNumber).toContain(`PUR-${year}-`);
    });

    test('should start counter from 1', () => {
      // Reset counter
      localStorageData = {};
      const invoiceNumber = generateInvoiceNumber();
      expect(invoiceNumber).toMatch(/PUR-\d{4}-001$/);
    });

    test('should increment counter correctly', () => {
      const invoice1 = generateInvoiceNumber();
      const invoice2 = generateInvoiceNumber();
      const invoice3 = generateInvoiceNumber();

      // Extract counter numbers
      const counter1 = parseInt(invoice1.split('-')[2]);
      const counter2 = parseInt(invoice2.split('-')[2]);
      const counter3 = parseInt(invoice3.split('-')[2]);

      expect(counter2).toBe(counter1 + 1);
      expect(counter3).toBe(counter2 + 1);
    });

    test('should pad counter with zeros', () => {
      const invoiceNumber = generateInvoiceNumber();
      const counter = invoiceNumber.split('-')[2];
      expect(counter.length).toBe(3);
      expect(counter).toMatch(/^\d{3}$/);
    });
  });

  describe('Counter persistence', () => {
    test('should read counter from localStorage', () => {
      // Reset first
      localStorageData = {};
      localStorageData['asel_purchase_invoice_counter'] = '5';
      const invoiceNumber = generateInvoiceNumber();
      const counter = parseInt(invoiceNumber.split('-')[2]);
      expect(counter).toBe(6);
    });

    test('should save counter to localStorage', () => {
      localStorageData = {};
      generateInvoiceNumber();
      expect(mockSetItem).toHaveBeenCalledWith(
        'asel_purchase_invoice_counter',
        '1'
      );
    });

    test('should handle missing counter in localStorage', () => {
      // Counter not set
      localStorageData = {};
      const invoiceNumber = generateInvoiceNumber();
      expect(invoiceNumber).toMatch(/PUR-\d{4}-001$/);
    });

    test('should handle counter reset', () => {
      // Reset first
      localStorageData = {};
      // First generation
      generateInvoiceNumber();
      // Reset localStorage
      localStorageData = {};
      // Should start from 1 again
      const invoiceNumber = generateInvoiceNumber();
      expect(invoiceNumber).toMatch(/PUR-\d{4}-001$/);
    });
  });

  describe('Year in invoice number', () => {
    test('should use current year', () => {
      const currentYear = new Date().getFullYear();
      const invoiceNumber = generateInvoiceNumber();
      expect(invoiceNumber).toContain(`PUR-${currentYear}-`);
    });

    test('should format year as 4 digits', () => {
      const invoiceNumber = generateInvoiceNumber();
      const year = invoiceNumber.split('-')[1];
      expect(year.length).toBe(4);
      expect(parseInt(year)).toBeGreaterThan(2000);
      expect(parseInt(year)).toBeLessThan(2100);
    });
  });

  describe('Multiple invoice numbers', () => {
    test('should generate unique invoice numbers', () => {
      const invoice1 = generateInvoiceNumber();
      const invoice2 = generateInvoiceNumber();
      const invoice3 = generateInvoiceNumber();

      expect(invoice1).not.toBe(invoice2);
      expect(invoice2).not.toBe(invoice3);
      expect(invoice1).not.toBe(invoice3);
    });

    test('should generate sequential invoice numbers', () => {
      const invoices = [];
      for (let i = 0; i < 10; i++) {
        invoices.push(generateInvoiceNumber());
      }

      // Check that all counters are sequential
      const counters = invoices.map(inv => parseInt(inv.split('-')[2]));
      for (let i = 1; i < counters.length; i++) {
        expect(counters[i]).toBe(counters[i - 1] + 1);
      }
    });

    test('should handle large counter values', () => {
      localStorageData = {};
      localStorageData['asel_purchase_invoice_counter'] = '999';
      const invoiceNumber = generateInvoiceNumber();
      expect(invoiceNumber).toMatch(/PUR-\d{4}-1000$/);
    });
  });

  describe('Format validation', () => {
    test('should match expected format exactly', () => {
      const invoiceNumber = generateInvoiceNumber();
      const parts = invoiceNumber.split('-');
      
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('PUR');
      expect(parts[1].length).toBe(4); // Year
      expect(parts[2].length).toBe(3); // Counter
    });

    test('should have correct prefix', () => {
      const invoiceNumber = generateInvoiceNumber();
      expect(invoiceNumber.startsWith('PUR-')).toBe(true);
    });
  });
});

