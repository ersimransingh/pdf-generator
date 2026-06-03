function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function isTruthy(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function resolveVariable(key, data, loopContext) {
  // Handle @index special variable
  if (key === '@index') {
    return loopContext && loopContext.index !== undefined ? String(loopContext.index) : '';
  }

  // Try loop context first for bare variable names
  if (loopContext && loopContext.item !== undefined) {
    // If key has no dot, try loop item first
    if (!key.includes('.')) {
      if (loopContext.item && typeof loopContext.item === 'object' && loopContext.item[key] !== undefined) {
        return loopContext.item[key];
      }
      if (loopContext.item !== undefined && !(typeof loopContext.item === 'object' && loopContext.item !== null)) {
        // Primitive array item
        return loopContext.item;
      }
    }
  }

  // Fall back to global data path
  return getValueByPath(data, key);
}

function parseTableBlock(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return null;
  const headers = lines[0].split('|').map(h => h.trim());
  const rowTemplate = lines.slice(1).join('\n');
  const cells = rowTemplate.split('|').map(c => c.trim());
  return { headers, cells };
}

function processTemplate(html, data, loopContext) {
  let rendered = html;

  // Handle {{#table array}}...{{/table}} helper
  const tableRegex = /\{\{#table\s+([\w.]+)\}\}([\s\S]*?)\{\{\/table\}\}/g;
  rendered = rendered.replace(tableRegex, (match, key, content) => {
    const array = resolveVariable(key, data, loopContext);
    if (!Array.isArray(array) || array.length === 0) return '';

    const parsed = parseTableBlock(content);
    if (!parsed) return '';

    const { headers, cells } = parsed;

    let tableHtml = '<table class="template-table"><thead><tr>';
    headers.forEach(h => {
      tableHtml += `<th>${processTemplate(h, data, loopContext)}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    array.forEach((item, index) => {
      tableHtml += '<tr>';
      cells.forEach(cell => {
        const cellContent = processTemplate(cell, data, { item, index });
        tableHtml += `<td>${cellContent}</td>`;
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    return tableHtml;
  });

  // Handle {{#each array}}...{{/each}} loops
  const eachRegex = /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  rendered = rendered.replace(eachRegex, (match, key, content) => {
    const array = resolveVariable(key, data, loopContext);
    if (!Array.isArray(array) || array.length === 0) return '';
    return array.map((item, index) => {
      return processTemplate(content, data, { item, index });
    }).join('');
  });

  // Handle {{#if variable}}...{{/if}} conditionals
  const ifRegex = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  rendered = rendered.replace(ifRegex, (match, key, content) => {
    const value = resolveVariable(key, data, loopContext);
    return isTruthy(value) ? processTemplate(content, data, loopContext) : '';
  });

  // Handle {{arrayPath[].field}} — repeats the containing <tr> once per array item
  rendered = rendered.replace(/(<tr(?:\s[^>]*)?>)([\s\S]*?)(<\/tr>)/gi, (fullMatch, open, body, close) => {
    const m = body.match(/\{\{\s*([\w.]+)\[\]\.([\w.]+)\s*\}\}/);
    if (!m) return fullMatch;
    const arrayPath = m[1];
    const arr = resolveVariable(arrayPath, data, loopContext);
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.map((item) => {
      const row = body.replace(/\{\{\s*([\w.]+)\[\]\.([\w.]+)\s*\}\}/g, (_, path, field) => {
        if (path !== arrayPath) return _;
        const val = getValueByPath(item, field);
        return val !== undefined && val !== null ? String(val) : '';
      });
      return open + row + close;
    }).join('');
  });

  // Handle {{variable}} with optional escape filter: {{variable|escape}}
  const varRegex = /\{\{\s*([\w.@]+)(?:\|(\w+))?\s*\}\}/g;
  rendered = rendered.replace(varRegex, (match, key, filter) => {
    const value = resolveVariable(key, data, loopContext);
    if (filter === 'escape') {
      return escapeHtml(value);
    }
    return value !== undefined && value !== null ? String(value) : '';
  });

  return rendered;
}

function fixTableColumnWidths(html) {
  return html.replace(/(<table(?:\s[^>]*)?>)([\s\S]*?)(<\/table>)/gi, (full, open, body, close) => {
    // If user already set table-layout explicitly, respect it
    if (/table-layout/i.test(open)) return full;

    // Detect explicit width on <col>, <td>, or <th> (style or attribute)
    const hasColWidth  = /<col\b[^>]*(?:style\s*=\s*["'][^"']*\bwidth\s*:|[\s]width\s*=)/i.test(body);
    const hasCellWidth = /<(?:td|th)\b[^>]*(?:style\s*=\s*["'][^"']*\bwidth\s*:\s*\d+%|[\s]width\s*=\s*["']\d)/i.test(body);
    if (!hasColWidth && !hasCellWidth) return full;

    // Add table-layout:fixed + width:100% so Puppeteer honours the declared column widths
    if (/style\s*=/i.test(open)) {
      return open.replace(/style\s*=\s*"([^"]*)"/i, 'style="$1; table-layout: fixed; width: 100%;"') + body + close;
    }
    return open.replace(/^<table\b/i, '<table style="table-layout: fixed; width: 100%;"') + body + close;
  });
}

function renderTemplate(html, css, data = {}, watermark = null) {
  let rendered = processTemplate(html, data, null);
  rendered = fixTableColumnWidths(rendered);

  // Inject watermark if enabled
  if (watermark && watermark.enabled) {
    const options = watermark.options || {};
    const opacity = options.opacity !== undefined ? options.opacity : 0.08;

    if (watermark.type === 'image' && watermark.image) {
      // Image watermark
      const watermarkHtml = `<img class="pdf-watermark" src="${watermark.image}" alt="watermark">`;
      const watermarkCss = `
        <style>
          .pdf-watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            opacity: ${opacity};
            pointer-events: none;
            z-index: 9999;
            max-width: 80%;
            max-height: 80%;
          }
        </style>
      `;

      if (rendered.includes('</body>')) {
        rendered = rendered.replace('</body>', `${watermarkCss}${watermarkHtml}</body>`);
      } else {
        rendered = rendered + watermarkCss + watermarkHtml;
      }
    } else if (watermark.text) {
      // Text watermark
      const color = options.color || '#000000';
      const fontSize = options.fontSize || '100px';
      const angle = options.angle !== undefined ? options.angle : -45;

      const watermarkHtml = `<div class="pdf-watermark">${escapeHtml(watermark.text)}</div>`;
      const watermarkCss = `
        <style>
          .pdf-watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(${angle}deg);
            font-size: ${fontSize};
            color: ${color};
            opacity: ${opacity};
            pointer-events: none;
            z-index: 9999;
            white-space: nowrap;
            font-weight: bold;
            letter-spacing: 4px;
          }
        </style>
      `;

      if (rendered.includes('</body>')) {
        rendered = rendered.replace('</body>', `${watermarkCss}${watermarkHtml}</body>`);
      } else {
        rendered = rendered + watermarkCss + watermarkHtml;
      }
    }
  }

  // SunEditor compatibility CSS (image alignment classes used by rich editor)
  const sunEditorCompatCss = `
    .__se__float-left { float: none !important; display: block !important; width: fit-content !important; max-width: 100%; margin-left: 0 !important; margin-right: auto !important; clear: both; }
    .__se__float-right { float: none !important; display: block !important; width: fit-content !important; max-width: 100%; margin-left: auto !important; margin-right: 0 !important; clear: both; }
    .__se__float-center { float: none !important; display: block !important; width: fit-content !important; max-width: 100%; margin-left: auto !important; margin-right: auto !important; clear: both; }
    .__se__float-none { float: none !important; display: block !important; width: fit-content !important; max-width: 100%; margin-left: auto !important; margin-right: auto !important; clear: both; }
    .se-image-container { max-width: 100%; height: auto; }
    .se-video-container { width: auto; height: auto; max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    td, th { padding: 8px; word-break: break-word; }
  `;

  // Inject CSS
  let fullHtml = rendered;
  const allCss = (css && css.trim() ? css.trim() + '\n' : '') + sunEditorCompatCss;
  if (fullHtml.includes('</head>')) {
    fullHtml = fullHtml.replace('</head>', `<style>${allCss}</style></head>`);
  } else {
    fullHtml = `<style>${allCss}</style>${fullHtml}`;
  }

  // Ensure proper HTML structure
  if (!fullHtml.includes('<!DOCTYPE') && !fullHtml.includes('<html')) {
    fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${allCss}</style></head><body>${fullHtml}</body></html>`;
  }

  return fullHtml;
}

function sanitizeHtml(html) {
  let sanitized = html;
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<script[^>]*\/>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  return sanitized;
}

function sanitizeCss(css) {
  let sanitized = css;
  sanitized = sanitized.replace(/@import\s+[^;]+;/gi, '');
  sanitized = sanitized.replace(/expression\s*\(/gi, '');
  return sanitized;
}

module.exports = { renderTemplate, sanitizeHtml, sanitizeCss, escapeHtml, processTemplate };
