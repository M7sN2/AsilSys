const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

// Configure markdown-it with Arabic support
const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true
});

async function convertMarkdownToPDF() {
    try {
        console.log('🔄 جاري تحويل الملف إلى PDF...');
        
        // Read the markdown file
        const markdownFile = path.join(__dirname, 'إيصال_استلام_النظام.md');
        if (!fs.existsSync(markdownFile)) {
            console.error('❌ الملف غير موجود:', markdownFile);
            process.exit(1);
        }
        
        const markdown = fs.readFileSync(markdownFile, 'utf8');
        
        // Convert markdown to HTML
        const htmlContent = md.render(markdown);
        
        // Create full HTML document with styling
        const fullHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إيصال استلام نظام إدارة المخزون والمحاسبة - شركة أسيل</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'IBM Plex Sans Arabic', Arial, sans-serif;
            line-height: 1.8;
            color: #1f2937;
            background: #ffffff;
            padding: 40px 50px;
            max-width: 900px;
            margin: 0 auto;
        }
        
        h1 {
            color: #2563eb;
            font-size: 2.2em;
            margin: 30px 0 20px;
            border-bottom: 4px solid #2563eb;
            padding-bottom: 15px;
            font-weight: 700;
            text-align: center;
        }
        
        h2 {
            color: #1e40af;
            font-size: 1.8em;
            margin: 30px 0 15px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
            font-weight: 600;
            page-break-after: avoid;
        }
        
        h3 {
            color: #3b82f6;
            font-size: 1.4em;
            margin: 20px 0 10px;
            font-weight: 600;
            page-break-after: avoid;
        }
        
        p {
            margin: 12px 0;
            text-align: justify;
            font-size: 1.05em;
        }
        
        ul, ol {
            margin: 12px 0 12px 30px;
            padding-right: 20px;
        }
        
        li {
            margin: 8px 0;
            line-height: 1.8;
            font-size: 1.05em;
        }
        
        code {
            background: #f3f4f6;
            padding: 3px 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.95em;
            color: #dc2626;
            border: 1px solid #e5e7eb;
        }
        
        strong {
            color: #1e40af;
            font-weight: 600;
        }
        
        hr {
            border: none;
            border-top: 2px solid #e5e7eb;
            margin: 30px 0;
        }
        
        blockquote {
            border-right: 4px solid #2563eb;
            padding-right: 20px;
            margin: 20px 0;
            color: #4b5563;
            font-style: italic;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 1em;
        }
        
        th, td {
            border: 1px solid #e5e7eb;
            padding: 12px;
            text-align: right;
        }
        
        th {
            background: #2563eb;
            color: white;
            font-weight: 600;
        }
        
        td {
            background: #ffffff;
        }
        
        tr:nth-child(even) td {
            background: #f9fafb;
        }
        
        @media print {
            body {
                padding: 20px;
            }
            
            h1 {
                page-break-after: avoid;
            }
            
            h2 {
                page-break-after: avoid;
            }
            
            h3 {
                page-break-after: avoid;
            }
            
            table {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;
        
        // Save HTML file (optional)
        const htmlFile = path.join(__dirname, 'إيصال_استلام_النظام.html');
        fs.writeFileSync(htmlFile, fullHTML, 'utf8');
        console.log('✅ تم إنشاء ملف HTML: إيصال_استلام_النظام.html');
        
        // Launch browser and create PDF
        console.log('🌐 جاري إنشاء PDF...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(fullHTML, { waitUntil: 'networkidle0' });
        
        const pdfFile = path.join(__dirname, 'إيصال_استلام_النظام.pdf');
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
        
        console.log('✅ تم إنشاء ملف PDF بنجاح: إيصال_استلام_النظام.pdf');
        console.log('📄 الملف جاهز للاستخدام!');
        
    } catch (error) {
        console.error('❌ خطأ في التحويل:', error.message);
        console.log('\n💡 يمكنك فتح ملف HTML في المتصفح وطباعته كـ PDF يدوياً');
        process.exit(1);
    }
}

// Run the conversion
convertMarkdownToPDF();

