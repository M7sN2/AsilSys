// Tests for applyFilters function from sales.js

describe('applyFilters', () => {
  let invoices;
  let customers;
  let filteredInvoices;
  let searchQuery;
  let dateFrom;
  let dateTo;
  let statusFilter;
  let sortBy;

  // Copy the function for testing
  function applyFilters() {
    filteredInvoices = [...invoices];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredInvoices = filteredInvoices.filter(invoice => {
        const invoiceNumber = (invoice.invoiceNumber || '').toLowerCase();
        if (invoiceNumber.includes(query)) return true;
        
        const customer = customers.find(c => c.id === invoice.customerId);
        if (customer) {
          const customerName = (customer.name || '').toLowerCase();
          if (customerName.includes(query)) return true;
        }
        
        return false;
      });
    }
    
    // Apply date range filter
    if (dateFrom) {
      filteredInvoices = filteredInvoices.filter(invoice => {
        return new Date(invoice.date) >= new Date(dateFrom);
      });
    }
    
    if (dateTo) {
      filteredInvoices = filteredInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.date);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        return invoiceDate <= toDate;
      });
    }
    
    // Apply status filter
    if (statusFilter) {
      filteredInvoices = filteredInvoices.filter(invoice => {
        return invoice.status === statusFilter;
      });
    }
    
    // Apply sorting
    filteredInvoices.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date) - new Date(a.date);
        case 'date-asc':
          return new Date(a.date) - new Date(b.date);
        case 'total-desc':
          return b.total - a.total;
        case 'total-asc':
          return a.total - b.total;
        default:
          return 0;
      }
    });
  }

  beforeEach(() => {
    customers = [
      { id: 'customer-1', name: 'عميل 1', code: 'CUST001' },
      { id: 'customer-2', name: 'عميل 2', code: 'CUST002' }
    ];

    invoices = [
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-2024-001',
        customerId: 'customer-1',
        date: '2024-01-15',
        status: 'pending',
        total: 100
      },
      {
        id: 'invoice-2',
        invoiceNumber: 'INV-2024-002',
        customerId: 'customer-2',
        date: '2024-02-20',
        status: 'delivered',
        total: 200
      },
      {
        id: 'invoice-3',
        invoiceNumber: 'INV-2024-003',
        customerId: 'customer-1',
        date: '2024-03-10',
        status: 'pending',
        total: 150
      }
    ];

    filteredInvoices = [];
    searchQuery = '';
    dateFrom = '';
    dateTo = '';
    statusFilter = '';
    sortBy = 'date-desc';
  });

  describe('Search filter', () => {
    test('should filter by invoice number', () => {
      searchQuery = 'INV-2024-001';
      applyFilters();
      expect(filteredInvoices.length).toBe(1);
      expect(filteredInvoices[0].invoiceNumber).toBe('INV-2024-001');
    });

    test('should filter by customer name', () => {
      searchQuery = 'عميل 1';
      applyFilters();
      expect(filteredInvoices.length).toBe(2);
      expect(filteredInvoices.every(inv => inv.customerId === 'customer-1')).toBe(true);
    });

    test('should return all invoices when search is empty', () => {
      searchQuery = '';
      applyFilters();
      expect(filteredInvoices.length).toBe(3);
    });

    test('should be case insensitive', () => {
      searchQuery = 'inv-2024-001';
      applyFilters();
      expect(filteredInvoices.length).toBe(1);
    });
  });

  describe('Date range filter', () => {
    test('should filter by date from', () => {
      dateFrom = '2024-02-01';
      applyFilters();
      expect(filteredInvoices.length).toBe(2);
      expect(filteredInvoices.every(inv => new Date(inv.date) >= new Date(dateFrom))).toBe(true);
    });

    test('should filter by date to', () => {
      dateTo = '2024-02-28';
      applyFilters();
      expect(filteredInvoices.length).toBe(2);
      expect(filteredInvoices.every(inv => new Date(inv.date) <= new Date(dateTo))).toBe(true);
    });

    test('should filter by date range', () => {
      dateFrom = '2024-02-01';
      dateTo = '2024-02-28';
      applyFilters();
      expect(filteredInvoices.length).toBe(1);
      expect(filteredInvoices[0].date).toBe('2024-02-20');
    });

    test('should return all invoices when date filters are empty', () => {
      dateFrom = '';
      dateTo = '';
      applyFilters();
      expect(filteredInvoices.length).toBe(3);
    });
  });

  describe('Status filter', () => {
    test('should filter by pending status', () => {
      statusFilter = 'pending';
      applyFilters();
      expect(filteredInvoices.length).toBe(2);
      expect(filteredInvoices.every(inv => inv.status === 'pending')).toBe(true);
    });

    test('should filter by delivered status', () => {
      statusFilter = 'delivered';
      applyFilters();
      expect(filteredInvoices.length).toBe(1);
      expect(filteredInvoices[0].status).toBe('delivered');
    });

    test('should return all invoices when status filter is empty', () => {
      statusFilter = '';
      applyFilters();
      expect(filteredInvoices.length).toBe(3);
    });
  });

  describe('Sorting', () => {
    test('should sort by date descending', () => {
      sortBy = 'date-desc';
      applyFilters();
      expect(filteredInvoices[0].date).toBe('2024-03-10');
      expect(filteredInvoices[filteredInvoices.length - 1].date).toBe('2024-01-15');
    });

    test('should sort by date ascending', () => {
      sortBy = 'date-asc';
      applyFilters();
      expect(filteredInvoices[0].date).toBe('2024-01-15');
      expect(filteredInvoices[filteredInvoices.length - 1].date).toBe('2024-03-10');
    });

    test('should sort by total descending', () => {
      sortBy = 'total-desc';
      applyFilters();
      expect(filteredInvoices[0].total).toBe(200);
      expect(filteredInvoices[filteredInvoices.length - 1].total).toBe(100);
    });

    test('should sort by total ascending', () => {
      sortBy = 'total-asc';
      applyFilters();
      expect(filteredInvoices[0].total).toBe(100);
      expect(filteredInvoices[filteredInvoices.length - 1].total).toBe(200);
    });
  });

  describe('Combined filters', () => {
    test('should apply multiple filters together', () => {
      searchQuery = 'عميل 1';
      statusFilter = 'pending';
      applyFilters();
      expect(filteredInvoices.length).toBe(2);
      expect(filteredInvoices.every(inv => 
        inv.customerId === 'customer-1' && inv.status === 'pending'
      )).toBe(true);
    });

    test('should apply all filters together', () => {
      searchQuery = 'عميل 1';
      dateFrom = '2024-01-01';
      dateTo = '2024-02-28';
      statusFilter = 'pending';
      sortBy = 'date-desc';
      applyFilters();
      expect(filteredInvoices.length).toBe(1);
      expect(filteredInvoices[0].date).toBe('2024-01-15');
    });

    test('should return empty when filters do not match', () => {
      searchQuery = 'INV-2024-999';
      applyFilters();
      expect(filteredInvoices.length).toBe(0);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty invoices array', () => {
      invoices = [];
      applyFilters();
      expect(filteredInvoices.length).toBe(0);
    });

    test('should handle invoices without customer', () => {
      invoices.push({
        id: 'invoice-4',
        invoiceNumber: 'INV-2024-004',
        customerId: 'non-existent',
        date: '2024-04-01',
        status: 'pending',
        total: 50
      });
      searchQuery = 'INV-2024-004';
      applyFilters();
      expect(filteredInvoices.length).toBe(1);
    });

    test('should handle invoices with missing invoice number', () => {
      invoices.push({
        id: 'invoice-5',
        invoiceNumber: null,
        customerId: 'customer-1',
        date: '2024-05-01',
        status: 'pending',
        total: 75
      });
      searchQuery = 'INV-2024-005';
      applyFilters();
      expect(filteredInvoices.length).toBe(0);
    });
  });
});

