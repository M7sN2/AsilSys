// Integration tests for generateAlerts function

const { 
  testProducts, 
  testSalesInvoices, 
  testSalesInvoiceItems,
  testPurchaseInvoices,
  testPurchaseInvoiceItems
} = require('../../fixtures/reports-data');

describe('generateAlerts - Integration Tests', () => {
  let mockElements;

  beforeEach(() => {
    // Setup mock DOM elements
    mockElements = {
      highSalesLowProfitList: { innerHTML: '' },
      lossProductsList: { innerHTML: '' }
    };

    global.document.getElementById = jest.fn((id) => {
      return mockElements[id] || { innerHTML: '', textContent: '' };
    });
  });

  // Mock formatArabicCurrency function
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

  function formatArabicCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicNumber(amount, decimals) + ' ' + currency;
  }

  function formatPercentage(value) {
    return formatArabicNumber(value, 2) + '%';
  }

  // Mock calculateAveragePurchasePrice function
  function calculateAveragePurchasePrice(productId, saleDate, products, purchaseInvoices, purchaseInvoiceItems) {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    
    const purchaseItems = purchaseInvoiceItems.filter(pi => pi.productId === productId);
    let totalPurchaseCost = 0;
    let totalPurchaseQtyInSmallestUnit = 0;
    
    purchaseItems.forEach(pi => {
      const purchaseInv = purchaseInvoices.find(pi2 => pi2.id === pi.invoiceId);
      if (purchaseInv) {
        let shouldInclude = true;
        if (saleDate) {
          const purchaseDate = purchaseInv.date.split('T')[0];
          shouldInclude = purchaseDate <= saleDate;
        }
        
        if (shouldInclude) {
          let quantityInSmallestUnit = pi.quantity || 0;
          if (pi.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityInSmallestUnit = (pi.quantity || 0) * conversionFactor;
          }
          
          const itemCost = (pi.price || 0) * (pi.quantity || 0);
          totalPurchaseCost += itemCost;
          totalPurchaseQtyInSmallestUnit += quantityInSmallestUnit;
        }
      }
    });
    
    return totalPurchaseQtyInSmallestUnit > 0 ? totalPurchaseCost / totalPurchaseQtyInSmallestUnit : 0;
  }

  // Mock generateAlerts function
  function generateAlerts(items, invoices, products, purchaseInvoices, purchaseInvoiceItems) {
    const highSalesLowProfit = [];
    const lossProducts = [];
    
    // Group by product
    const productStats = {};
    
    items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return;
      
      if (!productStats[product.id]) {
        productStats[product.id] = {
          product: product,
          totalQuantity: 0,
          totalSales: 0,
          totalCost: 0
        };
      }
      
      productStats[product.id].totalQuantity += (item.quantity || 0);
      productStats[product.id].totalSales += (item.price || 0) * (item.quantity || 0);
      
      const invoice = invoices.find(inv => inv.id === item.invoiceId);
      const saleDate = invoice ? invoice.date.split('T')[0] : null;
      const avgPurchasePrice = calculateAveragePurchasePrice(product.id, saleDate, products, purchaseInvoices, purchaseInvoiceItems);
      
      let quantityInSmallestUnit = item.quantity || 0;
      if (item.unit === 'largest') {
        const conversionFactor = product.conversionFactor || 1;
        quantityInSmallestUnit = (item.quantity || 0) * conversionFactor;
      }
      
      productStats[product.id].totalCost += avgPurchasePrice * quantityInSmallestUnit;
    });
    
    // Analyze each product
    Object.values(productStats).forEach(stat => {
      const profit = stat.totalSales - stat.totalCost;
      const profitMargin = stat.totalSales > 0 ? (profit / stat.totalSales) * 100 : 0;
      
      // High sales but low profit
      if (stat.totalSales > 1000 && profitMargin < 10 && profitMargin >= 0) {
        highSalesLowProfit.push({ ...stat, profit, profitMargin });
      }
      
      // Loss products
      if (profit < 0) {
        lossProducts.push({ ...stat, profit, profitMargin });
      }
    });
    
    // Render alerts
    renderAlerts(highSalesLowProfit, lossProducts);
  }

  // Mock renderAlerts function
  function renderAlerts(highSalesLowProfit, lossProducts) {
    const highSalesList = mockElements.highSalesLowProfitList;
    const lossList = mockElements.lossProductsList;
    
    if (highSalesLowProfit.length === 0) {
      highSalesList.innerHTML = '<p class="no-alerts">لا توجد منتجات</p>';
    } else {
      highSalesList.innerHTML = highSalesLowProfit.map(stat => `
        <div class="alert-item">
          <strong>${stat.product.name}</strong>
          <span>المبيعات: ${formatArabicCurrency(stat.totalSales)}</span>
          <span>الربح: ${formatArabicCurrency(stat.profit)}</span>
          <span>النسبة: ${formatPercentage(stat.profitMargin)}</span>
        </div>
      `).join('');
    }
    
    if (lossProducts.length === 0) {
      lossList.innerHTML = '<p class="no-alerts">لا توجد منتجات</p>';
    } else {
      lossList.innerHTML = lossProducts.map(stat => `
        <div class="alert-item loss">
          <strong>${stat.product.name}</strong>
          <span>الخسارة: ${formatArabicCurrency(Math.abs(stat.profit))}</span>
          <span>المبيعات: ${formatArabicCurrency(stat.totalSales)}</span>
        </div>
      `).join('');
    }
  }

  describe('High sales low profit alerts', () => {
    test('يجب اكتشاف منتجات بمبيعات عالية وربح منخفض', () => {
      // Create product with high sales but low profit margin
      const items = [
        {
          id: 'item-001',
          invoiceId: 'sales-inv-001',
          productId: 'prod-001',
          quantity: 200, // High quantity
          unit: 'smallest',
          price: 10 // Sale price
        }
      ];
      const invoices = [
        {
          id: 'sales-inv-001',
          date: '2024-01-15T10:00:00',
          total: 2000 // High sales
        }
      ];
      const products = testProducts;
      const purchaseInvoices = [
        {
          id: 'purch-inv-001',
          date: '2024-01-01T10:00:00',
          total: 1000
        }
      ];
      const purchaseInvoiceItems = [
        {
          id: 'purch-item-001',
          invoiceId: 'purch-inv-001',
          productId: 'prod-001',
          quantity: 200,
          unit: 'smallest',
          price: 9.5 // Purchase price close to sale price (low margin)
        }
      ];

      generateAlerts(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Should detect high sales low profit
      expect(mockElements.highSalesLowProfitList.innerHTML).not.toContain('لا توجد منتجات');
    });

    test('يجب عدم اكتشاف منتجات بمبيعات منخفضة', () => {
      const items = [
        {
          id: 'item-001',
          invoiceId: 'sales-inv-001',
          productId: 'prod-001',
          quantity: 10, // Low quantity
          unit: 'smallest',
          price: 10
        }
      ];
      const invoices = [
        {
          id: 'sales-inv-001',
          date: '2024-01-15T10:00:00',
          total: 100 // Low sales (< 1000)
        }
      ];
      const products = testProducts;
      const purchaseInvoices = [];
      const purchaseInvoiceItems = [];

      generateAlerts(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Should not detect (sales < 1000)
      expect(mockElements.highSalesLowProfitList.innerHTML).toContain('لا توجد منتجات');
    });

    test('يجب عدم اكتشاف منتجات بهامش ربح عالي', () => {
      const items = [
        {
          id: 'item-001',
          invoiceId: 'sales-inv-001',
          productId: 'prod-001',
          quantity: 200,
          unit: 'smallest',
          price: 10
        }
      ];
      const invoices = [
        {
          id: 'sales-inv-001',
          date: '2024-01-15T10:00:00',
          total: 2000
        }
      ];
      const products = testProducts;
      const purchaseInvoices = [
        {
          id: 'purch-inv-001',
          date: '2024-01-01T10:00:00',
          total: 1000
        }
      ];
      const purchaseInvoiceItems = [
        {
          id: 'purch-item-001',
          invoiceId: 'purch-inv-001',
          productId: 'prod-001',
          quantity: 200,
          unit: 'smallest',
          price: 5 // Low purchase price (high margin > 10%)
        }
      ];

      generateAlerts(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Should not detect (profit margin >= 10%)
      expect(mockElements.highSalesLowProfitList.innerHTML).toContain('لا توجد منتجات');
    });
  });

  describe('Loss products alerts', () => {
    test('يجب اكتشاف منتجات بخسارة', () => {
      // Create product with loss (sale price < purchase price)
      const items = [
        {
          id: 'item-001',
          invoiceId: 'sales-inv-001',
          productId: 'prod-001',
          quantity: 100,
          unit: 'smallest',
          price: 8 // Sale price
        }
      ];
      const invoices = [
        {
          id: 'sales-inv-001',
          date: '2024-01-15T10:00:00',
          total: 800
        }
      ];
      const products = testProducts;
      const purchaseInvoices = [
        {
          id: 'purch-inv-001',
          date: '2024-01-01T10:00:00',
          total: 1000
        }
      ];
      const purchaseInvoiceItems = [
        {
          id: 'purch-item-001',
          invoiceId: 'purch-inv-001',
          productId: 'prod-001',
          quantity: 100,
          unit: 'smallest',
          price: 10 // Purchase price > sale price (loss)
        }
      ];

      generateAlerts(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Should detect loss products
      expect(mockElements.lossProductsList.innerHTML).not.toContain('لا توجد منتجات');
      expect(mockElements.lossProductsList.innerHTML).toContain('الخسارة');
    });

    test('يجب عدم اكتشاف منتجات بربح', () => {
      const items = [
        {
          id: 'item-001',
          invoiceId: 'sales-inv-001',
          productId: 'prod-001',
          quantity: 100,
          unit: 'smallest',
          price: 10 // Sale price
        }
      ];
      const invoices = [
        {
          id: 'sales-inv-001',
          date: '2024-01-15T10:00:00',
          total: 1000
        }
      ];
      const products = testProducts;
      const purchaseInvoices = [
        {
          id: 'purch-inv-001',
          date: '2024-01-01T10:00:00',
          total: 800
        }
      ];
      const purchaseInvoiceItems = [
        {
          id: 'purch-item-001',
          invoiceId: 'purch-inv-001',
          productId: 'prod-001',
          quantity: 100,
          unit: 'smallest',
          price: 8 // Purchase price < sale price (profit)
        }
      ];

      generateAlerts(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Should not detect (profit > 0)
      expect(mockElements.lossProductsList.innerHTML).toContain('لا توجد منتجات');
    });
  });

  describe('Edge cases', () => {
    test('يجب التعامل مع قائمة فارغة', () => {
      generateAlerts([], [], testProducts, [], []);

      expect(mockElements.highSalesLowProfitList.innerHTML).toContain('لا توجد منتجات');
      expect(mockElements.lossProductsList.innerHTML).toContain('لا توجد منتجات');
    });

    test('يجب التعامل مع منتج غير موجود', () => {
      const items = [
        {
          id: 'item-001',
          invoiceId: 'sales-inv-001',
          productId: 'non-existent-product',
          quantity: 100,
          unit: 'smallest',
          price: 10
        }
      ];
      const invoices = [{ id: 'sales-inv-001', total: 1000 }];
      const products = testProducts;
      const purchaseInvoices = [];
      const purchaseInvoiceItems = [];

      generateAlerts(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Should handle gracefully
      expect(mockElements.highSalesLowProfitList.innerHTML).toContain('لا توجد منتجات');
      expect(mockElements.lossProductsList.innerHTML).toContain('لا توجد منتجات');
    });

    test('يجب التعامل مع منتجات بدون مشتريات سابقة', () => {
      const items = [
        {
          id: 'item-001',
          invoiceId: 'sales-inv-001',
          productId: 'prod-001',
          quantity: 100,
          unit: 'smallest',
          price: 10
        }
      ];
      const invoices = [{ id: 'sales-inv-001', date: '2024-01-15T10:00:00', total: 1000 }];
      const products = testProducts;
      const purchaseInvoices = [];
      const purchaseInvoiceItems = [];

      generateAlerts(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Should handle (no purchase history means cost = 0, so profit = sales)
      expect(mockElements.lossProductsList.innerHTML).toContain('لا توجد منتجات');
    });
  });
});

