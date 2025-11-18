// Test setup file
// This file runs before all tests

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window object
global.window = {
  localStorage: localStorageMock,
  electronAPI: {
    dbGet: jest.fn(),
    dbGetAll: jest.fn(),
    dbInsert: jest.fn(),
    dbUpdate: jest.fn(),
    dbDelete: jest.fn(),
    dbQuery: jest.fn(),
    saveInvoiceToFile: jest.fn()
  },
  dispatchEvent: jest.fn(),
  focus: jest.fn()
};

// Mock document
global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  addEventListener: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn()
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
  localStorageMock.setItem.mockImplementation(() => {});
  localStorageMock.removeItem.mockImplementation(() => {});
  localStorageMock.clear.mockImplementation(() => {});
});

