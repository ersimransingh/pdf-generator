const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { renderTemplate } = require('../utils/templateEngine');
const logger = require('../utils/logger');

function wrapFooterWithSkipLogic(footerHtml, skipPages) {
  const skipList = skipPages.split(',').map(s => s.trim()).filter(Boolean);
  if (skipList.length === 0) return footerHtml;

  const normalized = skipList.map(s => {
    const lower = s.toLowerCase();
    if (lower === 'first') return 1;
    if (lower === 'last') return 'last';
    const n = parseInt(s, 10);
    return isNaN(n) ? null : n;
  }).filter(v => v !== null);

  if (normalized.length === 0) return footerHtml;

  const script = `<script>
(function() {
  var skipPages = ${JSON.stringify(normalized)};
  var pnEl = document.querySelector('.pageNumber');
  if (!pnEl) return;
  var pn = parseInt(pnEl.textContent.trim(), 10);
  var totalEl = document.querySelector('.totalPages');
  var total = totalEl ? parseInt(totalEl.textContent.trim(), 10) : 0;
  var shouldHide = false;
  for (var i = 0; i < skipPages.length; i++) {
    if (skipPages[i] === 'last') {
      if (pn === total && total > 0) { shouldHide = true; break; }
    } else if (skipPages[i] === pn) {
      shouldHide = true; break;
    }
  }
  if (shouldHide) {
    var container = document.getElementById('pdf-footer-wrap');
    if (container) container.style.display = 'none';
    document.body.style.height = '0px';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
  }
})();
</script>`;

  return `<div id="pdf-footer-wrap" style="width: 100%;">${footerHtml}</div>${script}`;
}

function normalizeHeaderFooterTemplate(content, type) {
  const normalizedContent = String(content)
    .replace(/<p(\s|>)/gi, '<div$1')
    .replace(/<\/p>/gi, '</div>');
  const paddingStyle = type === 'header' ? 'padding: 0 10px 6px 10px;' : 'padding: 6px 10px 0 10px;';
  return `
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        font-family: Arial, sans-serif;
        -webkit-print-color-adjust: exact;
      }
      .pdf-${type}-inner, .pdf-${type}-inner * {
        box-sizing: border-box;
      }
      .pdf-${type}-inner {
        font-family: Arial, sans-serif;
        font-size: 9px;
        line-height: 1.4;
        color: #000;
        width: 100%;
      }
      .pdf-${type}-inner p {
        margin: 0;
      }
    </style>
    <div class="pdf-${type}-inner" style="width: 100%; ${paddingStyle}">
      ${normalizedContent}
    </div>
  `;
}

function ensureMinimumMargin(value, minimumPx) {
  if (!value) return `${minimumPx}px`;
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)px$/i);
  if (!match) return value;
  const current = parseFloat(match[1]);
  return `${Math.max(current, minimumPx)}px`;
}

class PdfService {
  constructor() {
    this.browser = null;
    this.initPromise = null;
  }

  async init() {
    if (this.browser) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--font-render-hinting=none'
      ]
    }).then(browser => {
      this.browser = browser;
      logger.info('Puppeteer browser initialized');
    }).catch(err => {
      logger.error('Failed to initialize Puppeteer', { error: err.message });
      throw err;
    });

    return this.initPromise;
  }

  async generatePdf(template, data, options = {}) {
    await this.init();

    const {
      pageSize = 'A4',
      orientation = 'portrait',
      margin = { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    } = options;

    // Build watermark config
    const watermark = {
      enabled: template.watermark_enabled === 1,
      text: template.watermark_text || '',
      options: template.watermark_options ? JSON.parse(template.watermark_options) : {}
    };

    const html = renderTemplate(template.html_content, template.css_content, data, watermark);

    const page = await this.browser.newPage();
    try {
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });

      // Wait for fonts to load
      await page.evaluate(() => document.fonts.ready);

      const pdfOptions = {
        format: pageSize,
        landscape: orientation === 'landscape',
        margin: {
          top: margin.top || '20px',
          right: margin.right || '20px',
          bottom: margin.bottom || '20px',
          left: margin.left || '20px'
        },
        printBackground: true,
        preferCSSPageSize: true
      };

      // Add header/footer if present
      const hasHeader = template.header_html && template.header_html.trim().length > 0;
      const hasFooter = template.footer_html && template.footer_html.trim().length > 0;
      const footerSkipPages = template.footer_skip_pages ? template.footer_skip_pages.trim() : '';

      if (hasHeader || hasFooter) {
        pdfOptions.displayHeaderFooter = true;

        if (hasHeader) {
          pdfOptions.margin.top = ensureMinimumMargin(pdfOptions.margin.top, 50);
          pdfOptions.headerTemplate = normalizeHeaderFooterTemplate(template.header_html, 'header');
        } else {
          // No header content: use empty template and free up top margin space
          pdfOptions.headerTemplate = '<div></div>';
          pdfOptions.margin.top = '0px';
        }

        if (hasFooter) {
          pdfOptions.margin.bottom = ensureMinimumMargin(pdfOptions.margin.bottom, 50);
          let footerTemplate = template.footer_html;
          if (footerSkipPages) {
            footerTemplate = wrapFooterWithSkipLogic(footerTemplate, footerSkipPages);
          }
          pdfOptions.footerTemplate = normalizeHeaderFooterTemplate(footerTemplate, 'footer');
        } else {
          // No footer content: use empty template and free up bottom margin space
          pdfOptions.footerTemplate = '<div></div>';
          pdfOptions.margin.bottom = '0px';
        }
      }

      const pdfBuffer = await page.pdf(pdfOptions);
      return pdfBuffer;
    } finally {
      await page.close();
    }
  }

  async generatePdfToFile(template, data, options = {}) {
    const pdfBuffer = await this.generatePdf(template, data, options);
    const filename = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.pdf`;
    const filePath = path.join(__dirname, '../../uploads', filename);
    fs.writeFileSync(filePath, pdfBuffer);
    return { filename, filePath };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.initPromise = null;
      logger.info('Puppeteer browser closed');
    }
  }
}

const pdfService = new PdfService();

module.exports = pdfService;
