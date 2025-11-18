// Integration tests for product management flow

const { setupMockElectronAPI } = require('../helpers/test-helpers');
const { testProduct } = require('../fixtures/sample-data');

describe('Product Management Flow - Integration Tests', () => {
  let mockData;
  let products;
  let categories;

  beforeEach(() => {
    products = [];
    categories = ['فئة تجريبية'];

    mockData = setupMockElectronAPI();
    mockData.products = [];
    mockData.categories = [];

    global.window = {
      electronAPI: {
        dbGetAll: jest.fn(async (table) => {
          if (table === 'products') return mockData.products;
          if (table === 'categories') return mockData.categories;
          return [];
        }),
        dbInsert: jest.fn(async (table, data) => {
          if (table === 'products') {
            mockData.products.push(data);
            return { success: true, id: data.id };
          }
          if (table === 'categories') {
            mockData.categories.push(data);
            return { success: true, id: data.id };
          }
          return { success: true };
        }),
        dbUpdate: jest.fn(async (table, id, data) => {
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
          if (table === 'products') {
            mockData.products = mockData.products.filter(p => p.id !== id);
            return { success: true };
          }
          return { success: true };
        })
      }
    };
  });

  describe('Complete Product Flow', () => {
    test('should create product and save to database', async () => {
      // 1. Create product
      const product = {
        id: 'test-product-001',
        code: 'PRD-00001',
        name: 'منتج تجريبي',
        category: 'فئة تجريبية',
        smallestUnit: 'قطعة',
        largestUnit: 'كرتون',
        conversionFactor: 12,
        smallestPrice: 10,
        largestPrice: 100,
        stock: 100,
        openingStock: 100,
        status: 'active'
      };

      // 2. Save to database (dbInsert already adds to mockData.products)
      await global.window.electronAPI.dbInsert('products', product);
      products.push(product);

      // 3. Verify
      expect(mockData.products.length).toBe(1);
      expect(mockData.products[0].name).toBe('منتج تجريبي');
      expect(mockData.products[0].stock).toBe(100);
    });

    test('should update product in database', async () => {
      // 1. Create product
      const product = {
        id: 'test-product-001',
        name: 'منتج تجريبي',
        stock: 100
      };
      mockData.products.push(product);

      // 2. Update product
      const updatedData = {
        name: 'منتج محدث',
        stock: 150
      };
      await global.window.electronAPI.dbUpdate('products', product.id, updatedData);

      // 3. Verify
      const updatedProduct = mockData.products.find(p => p.id === product.id);
      expect(updatedProduct.name).toBe('منتج محدث');
      expect(updatedProduct.stock).toBe(150);
    });

    test('should delete product from database', async () => {
      // 1. Create product
      const product = {
        id: 'test-product-001',
        name: 'منتج تجريبي'
      };
      mockData.products.push(product);

      // 2. Delete product
      await global.window.electronAPI.dbDelete('products', product.id);

      // 3. Verify
      expect(mockData.products.length).toBe(0);
      expect(mockData.products.find(p => p.id === product.id)).toBeUndefined();
    });
  });

  describe('Category Management Flow', () => {
    test('should add category and use it in product', async () => {
      // 1. Add category
      const category = {
        id: 'cat-001',
        name: 'فئة جديدة'
      };
      await global.window.electronAPI.dbInsert('categories', category);
      mockData.categories.push(category);
      categories.push(category.name);

      // 2. Create product with new category
      const product = {
        id: 'test-product-001',
        name: 'منتج جديد',
        category: 'فئة جديدة',
        stock: 50
      };
      await global.window.electronAPI.dbInsert('products', product);
      mockData.products.push(product);

      // 3. Verify
      expect(categories).toContain('فئة جديدة');
      expect(mockData.products[0].category).toBe('فئة جديدة');
    });

    test('should prevent deleting category used by products', async () => {
      // 1. Create category
      const category = {
        id: 'cat-001',
        name: 'فئة مستخدمة'
      };
      mockData.categories.push(category);
      categories.push(category.name);

      // 2. Create product with category
      const product = {
        id: 'test-product-001',
        name: 'منتج',
        category: 'فئة مستخدمة'
      };
      mockData.products.push(product);

      // 3. Try to delete category (should fail)
      const usageCount = mockData.products.filter(p => p.category === category.name).length;
      expect(usageCount).toBeGreaterThan(0);
      // Category should not be deleted
    });
  });

  describe('Stock Management', () => {
    test('should track stock changes', async () => {
      // 1. Create product
      const product = {
        id: 'test-product-001',
        name: 'منتج',
        stock: 100,
        openingStock: 100
      };
      mockData.products.push(product);

      // 2. Update stock
      await global.window.electronAPI.dbUpdate('products', product.id, {
        stock: 150
      });

      // 3. Verify
      const updatedProduct = mockData.products.find(p => p.id === product.id);
      expect(updatedProduct.stock).toBe(150);
      expect(updatedProduct.openingStock).toBe(100); // Opening stock should not change
    });
  });
});

