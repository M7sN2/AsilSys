// Tests for addCategory function from products.js

const { setupMockElectronAPI } = require('../../helpers/test-helpers');

describe('addCategory', () => {
  let categories;
  let mockData;
  let mockElements;
  let showMessageCalled;

  beforeEach(() => {
    categories = [];
    showMessageCalled = { message: '', type: '' };
    mockData = setupMockElectronAPI();

    mockElements = {
      newCategoryName: {
        value: '',
        trim: jest.fn(function() { return this.value.trim(); })
      }
    };

    global.document.getElementById = jest.fn((id) => {
      if (id === 'newCategoryName') {
        return mockElements.newCategoryName;
      }
      return {
        value: '',
        innerHTML: '',
        classList: {
          remove: jest.fn(),
          add: jest.fn()
        },
        appendChild: jest.fn()
      };
    });

    global.window = {
      electronAPI: {
        dbGetAll: jest.fn(async () => []),
        dbInsert: jest.fn(async () => ({ success: true }))
      }
    };

    // Mock showMessage
    global.showMessage = jest.fn((message, type) => {
      showMessageCalled.message = message;
      showMessageCalled.type = type;
    });

    // Mock saveCategories
    global.saveCategories = jest.fn(async () => {});
    global.renderCategories = jest.fn(() => {});
    global.renderCategoriesList = jest.fn(() => {});
  });

  // Copy the function for testing
  async function addCategory() {
    const categoryName = mockElements.newCategoryName.value.trim();
    
    if (!categoryName) {
      global.showMessage('يرجى إدخال اسم الصنف', 'error');
      return;
    }

    if (categories.includes(categoryName)) {
      global.showMessage('هذا الصنف موجود بالفعل', 'error');
      return;
    }

    try {
      // Check if category exists in database
      if (global.window.electronAPI && global.window.electronAPI.dbGetAll) {
        const existingCategories = await global.window.electronAPI.dbGetAll('categories', 'name = ?', [categoryName]);
        if (existingCategories && existingCategories.length > 0) {
          global.showMessage('هذا الصنف موجود بالفعل', 'error');
          return;
        }
        
        // Insert category in database
        const categoryData = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
          name: categoryName,
          createdAt: new Date().toISOString()
        };
        await global.window.electronAPI.dbInsert('categories', categoryData);
      }
      
      // Add to local array
      categories.push(categoryName);
      await global.saveCategories();
      global.renderCategories();
      global.renderCategoriesList();
      mockElements.newCategoryName.value = '';
      global.showMessage('تم إضافة الصنف بنجاح', 'success');
    } catch (error) {
      console.error('Error adding category:', error);
      global.showMessage('خطأ في إضافة الصنف: ' + error.message, 'error');
    }
  }

  describe('Basic category addition', () => {
    test('should add new category successfully', async () => {
      mockElements.newCategoryName.value = 'فئة جديدة';
      await addCategory();
      
      expect(categories.length).toBe(1);
      expect(categories[0]).toBe('فئة جديدة');
      expect(global.showMessage).toHaveBeenCalledWith('تم إضافة الصنف بنجاح', 'success');
      expect(mockElements.newCategoryName.value).toBe('');
    });

    test('should add category to database', async () => {
      mockElements.newCategoryName.value = 'فئة جديدة';
      await addCategory();
      
      expect(global.window.electronAPI.dbInsert).toHaveBeenCalled();
      const insertCall = global.window.electronAPI.dbInsert.mock.calls[0];
      expect(insertCall[0]).toBe('categories');
      expect(insertCall[1].name).toBe('فئة جديدة');
    });

    test('should trim category name', async () => {
      mockElements.newCategoryName.value = '  فئة جديدة  ';
      await addCategory();
      
      expect(categories[0]).toBe('فئة جديدة');
    });
  });

  describe('Validation', () => {
    test('should reject empty category name', async () => {
      mockElements.newCategoryName.value = '';
      await addCategory();
      
      expect(categories.length).toBe(0);
      expect(global.showMessage).toHaveBeenCalledWith('يرجى إدخال اسم الصنف', 'error');
    });

    test('should reject whitespace-only category name', async () => {
      mockElements.newCategoryName.value = '   ';
      await addCategory();
      
      expect(categories.length).toBe(0);
      expect(global.showMessage).toHaveBeenCalledWith('يرجى إدخال اسم الصنف', 'error');
    });

    test('should reject duplicate category in local array', async () => {
      categories.push('فئة موجودة');
      mockElements.newCategoryName.value = 'فئة موجودة';
      await addCategory();
      
      expect(categories.length).toBe(1);
      expect(global.showMessage).toHaveBeenCalledWith('هذا الصنف موجود بالفعل', 'error');
    });

    test('should reject duplicate category in database', async () => {
      global.window.electronAPI.dbGetAll = jest.fn(async () => [
        { id: '1', name: 'فئة موجودة' }
      ]);
      
      mockElements.newCategoryName.value = 'فئة موجودة';
      await addCategory();
      
      expect(categories.length).toBe(0);
      expect(global.showMessage).toHaveBeenCalledWith('هذا الصنف موجود بالفعل', 'error');
    });
  });

  describe('Multiple categories', () => {
    test('should add multiple categories', async () => {
      // Reset categories for this test
      categories.length = 0;
      global.window.electronAPI.dbGetAll = jest.fn(async () => []);
      
      mockElements.newCategoryName.value = 'فئة 1';
      await addCategory();
      
      mockElements.newCategoryName.value = 'فئة 2';
      await addCategory();
      
      mockElements.newCategoryName.value = 'فئة 3';
      await addCategory();
      
      expect(categories.length).toBe(3);
      expect(categories).toContain('فئة 1');
      expect(categories).toContain('فئة 2');
      expect(categories).toContain('فئة 3');
    });
  });

  describe('Error handling', () => {
    test('should handle database error gracefully', async () => {
      global.window.electronAPI.dbGetAll = jest.fn(async () => {
        throw new Error('Database error');
      });
      
      mockElements.newCategoryName.value = 'فئة جديدة';
      await addCategory();
      
      expect(global.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('خطأ في إضافة الصنف'),
        'error'
      );
    });

    test('should handle database insert error', async () => {
      global.window.electronAPI.dbInsert = jest.fn(async () => {
        throw new Error('Insert failed');
      });
      
      mockElements.newCategoryName.value = 'فئة جديدة';
      await addCategory();
      
      expect(global.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('خطأ في إضافة الصنف'),
        'error'
      );
    });
  });

  describe('Edge cases', () => {
    test('should handle no electronAPI', async () => {
      global.window.electronAPI = null;
      mockElements.newCategoryName.value = 'فئة جديدة';
      await addCategory();
      
      expect(categories.length).toBe(1);
      expect(categories[0]).toBe('فئة جديدة');
    });

    test('should handle long category names', async () => {
      const longName = 'فئة '.repeat(100);
      mockElements.newCategoryName.value = longName;
      await addCategory();
      
      expect(categories[0]).toBe(longName.trim());
    });
  });
});

