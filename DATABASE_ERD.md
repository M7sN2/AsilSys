# مخطط قاعدة البيانات - نظام أسيل (ERD)

## مخطط العلاقات الكامل (Entity Relationship Diagram)

```mermaid
erDiagram
    %% الجداول الأساسية
    categories {
        string id
        string name
        string createdAt
    }
    
    products {
        string id
        string code
        string name
        string category
        string smallestUnit
        string largestUnit
        float conversionFactor
        float smallestPrice
        float largestPrice
        float stock
        float openingStock
        string notes
        string status
        string lastSaleDate
        string createdAt
        string updatedAt
    }
    
    customers {
        string id
        string code
        string name
        string phone
        string address
        string firstTransactionDate
        float openingBalance
        float balance
        string status
        string lastTransactionDate
        string notes
        string createdAt
        string updatedAt
    }
    
    suppliers {
        string id
        string code
        string name
        string phone
        string address
        string firstTransactionDate
        float openingBalance
        float balance
        string status
        string lastTransactionDate
        string createdAt
        string updatedAt
    }
    
    users {
        string id
        string username
        string password
        string email
        string type
        string status
        string permissions
        string createdAt
        string updatedAt
        string lastLogin
    }
    
    %% فواتير المبيعات
    sales_invoices {
        string id
        string invoiceNumber
        string customerId
        string date
        string dueDate
        string status
        float subtotal
        float taxRate
        float taxAmount
        float shipping
        float discount
        float total
        float paid
        float remaining
        string paymentMethod
        string deliveryNoteId
        string deliveryNoteNumber
        string notes
        string createdAt
        string updatedAt
    }
    
    sales_invoice_items {
        string id
        string invoiceId
        string productId
        string productName
        string unit
        float quantity
        float price
        float total
    }
    
    %% أذون الصرف
    delivery_notes {
        string id
        string deliveryNoteNumber
        string date
        string salesRepId
        string salesRepName
        string warehouseKeeperName
        string status
        int totalProducts
        string notes
        string createdAt
        string updatedAt
    }
    
    delivery_note_items {
        string id
        string deliveryNoteId
        string productId
        string productName
        string productCode
        float quantity
        string unit
        string unitName
        float reservedQuantity
        float availableQuantity
    }
    
    %% التسويات
    delivery_settlements {
        string id
        string settlementNumber
        string deliveryNoteId
        string date
        string salesRepId
        string salesRepName
        string warehouseKeeperId
        string warehouseKeeperName
        string status
        string notes
        string createdAt
        string updatedAt
    }
    
    settlement_items {
        string id
        string settlementId
        string productId
        string productName
        string productCode
        float issuedQuantity
        float soldQuantity
        float returnedQuantity
        float rejectedQuantity
        float difference
        string unit
        string notes
    }
    
    %% فواتير المشتريات
    purchase_invoices {
        string id
        string invoiceNumber
        string supplierId
        string date
        string dueDate
        float subtotal
        float taxRate
        float taxAmount
        float shipping
        float discount
        float total
        float paid
        float remaining
        string paymentMethod
        string notes
        string createdAt
        string updatedAt
    }
    
    purchase_invoice_items {
        string id
        string invoiceId
        string productId
        string productName
        string unit
        float quantity
        float price
        float total
    }
    
    %% السندات
    receipts {
        string id
        string receiptNumber
        string customerId
        string date
        float amount
        string paymentMethod
        string notes
        string createdAt
        string updatedAt
    }
    
    payments {
        string id
        string paymentNumber
        string supplierId
        string type
        string toName
        string date
        float amount
        string paymentMethod
        string notes
        string createdAt
        string updatedAt
    }
    
    %% الجرد والمرتجعات
    inventory_adjustments {
        string id
        string adjustmentNumber
        string productId
        string date
        string type
        float quantity
        string reason
        string notes
        string userId
        string createdAt
    }
    
    returns {
        string id
        string returnNumber
        string productId
        string date
        string operationType
        string returnType
        string entityId
        string entityType
        string invoiceId
        string invoiceType
        string invoiceNumber
        float quantity
        float unitPrice
        float totalAmount
        string returnReason
        string isDamaged
        string restoredToStock
        string notes
        string userId
        string createdAt
        string updatedAt
    }
    
    %% الأصول والمصاريف
    fixed_assets {
        string id
        string code
        string name
        string category
        string purchaseDate
        float purchasePrice
        float currentValue
        float depreciationRate
        string location
        string department
        string status
        string description
        string supplierId
        string warrantyExpiryDate
        string notes
        string createdAt
        string updatedAt
    }
    
    operating_expenses {
        string id
        string date
        string category
        float amount
        string description
        string createdAt
        string updatedAt
    }
    
    %% معلومات الشركة والنسخ الاحتياطي
    company_info {
        string id
        string name
        string address
        string taxId
        string commercialRegister
        string phone
        string mobile
        string email
        float taxRate
        string commitmentText
        string createdAt
        string updatedAt
    }
    
    backup_history {
        string id
        string backupPath
        string backupType
        int fileSize
        string createdAt
    }
    
    %% العلاقات
    categories ||--o{ products : "has"
    products ||--o{ sales_invoice_items : "included_in"
    products ||--o{ purchase_invoice_items : "included_in"
    products ||--o{ delivery_note_items : "included_in"
    products ||--o{ settlement_items : "included_in"
    products ||--o{ inventory_adjustments : "adjusted_in"
    products ||--o{ returns : "returned_in"
    
    customers ||--o{ sales_invoices : "has"
    customers ||--o{ receipts : "receives"
    
    suppliers ||--o{ purchase_invoices : "has"
    suppliers ||--o{ payments : "receives"
    suppliers ||--o{ fixed_assets : "supplies"
    
    sales_invoices ||--o{ sales_invoice_items : "contains"
    sales_invoices ||--o{ returns : "can_have"
    
    purchase_invoices ||--o{ purchase_invoice_items : "contains"
    purchase_invoices ||--o{ returns : "can_have"
    
    delivery_notes ||--o{ delivery_note_items : "contains"
    delivery_notes ||--o{ delivery_settlements : "settled_in"
    delivery_notes ||--o{ sales_invoices : "linked_to"
    
    delivery_settlements ||--o{ settlement_items : "contains"
    
    inventory_adjustments }o--|| users : "performed_by"
    returns }o--|| users : "performed_by"
```

