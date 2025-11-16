// About Page - Print and PDF Save Functionality

document.addEventListener('DOMContentLoaded', () => {
    // Print Button
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            printAboutPage();
        });
    }

    // Save PDF Button
    const savePdfBtn = document.getElementById('savePdfBtn');
    if (savePdfBtn) {
        savePdfBtn.addEventListener('click', async () => {
            await saveAboutPageAsPDF();
        });
    }
});

// Print About Page
function printAboutPage() {
    // Generate print-friendly content
    const printContent = generatePrintContent();
    
    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة');
        return;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}

// Save About Page as PDF
async function saveAboutPageAsPDF() {
    try {
        // Check if Electron API is available
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            const printContent = generatePrintContent();
            const fileName = `عن_الشركة_${new Date().toISOString().split('T')[0]}.pdf`;
            
            const result = await window.electronAPI.saveInvoiceToFile(printContent, fileName);
            
            if (result.success) {
                showMessage('تم حفظ الملف بنجاح', 'success');
            } else if (result.cancelled) {
                // User cancelled, do nothing
            } else {
                showMessage('فشل حفظ الملف: ' + (result.error || 'خطأ غير معروف'), 'error');
            }
        } else {
            // Fallback: Use browser print with PDF option
            printAboutPage();
        }
    } catch (error) {
        console.error('Error saving PDF:', error);
        showMessage('خطأ في حفظ PDF: ' + error.message, 'error');
        // Fallback to print
        printAboutPage();
    }
}

// Generate Print-Friendly Content
function generatePrintContent() {
    const companyName = document.querySelector('.company-name')?.textContent || 'شركة أسيل للتوريدات الغذائية';
    const companyDescriptions = Array.from(document.querySelectorAll('.company-description'))
        .map(el => el.textContent.trim())
        .filter(text => text);
    
    const sections = Array.from(document.querySelectorAll('.about-section')).map(section => {
        const icon = section.querySelector('.section-icon')?.textContent || '';
        const title = section.querySelector('.section-title')?.textContent || '';
        const text = section.querySelector('.section-text')?.textContent || '';
        
        // Handle lists
        const activitiesList = section.querySelector('.activities-list');
        const clientsList = section.querySelector('.clients-list');
        const valuesGrid = section.querySelector('.values-grid');
        
        let content = '';
        if (activitiesList) {
            const items = Array.from(activitiesList.querySelectorAll('li'))
                .map(li => `<li>${li.textContent.trim()}</li>`)
                .join('');
            content = `<ul>${items}</ul>`;
        } else if (clientsList) {
            const items = Array.from(clientsList.querySelectorAll('li'))
                .map(li => `<li>${li.textContent.trim()}</li>`)
                .join('');
            content = `<ul>${items}</ul>`;
        } else if (valuesGrid) {
            const valueCards = Array.from(valuesGrid.querySelectorAll('.value-card'));
            const values = valueCards.map(card => {
                const title = card.querySelector('.value-title')?.textContent || '';
                const text = card.querySelector('.value-text')?.textContent || '';
                return `<div style="margin-bottom: 15px;"><strong>${title}:</strong> ${text}</div>`;
            }).join('');
            content = `<div>${values}</div>`;
        } else {
            content = text ? `<p>${text}</p>` : '';
        }
        
        return { icon, title, content };
    });
    
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>عن الشركة - شركة أسيل</title>
    <style>
        @page {
            margin: 2cm;
            size: A4;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            font-size: 14px;
            line-height: 1.8;
            color: #333;
            padding: 20px;
            background: #fff;
        }
        
        .print-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #8b4513;
        }
        
        .print-header h1 {
            font-size: 28px;
            color: #8b4513;
            margin-bottom: 10px;
        }
        
        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #8b4513;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .company-description {
            margin-bottom: 15px;
            text-align: justify;
            font-size: 14px;
            line-height: 1.8;
        }
        
        .section {
            margin-bottom: 25px;
            page-break-inside: avoid;
        }
        
        .section-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .section-icon {
            font-size: 24px;
        }
        
        .section-title {
            font-size: 20px;
            font-weight: bold;
            color: #8b4513;
        }
        
        .section-content {
            margin-top: 10px;
            padding-right: 10px;
        }
        
        .section-content p {
            margin-bottom: 10px;
            text-align: justify;
        }
        
        .section-content ul {
            margin-right: 20px;
            margin-top: 10px;
        }
        
        .section-content li {
            margin-bottom: 8px;
            list-style: none;
            position: relative;
            padding-right: 20px;
        }
        
        .section-content li::before {
            content: "✓";
            position: absolute;
            right: 0;
            color: #10b981;
            font-weight: bold;
        }
        
        .values-list {
            margin-top: 15px;
        }
        
        .value-item {
            margin-bottom: 15px;
            padding: 10px;
            background: #f8fafc;
            border-right: 3px solid #8b4513;
        }
        
        .value-item strong {
            color: #8b4513;
            display: block;
            margin-bottom: 5px;
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            .section {
                page-break-inside: avoid;
            }
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="print-header">
        <h1>🧊 عن الشركة</h1>
    </div>
    
    <div class="company-name">${companyName}</div>
    
    ${companyDescriptions.map(desc => `<div class="company-description">${desc}</div>`).join('')}
    
    ${sections.map(section => `
        <div class="section">
            <div class="section-header">
                <span class="section-icon">${section.icon}</span>
                <h2 class="section-title">${section.title}</h2>
            </div>
            <div class="section-content">
                ${section.content}
            </div>
        </div>
    `).join('')}
    
    <div class="footer">
        <p>© 2025 نظام أسيل — تم التطوير بواسطة المهندس محمد محسن. جميع الحقوق محفوظة.</p>
        <p>تم الطباعة في: ${new Date().toLocaleDateString('ar-EG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</p>
    </div>
</body>
</html>`;
}

// Show Message (simple implementation)
function showMessage(message, type = 'info') {
    // Try to use existing message system if available
    if (typeof showToast === 'function') {
        showToast(message, type);
    } else if (typeof showMessage === 'function' && showMessage !== window.showMessage) {
        showMessage(message, type);
    } else {
        // Fallback: simple alert
        alert(message);
    }
}

