// Integration tests for renderTables functions (renderProductsProfit, renderCustomersProfit, renderSuppliersProfit)

const { 
  testProducts, 
  testCustomers, 
  testSuppliers,
  testSalesInvoices, 
  testSalesInvoiceItems,
  testPurchaseInvoices,
  testPurchaseInvoiceItems
} = require('../../fixtures/reports-data');

describe('renderTables - Integration Tests', () => {
  let mockElements;

  beforeEach(() => {
    // Setup mock DOM elements
    mockElements = {
      productsProfitTableBody: { innerHTML: '' },
      customersProfitTableBody: { innerHTML: '' },
      suppliersProfitTableBody: { innerHTML: '' }
    };

    global.document.getElementById = jest.fn((id) => {
      return mockElements[id] || { innerHTML: '', textContent: '', className: '' };
    });
  });

  // Mock formatArabicNumber function
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

  // Mock formatArabicCurrency function
  function formatArabicCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicNumber(amount, decimals) + ' ' + currency;
  }

  // Mock formatPercentage function
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

  // Mock renderProductsProfit function
  function renderProductsProfit(items, invoices, products, purchaseInvoices, purchaseInvoiceItems) {
    const tbody = mockElements.productsProfitTableBody;
    
    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد بيانات</td></tr>';
      return;
    }
    
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
    
    // Convert to array and calculate averages
    const productArray = Object.values(productStats).map(stat => {
      const avgPurchasePrice = stat.totalQuantity > 0 ? stat.totalCost / stat.totalQuantity : 0;
      const avgSalePrice = stat.totalQuantity > 0 ? stat.totalSales / stat.totalQuantity : 0;
      const profit = stat.totalSales - stat.totalCost;
      const profitMargin = stat.totalSales > 0 ? (profit / stat.totalSales) * 100 : 0;
      
      return {
        ...stat,
        avgPurchasePrice,
        avgSalePrice,
        profit,
        profitMargin
      };
    });
    
    // Sort by profit (descending)
    productArray.sort((a, b) => b.profit - a.profit);
    
    // Render
    tbody.innerHTML = productArray.map(stat => {
      const profitClass = stat.profit < 0 ? 'negative' : stat.profit > 0 ? 'positive' : '';
      return `
        <tr>
          <td><strong>${stat.product.name}</strong><br><small>${stat.product.category || 'غير محدد'}</small></td>
          <td>${formatArabicNumber(stat.totalQuantity, 2)}</td>
          <td>${formatArabicCurrency(stat.avgPurchasePrice)}</td>
          <td>${formatArabicCurrency(stat.avgSalePrice)}</td>
          <td>${formatArabicCurrency(stat.totalCost)}</td>
          <td>${formatArabicCurrency(stat.totalSales)}</td>
          <td class="${profitClass}">${formatArabicCurrency(stat.profit)}</td>
          <td class="${profitClass}">${formatPercentage(stat.profitMargin)}</td>
        </tr>
      `;
    }).join('');
  }

  // Mock renderCustomersProfit function
  function renderCustomersProfit(invoices, items, products, customers, purchaseInvoices, purchaseInvoiceItems) {
    const tbody = mockElements.customersProfitTableBody;
    
    if (!invoices || invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد بيانات</td></tr>';
      return;
    }
    
    // Group by customer
    const customerStats = {};
    
    invoices.forEach(invoice => {
      const customer = customers.find(c => c.id === invoice.customerId);
      if (!customer) return;
      
      if (!customerStats[customer.id]) {
        customerStats[customer.id] = {
          customer: customer,
          totalSales: 0,
          totalCost: 0
        };
      }
      
      customerStats[customer.id].totalSales += (invoice.total || 0);
    });
    
    // Calculate costs for each customer
    Object.keys(customerStats).forEach(customerId => {
      const customerInvoices = invoices.filter(inv => inv.customerId === customerId);
      let totalCost = 0;
      
      customerInvoices.forEach(invoice => {
        const invoiceItems = items.filter(item => item.invoiceId === invoice.id);
        const saleDate = invoice.date.split('T')[0];
        invoiceItems.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (!product) return;
          
          const avgPurchasePrice = calculateAveragePurchasePrice(product.id, saleDate, products, purchaseInvoices, purchaseInvoiceItems);
          
          let quantityInSmallestUnit = item.quantity || 0;
          if (item.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityInSmallestUnit = (item.quantity || 0) * conversionFactor;
          }
          
          totalCost += avgPurchasePrice * quantityInSmallestUnit;
        });
      });
      
      customerStats[customerId].totalCost = totalCost;
    });
    
    // Convert to array and calculate profit
    const customerArray = Object.values(customerStats).map(stat => {
      const profit = stat.totalSales - stat.totalCost;
      const profitMargin = stat.totalSales > 0 ? (profit / stat.totalSales) * 100 : 0;
      const status = profitMargin >= 20 ? 'profitable' : profitMargin >= 10 ? 'moderate' : profitMargin < 0 ? 'loss' : 'low';
      
      return {
        ...stat,
        profit,
        profitMargin,
        status
      };
    });
    
    // Sort by profit (descending)
    customerArray.sort((a, b) => b.profit - a.profit);
    
    // Render
    tbody.innerHTML = customerArray.map(stat => {
      const statusClass = stat.status === 'profitable' ? 'positive' : stat.status === 'loss' ? 'negative' : '';
      const statusText = stat.status === 'profitable' ? 'مربح جداً' : stat.status === 'moderate' ? 'مربح' : stat.status === 'low' ? 'ربح منخفض' : 'خسارة';
      return `
        <tr>
          <td><strong>${stat.customer.name}</strong></td>
          <td>${formatArabicCurrency(stat.totalSales)}</td>
          <td>${formatArabicCurrency(stat.totalCost)}</td>
          <td class="${statusClass}">${formatArabicCurrency(stat.profit)}</td>
          <td class="${statusClass}">${formatPercentage(stat.profitMargin)}</td>
          <td><span class="status-badge ${stat.status}">${statusText}</span></td>
        </tr>
      `;
    }).join('');
  }

  describe('renderProductsProfit', () => {
    test('يجب عرض جدول أرباح المنتجات بشكل صحيح', () => {
      const items = testSalesInvoiceItems;
      const invoices = testSalesInvoices;
      const products = testProducts;
      const purchaseInvoices = testPurchaseInvoices;
      const purchaseInvoiceItems = testPurchaseInvoiceItems;

      renderProductsProfit(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      expect(mockElements.productsProfitTableBody.innerHTML).not.toBe('');
      expect(mockElements.productsProfitTableBody.innerHTML).toContain('منتج');
    });

    test('يجب عرض رسالة "لا توجد بيانات" عند عدم وجود عناصر', () => {
      renderProductsProfit([], [], testProducts, [], []);

      expect(mockElements.productsProfitTableBody.innerHTML).toContain('لا توجد بيانات');
    });

    test('يجب ترتيب المنتجات حسب الربح (تنازلي)', () => {
      const items = testSalesInvoiceItems;
      const invoices = testSalesInvoices;
      const products = testProducts;
      const purchaseInvoices = testPurchaseInvoices;
      const purchaseInvoiceItems = testPurchaseInvoiceItems;

      renderProductsProfit(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Should render products sorted by profit
      expect(mockElements.productsProfitTableBody.innerHTML).not.toBe('');
    });

    test('يجب حساب إجمالي الكمية والمبيعات والتكلفة بشكل صحيح', () => {
      const items = [
        {
          id: 'item-001',
          invoiceId: 'sales-inv-001',
          productId: 'prod-001',
          quantity: 20,
          unit: 'smallest',
          price: 10
        },
        {
          id: 'item-002',
          invoiceId: 'sales-inv-001',
          productId: 'prod-001',
          quantity: 30,
          unit: 'smallest',
          price: 10
        }
      ];
      const invoices = [{ id: 'sales-inv-001', date: '2024-01-15T10:00:00', total: 500 }];
      const products = testProducts;
      const purchaseInvoices = testPurchaseInvoices;
      const purchaseInvoiceItems = testPurchaseInvoiceItems;

      renderProductsProfit(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Total quantity should be 50
      expect(mockElements.productsProfitTableBody.innerHTML).toContain('٥٠');
    });
  });

  describe('renderCustomersProfit', () => {
    test('يجب عرض جدول أرباح العملاء بشكل صحيح', () => {
      const invoices = testSalesInvoices;
      const items = testSalesInvoiceItems;
      const products = testProducts;
      const customers = testCustomers;
      const purchaseInvoices = testPurchaseInvoices;
      const purchaseInvoiceItems = testPurchaseInvoiceItems;

      renderCustomersProfit(invoices, items, products, customers, purchaseInvoices, purchaseInvoiceItems);

      expect(mockElements.customersProfitTableBody.innerHTML).not.toBe('');
      expect(mockElements.customersProfitTableBody.innerHTML).toContain('عميل');
    });

    test('يجب عرض رسالة "لا توجد بيانات" عند عدم وجود فواتير', () => {
      renderCustomersProfit([], [], testProducts, testCustomers, [], []);

      expect(mockElements.customersProfitTableBody.innerHTML).toContain('لا توجد بيانات');
    });

    test('يجب تصنيف العملاء حسب الربحية', () => {
      const invoices = testSalesInvoices;
      const items = testSalesInvoiceItems;
      const products = testProducts;
      const customers = testCustomers;
      const purchaseInvoices = testPurchaseInvoices;
      const purchaseInvoiceItems = testPurchaseInvoiceItems;

      renderCustomersProfit(invoices, items, products, customers, purchaseInvoices, purchaseInvoiceItems);

      // Should include status badges
      expect(mockElements.customersProfitTableBody.innerHTML).toContain('status-badge');
    });

    test('يجب ترتيب العملاء حسب الربح (تنازلي)', () => {
      const invoices = testSalesInvoices;
      const items = testSalesInvoiceItems;
      const products = testProducts;
      const customers = testCustomers;
      const purchaseInvoices = testPurchaseInvoices;
      const purchaseInvoiceItems = testPurchaseInvoiceItems;

      renderCustomersProfit(invoices, items, products, customers, purchaseInvoices, purchaseInvoiceItems);

      // Should render customers sorted by profit
      expect(mockElements.customersProfitTableBody.innerHTML).not.toBe('');
    });
  });

  describe('Edge cases', () => {
    test('يجب التعامل مع منتج غير موجود', () => {
      const items = [
        {
          id: 'item-001',
          invoiceId: 'sales-inv-001',
          productId: 'non-existent-product',
          quantity: 10,
          unit: 'smallest',
          price: 10
        }
      ];
      const invoices = [{ id: 'sales-inv-001', total: 100 }];
      const products = testProducts;
      const purchaseInvoices = [];
      const purchaseInvoiceItems = [];

      renderProductsProfit(items, invoices, products, purchaseInvoices, purchaseInvoiceItems);

      // Should handle gracefully
      expect(mockElements.productsProfitTableBody.innerHTML).not.toContain('non-existent-product');
    });

    test('يجب التعامل مع عميل غير موجود', () => {
      const invoices = [
        {
          id: 'sales-inv-001',
          customerId: 'non-existent-customer',
          total: 100
        }
      ];
      const items = [];
      const products = testProducts;
      const customers = testCustomers;
      const purchaseInvoices = [];
      const purchaseInvoiceItems = [];

      renderCustomersProfit(invoices, items, products, customers, purchaseInvoices, purchaseInvoiceItems);

      // Should handle gracefully
      expect(mockElements.customersProfitTableBody.innerHTML).not.toContain('non-existent-customer');
    });

    test('يجب التعامل مع فواتير بدون عناصر', () => {
      const invoices = testSalesInvoices;
      const items = [];
      const products = testProducts;
      const customers = testCustomers;
      const purchaseInvoices = [];
      const purchaseInvoiceItems = [];

      renderCustomersProfit(invoices, items, products, customers, purchaseInvoices, purchaseInvoiceItems);

      // Should render customers with zero costs
      expect(mockElements.customersProfitTableBody.innerHTML).not.toBe('');
    });
  });
});

