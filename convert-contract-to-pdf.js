const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function convertContractToPDF() {
    try {
        console.log('🔄 جاري تحويل العقد إلى PDF...');
        
        // Read the HTML file
        const htmlFile = path.join(__dirname, 'عقد_تسليم_النظام_للعميل.html');
        if (!fs.existsSync(htmlFile)) {
            console.error('❌ الملف غير موجود:', htmlFile);
            process.exit(1);
        }
        
        const htmlContent = fs.readFileSync(htmlFile, 'utf8');
        
        console.log('✅ تم قراءة ملف HTML');
        
        // Launch browser and create PDF
        console.log('🌐 جاري إنشاء PDF...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfFile = path.join(__dirname, 'عقد_تسليم_النظام_للعميل.pdf');
        await page.pdf({
            path: pdfFile,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });
        
        await browser.close();
        
        console.log('✅ تم إنشاء ملف PDF بنجاح: عقد_تسليم_النظام_للعميل.pdf');
        console.log('📄 الملف جاهز للاستخدام!');
        
    } catch (error) {
        console.error('❌ خطأ في التحويل:', error.message);
        console.log('\n💡 يمكنك فتح ملف HTML في المتصفح وطباعته كـ PDF يدوياً');
        console.log('   أو تأكد من تثبيت puppeteer: npm install puppeteer');
        process.exit(1);
    }
}

// Run the conversion
convertContractToPDF();

