const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { renderTemplate } = require('../utils/templateEngine');
const logger = require('../utils/logger');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

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
        overflow: hidden;
      }
      .pdf-${type}-inner::after {
        content: '';
        display: table;
        clear: both;
      }
      .pdf-${type}-inner p {
        margin: 0;
      }
      .se-image-container, .se-component {
        max-width: 100%;
        height: auto;
      }
      .__se__float-right {
        float: right !important;
        clear: none !important;
        display: block;
        width: auto;
        margin-left: 10px !important;
        margin-right: 0 !important;
        margin-bottom: 4px;
      }
      .__se__float-left {
        float: left !important;
        clear: none !important;
        display: block;
        width: auto;
        margin-right: 10px !important;
        margin-left: 0 !important;
        margin-bottom: 4px;
      }
      .__se__float-center, .__se__float-none {
        float: none !important;
        clear: both !important;
        display: block !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
    </style>
    <div class="pdf-${type}-inner" style="width: 100%; ${paddingStyle}">
      ${normalizedContent}
    </div>
  `;
}

// PDF page widths in CSS pixels (96 dpi) per format and orientation.
// Used to size the measurement viewport so image scaling matches the real PDF.
const PDF_PAGE_WIDTHS = {
  A4:     { portrait: 794,  landscape: 1123 },
  Letter: { portrait: 816,  landscape: 1056 },
  Legal:  { portrait: 816,  landscape: 1056 },
  A3:     { portrait: 1123, landscape: 1587 }
};

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

  // Render a header/footer template in a temporary page and return its actual height in px.
  // pageSize / orientation are used to set the viewport width to match the real PDF page so
  // images (especially base64 ones) scale to the same dimensions as in the final output.
  async measureTemplateHeight(html, type, pageSize = 'A4', orientation = 'portrait') {
    const rendered = normalizeHeaderFooterTemplate(html, type);
    const widthPx = (PDF_PAGE_WIDTHS[pageSize] || PDF_PAGE_WIDTHS.A4)[orientation] || 794;
    const page = await this.browser.newPage();
    try {
      await page.setViewport({ width: widthPx, height: 1200 });
      await page.setContent(rendered, { waitUntil: ['networkidle0', 'domcontentloaded'], timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      // Wait for every image to finish decoding before measuring — base64 images decode
      // asynchronously and layout height is wrong if measured before decode completes.
      await page.evaluate(() => Promise.all(
        Array.from(document.images).map(img =>
          img.complete
            ? Promise.resolve()
            : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })
        )
      ));
      const height = await page.evaluate(() => {
        const el = document.body.firstElementChild;
        if (!el) return 60;
        return Math.max(el.scrollHeight, el.getBoundingClientRect().height);
      });
      return Math.ceil(height);
    } catch (e) {
      return 60; // safe fallback
    } finally {
      await page.close();
    }
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
      type: template.watermark_type || 'text',
      text: template.watermark_text || '',
      image: template.watermark_image || '',
      options: template.watermark_options ? JSON.parse(template.watermark_options) : {}
    };

    const html = renderTemplate(template.html_content, template.css_content, data, watermark);

    const hasHeader = template.header_html && template.header_html.trim().length > 0;
    const hasFooter = template.footer_html && template.footer_html.trim().length > 0;
    const footerSkipPages = template.footer_skip_pages ? template.footer_skip_pages.trim() : '';

    // Measure actual header / footer heights so margins are always exact.
    // We do this before opening the main page to avoid holding two pages at once.
    let headerHeightPx = 0;
    let footerHeightPx = 0;

    if (hasHeader) {
      headerHeightPx = await this.measureTemplateHeight(template.header_html, 'header', pageSize, orientation);
    }
    if (hasFooter) {
      footerHeightPx = await this.measureTemplateHeight(template.footer_html, 'footer', pageSize, orientation);
    }

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

      if (hasHeader || hasFooter) {
        pdfOptions.displayHeaderFooter = true;

        if (hasHeader) {
          // Use the measured height + 16 px breathing room as the top margin.
          // The extra buffer absorbs sub-pixel differences between the measurement
          // viewport and Puppeteer's internal PDF renderer, which is especially
          // noticeable when the header contains images.
          const needed = headerHeightPx + 16;
          pdfOptions.margin.top = ensureMinimumMargin(pdfOptions.margin.top, needed);
          pdfOptions.headerTemplate = normalizeHeaderFooterTemplate(template.header_html, 'header');
        } else {
          pdfOptions.headerTemplate = '<div></div>';
          pdfOptions.margin.top = '0px';
        }

        if (hasFooter) {
          const needed = footerHeightPx + 16;
          pdfOptions.margin.bottom = ensureMinimumMargin(pdfOptions.margin.bottom, needed);
          let footerTemplate = template.footer_html;
          if (footerSkipPages) {
            footerTemplate = wrapFooterWithSkipLogic(footerTemplate, footerSkipPages);
          }
          pdfOptions.footerTemplate = normalizeHeaderFooterTemplate(footerTemplate, 'footer');
        } else {
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
    ensureDirectoryExists(UPLOADS_DIR);
    const filePath = path.join(UPLOADS_DIR, filename);
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
