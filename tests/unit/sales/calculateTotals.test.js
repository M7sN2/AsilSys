// Tests for calculateTotals function from sales.js

const { createMockElement } = require('../../helpers/test-helpers');

describe('calculateTotals', () => {
  let invoiceProducts;
  let customers;
  let mockElements;

  // Copy the function for testing
  async function calculateTotals() {
    const subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    const taxRateField = mockElements.taxRate;
    let taxRate = parseFloat(taxRateField.value);
    
    if (isNaN(taxRate) || taxRateField.value === '') {
      taxRate = 0;
    }
    
    const taxAmount = (subtotal * taxRate) / 100;
    const shipping = parseFloat(mockElements.shipping.value) || 0;
    const discount = parseFloat(mockElements.discount.value) || 0;
    const total = subtotal + taxAmount + shipping - discount;
    const paid = parseFloat(mockElements.paid.value) || 0;
    const remaining = total - paid;

    mockElements.subtotal.textContent = `${subtotal.toFixed(2)} ج.م`;
    mockElements.taxAmount.textContent = `${taxAmount.toFixed(2)} ج.م`;
    mockElements.total.textContent = `${total.toFixed(2)} ج.م`;
    mockElements.remaining.textContent = `${remaining.toFixed(2)} ج.م`;

    const customerId = mockElements.customerSelect.value;
    
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        const oldBalance = customer.balance || 0;
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
    invoiceProducts = [];
    customers = [];

    mockElements = {
      taxRate: createMockElement('taxRate', '0'),
      shipping: createMockElement('shipping', '0'),
      discount: createMockElement('discount', '0'),
      paid: createMockElement('paid', '0'),
      subtotal: createMockElement('subtotal', '', '0.00 ج.م'),
      taxAmount: createMockElement('taxAmount', '', '0.00 ج.م'),
      total: createMockElement('total', '', '0.00 ج.م'),
      remaining: createMockElement('remaining', '', '0.00 ج.م'),
      customerSelect: createMockElement('customerSelect', ''),
      oldBalanceDisplay: createMockElement('oldBalanceDisplay', '', '0.00 ج.م'),
      newBalanceDisplay: createMockElement('newBalanceDisplay', '', '0.00 ج.م'),
      newBalanceRow: createMockElement('newBalanceRow'),
      finalBalanceRow: createMockElement('finalBalanceRow')
    };

    global.document.getElementById = jest.fn((id) => {
      const elementMap = {
        taxRate: mockElements.taxRate,
        shipping: mockElements.shipping,
        discount: mockElements.discount,
        paid: mockElements.paid,
        subtotal: mockElements.subtotal,
        taxAmount: mockElements.taxAmount,
        total: mockElements.total,
        remaining: mockElements.remaining,
        customerSelect: mockElements.customerSelect,
        oldBalanceDisplay: mockElements.oldBalanceDisplay,
        newBalanceDisplay: mockElements.newBalanceDisplay,
        newBalanceRow: mockElements.newBalanceRow,
        finalBalanceRow: mockElements.finalBalanceRow
      };
      return elementMap[id] || createMockElement(id);
    });
  });

  describe('Basic calculations', () => {
    test('should calculate subtotal from products', async () => {
      invoiceProducts = [
        { total: 100 },
        { total: 50 },
        { total: 25 }
      ];
      await calculateTotals();
      expect(mockElements.subtotal.textContent).toBe('175.00 ج.م');
    });

    test('should calculate total with tax', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.taxRate.value = '14';
      await calculateTotals();
      expect(mockElements.taxAmount.textContent).toBe('14.00 ج.م');
      expect(mockElements.total.textContent).toBe('114.00 ج.م');
    });

    test('should calculate total with shipping', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.shipping.value = '10';
      await calculateTotals();
      expect(mockElements.total.textContent).toBe('110.00 ج.م');
    });

    test('should calculate total with discount', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.discount.value = '5';
      await calculateTotals();
      expect(mockElements.total.textContent).toBe('95.00 ج.م');
    });

    test('should calculate total with shipping and discount', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.shipping.value = '10';
      mockElements.discount.value = '5';
      await calculateTotals();
      expect(mockElements.total.textContent).toBe('105.00 ج.م');
    });

    test('should calculate remaining amount', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '50';
      await calculateTotals();
      expect(mockElements.remaining.textContent).toBe('50.00 ج.م');
    });

    test('should handle zero products', async () => {
      invoiceProducts = [];
      await calculateTotals();
      expect(mockElements.subtotal.textContent).toBe('0.00 ج.م');
      expect(mockElements.total.textContent).toBe('0.00 ج.م');
    });
  });

  describe('Tax calculations', () => {
    test('should calculate tax correctly', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.taxRate.value = '14';
      await calculateTotals();
      expect(mockElements.taxAmount.textContent).toBe('14.00 ج.م');
    });

    test('should handle zero tax rate', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.taxRate.value = '0';
      await calculateTotals();
      expect(mockElements.taxAmount.textContent).toBe('0.00 ج.م');
    });

    test('should handle empty tax rate', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.taxRate.value = '';
      await calculateTotals();
      expect(mockElements.taxAmount.textContent).toBe('0.00 ج.م');
    });

    test('should include tax in total', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.taxRate.value = '14';
      await calculateTotals();
      const total = parseFloat(mockElements.total.textContent.replace(' ج.م', ''));
      expect(total).toBe(114);
    });
  });

  describe('Customer balance calculations', () => {
    test('should calculate new balance when customer is selected', async () => {
      customers = [{
        id: 'customer-1',
        name: 'عميل 1',
        balance: 100
      }];
      invoiceProducts = [{ total: 100 }];
      mockElements.customerSelect.value = 'customer-1';
      mockElements.paid.value = '50';
      await calculateTotals();
      
      expect(mockElements.oldBalanceDisplay.textContent).toBe('100.00 ج.م');
      expect(mockElements.newBalanceDisplay.textContent).toBe('150.00 ج.م');
      expect(mockElements.newBalanceRow.style.display).toBe('flex');
      expect(mockElements.finalBalanceRow.style.display).toBe('flex');
    });

    test('should hide balance rows when no customer selected', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.customerSelect.value = '';
      await calculateTotals();
      
      expect(mockElements.newBalanceRow.style.display).toBe('none');
      expect(mockElements.finalBalanceRow.style.display).toBe('none');
    });

    test('should handle customer with zero balance', async () => {
      customers = [{
        id: 'customer-1',
        name: 'عميل 1',
        balance: 0
      }];
      invoiceProducts = [{ total: 100 }];
      mockElements.customerSelect.value = 'customer-1';
      await calculateTotals();
      
      expect(mockElements.oldBalanceDisplay.textContent).toBe('0.00 ج.م');
      expect(mockElements.newBalanceDisplay.textContent).toBe('100.00 ج.م');
    });

    test('should handle customer with negative balance', async () => {
      customers = [{
        id: 'customer-1',
        name: 'عميل 1',
        balance: -50
      }];
      invoiceProducts = [{ total: 100 }];
      mockElements.customerSelect.value = 'customer-1';
      await calculateTotals();
      
      expect(mockElements.oldBalanceDisplay.textContent).toBe('-50.00 ج.م');
      expect(mockElements.newBalanceDisplay.textContent).toBe('50.00 ج.م');
    });
  });

  describe('Edge cases', () => {
    test('should handle empty shipping value', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.shipping.value = '';
      await calculateTotals();
      expect(mockElements.total.textContent).toBe('100.00 ج.م');
    });

    test('should handle empty discount value', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.discount.value = '';
      await calculateTotals();
      expect(mockElements.total.textContent).toBe('100.00 ج.م');
    });

    test('should handle empty paid value', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '';
      await calculateTotals();
      expect(mockElements.remaining.textContent).toBe('100.00 ج.م');
    });

    test('should handle invalid tax rate', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.taxRate.value = 'invalid';
      await calculateTotals();
      expect(mockElements.taxAmount.textContent).toBe('0.00 ج.م');
    });

    test('should handle negative discount', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.discount.value = '-10';
      await calculateTotals();
      expect(mockElements.total.textContent).toBe('110.00 ج.م');
    });

    test('should handle paid amount greater than total', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '150';
      await calculateTotals();
      expect(mockElements.remaining.textContent).toBe('-50.00 ج.م');
    });

    test('should handle multiple products with different totals', async () => {
      invoiceProducts = [
        { total: 100 },
        { total: 200 },
        { total: 50 }
      ];
      mockElements.taxRate.value = '14';
      await calculateTotals();
      expect(mockElements.subtotal.textContent).toBe('350.00 ج.م');
      expect(mockElements.taxAmount.textContent).toBe('49.00 ج.م');
      expect(mockElements.total.textContent).toBe('399.00 ج.م');
    });
  });

  describe('Complex scenarios', () => {
    test('should calculate complete invoice correctly', async () => {
      customers = [{
        id: 'customer-1',
        name: 'عميل 1',
        balance: 50
      }];
      invoiceProducts = [
        { total: 100 },
        { total: 50 }
      ];
      mockElements.customerSelect.value = 'customer-1';
      mockElements.taxRate.value = '14';
      mockElements.shipping.value = '10';
      mockElements.discount.value = '5';
      mockElements.paid.value = '100';
      await calculateTotals();
      
      expect(mockElements.subtotal.textContent).toBe('150.00 ج.م');
      expect(mockElements.taxAmount.textContent).toBe('21.00 ج.م');
      expect(mockElements.total.textContent).toBe('176.00 ج.م');
      expect(mockElements.remaining.textContent).toBe('76.00 ج.م');
      expect(mockElements.newBalanceDisplay.textContent).toBe('126.00 ج.م');
    });

    test('should handle full payment', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '100';
      await calculateTotals();
      expect(mockElements.remaining.textContent).toBe('0.00 ج.م');
    });

    test('should handle no payment', async () => {
      invoiceProducts = [{ total: 100 }];
      mockElements.paid.value = '0';
      await calculateTotals();
      expect(mockElements.remaining.textContent).toBe('100.00 ج.م');
    });
  });
});

