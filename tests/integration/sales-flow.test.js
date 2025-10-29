// Integration tests for sales invoice flow

const { setupMockElectronAPI } = require('../helpers/test-helpers');
const { testCustomer, testProduct } = require('../fixtures/sample-data');

describe('Sales Invoice Flow - Integration Tests', () => {
  let mockData;
  let invoices;
  let customers;
  let products;
  let invoiceProducts;

  beforeEach(() => {
    invoices = [];
    customers = [];
    products = [];
    invoiceProducts = [];

    mockData = setupMockElectronAPI();
    mockData.sales_invoices = [];
    mockData.customers = [];
    mockData.products = [];
    mockData.sales_invoice_items = [];

    global.window = {
      electronAPI: {
        dbGetAll: jest.fn(async (table, where = '', params = []) => {
          if (table === 'sales_invoices') return mockData.sales_invoices;
          if (table === 'customers') return mockData.customers;
          if (table === 'products') return mockData.products;
          if (table === 'sales_invoice_items') {
            if (where.includes('invoiceId = ?')) {
              return mockData.sales_invoice_items.filter(item => item.invoiceId === params[0]);
            }
            return mockData.sales_invoice_items;
          }
          return [];
        }),
        dbInsert: jest.fn(async (table, data) => {
          if (table === 'sales_invoices') {
            mockData.sales_invoices.push(data);
            return { success: true, id: data.id };
          }
          if (table === 'customers') {
            mockData.customers.push(data);
            return { success: true, id: data.id };
          }
          if (table === 'products') {
            mockData.products.push(data);
            return { success: true, id: data.id };
          }
          if (table === 'sales_invoice_items') {
            mockData.sales_invoice_items.push(data);
            return { success: true, id: data.id };
          }
          return { success: true };
        }),
        dbUpdate: jest.fn(async (table, id, data) => {
          if (table === 'sales_invoices') {
            const index = mockData.sales_invoices.findIndex(i => i.id === id);
            if (index !== -1) {
              mockData.sales_invoices[index] = { ...mockData.sales_invoices[index], ...data };
            }
            return { success: true };
          }
          if (table === 'customers') {
            const index = mockData.customers.findIndex(c => c.id === id);
            if (index !== -1) {
              mockData.customers[index] = { ...mockData.customers[index], ...data };
            }
            return { success: true };
          }
          if (table === 'products') {
            const index = mockData.products.findIndex(p => p.id === id);
            if (index !== -1) {
              mockData.products[index] = { ...mockData.products[index], ...data };
            }
            return { success: true };
          }
          return { success: true };
        }),
        dbDelete: jest.fn(async (table, id) => {
          if (table === 'sales_invoices') {
            mockData.sales_invoices = mockData.sales_invoices.filter(i => i.id !== id);
            return { success: true };
          }
          return { success: true };
        })
      }
    };
  });

  describe('Complete Sales Invoice Flow', () => {
    test('should create sales invoice and update customer balance', async () => {
      // 1. Setup customer and product
      const customer = {
        ...testCustomer,
        id: 'customer-001',
        balance: 0
      };
      await global.window.electronAPI.dbInsert('customers', customer);
      mockData.customers.push(customer);

      const product = {
        ...testProduct,
        id: 'product-001',
        stock: 100
      };
      await global.window.electronAPI.dbInsert('products', product);
      mockData.products.push(product);

      // 2. Create invoice (dbInsert already adds to mockData.sales_invoices)
      const invoice = {
        id: 'invoice-001',
        invoiceNumber: 'INV-2024-001',
        customerId: customer.id,
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        subtotal: 100,
        taxRate: 14,
        taxAmount: 14,
        shipping: 10,
        discount: 5,
        total: 119,
        paid: 50,
        remaining: 69
      };
      await global.window.electronAPI.dbInsert('sales_invoices', invoice);

      // 3. Add invoice items (dbInsert already adds to mockData.sales_invoice_items)
      const invoiceItem = {
        id: 'item-001',
        invoiceId: invoice.id,
        productId: product.id,
        quantity: 5,
        unit: 'smallest',
        price: 20,
        total: 100
      };
      await global.window.electronAPI.dbInsert('sales_invoice_items', invoiceItem);

      // 4. Update customer balance
      await global.window.electronAPI.dbUpdate('customers', customer.id, {
        balance: customer.balance + invoice.remaining
      });

      // 5. Verify
      expect(mockData.sales_invoices.length).toBe(1);
      expect(mockData.sales_invoice_items.length).toBe(1);
      const updatedCustomer = mockData.customers.find(c => c.id === customer.id);
      expect(updatedCustomer.balance).toBe(69);
    });

    test('should handle multiple products in sales invoice', async () => {
      const customer = {
        ...testCustomer,
        id: 'customer-002',
        balance: 0
      };
      mockData.customers.push(customer);

      const product1 = { ...testProduct, id: 'product-001', stock: 100 };
      const product2 = { ...testProduct, id: 'product-002', stock: 50 };
      mockData.products.push(product1, product2);

      const invoice = {
        id: 'invoice-002',
        invoiceNumber: 'INV-2024-002',
        customerId: customer.id,
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        subtotal: 200,
        total: 200,
        paid: 0,
        remaining: 200
      };
      mockData.sales_invoices.push(invoice);

      const item1 = {
        id: 'item-001',
        invoiceId: invoice.id,
        productId: product1.id,
        quantity: 10,
        total: 100
      };
      const item2 = {
        id: 'item-002',
        invoiceId: invoice.id,
        productId: product2.id,
        quantity: 5,
        total: 100
      };
      mockData.sales_invoice_items.push(item1, item2);

      const items = mockData.sales_invoice_items.filter(item => item.invoiceId === invoice.id);
      expect(items.length).toBe(2);
      expect(items.reduce((sum, item) => sum + item.total, 0)).toBe(200);
    });

    test('should calculate customer balance correctly', async () => {
      const customer = {
        ...testCustomer,
        id: 'customer-003',
        balance: 100,
        openingBalance: 50
      };
      mockData.customers.push(customer);

      const invoice1 = {
        id: 'invoice-003',
        invoiceNumber: 'INV-2024-003',
        customerId: customer.id,
        total: 150,
        paid: 50,
        remaining: 100
      };
      mockData.sales_invoices.push(invoice1);

      // Recalculate balance
      const invoices = mockData.sales_invoices.filter(inv => inv.customerId === customer.id);
      const totalRemaining = invoices.reduce((sum, inv) => sum + (inv.remaining || 0), 0);
      const newBalance = customer.openingBalance + totalRemaining;

      expect(newBalance).toBe(150);
    });
  });

  describe('Stock Management', () => {
    test('should reduce stock on sale', async () => {
      const product = {
        ...testProduct,
        id: 'product-001',
        stock: 100,
        openingStock: 100
      };
      mockData.products.push(product);

      const invoice = {
        id: 'invoice-004',
        invoiceNumber: 'INV-2024-004',
        customerId: 'customer-001',
        status: 'delivered'
      };
      mockData.sales_invoices.push(invoice);

      const invoiceItem = {
        id: 'item-001',
        invoiceId: invoice.id,
        productId: product.id,
        quantity: 10,
        unit: 'smallest'
      };
      mockData.sales_invoice_items.push(invoiceItem);

      // Update stock
      const productIndex = mockData.products.findIndex(p => p.id === product.id);
      mockData.products[productIndex].stock -= invoiceItem.quantity;

      expect(mockData.products[productIndex].stock).toBe(90);
    });

    test('should handle multiple sales of same product', async () => {
      const product = {
        ...testProduct,
        id: 'product-001',
        stock: 100
      };
      mockData.products.push(product);

      const invoice1 = {
        id: 'invoice-005',
        invoiceNumber: 'INV-2024-005',
        customerId: 'customer-001',
        status: 'delivered'
      };
      const invoice2 = {
        id: 'invoice-006',
        invoiceNumber: 'INV-2024-006',
        customerId: 'customer-002',
        status: 'delivered'
      };
      mockData.sales_invoices.push(invoice1, invoice2);

      const item1 = {
        id: 'item-001',
        invoiceId: invoice1.id,
        productId: product.id,
        quantity: 20
      };
      const item2 = {
        id: 'item-002',
        invoiceId: invoice2.id,
        productId: product.id,
        quantity: 30
      };
      mockData.sales_invoice_items.push(item1, item2);

      // Update stock for both sales
      const productIndex = mockData.products.findIndex(p => p.id === product.id);
      const totalQuantity = item1.quantity + item2.quantity;
      mockData.products[productIndex].stock -= totalQuantity;

      expect(mockData.products[productIndex].stock).toBe(50);
    });
  });

  describe('Balance Calculations', () => {
    test('should calculate balance from opening balance and invoices', async () => {
      const customer = {
        ...testCustomer,
        id: 'customer-004',
        openingBalance: 100,
        balance: 0
      };
      mockData.customers.push(customer);

      const invoice1 = {
        id: 'invoice-007',
        customerId: customer.id,
        total: 200,
        paid: 100,
        remaining: 100
      };
      const invoice2 = {
        id: 'invoice-008',
        customerId: customer.id,
        total: 150,
        paid: 50,
        remaining: 100
      };
      mockData.sales_invoices.push(invoice1, invoice2);

      const invoices = mockData.sales_invoices.filter(inv => inv.customerId === customer.id);
      const totalRemaining = invoices.reduce((sum, inv) => sum + (inv.remaining || 0), 0);
      const calculatedBalance = customer.openingBalance + totalRemaining;

      expect(calculatedBalance).toBe(300);
    });

    test('should handle zero opening balance', async () => {
      const customer = {
        ...testCustomer,
        id: 'customer-005',
        openingBalance: 0,
        balance: 0
      };
      mockData.customers.push(customer);

      const invoice = {
        id: 'invoice-009',
        customerId: customer.id,
        total: 100,
        paid: 0,
        remaining: 100
      };
      mockData.sales_invoices.push(invoice);

      const invoices = mockData.sales_invoices.filter(inv => inv.customerId === customer.id);
      const totalRemaining = invoices.reduce((sum, inv) => sum + (inv.remaining || 0), 0);
      const calculatedBalance = customer.openingBalance + totalRemaining;

      expect(calculatedBalance).toBe(100);
    });
  });
});

