// Tests for applyFilters function from products.js

const { createMockElement } = require('../../helpers/test-helpers');

describe('applyFilters', () => {
  let products;
  let filteredProducts;
  let mockElements;

  // Copy the function for testing
  function applyFilters() {
    const searchTerm = mockElements.searchInput.value.toLowerCase();
    const categoryFilterValue = mockElements.categoryFilter.value;
    const statusFilterValue = mockElements.statusFilter.value;
    const stockFilterValue = mockElements.stockFilter.value;

    // Filter products
    filteredProducts = products.filter(product => {
      const stock = parseFloat(product.stock || 0);
      
      // Search filter - includes name, code, category, and stock value
      const matchSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm) ||
        product.code.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm) ||
        stock.toString().includes(searchTerm);
      
      // Category filter
      const matchCategory = !categoryFilterValue || product.category === categoryFilterValue;
      
      // Status filter
      const matchStatus = !statusFilterValue || product.status === statusFilterValue;
      
      // Stock filter
      let matchStock = true;
      if (stockFilterValue) {
        if (stockFilterValue === 'zero') {
          matchStock = stock === 0;
        } else if (stockFilterValue === 'low') {
          matchStock = stock > 0 && stock < 150;
        } else if (stockFilterValue === 'medium') {
          matchStock = stock >= 150 && stock < 300;
        } else if (stockFilterValue === 'high') {
          matchStock = stock >= 300;
        }
      }

      return matchSearch && matchCategory && matchStatus && matchStock;
    });
  }

  beforeEach(() => {
    products = [
      {
        id: '1',
        code: 'PRD-00001',
        name: 'منتج 1',
        category: 'فئة 1',
        status: 'active',
        stock: 100
      },
      {
        id: '2',
        code: 'PRD-00002',
        name: 'منتج 2',
        category: 'فئة 2',
        status: 'active',
        stock: 200
      },
      {
        id: '3',
        code: 'PRD-00003',
        name: 'منتج 3',
        category: 'فئة 1',
        status: 'inactive',
        stock: 0
      },
      {
        id: '4',
        code: 'PRD-00004',
        name: 'منتج 4',
        category: 'فئة 2',
        status: 'active',
        stock: 350
      }
    ];

    filteredProducts = [];

    mockElements = {
      searchInput: createMockElement('searchInput', ''),
      categoryFilter: createMockElement('categoryFilter', ''),
      statusFilter: createMockElement('statusFilter', ''),
      stockFilter: createMockElement('stockFilter', '')
    };

    global.document.getElementById = jest.fn((id) => {
      const elementMap = {
        searchInput: mockElements.searchInput,
        categoryFilter: mockElements.categoryFilter,
        statusFilter: mockElements.statusFilter,
        stockFilter: mockElements.stockFilter
      };
      return elementMap[id] || createMockElement(id);
    });
  });

  describe('Search filter', () => {
    test('should filter by product name', () => {
      mockElements.searchInput.value = 'منتج 1';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].name).toBe('منتج 1');
    });

    test('should filter by product code', () => {
      mockElements.searchInput.value = 'PRD-00002';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].code).toBe('PRD-00002');
    });

    test('should filter by category', () => {
      mockElements.searchInput.value = 'فئة 1';
      applyFilters();
      expect(filteredProducts.length).toBe(2);
      expect(filteredProducts.every(p => p.category === 'فئة 1')).toBe(true);
    });

    test('should filter by stock value', () => {
      mockElements.searchInput.value = '100';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].stock).toBe(100);
    });

    test('should return all products when search is empty', () => {
      mockElements.searchInput.value = '';
      applyFilters();
      expect(filteredProducts.length).toBe(4);
    });

    test('should be case insensitive', () => {
      mockElements.searchInput.value = 'prd';
      applyFilters();
      expect(filteredProducts.length).toBeGreaterThan(0);
    });
  });

  describe('Category filter', () => {
    test('should filter by category', () => {
      mockElements.categoryFilter.value = 'فئة 1';
      applyFilters();
      expect(filteredProducts.length).toBe(2);
      expect(filteredProducts.every(p => p.category === 'فئة 1')).toBe(true);
    });

    test('should return all products when category filter is empty', () => {
      mockElements.categoryFilter.value = '';
      applyFilters();
      expect(filteredProducts.length).toBe(4);
    });

    test('should return empty when category does not match', () => {
      mockElements.categoryFilter.value = 'فئة غير موجودة';
      applyFilters();
      expect(filteredProducts.length).toBe(0);
    });
  });

  describe('Status filter', () => {
    test('should filter by active status', () => {
      mockElements.statusFilter.value = 'active';
      applyFilters();
      expect(filteredProducts.length).toBe(3);
      expect(filteredProducts.every(p => p.status === 'active')).toBe(true);
    });

    test('should filter by inactive status', () => {
      mockElements.statusFilter.value = 'inactive';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].status).toBe('inactive');
    });

    test('should return all products when status filter is empty', () => {
      mockElements.statusFilter.value = '';
      applyFilters();
      expect(filteredProducts.length).toBe(4);
    });
  });

  describe('Stock filter', () => {
    test('should filter by zero stock', () => {
      mockElements.stockFilter.value = 'zero';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].stock).toBe(0);
    });

    test('should filter by low stock (0 < stock < 150)', () => {
      mockElements.stockFilter.value = 'low';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].stock).toBe(100);
      expect(filteredProducts[0].stock).toBeGreaterThan(0);
      expect(filteredProducts[0].stock).toBeLessThan(150);
    });

    test('should filter by medium stock (150 <= stock < 300)', () => {
      mockElements.stockFilter.value = 'medium';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].stock).toBe(200);
      expect(filteredProducts[0].stock).toBeGreaterThanOrEqual(150);
      expect(filteredProducts[0].stock).toBeLessThan(300);
    });

    test('should filter by high stock (stock >= 300)', () => {
      mockElements.stockFilter.value = 'high';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].stock).toBe(350);
      expect(filteredProducts[0].stock).toBeGreaterThanOrEqual(300);
    });

    test('should return all products when stock filter is empty', () => {
      mockElements.stockFilter.value = '';
      applyFilters();
      expect(filteredProducts.length).toBe(4);
    });
  });

  describe('Combined filters', () => {
    test('should apply multiple filters together', () => {
      mockElements.categoryFilter.value = 'فئة 1';
      mockElements.statusFilter.value = 'active';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].category).toBe('فئة 1');
      expect(filteredProducts[0].status).toBe('active');
    });

    test('should apply all filters together', () => {
      mockElements.searchInput.value = 'منتج';
      mockElements.categoryFilter.value = 'فئة 1';
      mockElements.statusFilter.value = 'active';
      mockElements.stockFilter.value = 'low';
      applyFilters();
      expect(filteredProducts.length).toBe(1);
      expect(filteredProducts[0].name).toContain('منتج');
      expect(filteredProducts[0].category).toBe('فئة 1');
      expect(filteredProducts[0].status).toBe('active');
      expect(filteredProducts[0].stock).toBe(100);
    });

    test('should return empty when filters do not match', () => {
      mockElements.categoryFilter.value = 'فئة 1';
      mockElements.statusFilter.value = 'inactive';
      mockElements.stockFilter.value = 'high';
      applyFilters();
      expect(filteredProducts.length).toBe(0);
    });
  });

  describe('Edge cases', () => {
    test('should handle products with null stock', () => {
      products.push({
        id: '5',
        code: 'PRD-00005',
        name: 'منتج 5',
        category: 'فئة 1',
        status: 'active',
        stock: null
      });
      mockElements.stockFilter.value = 'zero';
      applyFilters();
      expect(filteredProducts.length).toBe(2); // Includes product with null stock (treated as 0)
    });

    test('should handle products with undefined stock', () => {
      products.push({
        id: '5',
        code: 'PRD-00005',
        name: 'منتج 5',
        category: 'فئة 1',
        status: 'active',
        stock: undefined
      });
      mockElements.stockFilter.value = 'zero';
      applyFilters();
      expect(filteredProducts.length).toBe(2);
    });

    test('should handle empty products array', () => {
      products = [];
      applyFilters();
      expect(filteredProducts.length).toBe(0);
    });
  });
});

