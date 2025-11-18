// Sample test data fixtures

module.exports = {
  testSupplier: {
    id: 'test-supplier-001',
    code: 'SUP001',
    name: 'مورد تجريبي',
    phone: '01234567890',
    address: 'عنوان تجريبي',
    openingBalance: 0,
    balance: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  testProduct: {
    id: 'test-product-001',
    code: 'PROD001',
    name: 'منتج تجريبي',
    category: 'فئة تجريبية',
    smallestUnit: 'قطعة',
    largestUnit: 'كرتون',
    conversionFactor: 12,
    smallestPrice: 10,
    largestPrice: 100,
    stock: 100,
    openingStock: 100,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  testCustomer: {
    id: 'test-customer-001',
    code: 'CUST001',
    name: 'عميل تجريبي',
    phone: '01234567890',
    address: 'عنوان تجريبي',
    openingBalance: 0,
    balance: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  testPurchaseInvoice: {
    id: 'test-invoice-001',
    invoiceNumber: 'PUR-2024-001',
    supplierId: 'test-supplier-001',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentMethod: 'cash',
    products: [
      {
        productId: 'test-product-001',
        productName: 'منتج تجريبي',
        productCode: 'PROD001',
        quantity: 10,
        unit: 'smallest',
        unitName: 'قطعة',
        price: 10,
        total: 100
      }
    ],
    subtotal: 100,
    taxRate: 0,
    taxAmount: 0,
    shipping: 20,
    discount: 10,
    total: 110,
    paid: 100,
    remaining: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  testInvoiceProduct: {
    productId: 'test-product-001',
    productName: 'منتج تجريبي',
    productCode: 'PROD001',
    quantity: 5,
    unit: 'smallest',
    unitName: 'قطعة',
    price: 15,
    total: 75
  }
};
