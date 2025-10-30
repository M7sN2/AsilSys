const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function convertUpdatedCatalogToPDF() {
    try {
        console.log('🔄 جاري تحويل الكتالوج المحدث إلى PDF...');
        
        // Read the HTML file
        const htmlFile = path.join(__dirname, 'كتالوج_استخدام_النظام_محدث.html');
        const htmlContent = fs.readFileSync(htmlFile, 'utf8');
        
        console.log('✅ تم قراءة ملف HTML بنجاح');
        
        // Launch browser and create PDF
        console.log('🌐 جاري إنشاء PDF...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set content with wait for fonts and images
        await page.setContent(htmlContent, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });
        
        // Wait a bit for any dynamic content
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate PDF
        const pdfPath = path.join(__dirname, 'كتالوج_استخدام_النظام_محدث.pdf');
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '2cm',
                right: '2cm',
                bottom: '2cm',
                left: '2cm'
            }
        });
        
        await browser.close();
        
        console.log('✅ تم إنشاء PDF بنجاح: ' + pdfPath);
        console.log('📄 حجم الملف: ' + (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2) + ' MB');
    } catch (error) {
        console.error('❌ خطأ في تحويل الكتالوج:', error);
        process.exit(1);
    }
}

convertUpdatedCatalogToPDF();

