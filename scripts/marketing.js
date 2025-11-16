// Marketing Page Script - Load Contact Info from Database

let marketingContactInfo = {
    whatsApp: '01XXXXXXXXX',
    mobile: '01XXXXXXXXX',
    workingHours: 'السبت - الخميس | 9 صباحًا - 11 مساءً'
};

// Load Marketing Contact Info from Database
async function loadMarketingContactInfo() {
    try {
        if (window.electronAPI && window.electronAPI.dbGet) {
            // Ensure columns exist in database (for existing databases)
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN marketingWhatsApp TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN marketingMobile TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN marketingWorkingHours TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }

            const companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
            
            if (companyInfo) {
                marketingContactInfo = {
                    whatsApp: companyInfo.marketingWhatsApp || '01XXXXXXXXX',
                    mobile: companyInfo.marketingMobile || '01XXXXXXXXX',
                    workingHours: companyInfo.marketingWorkingHours || 'السبت - الخميس | 9 صباحًا - 11 مساءً'
                };
            }
        } else {
            // Fallback to localStorage if electronAPI not available
            const stored = localStorage.getItem('asel_marketing_contact');
            if (stored) {
                marketingContactInfo = JSON.parse(stored);
            }
        }
    } catch (error) {
        console.error('[Marketing] Error loading contact info:', error);
    }
    
    // Update the page with loaded data
    updateMarketingContactInfo();
}

// Update Marketing Contact Info on Page
function updateMarketingContactInfo() {
    // Update WhatsApp
    const whatsAppElement = document.querySelector('.contact-item:nth-child(1) .contact-details p');
    if (whatsAppElement) {
        whatsAppElement.textContent = marketingContactInfo.whatsApp;
    }

    // Update Mobile
    const mobileElement = document.querySelector('.contact-item:nth-child(2) .contact-details p');
    if (mobileElement) {
        mobileElement.textContent = marketingContactInfo.mobile;
    }

    // Update Working Hours
    const workingHoursElement = document.querySelector('.contact-item:nth-child(3) .contact-details p');
    if (workingHoursElement) {
        workingHoursElement.textContent = marketingContactInfo.workingHours;
    }
}

// Print Marketing Content
function printMarketingContent() {
    window.print();
}

// Export Marketing Content to PDF
async function exportMarketingToPDF() {
    try {
        // Get the marketing content sub-tab
        const marketingContentTab = document.getElementById('marketing-content-subtab');
        if (!marketingContentTab) {
            if (window.showToast) {
                window.showToast('لم يتم العثور على المحتوى التسويقي', 'error');
            }
            return;
        }

        // Clone the content for PDF
        const printContent = marketingContentTab.cloneNode(true);
        
        // Remove action buttons from print version
        const actions = printContent.querySelector('.marketing-actions');
        if (actions) actions.remove();
        
        // Get logo SVG content and convert to base64
        let logoBase64 = '';
        try {
            const logoResponse = await fetch('assets/aseel_logo.svg');
            if (logoResponse.ok) {
                const logoSvg = await logoResponse.text();
                logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
            }
        } catch (e) {
            console.warn('Could not load logo:', e);
        }
        
        // Generate HTML content for PDF
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>العرض التسويقي - أسيل للتوريدات الغذائية</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                        padding: 20px;
                        direction: rtl;
                        background: white;
                        color: #333;
                    }
                    .marketing-hero {
                        background: linear-gradient(135deg, #8B4513 0%, #654321 100%);
                        border-radius: 12px;
                        padding: 40px;
                        margin-bottom: 30px;
                        text-align: center;
                        color: white;
                    }
                    .hero-title {
                        font-size: 2.5rem;
                        margin-bottom: 15px;
                    }
                    .hero-subtitle {
                        font-size: 1.3rem;
                        margin-bottom: 20px;
                    }
                    .section-title {
                        font-size: 1.8rem;
                        color: #8B4513;
                        margin-bottom: 20px;
                        text-align: center;
                    }
                    .features-grid, .products-grid, .benefits-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .feature-card, .product-category, .benefit-item {
                        background: #f9f9f9;
                        padding: 20px;
                        border-radius: 8px;
                        border: 1px solid #ddd;
                    }
                    .contact-section {
                        background: #f5f5f5;
                        padding: 30px;
                        border-radius: 12px;
                        margin-top: 30px;
                    }
                    .company-logo {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .company-logo img {
                        max-width: 300px;
                        height: auto;
                    }
                    .statistics-section {
                        margin: 40px 0;
                        padding: 30px;
                        background: #f9f9f9;
                        border-radius: 12px;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                        margin-top: 20px;
                    }
                    .stat-card {
                        background: linear-gradient(135deg, #8B4513 0%, #654321 100%);
                        border-radius: 12px;
                        padding: 20px;
                        text-align: center;
                        color: white;
                    }
                    .stat-number {
                        font-size: 2.5rem;
                        font-weight: 700;
                        margin-bottom: 10px;
                    }
                    .stat-icon {
                        font-size: 2.5rem;
                        font-weight: 700;
                        margin-bottom: 10px;
                        font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
                        line-height: 1;
                    }
                    .stat-label {
                        font-size: 1rem;
                        font-weight: 500;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    th, td {
                        padding: 10px;
                        text-align: right;
                        border: 1px solid #ddd;
                    }
                    th {
                        background: #8B4513;
                        color: white;
                    }
                </style>
            </head>
            <body>
                ${logoBase64 ? `<div class="company-logo"><img src="${logoBase64}" alt="أسيل للتوريدات الغذائية" style="max-width: 300px; height: auto;" /></div>` : ''}
                ${printContent.innerHTML}
            </body>
            </html>
        `;
        
        // Generate filename with current date
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
        const filename = `العرض_التسويقي_${dateStr}.pdf`;
        
        // Check if Electron API is available
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            const result = await window.electronAPI.saveInvoiceToFile(htmlContent, filename);
            
            if (result.success) {
                if (window.showToast) {
                    window.showToast('تم حفظ الملف بنجاح', 'success');
                }
            } else if (result.cancelled) {
                // User cancelled, do nothing
            } else {
                if (window.showToast) {
                    window.showToast('فشل حفظ الملف: ' + (result.error || 'خطأ غير معروف'), 'error');
                }
            }
        } else {
            // Fallback: Use browser print with PDF option
            if (window.showToast) {
                window.showToast('وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"', 'warning');
            }
            printMarketingContent();
        }
    } catch (error) {
        console.error('Error exporting marketing to PDF:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء تصدير PDF: ' + error.message, 'error');
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadMarketingContactInfo();
    
    // Add event listeners for print and PDF buttons
    const printBtn = document.getElementById('printMarketingBtn');
    const exportBtn = document.getElementById('exportMarketingPdfBtn');
    
    if (printBtn) {
        printBtn.addEventListener('click', printMarketingContent);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportMarketingToPDF);
    }
});

