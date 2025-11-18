# دليل الاختبارات - نظام إدارة شركة أسيل

## نظرة عامة

هذا المجلد يحتوي على جميع اختبارات النظام. الاختبارات مقسمة إلى:
- **Unit Tests**: اختبارات الوحدات الفردية
- **Integration Tests**: اختبارات التكامل بين المكونات
- **E2E Tests**: اختبارات من البداية للنهاية

## البنية التحتية

### الملفات الأساسية:
- `setup.js` - إعداد البيئة قبل الاختبارات
- `jest.config.js` - إعدادات Jest
- `helpers/test-helpers.js` - دوال مساعدة للاختبارات
- `fixtures/sample-data.js` - بيانات تجريبية

## تشغيل الاختبارات

### تثبيت الاعتماديات:
```bash
npm install
```

### تشغيل جميع الاختبارات:
```bash
npm test
```

### تشغيل Unit Tests فقط:
```bash
npm run test:unit
```

### تشغيل Integration Tests فقط:
```bash
npm run test:integration
```

### تشغيل الاختبارات في وضع Watch:
```bash
npm run test:watch
```

### تشغيل الاختبارات مع تقرير التغطية:
```bash
npm run test:coverage
```

## هيكل الاختبارات

```
tests/
├── unit/                    # اختبارات الوحدات
│   ├── utils/              # دوال التنسيق والتحويل
│   ├── calculations/       # دوال الحسابات
│   └── database/          # دوال قاعدة البيانات
├── integration/            # اختبارات التكامل
│   ├── purchase-flow.test.js
│   └── sales-flow.test.js
├── e2e/                    # اختبارات E2E
├── fixtures/              # بيانات تجريبية
│   └── sample-data.js
└── helpers/               # دوال مساعدة
    └── test-helpers.js
```

## الاختبارات المتوفرة حالياً

### Unit Tests:
- ✅ `formatArabicNumber.test.js` - تنسيق الأرقام العربية
- ✅ `formatCurrency.test.js` - تنسيق العملة
- ✅ `generateInvoiceNumber.test.js` - توليد أرقام الفواتير
- ✅ `calculateTotals.test.js` - حساب الإجماليات

### Integration Tests:
- ✅ `purchase-flow.test.js` - تدفق فاتورة المشتريات

## كتابة اختبارات جديدة

### مثال على Unit Test:
```javascript
describe('functionName', () => {
  test('should do something', () => {
    const result = functionName(input);
    expect(result).toBe(expected);
  });
});
```

### مثال على Integration Test:
```javascript
describe('Feature Flow', () => {
  test('should complete full flow', async () => {
    // Arrange
    const data = createTestData();
    
    // Act
    const result = await performAction(data);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

## أفضل الممارسات

1. **استخدم أسماء واضحة**: اكتب أسماء اختبارات واضحة ومفهومة
2. **Arrange-Act-Assert**: نظم الاختبارات بهذا النمط
3. **استخدم Fixtures**: استخدم البيانات التجريبية من `fixtures/`
4. **استخدم Helpers**: استخدم الدوال المساعدة من `helpers/`
5. **نظف البيانات**: تأكد من تنظيف البيانات بعد كل اختبار

## التغطية المستهدفة

- **الحد الأدنى**: 70%
- **الهدف المثالي**: 80%+
- **الدوال الحرجة**: 100%

## المساهمة

عند إضافة اختبارات جديدة:
1. تأكد من أن جميع الاختبارات تمر
2. تحقق من التغطية
3. اكتب اختبارات واضحة ومفهومة
4. استخدم البيانات التجريبية من `fixtures/`

