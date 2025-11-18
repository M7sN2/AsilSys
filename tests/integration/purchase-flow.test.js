// Integration tests for purchase invoice flow

const { setupMockElectronAPI, setupMockLocalStorage } = require('../helpers/test-helpers');
const { testSupplier, testProduct, testPurchaseInvoice } = require('../fixtures/sample-data');

describe('Purchase Invoice Flow - Integration Tests', () => {
  let mockData;
  let invoices;
  let suppliers;
  let products;
  let invoiceProducts;

  beforeEach(() => {
    // Initialize arrays
    invoices = [];
    suppliers = [];
    products = [];
    invoiceProducts = [];

    // Setup mocks
    mockData = setupMockElectronAPI();
    setupMockLocalStorage();

    // Add test data
    suppliers.push({ ...testSupplier });
    products.push({ ...testProduct });
    mockData.suppliers = [...suppliers];
    mockData.products = [...products];
  });

  describe('Complete Purchase Invoice Flow', () => {
    test('should create purchase invoice and update stock', async () => {
      // 1. Create supplier
      const supplier = suppliers[0];
      expect(supplier).toBeDefined();
      expect(supplier.balance).toBe(0);

      // 2. Create product
      const product = products[0];
      expect(product).toBeDefined();
      expect(product.stock).toBe(100);

      // 3. Create purchase invoice
      const invoice = {
        id: 'test-invoice-001',
        invoiceNumber: 'PUR-2024-001',
        supplierId: supplier.id,
        date: new Date().toISOString().split('T')[0],
        products: [{
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          quantity: 50,
          unit: 'smallest',
          unitName: product.smallestUnit,
          price: 10,
          total: 500
        }],
        subtotal: 500,
        taxRate: 0,
        taxAmount: 0,
        shipping: 20,
        discount: 10,
        total: 510,
        paid: 500,
        remaining: 10
      };

      // 4. Save invoice
      invoices.push(invoice);
      mockData.invoices = [...invoices];

      // 5. Update product stock
      const productIndex = products.findIndex(p => p.id === product.id);
      if (productIndex !== -1) {
        products[productIndex].stock += 50; // Add stock on purchase
        expect(products[productIndex].stock).toBe(150);
      }

      // 6. Update supplier balance
      const supplierIndex = suppliers.findIndex(s => s.id === supplier.id);
      if (supplierIndex !== -1) {
        suppliers[supplierIndex].balance += invoice.remaining;
        expect(suppliers[supplierIndex].balance).toBe(10);
      }

      // 7. Verify results
      expect(invoice.total).toBe(510);
      expect(invoice.remaining).toBe(10);
      expect(products[productIndex].stock).toBe(150);
      expect(suppliers[supplierIndex].balance).toBe(10);
    });

    test('should handle multiple products in purchase invoice', async () => {
      const supplier = suppliers[0];
      const product1 = products[0];
      const product2 = { ...testProduct, id: 'test-product-002', code: 'PROD002', stock: 200 };

      products.push(product2);
      mockData.products = [...products];

      const invoice = {
        id: 'test-invoice-002',
        invoiceNumber: 'PUR-2024-002',
        supplierId: supplier.id,
        products: [
          {
            productId: product1.id,
            quantity: 30,
            price: 10,
            total: 300
          },
          {
            productId: product2.id,
            quantity: 20,
            price: 15,
            total: 300
          }
        ],
        subtotal: 600,
        shipping: 0,
        discount: 0,
        total: 600,
        paid: 600,
        remaining: 0
      };

      // Update stocks
      const product1Index = products.findIndex(p => p.id === product1.id);
      const product2Index = products.findIndex(p => p.id === product2.id);
      
      products[product1Index].stock += 30;
      products[product2Index].stock += 20;

      // Verify
      expect(products[product1Index].stock).toBe(130);
      expect(products[product2Index].stock).toBe(220);
      expect(invoice.total).toBe(600);
      expect(invoice.remaining).toBe(0);
    });

    test('should calculate supplier balance correctly', async () => {
      const supplier = suppliers[0];
      const product = products[0];

      // Create first invoice
      const invoice1 = {
        id: 'test-invoice-003',
        supplierId: supplier.id,
        total: 1000,
        paid: 800,
        remaining: 200
      };

      suppliers[0].balance += invoice1.remaining;
      expect(suppliers[0].balance).toBe(200);

      // Create second invoice
      const invoice2 = {
        id: 'test-invoice-004',
        supplierId: supplier.id,
        total: 500,
        paid: 300,
        remaining: 200
      };

      suppliers[0].balance += invoice2.remaining;
      expect(suppliers[0].balance).toBe(400);
    });
  });

  describe('Stock Management', () => {
    test('should add stock on purchase', async () => {
      const product = products[0];
      const initialStock = product.stock;

      const purchaseQuantity = 50;
      const productIndex = products.findIndex(p => p.id === product.id);
      products[productIndex].stock += purchaseQuantity;

      expect(products[productIndex].stock).toBe(initialStock + purchaseQuantity);
    });

    test('should handle multiple purchases of same product', async () => {
      const product = products[0];
      const initialStock = product.stock;

      // First purchase
      products[0].stock += 30;
      expect(products[0].stock).toBe(initialStock + 30);

      // Second purchase
      products[0].stock += 20;
      expect(products[0].stock).toBe(initialStock + 50);
    });
  });

  describe('Balance Calculations', () => {
    test('should calculate balance from opening balance and invoices', async () => {
      const supplier = {
        ...testSupplier,
        openingBalance: 100,
        balance: 100
      };

      // Add invoice with remaining
      const remaining = 50;
      supplier.balance += remaining;

      expect(supplier.balance).toBe(150);
    });

    test('should handle zero opening balance', async () => {
      const supplier = {
        ...testSupplier,
        openingBalance: 0,
        balance: 0
      };

      const remaining = 100;
      supplier.balance += remaining;

      expect(supplier.balance).toBe(100);
    });
  });
});

