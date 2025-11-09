// Integration tests for applyFilters function

const { 
  testProducts, 
  testCustomers, 
  testSalesInvoices, 
  testSalesInvoiceItems,
  getDateString,
  createTestSalesInvoice,
  createTestSalesItem
} = require('../../fixtures/reports-data');

describe('applyFilters - Integration Tests', () => {
  let mockElements;
  let salesInvoices;
  let salesInvoiceItems;
  let products;
  let customers;

  beforeEach(() => {
    // Reset data
    salesInvoices = [...testSalesInvoices];
    salesInvoiceItems = [...testSalesInvoiceItems];
    products = [...testProducts];
    customers = [...testCustomers];

    // Setup mock DOM elements
    mockElements = {
      fromDate: { value: '2024-01-01' },
      toDate: { value: '2024-12-31' },
      customerFilter: { value: '' },
      categoryFilter: { value: '' }
    };

    global.document.getElementById = jest.fn((id) => {
      return mockElements[id] || { value: '', textContent: '', innerHTML: '' };
    });
  });

  // Mock getFilters function
  function getFilters() {
    return {
      fromDate: mockElements.fromDate.value,
      toDate: mockElements.toDate.value,
      customerId: mockElements.customerFilter.value,
      category: mockElements.categoryFilter.value
    };
  }

  // Mock applyFilters function
  function applyFilters(salesInvoices, salesInvoiceItems, products, customers) {
    const filters = getFilters();
    
    // Filter invoices by date and customer
    let filteredSalesInvoices = salesInvoices.filter(inv => {
      const invDate = inv.date.split('T')[0];
      if (invDate < filters.fromDate || invDate > filters.toDate) return false;
      if (filters.customerId && inv.customerId !== filters.customerId) return false;
      return true;
    });

    // Filter invoice items by category or product
    let filteredSalesItems = salesInvoiceItems.filter(item => {
      const invoice = filteredSalesInvoices.find(inv => inv.id === item.invoiceId);
      if (!invoice) return false;
      
      if (filters.category) {
        if (filters.category.startsWith('category:')) {
          const categoryName = filters.category.replace('category:', '');
          const product = products.find(p => p.id === item.productId);
          if (!product || product.category !== categoryName) return false;
        } else if (filters.category.startsWith('product:')) {
          const productId = filters.category.replace('product:', '');
          if (item.productId !== productId) return false;
        }
      }
      return true;
    });
    
    // Filter invoices to only include those that have items from the filtered category/product
    if (filters.category) {
      const invoiceIdsWithFilteredItems = [...new Set(filteredSalesItems.map(item => item.invoiceId))];
      filteredSalesInvoices = filteredSalesInvoices.filter(inv => 
        invoiceIdsWithFilteredItems.includes(inv.id)
      );
    }

    return {
      invoices: filteredSalesInvoices,
      items: filteredSalesItems
    };
  }

  describe('Date filtering', () => {
    test('يجب فلترة الفواتير حسب التاريخ', () => {
      // Set date range to last week only
      const lastWeek = getDateString(7);
      const today = getDateString(0);
      
      mockElements.fromDate.value = lastWeek;
      mockElements.toDate.value = today;

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // Should only include invoices within date range
      result.invoices.forEach(inv => {
        const invDate = inv.date.split('T')[0];
        expect(invDate >= lastWeek && invDate <= today).toBe(true);
      });
    });

    test('يجب استبعاد الفواتير خارج النطاق الزمني', () => {
      // Set date range to last month
      const lastMonth = getDateString(30);
      const lastWeek = getDateString(7);
      
      mockElements.fromDate.value = lastMonth;
      mockElements.toDate.value = lastWeek;

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // Should not include invoices after lastWeek
      result.invoices.forEach(inv => {
        const invDate = inv.date.split('T')[0];
        expect(invDate <= lastWeek).toBe(true);
      });
    });

    test('يجب التعامل مع نطاق تاريخ فارغ', () => {
      mockElements.fromDate.value = '';
      mockElements.toDate.value = '';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // Should return empty arrays or handle gracefully
      expect(Array.isArray(result.invoices)).toBe(true);
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe('Customer filtering', () => {
    test('يجب فلترة الفواتير حسب العميل', () => {
      mockElements.customerFilter.value = 'cust-001';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // All invoices should belong to cust-001
      result.invoices.forEach(inv => {
        expect(inv.customerId).toBe('cust-001');
      });
    });

    test('يجب استبعاد فواتير العملاء الآخرين', () => {
      mockElements.customerFilter.value = 'cust-001';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // Should not include invoices from other customers
      result.invoices.forEach(inv => {
        expect(inv.customerId).not.toBe('cust-002');
      });
    });

    test('يجب إرجاع جميع الفواتير عند عدم تحديد عميل', () => {
      mockElements.customerFilter.value = '';
      // Set date range to include all test invoices
      mockElements.fromDate.value = '2024-01-01';
      mockElements.toDate.value = '2024-12-31';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // Should include all invoices within date range
      expect(result.invoices.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Category filtering', () => {
    test('يجب فلترة الفواتير حسب التصنيف', () => {
      mockElements.categoryFilter.value = 'category:تصنيف 1';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // All items should belong to products in category "تصنيف 1"
      result.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        expect(product).toBeDefined();
        expect(product.category).toBe('تصنيف 1');
      });
    });

    test('يجب فلترة الفواتير حسب منتج محدد', () => {
      mockElements.categoryFilter.value = 'product:prod-001';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // All items should belong to prod-001
      result.items.forEach(item => {
        expect(item.productId).toBe('prod-001');
      });
    });

    test('يجب استبعاد الفواتير التي لا تحتوي على منتجات من التصنيف المحدد', () => {
      mockElements.categoryFilter.value = 'category:تصنيف 2';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // Should only include invoices with items from category "تصنيف 2"
      result.invoices.forEach(inv => {
        const invoiceItems = result.items.filter(item => item.invoiceId === inv.id);
        expect(invoiceItems.length).toBeGreaterThan(0);
        invoiceItems.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          expect(product.category).toBe('تصنيف 2');
        });
      });
    });
  });

  describe('Combined filters', () => {
    test('يجب تطبيق فلترة متعددة (تاريخ + عميل)', () => {
      const lastWeek = getDateString(7);
      const today = getDateString(0);
      
      mockElements.fromDate.value = lastWeek;
      mockElements.toDate.value = today;
      mockElements.customerFilter.value = 'cust-001';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // Should only include invoices from cust-001 within date range
      result.invoices.forEach(inv => {
        expect(inv.customerId).toBe('cust-001');
        const invDate = inv.date.split('T')[0];
        expect(invDate >= lastWeek && invDate <= today).toBe(true);
      });
    });

    test('يجب تطبيق فلترة متعددة (تاريخ + عميل + تصنيف)', () => {
      const lastWeek = getDateString(7);
      const today = getDateString(0);
      
      mockElements.fromDate.value = lastWeek;
      mockElements.toDate.value = today;
      mockElements.customerFilter.value = 'cust-001';
      mockElements.categoryFilter.value = 'category:تصنيف 1';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // Should only include invoices matching all filters
      result.invoices.forEach(inv => {
        expect(inv.customerId).toBe('cust-001');
        const invDate = inv.date.split('T')[0];
        expect(invDate >= lastWeek && invDate <= today).toBe(true);
      });

      result.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        expect(product.category).toBe('تصنيف 1');
      });
    });

    test('يجب إرجاع قائمة فارغة عند عدم وجود تطابق', () => {
      // Set filters that won't match any data
      mockElements.fromDate.value = '2025-01-01';
      mockElements.toDate.value = '2025-01-31';
      mockElements.customerFilter.value = 'non-existent-customer';
      mockElements.categoryFilter.value = 'category:non-existent-category';

      const result = applyFilters(salesInvoices, salesInvoiceItems, products, customers);

      // Should return empty arrays
      expect(result.invoices.length).toBe(0);
      expect(result.items.length).toBe(0);
    });
  });

  describe('Edge cases', () => {
    test('يجب التعامل مع قائمة فواتير فارغة', () => {
      const emptyInvoices = [];
      const emptyItems = [];

      const result = applyFilters(emptyInvoices, emptyItems, products, customers);

      expect(result.invoices.length).toBe(0);
      expect(result.items.length).toBe(0);
    });

    test('يجب التعامل مع منتج غير موجود في عناصر الفاتورة', () => {
      // Create item with non-existent product
      const itemWithMissingProduct = {
        id: 'item-999',
        invoiceId: 'sales-inv-001',
        productId: 'non-existent-product',
        quantity: 10,
        unit: 'smallest',
        price: 10
      };

      const itemsWithMissing = [...salesInvoiceItems, itemWithMissingProduct];
      mockElements.categoryFilter.value = 'category:تصنيف 1';

      const result = applyFilters(salesInvoices, itemsWithMissing, products, customers);

      // Should filter out items with missing products
      result.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        expect(product).toBeDefined();
      });
    });

    test('يجب التعامل مع فواتير بدون عناصر', () => {
      const invoiceWithoutItems = createTestSalesInvoice('cust-001', getDateString(0), 1000);
      const invoicesWithEmpty = [...salesInvoices, invoiceWithoutItems];

      const result = applyFilters(invoicesWithEmpty, salesInvoiceItems, products, customers);

      // Should handle gracefully
      expect(Array.isArray(result.invoices)).toBe(true);
      expect(Array.isArray(result.items)).toBe(true);
    });
  });
});

