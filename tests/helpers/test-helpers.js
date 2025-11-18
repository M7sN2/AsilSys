// Test helper functions

/**
 * Create a mock DOM element
 */
function createMockElement(id, value = '', textContent = '') {
  return {
    id,
    value,
    textContent,
    innerHTML: '',
    style: {
      display: 'none'
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    hasAttribute: jest.fn(() => false),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(() => false)
    },
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => [])
  };
}

/**
 * Setup mock DOM for tests
 */
function setupMockDOM() {
  const mockElements = {
    shipping: createMockElement('shipping', '0'),
    discount: createMockElement('discount', '0'),
    paid: createMockElement('paid', '0'),
    subtotal: createMockElement('subtotal', '', '0.00 ج.م'),
    taxAmount: createMockElement('taxAmount', '', '0.00 ج.م'),
    total: createMockElement('total', '', '0.00 ج.م'),
    remaining: createMockElement('remaining', '', '0.00 ج.م'),
    supplierSelect: createMockElement('supplierSelect', ''),
    oldBalanceDisplay: createMockElement('oldBalanceDisplay', '', '0.00 ج.م'),
    newBalanceDisplay: createMockElement('newBalanceDisplay', '', '0.00 ج.م'),
    newBalanceRow: createMockElement('newBalanceRow'),
    finalBalanceRow: createMockElement('finalBalanceRow')
  };

  global.document.getElementById = jest.fn((id) => {
    return mockElements[id] || createMockElement(id);
  });

  return mockElements;
}

/**
 * Reset mock DOM
 */
function resetMockDOM() {
  global.document.getElementById = jest.fn();
}

/**
 * Mock localStorage with data
 */
function setupMockLocalStorage(data = {}) {
  const storage = { ...data };
  
  global.localStorage.getItem = jest.fn((key) => {
    return storage[key] || null;
  });
  
  global.localStorage.setItem = jest.fn((key, value) => {
    storage[key] = value;
  });
  
  global.localStorage.removeItem = jest.fn((key) => {
    delete storage[key];
  });
  
  global.localStorage.clear = jest.fn(() => {
    Object.keys(storage).forEach(key => delete storage[key]);
  });
  
  return storage;
}

/**
 * Mock Electron API
 */
function setupMockElectronAPI() {
  const mockData = {
    suppliers: [],
    products: [],
    invoices: []
  };

  global.window.electronAPI = {
    dbGet: jest.fn(async (table, id) => {
      const items = mockData[table] || [];
      return items.find(item => item.id === id) || null;
    }),
    
    dbGetAll: jest.fn(async (table, where = '', params = []) => {
      return mockData[table] || [];
    }),
    
    dbInsert: jest.fn(async (table, data) => {
      if (!mockData[table]) {
        mockData[table] = [];
      }
      mockData[table].push(data);
      return { success: true, id: data.id };
    }),
    
    dbUpdate: jest.fn(async (table, id, data) => {
      if (!mockData[table]) {
        mockData[table] = [];
      }
      const index = mockData[table].findIndex(item => item.id === id);
      if (index !== -1) {
        mockData[table][index] = { ...mockData[table][index], ...data };
        return { success: true };
      }
      return { success: false };
    }),
    
    dbDelete: jest.fn(async (table, id) => {
      if (!mockData[table]) {
        mockData[table] = [];
      }
      const index = mockData[table].findIndex(item => item.id === id);
      if (index !== -1) {
        mockData[table].splice(index, 1);
        return { success: true };
      }
      return { success: false };
    }),
    
    dbQuery: jest.fn(async (sql, params = []) => {
      return { success: true };
    }),
    
    saveInvoiceToFile: jest.fn(async (content, fileName) => {
      return { success: true, filePath: `test/${fileName}` };
    })
  };

  return mockData;
}

/**
 * Calculate expected total for invoice
 */
function calculateExpectedTotal(products, shipping = 0, discount = 0) {
  const subtotal = products.reduce((sum, p) => sum + (p.total || 0), 0);
  return subtotal + shipping - discount;
}

/**
 * Create test invoice products array
 */
function createTestInvoiceProducts(count = 1) {
  return Array.from({ length: count }, (_, i) => ({
    productId: `test-product-${i + 1}`,
    productName: `منتج تجريبي ${i + 1}`,
    productCode: `PROD${String(i + 1).padStart(3, '0')}`,
    quantity: (i + 1) * 10,
    unit: 'smallest',
    unitName: 'قطعة',
    price: (i + 1) * 10,
    total: (i + 1) * 10 * (i + 1) * 10
  }));
}

module.exports = {
  createMockElement,
  setupMockDOM,
  resetMockDOM,
  setupMockLocalStorage,
  setupMockElectronAPI,
  calculateExpectedTotal,
  createTestInvoiceProducts
};