## ملخص الجداول والعلاقات

### الجداول الأساسية (5 جداول)
1. **categories** - الأصناف
2. **products** - المنتجات
3. **customers** - العملاء
4. **suppliers** - الموردين
5. **users** - المستخدمين

### جداول المبيعات (4 جداول)
6. **sales_invoices** - فواتير المبيعات
7. **sales_invoice_items** - عناصر فواتير المبيعات
8. **delivery_notes** - أذون الصرف
9. **delivery_note_items** - عناصر أذون الصرف

### جداول التسويات (2 جدول)
10. **delivery_settlements** - التسويات
11. **settlement_items** - عناصر التسويات

### جداول المشتريات (2 جدول)
12. **purchase_invoices** - فواتير المشتريات
13. **purchase_invoice_items** - عناصر فواتير المشتريات

### جداول السندات (2 جدول)
14. **receipts** - سندات القبض
15. **payments** - سندات الصرف

### جداول الجرد والمرتجعات (2 جدول)
16. **inventory_adjustments** - عمليات الجرد
17. **returns** - المرتجعات

### جداول الأصول والمصاريف (2 جدول)
18. **fixed_assets** - الأصول الثابتة
19. **operating_expenses** - المصاريف التشغيلية

### جداول النظام (2 جدول)
20. **company_info** - معلومات الشركة
21. **backup_history** - سجل النسخ الاحتياطي

---

**المجموع: 21 جدول**

## ملاحظات مهمة

### العلاقات الرئيسية:
- **products** هو الجدول المركزي الذي يرتبط بمعظم الجداول الأخرى
- **customers** يرتبط بـ **sales_invoices** و **receipts**
- **suppliers** يرتبط بـ **purchase_invoices** و **payments** و **fixed_assets**
- **delivery_notes** يرتبط بـ **sales_invoices** و **delivery_settlements**
- **users** يرتبط بـ **inventory_adjustments** و **returns**

### Foreign Keys:
- جميع العلاقات محمية بـ Foreign Key Constraints
- بعض الجداول تستخدم `ON DELETE CASCADE` لحذف العناصر المرتبطة تلقائياً
- جدول **returns** له علاقات متعددة مع **sales_invoices** و **purchase_invoices**

