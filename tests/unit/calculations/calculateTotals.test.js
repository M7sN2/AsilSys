// Tests for calculateTotals function

const { setupMockDOM, createMockElement } = require('../../helpers/test-helpers');

describe('calculateTotals', () => {
  let mockElements;
  let invoiceProducts;
  let suppliers;

  // Copy the function for testing
  function calculateTotals() {
    const subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    // Tax is always 0 for purchase invoices (no VAT)
    const taxRate = 0;
    const taxAmount = 0;
    const shipping = parseFloat(mockElements.shipping.value) || 0;
    const discount = parseFloat(mockElements.discount.value) || 0;
    const total = subtotal + taxAmount + shipping - discount;
    const paid = parseFloat(mockElements.paid.value) || 0;
    const remaining = total - paid;

    mockElements.subtotal.textContent = `${subtotal.toFixed(2)} ج.م`;
    mockElements.taxAmount.textContent = `${taxAmount.toFixed(2)} ج.م`;
    mockElements.total.textContent = `${total.toFixed(2)} ج.م`;
    mockElements.remaining.textContent = `${remaining.toFixed(2)} ج.م`;

    // Show balance info if supplier selected
    const supplierId = mockElements.supplierSelect.value;
    
    if (supplierId) {
      const supplier = suppliers.find(s => s.id === supplierId);
      if (supplier) {
        const oldBalance = supplier.balance || 0;
        const newBalance = oldBalance + remaining;
        
        mockElements.oldBalanceDisplay.textContent = `${oldBalance.toFixed(2)} ج.م`;
        mockElements.newBalanceDisplay.textContent = `${newBalance.toFixed(2)} ج.م`;
        mockElements.newBalanceRow.style.display = 'flex';
        mockElements.finalBalanceRow.style.display = 'flex';
      }
    } else {
      mockElements.newBalanceRow.style.display = 'none';
      mockElements.finalBalanceRow.style.display = 'none';
    }
  }

  beforeEach(() => {
    // Setup mock DOM
    mockElements = {
      shipping: createMockElement('shipping', '0'),
      discount: createMockElement('discount', '0'),
      paid: createMockElement('paid', '0'),
      subtotal: createMockElement('subtotal', '', '0.00 ج.م'),
      taxAmount: createMockElement('taxAmount', '', '0.00 ج.م'),
      total: createMockElement('total', '', '0.00 ج.م'),
      remaining: createMockElement('remaining', '', '0.00 ج.م'),
      supplierSelect: createMockElement('supplierSelect', ''),
      oldBalanceDisplay: createMockElement('oldBalanceDisplay', '', '0.00 ج.م'),
      newBalanceDisplay: createMockElement('newBalanceDisplay', '', '0.00 ج.م'),
      newBalanceRow: createMockElement('newBalanceRow'),
      finalBalanceRow: createMockElement('finalBalanceRow')
    };

    invoiceProducts = [];
    suppliers = [];
  });

  describe('Basic calculations', () => {
    test('should calculate subtotal from products', () => {
      invoiceProducts = [
        { total: 100 },
        { total: 50 },
        { total: 25 }
      ];

      calculateTotals();

      expect(mockElements.subtotal.textContent).toBe('175.00 ج.م');
    });

    test('should calculate total with shipping', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.shipping.value = '20';

      calculateTotals();

      expect(mockElements.total.textContent).toBe('120.00 ج.م');
    });

    test('should calculate total with discount', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.discount.value = '10';

      calculateTotals();

      expect(mockElements.total.textContent).toBe('90.00 ج.م');
    });

    test('should calculate total with shipping and discount', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.shipping.value = '20';
      mockElements.discount.value = '10';

      calculateTotals();

      expect(mockElements.total.textContent).toBe('110.00 ج.م');
    });

    test('should calculate remaining amount', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '80';

      calculateTotals();

      expect(mockElements.remaining.textContent).toBe('20.00 ج.م');
    });

    test('should handle zero products', () => {
      invoiceProducts = [];

      calculateTotals();

      expect(mockElements.subtotal.textContent).toBe('0.00 ج.م');
      expect(mockElements.total.textContent).toBe('0.00 ج.م');
      expect(mockElements.remaining.textContent).toBe('0.00 ج.م');
    });
  });

  describe('Tax calculations', () => {
    test('should always set tax to 0 for purchase invoices', () => {
      invoiceProducts = [{ total: 100 }];

      calculateTotals();

      expect(mockElements.taxAmount.textContent).toBe('0.00 ج.م');
    });

    test('should not include tax in total', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.shipping.value = '20';

      calculateTotals();

      // Total should be 100 + 20 = 120, not including tax
      expect(mockElements.total.textContent).toBe('120.00 ج.م');
    });
  });

  describe('Supplier balance calculations', () => {
    test('should calculate new balance when supplier is selected', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '80';
      mockElements.supplierSelect.value = 'supplier-1';
      
      suppliers = [{
        id: 'supplier-1',
        balance: 50
      }];

      calculateTotals();

      // Old balance: 50, Remaining: 20, New balance: 70
      expect(mockElements.oldBalanceDisplay.textContent).toBe('50.00 ج.م');
      expect(mockElements.newBalanceDisplay.textContent).toBe('70.00 ج.م');
      expect(mockElements.newBalanceRow.style.display).toBe('flex');
      expect(mockElements.finalBalanceRow.style.display).toBe('flex');
    });

    test('should hide balance rows when no supplier selected', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.supplierSelect.value = '';

      calculateTotals();

      expect(mockElements.newBalanceRow.style.display).toBe('none');
      expect(mockElements.finalBalanceRow.style.display).toBe('none');
    });

    test('should handle supplier with zero balance', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '50';
      mockElements.supplierSelect.value = 'supplier-1';
      
      suppliers = [{
        id: 'supplier-1',
        balance: 0
      }];

      calculateTotals();

      expect(mockElements.oldBalanceDisplay.textContent).toBe('0.00 ج.م');
      expect(mockElements.newBalanceDisplay.textContent).toBe('50.00 ج.م');
    });

    test('should handle supplier with negative balance', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '150';
      mockElements.supplierSelect.value = 'supplier-1';
      
      suppliers = [{
        id: 'supplier-1',
        balance: -20
      }];

      calculateTotals();

      // Remaining: -50, Old balance: -20, New balance: -70
      expect(mockElements.oldBalanceDisplay.textContent).toBe('-20.00 ج.م');
      expect(mockElements.newBalanceDisplay.textContent).toBe('-70.00 ج.م');
    });
  });

  describe('Edge cases', () => {
    test('should handle empty shipping value', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.shipping.value = '';

      calculateTotals();

      expect(mockElements.total.textContent).toBe('100.00 ج.م');
    });

    test('should handle empty discount value', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.discount.value = '';

      calculateTotals();

      expect(mockElements.total.textContent).toBe('100.00 ج.م');
    });

    test('should handle empty paid value', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '';

      calculateTotals();

      expect(mockElements.remaining.textContent).toBe('100.00 ج.م');
    });

    test('should handle invalid shipping value', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.shipping.value = 'abc';

      calculateTotals();

      expect(mockElements.total.textContent).toBe('100.00 ج.م');
    });

    test('should handle negative discount', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.discount.value = '-10';

      calculateTotals();

      // Negative discount is parsed as -10, so total = 100 - (-10) = 110
      // This is the actual behavior - negative discount increases total
      expect(mockElements.total.textContent).toBe('110.00 ج.م');
    });

    test('should handle paid amount greater than total', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '150';

      calculateTotals();

      expect(mockElements.remaining.textContent).toBe('-50.00 ج.م');
    });

    test('should handle multiple products with different totals', () => {
      invoiceProducts = [
        { total: 100.50 },
        { total: 75.25 },
        { total: 200.75 }
      ];
      mockElements.shipping.value = '30';
      mockElements.discount.value = '15';

      calculateTotals();

      // Subtotal: 376.50, Total: 376.50 + 30 - 15 = 391.50
      expect(mockElements.subtotal.textContent).toBe('376.50 ج.م');
      expect(mockElements.total.textContent).toBe('391.50 ج.م');
    });
  });

  describe('Complex scenarios', () => {
    test('should calculate complete invoice correctly', () => {
      invoiceProducts = [
        { total: 100 },
        { total: 200 },
        { total: 150 }
      ];
      mockElements.shipping.value = '50';
      mockElements.discount.value = '25';
      mockElements.paid.value = '400';
      mockElements.supplierSelect.value = 'supplier-1';
      
      suppliers = [{
        id: 'supplier-1',
        balance: 100
      }];

      calculateTotals();

      // Subtotal: 450, Total: 450 + 50 - 25 = 475, Remaining: 475 - 400 = 75
      expect(mockElements.subtotal.textContent).toBe('450.00 ج.م');
      expect(mockElements.total.textContent).toBe('475.00 ج.م');
      expect(mockElements.remaining.textContent).toBe('75.00 ج.م');
      expect(mockElements.newBalanceDisplay.textContent).toBe('175.00 ج.م');
    });

    test('should handle full payment', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '100';

      calculateTotals();

      expect(mockElements.remaining.textContent).toBe('0.00 ج.م');
    });

    test('should handle no payment', () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '0';

      calculateTotals();

      expect(mockElements.remaining.textContent).toBe('100.00 ج.م');
    });
  });
});

