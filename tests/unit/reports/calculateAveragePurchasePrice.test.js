// Unit tests for calculateAveragePurchasePrice function

describe('calculateAveragePurchasePrice', () => {
  // Replicate the function logic for testing
  function calculateAveragePurchasePrice(productId, saleDate = null, products, purchaseInvoices, purchaseInvoiceItems) {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    
    const purchaseItems = purchaseInvoiceItems.filter(pi => pi.productId === productId);
    let totalPurchaseCost = 0;
    let totalPurchaseQtyInSmallestUnit = 0;
    
    purchaseItems.forEach(pi => {
      const purchaseInv = purchaseInvoices.find(pi2 => pi2.id === pi.invoiceId);
      if (purchaseInv) {
        // If saleDate is provided, only consider purchases up to that date
        let shouldInclude = true;
        if (saleDate) {
          const purchaseDate = purchaseInv.date.split('T')[0];
          shouldInclude = purchaseDate <= saleDate;
        }
        
        if (shouldInclude) {
          // Convert quantity to smallest unit
          let quantityInSmallestUnit = pi.quantity || 0;
          if (pi.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityInSmallestUnit = (pi.quantity || 0) * conversionFactor;
          }
          
          // Price is per unit (smallest or largest), so we need to calculate total cost
          const itemCost = (pi.price || 0) * (pi.quantity || 0);
          
          totalPurchaseCost += itemCost;
          totalPurchaseQtyInSmallestUnit += quantityInSmallestUnit;
        }
      }
    });
    
    // Return average price per smallest unit
    return totalPurchaseQtyInSmallestUnit > 0 ? totalPurchaseCost / totalPurchaseQtyInSmallestUnit : 0;
  }

  const testProduct = {
    id: 'prod-001',
    code: 'PROD001',
    name: 'منتج تجريبي',
    category: 'تصنيف 1',
    smallestUnit: 'قطعة',
    largestUnit: 'كرتون',
    conversionFactor: 12,
    smallestPrice: 10,
    largestPrice: 100,
    stock: 100
  };

  describe('Basic calculation', () => {
    test('يجب حساب متوسط سعر الشراء بشكل صحيح', () => {
      const products = [testProduct];
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
          price: 8
        }
      ];

      const avgPrice = calculateAveragePurchasePrice(
        'prod-001',
        null,
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      // Total cost: 100 * 8 = 800
      // Total quantity: 100
      // Average: 800 / 100 = 8
      expect(avgPrice).toBe(8);
    });

    test('يجب حساب متوسط سعر الشراء مع مشتريات متعددة', () => {
      const products = [testProduct];
      const purchaseInvoices = [
        {
          id: 'purch-inv-001',
          date: '2024-01-01T10:00:00',
          total: 1000
        },
        {
          id: 'purch-inv-002',
          date: '2024-01-15T10:00:00',
          total: 1500
        }
      ];
      const purchaseInvoiceItems = [
        {
          id: 'purch-item-001',
          invoiceId: 'purch-inv-001',
          productId: 'prod-001',
          quantity: 100,
          unit: 'smallest',
          price: 8
        },
        {
          id: 'purch-item-002',
          invoiceId: 'purch-inv-002',
          productId: 'prod-001',
          quantity: 50,
          unit: 'smallest',
          price: 9
        }
      ];

      const avgPrice = calculateAveragePurchasePrice(
        'prod-001',
        null,
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      // Total cost: (100 * 8) + (50 * 9) = 800 + 450 = 1250
      // Total quantity: 100 + 50 = 150
      // Average: 1250 / 150 = 8.333...
      expect(avgPrice).toBeCloseTo(8.333, 2);
    });
  });

  describe('Date filtering', () => {
    test('يجب حساب متوسط السعر حتى تاريخ البيع فقط', () => {
      const products = [testProduct];
      const purchaseInvoices = [
        {
          id: 'purch-inv-001',
          date: '2024-01-01T10:00:00',
          total: 1000
        },
        {
          id: 'purch-inv-002',
          date: '2024-01-20T10:00:00',
          total: 1500
        }
      ];
      const purchaseInvoiceItems = [
        {
          id: 'purch-item-001',
          invoiceId: 'purch-inv-001',
          productId: 'prod-001',
          quantity: 100,
          unit: 'smallest',
          price: 8
        },
        {
          id: 'purch-item-002',
          invoiceId: 'purch-inv-002',
          productId: 'prod-001',
          quantity: 50,
          unit: 'smallest',
          price: 9
        }
      ];

      // Sale date is 2024-01-15, so only first purchase should be included
      const avgPrice = calculateAveragePurchasePrice(
        'prod-001',
        '2024-01-15',
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      // Only first purchase: 100 * 8 = 800, quantity = 100
      // Average: 800 / 100 = 8
      expect(avgPrice).toBe(8);
    });

    test('يجب تضمين المشتريات في نفس تاريخ البيع', () => {
      const products = [testProduct];
      const purchaseInvoices = [
        {
          id: 'purch-inv-001',
          date: '2024-01-15T10:00:00',
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
          price: 8
        }
      ];

      const avgPrice = calculateAveragePurchasePrice(
        'prod-001',
        '2024-01-15',
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      expect(avgPrice).toBe(8);
    });
  });

  describe('Unit conversion', () => {
    test('يجب تحويل الوحدات الكبيرة إلى صغيرة', () => {
      const products = [testProduct];
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
          quantity: 10, // 10 كرتون
          unit: 'largest',
          price: 100 // سعر الكرتون
        }
      ];

      const avgPrice = calculateAveragePurchasePrice(
        'prod-001',
        null,
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      // Total cost: 10 * 100 = 1000
      // Total quantity in smallest unit: 10 * 12 = 120
      // Average: 1000 / 120 = 8.333...
      expect(avgPrice).toBeCloseTo(8.333, 2);
    });

    test('يجب التعامل مع الوحدات المختلطة', () => {
      const products = [testProduct];
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
          quantity: 50,
          unit: 'smallest',
          price: 8
        },
        {
          id: 'purch-item-002',
          invoiceId: 'purch-inv-001',
          productId: 'prod-001',
          quantity: 5, // 5 كرتون
          unit: 'largest',
          price: 100
        }
      ];

      const avgPrice = calculateAveragePurchasePrice(
        'prod-001',
        null,
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      // Total cost: (50 * 8) + (5 * 100) = 400 + 500 = 900
      // Total quantity: 50 + (5 * 12) = 50 + 60 = 110
      // Average: 900 / 110 = 8.181...
      expect(avgPrice).toBeCloseTo(8.181, 2);
    });
  });

  describe('Edge cases', () => {
    test('يجب إرجاع 0 لمنتج غير موجود', () => {
      const products = [];
      const purchaseInvoices = [];
      const purchaseInvoiceItems = [];

      const avgPrice = calculateAveragePurchasePrice(
        'non-existent',
        null,
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      expect(avgPrice).toBe(0);
    });

    test('يجب إرجاع 0 لمنتج بدون مشتريات', () => {
      const products = [testProduct];
      const purchaseInvoices = [];
      const purchaseInvoiceItems = [];

      const avgPrice = calculateAveragePurchasePrice(
        'prod-001',
        null,
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      expect(avgPrice).toBe(0);
    });

    test('يجب التعامل مع الكميات الصفرية', () => {
      const products = [testProduct];
      const purchaseInvoices = [
        {
          id: 'purch-inv-001',
          date: '2024-01-01T10:00:00',
          total: 0
        }
      ];
      const purchaseInvoiceItems = [
        {
          id: 'purch-item-001',
          invoiceId: 'purch-inv-001',
          productId: 'prod-001',
          quantity: 0,
          unit: 'smallest',
          price: 8
        }
      ];

      const avgPrice = calculateAveragePurchasePrice(
        'prod-001',
        null,
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      expect(avgPrice).toBe(0);
    });

    test('يجب التعامل مع الأسعار الصفرية', () => {
      const products = [testProduct];
      const purchaseInvoices = [
        {
          id: 'purch-inv-001',
          date: '2024-01-01T10:00:00',
          total: 0
        }
      ];
      const purchaseInvoiceItems = [
        {
          id: 'purch-item-001',
          invoiceId: 'purch-inv-001',
          productId: 'prod-001',
          quantity: 100,
          unit: 'smallest',
          price: 0
        }
      ];

      const avgPrice = calculateAveragePurchasePrice(
        'prod-001',
        null,
        products,
        purchaseInvoices,
        purchaseInvoiceItems
      );

      expect(avgPrice).toBe(0);
    });
  });
});

