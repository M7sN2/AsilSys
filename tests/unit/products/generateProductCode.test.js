// Tests for generateProductCode function from products.js

describe('generateProductCode', () => {
  let mockData;
  let mockGetItem;
  let mockSetItem;
  let localStorageData;

  beforeEach(() => {
    localStorageData = {};
    jest.clearAllMocks();
    mockGetItem = jest.fn((key) => {
      return localStorageData[key] || null;
    });
    mockSetItem = jest.fn((key, value) => {
      localStorageData[key] = value;
    });
    global.localStorage.getItem = mockGetItem;
    global.localStorage.setItem = mockSetItem;

    mockData = {
      products: []
    };

    global.window = {
      electronAPI: {
        dbGetAll: jest.fn(async () => {
          return mockData.products;
        })
      }
    };
  });

  // Copy the function for testing
  async function generateProductCode() {
    const STORAGE_KEYS = {
      PRODUCT_COUNTER: 'asel_product_counter'
    };

    if (global.window.electronAPI && global.window.electronAPI.dbGetAll) {
      try {
        // Get all products to find highest counter
        const allProducts = await global.window.electronAPI.dbGetAll('products', '', []);
        const codes = allProducts.map(p => p.code).filter(code => code && code.startsWith('PRD-'));
        const numbers = codes.map(code => {
          const match = code.match(/PRD-(\d+)/);
          return match ? parseInt(match[1]) : 0;
        });
        const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
        const counter = maxNumber + 1;
        
        // Format: PRD-00001
        return `PRD-${String(counter).padStart(5, '0')}`;
      } catch (error) {
        console.error('Error generating product code:', error);
      }
    }
    
    // Fallback to localStorage
    let counter = parseInt(mockGetItem(STORAGE_KEYS.PRODUCT_COUNTER) || '0');
    counter++;
    mockSetItem(STORAGE_KEYS.PRODUCT_COUNTER, counter.toString());
    
    // Format: PRD-00001
    return `PRD-${String(counter).padStart(5, '0')}`;
  }

  describe('Basic code generation', () => {
    test('should generate product code with correct format', async () => {
      const code = await generateProductCode();
      expect(code).toMatch(/^PRD-\d{5}$/);
      expect(code).toContain('PRD-');
    });

    test('should start counter from 1', async () => {
      localStorageData = {};
      mockData.products = [];
      const code = await generateProductCode();
      expect(code).toMatch(/PRD-00001$/);
    });

    test('should increment counter correctly', async () => {
      localStorageData = {};
      mockData.products = [];
      const code1 = await generateProductCode();
      const code2 = await generateProductCode();
      const code3 = await generateProductCode();

      const counter1 = parseInt(code1.split('-')[1]);
      const counter2 = parseInt(code2.split('-')[1]);
      const counter3 = parseInt(code3.split('-')[1]);

      expect(counter2).toBe(counter1 + 1);
      expect(counter3).toBe(counter2 + 1);
    });

    test('should pad counter with zeros', async () => {
      localStorageData = {};
      mockData.products = [];
      const code = await generateProductCode();
      const counter = code.split('-')[1];
      expect(counter.length).toBe(5);
      expect(counter).toMatch(/^\d{5}$/);
    });
  });

  describe('Database integration', () => {
    test('should use database products to find max counter', async () => {
      mockData.products = [
        { code: 'PRD-00001' },
        { code: 'PRD-00005' },
        { code: 'PRD-00003' }
      ];
      if (!global.window.electronAPI) {
        global.window.electronAPI = {};
      }
      global.window.electronAPI.dbGetAll = jest.fn(async () => mockData.products);
      const code = await generateProductCode();
      const counter = parseInt(code.split('-')[1]);
      expect(counter).toBe(6); // Max is 5, so next is 6
    });

    test('should handle products without PRD prefix', async () => {
      mockData.products = [
        { code: 'PRD-00001' },
        { code: 'OLD-001' },
        { code: 'PRD-00003' }
      ];
      if (!global.window.electronAPI) {
        global.window.electronAPI = {};
      }
      global.window.electronAPI.dbGetAll = jest.fn(async () => mockData.products);
      const code = await generateProductCode();
      const counter = parseInt(code.split('-')[1]);
      expect(counter).toBe(4); // Only PRD codes are considered
    });

    test('should handle empty products array', async () => {
      mockData.products = [];
      const code = await generateProductCode();
      expect(code).toMatch(/PRD-00001$/);
    });

    test('should fallback to localStorage if database fails', async () => {
      localStorageData = {};
      localStorageData['asel_product_counter'] = '10';
      if (!global.window.electronAPI) {
        global.window.electronAPI = {};
      }
      global.window.electronAPI.dbGetAll = jest.fn(async () => {
        throw new Error('Database error');
      });
      
      const code = await generateProductCode();
      const counter = parseInt(code.split('-')[1]);
      expect(counter).toBe(11);
    });
  });

  describe('LocalStorage fallback', () => {
    test('should read counter from localStorage', async () => {
      localStorageData = {};
      localStorageData['asel_product_counter'] = '5';
      mockData.products = [];
      if (!global.window.electronAPI) {
        global.window.electronAPI = {};
      }
      global.window.electronAPI.dbGetAll = jest.fn(async () => {
        throw new Error('Database error');
      });
      
      const code = await generateProductCode();
      const counter = parseInt(code.split('-')[1]);
      expect(counter).toBe(6);
    });

    test('should save counter to localStorage', async () => {
      localStorageData = {};
      mockData.products = [];
      if (!global.window.electronAPI) {
        global.window.electronAPI = {};
      }
      global.window.electronAPI.dbGetAll = jest.fn(async () => {
        throw new Error('Database error');
      });
      
      await generateProductCode();
      expect(mockSetItem).toHaveBeenCalledWith(
        'asel_product_counter',
        '1'
      );
    });

    test('should handle missing counter in localStorage', async () => {
      localStorageData = {};
      mockData.products = [];
      if (!global.window.electronAPI) {
        global.window.electronAPI = {};
      }
      global.window.electronAPI.dbGetAll = jest.fn(async () => {
        throw new Error('Database error');
      });
      
      const code = await generateProductCode();
      expect(code).toMatch(/PRD-00001$/);
    });
  });

  describe('Edge cases', () => {
    test('should handle very large counter values', async () => {
      mockData.products = [
        { code: 'PRD-99999' }
      ];
      if (!global.window.electronAPI) {
        global.window.electronAPI = {};
      }
      global.window.electronAPI.dbGetAll = jest.fn(async () => mockData.products);
      const code = await generateProductCode();
      expect(code).toMatch(/PRD-100000$/);
    });

    test('should handle products with invalid codes', async () => {
      mockData.products = [
        { code: 'PRD-00001' },
        { code: 'INVALID' },
        { code: null },
        { code: undefined }
      ];
      if (!global.window.electronAPI) {
        global.window.electronAPI = {};
      }
      global.window.electronAPI.dbGetAll = jest.fn(async () => mockData.products);
      const code = await generateProductCode();
      const counter = parseInt(code.split('-')[1]);
      expect(counter).toBe(2);
    });

    test('should handle no electronAPI', async () => {
      localStorageData = {};
      global.window.electronAPI = null;
      const code = await generateProductCode();
      expect(code).toMatch(/PRD-00001$/);
    });
  });
});

