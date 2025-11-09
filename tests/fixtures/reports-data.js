// Test data fixtures for reports testing

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const lastWeek = new Date(today);
lastWeek.setDate(today.getDate() - 7);
const lastMonth = new Date(today);
lastMonth.setDate(today.getDate() - 30);

module.exports = {
  // Test Products
  testProducts: [
    {
      id: 'prod-001',
      code: 'PROD001',
      name: 'منتج أ',
      category: 'تصنيف 1',
      smallestUnit: 'قطعة',
      largestUnit: 'كرتون',
      conversionFactor: 12,
      smallestPrice: 10,
      largestPrice: 100,
      stock: 100,
      openingStock: 100
    },
    {
      id: 'prod-002',
      code: 'PROD002',
      name: 'منتج ب',
      category: 'تصنيف 1',
      smallestUnit: 'قطعة',
      largestUnit: 'كرتون',
      conversionFactor: 10,
      smallestPrice: 15,
      largestPrice: 140,
      stock: 50,
      openingStock: 50
    },
    {
      id: 'prod-003',
      code: 'PROD003',
      name: 'منتج ج',
      category: 'تصنيف 2',
      smallestUnit: 'كيلو',
      largestUnit: 'طن',
      conversionFactor: 1000,
      smallestPrice: 20,
      largestPrice: 18000,
      stock: 200,
      openingStock: 200
    }
  ],

  // Test Customers
  testCustomers: [
    {
      id: 'cust-001',
      code: 'CUST001',
      name: 'عميل أ',
      phone: '01000000001',
      address: 'عنوان 1',
      openingBalance: 0,
      balance: 0
    },
    {
      id: 'cust-002',
      code: 'CUST002',
      name: 'عميل ب',
      phone: '01000000002',
      address: 'عنوان 2',
      openingBalance: 0,
      balance: 0
    }
  ],

  // Test Suppliers
  testSuppliers: [
    {
      id: 'supp-001',
      code: 'SUP001',
      name: 'مورد أ',
      phone: '01000000011',
      address: 'عنوان مورد 1',
      openingBalance: 0,
      balance: 0
    },
    {
      id: 'supp-002',
      code: 'SUP002',
      name: 'مورد ب',
      phone: '01000000012',
      address: 'عنوان مورد 2',
      openingBalance: 0,
      balance: 0
    }
  ],

  // Test Categories
  testCategories: [
    { id: 'cat-001', name: 'تصنيف 1' },
    { id: 'cat-002', name: 'تصنيف 2' }
  ],

  // Test Purchase Invoices
  testPurchaseInvoices: [
    {
      id: 'purch-inv-001',
      invoiceNumber: 'PUR-001',
      supplierId: 'supp-001',
      date: lastMonth.toISOString().split('T')[0] + 'T10:00:00',
      total: 1000,
      paid: 800,
      remaining: 200
    },
    {
      id: 'purch-inv-002',
      invoiceNumber: 'PUR-002',
      supplierId: 'supp-001',
      date: lastWeek.toISOString().split('T')[0] + 'T10:00:00',
      total: 1500,
      paid: 1500,
      remaining: 0
    },
    {
      id: 'purch-inv-003',
      invoiceNumber: 'PUR-003',
      supplierId: 'supp-002',
      date: yesterday.toISOString().split('T')[0] + 'T10:00:00',
      total: 2000,
      paid: 1000,
      remaining: 1000
    }
  ],

  // Test Purchase Invoice Items
  testPurchaseInvoiceItems: [
    {
      id: 'purch-item-001',
      invoiceId: 'purch-inv-001',
      productId: 'prod-001',
      quantity: 50,
      unit: 'smallest',
      price: 8 // سعر شراء أقل من سعر البيع
    },
    {
      id: 'purch-item-002',
      invoiceId: 'purch-inv-001',
      productId: 'prod-002',
      quantity: 30,
      unit: 'smallest',
      price: 12
    },
    {
      id: 'purch-item-003',
      invoiceId: 'purch-inv-002',
      productId: 'prod-001',
      quantity: 100,
      unit: 'smallest',
      price: 9 // سعر شراء مختلف
    },
    {
      id: 'purch-item-004',
      invoiceId: 'purch-inv-003',
      productId: 'prod-003',
      quantity: 2,
      unit: 'largest', // كرتون
      price: 15000
    }
  ],

  // Test Sales Invoices
  testSalesInvoices: [
    {
      id: 'sales-inv-001',
      invoiceNumber: 'SAL-001',
      customerId: 'cust-001',
      date: lastWeek.toISOString().split('T')[0] + 'T10:00:00',
      total: 500,
      paid: 500,
      remaining: 0
    },
    {
      id: 'sales-inv-002',
      invoiceNumber: 'SAL-002',
      customerId: 'cust-001',
      date: yesterday.toISOString().split('T')[0] + 'T10:00:00',
      total: 800,
      paid: 400,
      remaining: 400
    },
    {
      id: 'sales-inv-003',
      invoiceNumber: 'SAL-003',
      customerId: 'cust-002',
      date: today.toISOString().split('T')[0] + 'T10:00:00',
      total: 1200,
      paid: 0,
      remaining: 1200
    }
  ],

  // Test Sales Invoice Items
  testSalesInvoiceItems: [
    {
      id: 'sales-item-001',
      invoiceId: 'sales-inv-001',
      productId: 'prod-001',
      quantity: 20,
      unit: 'smallest',
      price: 10 // سعر بيع
    },
    {
      id: 'sales-item-002',
      invoiceId: 'sales-inv-001',
      productId: 'prod-002',
      quantity: 10,
      unit: 'smallest',
      price: 15
    },
    {
      id: 'sales-item-003',
      invoiceId: 'sales-inv-002',
      productId: 'prod-001',
      quantity: 30,
      unit: 'smallest',
      price: 10
    },
    {
      id: 'sales-item-004',
      invoiceId: 'sales-inv-003',
      productId: 'prod-003',
      quantity: 1,
      unit: 'largest', // كرتون
      price: 20000
    }
  ],

  // Test Operating Expenses
  testOperatingExpenses: [
    {
      id: 'exp-001',
      date: lastWeek.toISOString().split('T')[0] + 'T10:00:00',
      amount: 100,
      description: 'مصروف تجريبي 1',
      category: 'مصروفات عامة'
    },
    {
      id: 'exp-002',
      date: yesterday.toISOString().split('T')[0] + 'T10:00:00',
      amount: 200,
      description: 'مصروف تجريبي 2',
      category: 'مصروفات عامة'
    },
    {
      id: 'exp-003',
      date: today.toISOString().split('T')[0] + 'T10:00:00',
      amount: 150,
      description: 'مصروف تجريبي 3',
      category: 'مصروفات عامة'
    }
  ],

  // Helper function to get date string
  getDateString: (daysAgo = 0) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  },

  // Helper function to create test invoice with date
  createTestSalesInvoice: (customerId, date, total, paid = 0) => ({
    id: `sales-inv-${Date.now()}`,
    invoiceNumber: `SAL-${Date.now()}`,
    customerId,
    date: date + 'T10:00:00',
    total,
    paid,
    remaining: total - paid
  }),

  // Helper function to create test sales item
  createTestSalesItem: (invoiceId, productId, quantity, unit, price) => ({
    id: `sales-item-${Date.now()}`,
    invoiceId,
    productId,
    quantity,
    unit,
    price
  }),

  // Helper function to create test purchase invoice
  createTestPurchaseInvoice: (supplierId, date, total, paid = 0) => ({
    id: `purch-inv-${Date.now()}`,
    invoiceNumber: `PUR-${Date.now()}`,
    supplierId,
    date: date + 'T10:00:00',
    total,
    paid,
    remaining: total - paid
  }),

  // Helper function to create test purchase item
  createTestPurchaseItem: (invoiceId, productId, quantity, unit, price) => ({
    id: `purch-item-${Date.now()}`,
    invoiceId,
    productId,
    quantity,
    unit,
    price
  })
};

