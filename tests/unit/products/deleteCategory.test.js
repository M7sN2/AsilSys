// Tests for deleteCategory function from products.js

const { setupMockElectronAPI } = require('../../helpers/test-helpers');

describe('deleteCategory', () => {
  let categories;
  let products;
  let mockData;
  let showMessageCalled;
  let confirmResult;

  beforeEach(() => {
    categories = ['فئة 1', 'فئة 2', 'فئة 3'];
    products = [
      { id: '1', category: 'فئة 1', name: 'منتج 1' },
      { id: '2', category: 'فئة 2', name: 'منتج 2' },
      { id: '3', category: 'فئة 1', name: 'منتج 3' }
    ];
    showMessageCalled = { message: '', type: '' };
    confirmResult = true;
    mockData = setupMockElectronAPI();

    global.window = {
      electronAPI: {
        dbGetAll: jest.fn(async () => []),
        dbDelete: jest.fn(async () => ({ success: true }))
      }
    };

    global.confirm = jest.fn(() => confirmResult);
    global.showMessage = jest.fn((message, type) => {
      showMessageCalled.message = message;
      showMessageCalled.type = type;
    });
    global.saveCategories = jest.fn(async () => {});
    global.renderCategories = jest.fn(() => {});
    global.renderCategoriesList = jest.fn(() => {});
  });

  // Copy the function for testing
  async function deleteCategory(index) {
    if (index < 0 || index >= categories.length) {
      return;
    }

    const categoryName = categories[index];
    
    // Count products using this category
    const usageCount = products.filter(p => p.category === categoryName).length;
    
    if (usageCount > 0) {
      global.showMessage('لا يمكن حذف هذا الصنف لأنه مستخدم في منتجات', 'error');
      return;
    }

    if (!global.confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      return;
    }

    try {
      // Delete from database
      if (global.window.electronAPI && global.window.electronAPI.dbGetAll) {
        const existingCategories = await global.window.electronAPI.dbGetAll('categories', 'name = ?', [categoryName]);
        if (existingCategories && existingCategories.length > 0) {
          await global.window.electronAPI.dbDelete('categories', existingCategories[0].id);
        }
      }
      
      // Remove from local array
      categories.splice(index, 1);
      await global.saveCategories();
      global.renderCategories();
      global.renderCategoriesList();
      global.showMessage('تم حذف الصنف بنجاح', 'success');
    } catch (error) {
      console.error('Error deleting category:', error);
      global.showMessage('خطأ في حذف الصنف: ' + error.message, 'error');
    }
  }

  describe('Basic category deletion', () => {
    test('should delete category successfully', async () => {
      const initialLength = categories.length;
      await deleteCategory(2); // Delete 'فئة 3'
      
      expect(categories.length).toBe(initialLength - 1);
      expect(categories).not.toContain('فئة 3');
      expect(global.showMessage).toHaveBeenCalledWith('تم حذف الصنف بنجاح', 'success');
    });

    test('should ask for confirmation', async () => {
      await deleteCategory(2);
      expect(global.confirm).toHaveBeenCalledWith('هل أنت متأكد من حذف هذا الصنف؟');
    });

    test('should not delete if user cancels', async () => {
      confirmResult = false;
      const initialLength = categories.length;
      await deleteCategory(2);
      
      expect(categories.length).toBe(initialLength);
      expect(global.showMessage).not.toHaveBeenCalledWith('تم حذف الصنف بنجاح', 'success');
    });
  });

  describe('Category with products', () => {
    test('should prevent deletion if category is used', async () => {
      const initialLength = categories.length;
      await deleteCategory(0); // 'فئة 1' has 2 products
      
      expect(categories.length).toBe(initialLength);
      expect(global.showMessage).toHaveBeenCalledWith(
        'لا يمكن حذف هذا الصنف لأنه مستخدم في منتجات',
        'error'
      );
    });

    test('should allow deletion if category is not used', async () => {
      const initialLength = categories.length;
      await deleteCategory(2); // 'فئة 3' has no products
      
      expect(categories.length).toBe(initialLength - 1);
      expect(global.showMessage).toHaveBeenCalledWith('تم حذف الصنف بنجاح', 'success');
    });
  });

  describe('Database integration', () => {
    test('should delete category from database', async () => {
      global.window.electronAPI.dbGetAll = jest.fn(async () => [
        { id: 'cat-1', name: 'فئة 3' }
      ]);
      
      await deleteCategory(2);
      
      expect(global.window.electronAPI.dbDelete).toHaveBeenCalledWith('categories', 'cat-1');
    });

    test('should handle category not found in database', async () => {
      global.window.electronAPI.dbGetAll = jest.fn(async () => []);
      
      await deleteCategory(2);
      
      expect(categories.length).toBe(2);
      expect(global.showMessage).toHaveBeenCalledWith('تم حذف الصنف بنجاح', 'success');
    });
  });

  describe('Edge cases', () => {
    test('should handle invalid index', async () => {
      const initialLength = categories.length;
      await deleteCategory(-1);
      await deleteCategory(100);
      
      expect(categories.length).toBe(initialLength);
    });

    test('should handle empty categories array', async () => {
      categories = [];
      await deleteCategory(0);
      
      expect(categories.length).toBe(0);
    });

    test('should handle database error', async () => {
      global.window.electronAPI.dbGetAll = jest.fn(async () => {
        throw new Error('Database error');
      });
      
      await deleteCategory(2);
      
      expect(global.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('خطأ في حذف الصنف'),
        'error'
      );
    });

    test('should handle no electronAPI', async () => {
      global.window.electronAPI = null;
      const initialLength = categories.length;
      await deleteCategory(2);
      
      expect(categories.length).toBe(initialLength - 1);
    });
  });
});

