// When embedded under jarvis_backend at /pdfgenerator, index.html injects
// window.PDF_GEN_BASE = '/pdfgenerator'.  Falls back to '' for standalone mode.
const API_BASE = (typeof window !== 'undefined' && window.PDF_GEN_BASE) ? window.PDF_GEN_BASE : '';
let currentTemplateId = null;
let pdfBlobUrl = null;
let editors = {};
let cmEditors = {};
let watermarkImageBase64 = '';
let pendingEditorContent = {};

// DOM Elements
const dataEditor = document.getElementById('data-editor');
const templateName = document.getElementById('template-name');
const templateDesc = document.getElementById('template-desc');
const toast = document.getElementById('toast');

// PDF Preview Modal
const pdfPreviewModal = document.getElementById('pdf-preview-modal');
const pdfPreviewFrame = document.getElementById('pdf-preview-frame');
const pdfPreviewLoader = document.getElementById('pdf-preview-loader');
const btnPreviewPdf = document.getElementById('btn-preview-pdf');
const btnClosePdfModal = document.getElementById('close-pdf-modal');

// PDF Options
const previewSize = document.getElementById('preview-size');
const previewOrientation = document.getElementById('preview-orientation');
const marginTop = document.getElementById('margin-top');
const marginRight = document.getElementById('margin-right');
const marginBottom = document.getElementById('margin-bottom');
const marginLeft = document.getElementById('margin-left');
const btnDownload = document.getElementById('btn-download');

// Watermark controls
const wmTypeRadios = document.querySelectorAll('input[name="wm-type"]');
const wmTextControls = document.getElementById('wm-text-controls');
const wmImageControls = document.getElementById('wm-image-controls');
const wmEnabled = document.getElementById('wm-enabled');
const wmText = document.getElementById('wm-text');
const wmOpacity = document.getElementById('wm-opacity');
const wmOpacityVal = document.getElementById('wm-opacity-val');
const wmColor = document.getElementById('wm-color');
const wmFontSize = document.getElementById('wm-fontsize');
const wmAngle = document.getElementById('wm-angle');
const wmAngleVal = document.getElementById('wm-angle-val');
const wmImageFile = document.getElementById('wm-image-file');
const wmImagePreview = document.getElementById('wm-image-preview');
const wmPreviewImg = document.getElementById('wm-preview-img');
const wmRemoveImage = document.getElementById('wm-remove-image');
const wmImageOpacity = document.getElementById('wm-image-opacity');
const wmImageOpacityVal = document.getElementById('wm-image-opacity-val');
const footerSkipPages = document.getElementById('footer-skip-pages');

// Hidden color inputs for table plugins
const tableBgInput = document.createElement('input');
tableBgInput.type = 'color';
tableBgInput.style.position = 'absolute';
tableBgInput.style.visibility = 'hidden';
document.body.appendChild(tableBgInput);

const tableBorderInput = document.createElement('input');
tableBorderInput.type = 'color';
tableBorderInput.style.position = 'absolute';
tableBorderInput.style.visibility = 'hidden';
document.body.appendChild(tableBorderInput);

const headerFooterPdfVars = {
  pageNumber: { text: 'Page Number', output: '<span class="pageNumber"></span>' },
  totalPages: { text: 'Total Pages', output: '<span class="totalPages"></span>' },
  date: { text: 'Date', output: '<span class="date"></span>' },
  title: { text: 'Title', output: '<span class="title"></span>' },
  url: { text: 'URL', output: '<span class="url"></span>' }
};

function encodeHeaderFooterPlaceholders(html) {
  if (!html) return html;
  let encoded = html;
  Object.entries(headerFooterPdfVars).forEach(([key, meta]) => {
    const regex = new RegExp(`<span[^>]*class=["'][^"'<>]*\\b${key}\\b[^"'<>]*["'][^>]*>[\\s\\S]*?<\\/span>`, 'gi');
    encoded = encoded.replace(regex, `<span data-pdf-var="${key}" style="background:#e2e8f0;color:#0f172a;padding:1px 4px;border-radius:3px;">${meta.text}</span>`);
  });
  return encoded;
}

function decodeHeaderFooterPlaceholders(html) {
  if (!html) return html;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  wrapper.querySelectorAll('[data-pdf-var]').forEach((node) => {
    const key = node.getAttribute('data-pdf-var');
    const meta = headerFooterPdfVars[key];
    if (!meta) return;
    const temp = document.createElement('div');
    temp.innerHTML = meta.output;
    node.replaceWith(temp.firstChild);
  });
  return wrapper.innerHTML;
}

function getEncodedHeaderFooterSnippet(key) {
  const meta = headerFooterPdfVars[key];
  if (!meta) return '';
  return encodeHeaderFooterPlaceholders(meta.output);
}

function getSelectedTableCells(selection) {
  if (!selection || selection.rangeCount === 0) return [];

  const range = selection.getRangeAt(0);
  let anchorNode = selection.anchorNode;
  if (anchorNode && anchorNode.nodeType === 3) anchorNode = anchorNode.parentElement;
  const anchorCell = anchorNode && anchorNode.closest ? anchorNode.closest('td, th') : null;
  const anchorTable = anchorCell ? anchorCell.closest('table') : null;

  if (!range.collapsed && anchorTable) {
    const cells = Array.from(anchorTable.querySelectorAll('td, th')).filter(function(cell) {
      try {
        return range.intersectsNode(cell);
      } catch (err) {
        return false;
      }
    });
    if (cells.length) return cells;
  }

  return anchorCell ? [anchorCell] : [];
}

// SunEditor custom plugins
const pageBreakPlugin = {
  name: 'pageBreak',
  display: 'command',
  title: 'Insert Page Break',
  innerHTML: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/></svg>',
  add: function(core, targetElement) {},
  action: function() {
    this.execCommand('insertHTML', false, '<div style="page-break-after: always; height: 0;"></div>');
  }
};

const tableCellBackgroundPlugin = {
  name: 'tableCellBackground',
  display: 'command',
  title: 'Cell Background Color',
  innerHTML: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l-5.5 9h11z"/><circle cx="17.5" cy="17.5" r="4.5" fill="currentColor"/><path d="M3 13.5h8v8H3z"/></svg>',
  add: function(core, targetElement) {},
  action: function() {
    const selection = this.getSelection();
    const cells = getSelectedTableCells(selection);
    if (!cells.length) {
      showToast('Place cursor inside a table cell first', 'warning');
      return;
    }
    tableBgInput.onchange = function() {
      const color = tableBgInput.value;
      cells.forEach(function(cell) {
        cell.style.backgroundColor = color;
        // Ensure child elements don't hide the cell background
        cell.querySelectorAll('p, div, span').forEach(function(child) {
          if (!child.style.backgroundColor) {
            child.style.backgroundColor = 'transparent';
          }
        });
      });
    };
    tableBgInput.click();
  }
};

// Floating panel for combined table border settings
const tableBorderPanel = (function() {
  const el = document.createElement('div');
  el.style.cssText = 'display:none;position:fixed;z-index:99999;background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.18);min-width:230px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-size:13px;font-weight:600;color:#1e293b;">Table Border</span>
      <button id="tbs-close" style="background:none;border:none;cursor:pointer;font-size:16px;color:#94a3b8;line-height:1;padding:0 2px;">&#10005;</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <label style="font-size:12px;color:#475569;width:44px;flex-shrink:0;">Color</label>
        <input type="color" id="tbs-color" value="#000000" style="width:36px;height:26px;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;padding:1px;">
        <span id="tbs-color-val" style="font-size:11px;color:#64748b;">#000000</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <label style="font-size:12px;color:#475569;width:44px;flex-shrink:0;">Width</label>
        <input type="number" id="tbs-width" value="1" min="0" max="20" style="width:54px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;">
        <span style="font-size:12px;color:#64748b;">px</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <label style="font-size:12px;color:#475569;width:44px;flex-shrink:0;">Style</label>
        <select id="tbs-style" style="flex:1;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;">
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="double">Double</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button id="tbs-apply" style="flex:1;padding:7px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;">Apply to Table</button>
        <button id="tbs-remove" style="padding:7px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-size:12px;cursor:pointer;">Remove</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const colorInput = el.querySelector('#tbs-color');
  const colorVal   = el.querySelector('#tbs-color-val');
  const widthInput = el.querySelector('#tbs-width');
  const styleSelect = el.querySelector('#tbs-style');

  colorInput.addEventListener('input', () => { colorVal.textContent = colorInput.value; });

  function applyBorder() {
    const table = el._table;
    if (!table) return;
    const w = (widthInput.value || '1') + 'px';
    const s = styleSelect.value;
    const c = colorInput.value;
    const borderVal = `${w} ${s} ${c}`;
    table.style.borderCollapse = 'collapse';
    table.style.border = borderVal;
    table.querySelectorAll('td, th').forEach(cell => { cell.style.border = borderVal; });
    el.style.display = 'none';
  }

  el.querySelector('#tbs-apply').addEventListener('click', applyBorder);

  el.querySelector('#tbs-remove').addEventListener('click', () => {
    const table = el._table;
    if (!table) return;
    table.style.border = '';
    table.style.borderCollapse = '';
    table.querySelectorAll('td, th').forEach(cell => { cell.style.border = ''; });
    el.style.display = 'none';
  });

  el.querySelector('#tbs-close').addEventListener('click', () => { el.style.display = 'none'; });

  document.addEventListener('mousedown', (e) => {
    if (el.style.display === 'none') return;
    if (!el.contains(e.target)) el.style.display = 'none';
  }, true);

  el.show = function(table, anchorEl) {
    el._table = table;
    // Pre-fill from existing table styles
    const existingColor = table.style.borderColor || '#000000';
    colorInput.value = /^#[0-9a-f]{6}$/i.test(existingColor) ? existingColor : '#000000';
    colorVal.textContent = colorInput.value;
    widthInput.value = parseInt(table.style.borderWidth) || 1;
    styleSelect.value = table.style.borderStyle || 'solid';
    // Position below the anchor button
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const panelW = 240;
      let left = rect.left;
      if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
      el.style.top  = (rect.bottom + 6) + 'px';
      el.style.left = left + 'px';
      el.style.right = 'auto';
    }
    el.style.display = 'block';
  };

  return el;
})();

let _activeBorderBtn = null;

const tableBorderSettingsPlugin = {
  name: 'tableBorderSettings',
  display: 'command',
  title: 'Table Border Settings',
  innerHTML: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  add: function(core, targetElement) {
    targetElement.addEventListener('mousedown', () => { _activeBorderBtn = targetElement; });
  },
  action: function() {
    const selection = this.getSelection();
    let node = selection ? selection.anchorNode : null;
    if (!node) return;
    if (node.nodeType === 3) node = node.parentElement;
    const table = node ? node.closest('table') : null;
    if (!table) { showToast('Place cursor inside a table first', 'warning'); return; }
    tableBorderPanel.show(table, _activeBorderBtn);
  }
};

const tableFullWidthPlugin = {
  name: 'tableFullWidth',
  display: 'command',
  title: 'Table Full Width',
  innerHTML: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 3h18v18H3V3zm16 16V5H5v14h14z"/><path d="M3 9h18v2H3zm0 6h18v2H3zm8-12v18H9V3z"/></svg>',
  add: function(core, targetElement) {},
  action: function() {
    const selection = this.getSelection();
    let node = selection ? selection.anchorNode : null;
    if (!node) return;
    if (node.nodeType === 3) node = node.parentElement;
    const table = node.closest('table');
    if (!table) {
      showToast('Place cursor inside a table first', 'warning');
      return;
    }
    table.style.width = '100%';
    table.querySelectorAll('td, th').forEach(function(c) {
      c.style.wordBreak = 'break-word';
    });
  }
};

// Column width percentage panel
const colWidthPanel = (function() {
  const el = document.createElement('div');
  el.style.cssText = 'display:none;position:fixed;z-index:99999;background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.18);width:260px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-height:80vh;overflow-y:auto;';
  document.body.appendChild(el);

  function getColCount(table) {
    const firstRow = table.querySelector('tr');
    return firstRow ? firstRow.cells.length : 0;
  }

  function getCurrentWidths(table, n) {
    const w = new Array(n).fill('');
    const cg = table.querySelector('colgroup');
    if (cg) {
      cg.querySelectorAll('col').forEach((col, i) => {
        if (i < n) w[i] = col.style.width || col.getAttribute('width') || '';
      });
    } else {
      const firstRow = table.querySelector('tr');
      if (firstRow) Array.from(firstRow.cells).forEach((c, i) => {
        if (i < n) w[i] = c.style.width || c.getAttribute('width') || '';
      });
    }
    return w;
  }

  function applyWidths(table, widths) {
    table.style.tableLayout = 'fixed';
    table.style.width = '100%';
    // Update / create <colgroup> with <col> elements — most reliable for PDF
    let cg = table.querySelector('colgroup');
    if (!cg) { cg = document.createElement('colgroup'); table.insertBefore(cg, table.firstChild); }
    cg.innerHTML = '';
    widths.forEach(w => {
      const col = document.createElement('col');
      if (w) col.style.width = w;
      cg.appendChild(col);
    });
    // Also stamp width onto every cell in each column so it survives HTML serialisation
    table.querySelectorAll('tr').forEach(row => {
      Array.from(row.cells).forEach((cell, i) => {
        if (i < widths.length) {
          if (widths[i]) cell.style.width = widths[i];
          else cell.style.removeProperty('width');
        }
      });
    });
  }

  function render(table) {
    const n = getColCount(table);
    if (!n) return;
    const cur = getCurrentWidths(table, n);

    const rows = Array.from({ length: n }, (_, i) => {
      const v = cur[i] ? parseFloat(cur[i]) : '';
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <label style="font-size:12px;color:#475569;width:48px;flex-shrink:0;">Col ${i + 1}</label>
        <input type="number" id="cwp-${i}" min="1" max="100" step="1" value="${v}" placeholder="auto"
               style="width:68px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;">
        <span style="font-size:12px;color:#64748b;">%</span>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:600;color:#1e293b;">Column Widths</span>
        <button id="cwp-close" style="background:none;border:none;cursor:pointer;font-size:16px;color:#94a3b8;line-height:1;padding:0 2px;">&#10005;</button>
      </div>
      <div>${rows}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 4px;padding:6px 8px;background:#f8fafc;border-radius:6px;font-size:12px;">
        <span style="color:#475569;">Total</span>
        <span id="cwp-total" style="font-weight:600;color:#334155;">0%</span>
        <span id="cwp-hint" style="font-size:11px;color:#94a3b8;"></span>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button id="cwp-apply" style="flex:1;padding:7px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;">Apply</button>
        <button id="cwp-even" style="padding:7px 10px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:6px;font-size:12px;cursor:pointer;" title="Distribute evenly">Even</button>
        <button id="cwp-clear" style="padding:7px 10px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;cursor:pointer;">Clear</button>
      </div>`;

    function updateTotal() {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const v = parseFloat(el.querySelector(`#cwp-${i}`).value);
        if (!isNaN(v)) sum += v;
      }
      const tot = el.querySelector('#cwp-total');
      const hint = el.querySelector('#cwp-hint');
      tot.textContent = sum + '%';
      tot.style.color = sum > 100 ? '#dc2626' : sum === 100 ? '#16a34a' : '#334155';
      hint.textContent = sum === 100 ? '✓' : sum > 100 ? '⚠ over 100' : 'should = 100';
      hint.style.color = sum === 100 ? '#16a34a' : '#94a3b8';
    }

    for (let i = 0; i < n; i++) el.querySelector(`#cwp-${i}`).addEventListener('input', updateTotal);
    updateTotal();

    el.querySelector('#cwp-close').onclick = () => { el.style.display = 'none'; };

    el.querySelector('#cwp-apply').onclick = () => {
      const widths = [];
      for (let i = 0; i < n; i++) {
        const v = parseFloat(el.querySelector(`#cwp-${i}`).value);
        widths.push(isNaN(v) || v <= 0 ? null : v + '%');
      }
      applyWidths(table, widths);
      el.style.display = 'none';
    };

    el.querySelector('#cwp-even').onclick = () => {
      const each = Math.floor(100 / n);
      for (let i = 0; i < n; i++) el.querySelector(`#cwp-${i}`).value = each;
      updateTotal();
    };

    el.querySelector('#cwp-clear').onclick = () => {
      for (let i = 0; i < n; i++) el.querySelector(`#cwp-${i}`).value = '';
      updateTotal();
    };
  }

  el.show = function(table, anchorEl) {
    render(table);
    if (anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      let left = r.left;
      if (left + 268 > window.innerWidth - 8) left = window.innerWidth - 276;
      el.style.top = (r.bottom + 6) + 'px';
      el.style.left = left + 'px';
    }
    el.style.display = 'block';
  };

  document.addEventListener('mousedown', (e) => {
    if (el.style.display === 'none') return;
    if (!el.contains(e.target)) el.style.display = 'none';
  }, true);

  return el;
})();

let _activeColWidthBtn = null;

const tableColWidthPlugin = {
  name: 'tableColWidth',
  display: 'command',
  title: 'Set Column Widths (%)',
  innerHTML: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><text x="4.5" y="15.5" font-size="5.5" fill="currentColor" stroke="none" font-family="monospace">%</text></svg>',
  add: function(core, targetElement) {
    targetElement.addEventListener('mousedown', () => { _activeColWidthBtn = targetElement; });
  },
  action: function() {
    const selection = this.getSelection();
    let node = selection ? selection.anchorNode : null;
    if (!node) return;
    if (node.nodeType === 3) node = node.parentElement;
    const table = node ? node.closest('table') : null;
    if (!table) { showToast('Place cursor inside a table first', 'warning'); return; }
    colWidthPanel.show(table, _activeColWidthBtn);
  }
};

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const codeEditors = document.querySelectorAll('.code-editor, .watermark-panel, .editor-wrapper');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    codeEditors.forEach(e => e.classList.add('hidden'));
    btn.classList.add('active');
    const target = document.getElementById(`${btn.dataset.tab}-editor-wrapper`) || document.getElementById(`${btn.dataset.tab}-editor`);
    if (target) target.classList.remove('hidden');
    const key = btn.dataset.tab;
    if (cmEditors[key]) {
      setTimeout(() => cmEditors[key].refresh(), 100);
    }
    if (['html', 'header', 'footer'].includes(key) && !editors[key]) {
      initRichEditor(key);
    }
  });
});

// ── Variable browser panel ────────────────────────────────────────────────
const varPanel = (function () {
  const el = document.createElement('div');
  el.style.cssText = 'display:none;position:fixed;z-index:99999;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.18);width:330px;max-height:500px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;flex-direction:column;overflow:hidden;';
  document.body.appendChild(el);

  function getData() {
    try {
      const raw = (cmEditors.data ? cmEditors.data.getValue() : null)
                  || document.getElementById('data-editor').value
                  || '{}';
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function extractVars(obj) {
    const scalars = [], arrayFields = [], arrayLoops = [];
    function walk(o, pfx) {
      if (!o || typeof o !== 'object') return;
      for (const [k, v] of Object.entries(o)) {
        const path = pfx ? `${pfx}.${k}` : k;
        if (Array.isArray(v)) {
          const first = v.find(x => x && typeof x === 'object');
          if (first) {
            for (const [fk, fv] of Object.entries(first)) {
              arrayFields.push({ path: `${path}[].${fk}`, preview: String(fv ?? '').slice(0, 22) });
            }
          }
          arrayLoops.push({ path, count: v.length });
        } else if (v && typeof v === 'object') {
          walk(v, path);
        } else {
          scalars.push({ path, preview: String(v ?? '').slice(0, 28) });
        }
      }
    }
    walk(obj, '');
    return { scalars, arrayFields, arrayLoops };
  }

  function badge(type) {
    const map = {
      scalar:      ['VAR', '#2563eb', '#eff6ff'],
      'array-field': ['ROW', '#7c3aed', '#f5f3ff'],
      array:       ['ARR', '#059669', '#ecfdf5']
    };
    const [label, color, bg] = map[type];
    return `<span style="font-size:10px;color:${color};background:${bg};padding:1px 5px;border-radius:3px;font-weight:700;flex-shrink:0;">${label}</span>`;
  }

  function buildList(vars, q) {
    q = (q || '').toLowerCase();
    const all = [
      ...vars.scalars.map(v => ({ type: 'scalar', insert: `{{${v.path}}}`, preview: v.preview })),
      ...vars.arrayFields.map(v => ({ type: 'array-field', insert: `{{${v.path}}}`, preview: v.preview })),
      ...vars.arrayLoops.map(v => ({ type: 'array', insert: `{{${v.path}}}`, preview: `${v.count} item${v.count !== 1 ? 's' : ''}` }))
    ];
    return q ? all.filter(v => v.insert.toLowerCase().includes(q)) : all;
  }

  function render(vars, q) {
    const items = buildList(vars, q);
    const rows = items.length
      ? items.map(it => {
          const ins = it.insert.replace(/"/g, '&quot;');
          return `<div class="vp-row" data-insert="${ins}"
            style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;border-radius:6px;">
            ${badge(it.type)}
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:500;color:#1e293b;font-family:monospace;
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.insert}</div>
              ${it.preview ? `<div style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it.preview)}</div>` : ''}
            </div>
          </div>`;
        }).join('')
      : '<div style="padding:24px;text-align:center;font-size:12px;color:#94a3b8;">No matching variables</div>';

    el.innerHTML = `
      <div style="padding:12px 14px 8px;border-bottom:1px solid #f1f5f9;flex-shrink:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;font-weight:600;color:#1e293b;">Insert Variable</span>
          <button id="vp-close" style="background:none;border:none;cursor:pointer;font-size:16px;color:#94a3b8;line-height:1;padding:0 2px;">&#10005;</button>
        </div>
        <input id="vp-search" type="text" placeholder="Search variables…" value="${escapeHtml(q || '')}"
               style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;outline:none;">
      </div>
      <div style="display:flex;gap:10px;padding:6px 10px 4px;flex-shrink:0;">
        <span style="font-size:10px;color:#2563eb;">■ VAR = value</span>
        <span style="font-size:10px;color:#7c3aed;">■ ROW = table row field</span>
        <span style="font-size:10px;color:#059669;">■ ARR = array</span>
      </div>
      <div id="vp-list" style="overflow-y:auto;flex:1;padding:4px 6px 8px;">${rows}</div>`;

    el.querySelector('#vp-close').onclick = () => { el.style.display = 'none'; };

    const searchEl = el.querySelector('#vp-search');
    searchEl.addEventListener('input', e => render(vars, e.target.value));
    searchEl.addEventListener('keydown', e => { if (e.key === 'Escape') el.style.display = 'none'; });

    el.querySelectorAll('.vp-row').forEach(row => {
      row.addEventListener('mouseenter', () => { row.style.background = '#f8fafc'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', () => {
        navigator.clipboard.writeText(row.dataset.insert).then(() => {
          showToast(`Copied: ${row.dataset.insert}`, 'success');
        }).catch(() => {
          // Fallback for browsers that block clipboard API
          const tmp = document.createElement('textarea');
          tmp.value = row.dataset.insert;
          tmp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand('copy');
          document.body.removeChild(tmp);
          showToast(`Copied: ${row.dataset.insert}`, 'success');
        });
        el.style.display = 'none';
      });
    });

    setTimeout(() => { const s = el.querySelector('#vp-search'); if (s) s.focus(); }, 40);
  }

  el.show = function (anchorEl) {
    const data = getData();
    if (!data || Object.keys(data).length === 0) {
      showToast('Add sample JSON data first in the Data tab', 'warning');
      return;
    }
    const vars = extractVars(data);
    if (!vars.scalars.length && !vars.arrayFields.length && !vars.arrayLoops.length) {
      showToast('No variables found in sample data', 'warning');
      return;
    }
    el.style.display = 'flex';
    render(vars, '');

    if (anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      let left = r.left, top = r.bottom + 6;
      if (left + 338 > window.innerWidth - 8) left = window.innerWidth - 346;
      if (top + 510 > window.innerHeight - 8) top = r.top - 510;
      el.style.left = Math.max(8, left) + 'px';
      el.style.top  = Math.max(8, top)  + 'px';
    }
  };

  document.addEventListener('mousedown', e => {
    if (el.style.display === 'none') return;
    if (!el.contains(e.target)) el.style.display = 'none';
  }, true);

  return el;
})();

document.getElementById('btn-insert-variable').addEventListener('click', e => {
  varPanel.show(e.currentTarget);
});

document.querySelectorAll('.js-editor-snippet').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.editorTarget;
    const pdfVar = btn.dataset.pdfVar;
    const snippet = getEncodedHeaderFooterSnippet(pdfVar);
    if (!target || !snippet) return;
    if (!editors[target]) {
      initRichEditor(target);
    }
    if (!editors[target]) {
      showToast(`Open the ${target} editor first`, 'warning');
      return;
    }
    const existing = editors[target].getContents() || '';
    const spacer = existing && existing !== '<p><br></p>' ? '&nbsp;' : '';
    editors[target].setContents(existing === '<p><br></p>' ? snippet : existing + spacer + snippet);
  });
});

// Vertical line shown during column drag-resize
const colResizeLine = document.createElement('div');
colResizeLine.style.cssText = 'display:none;position:fixed;top:0;height:100vh;width:2px;background:#2563eb;z-index:99999;pointer-events:none;opacity:0.75;';
document.body.appendChild(colResizeLine);

function initTableColumnResize(editorEl) {
  if (!editorEl || editorEl._colResizeInit) return;
  editorEl._colResizeInit = true;

  const THRESHOLD = 6; // px from cell right edge that activates resize cursor

  let hoveredCell = null;

  function getCell(e) {
    let el = e.target;
    while (el && el !== editorEl) {
      if (el.tagName === 'TD' || el.tagName === 'TH') return el;
      el = el.parentElement;
    }
    return null;
  }

  function nearRightEdge(e, cell) {
    const rect = cell.getBoundingClientRect();
    return e.clientX >= rect.right - THRESHOLD && e.clientX <= rect.right + THRESHOLD;
  }

  // Change cursor when hovering near a column border
  editorEl.addEventListener('mousemove', (e) => {
    const cell = getCell(e);
    if (hoveredCell && hoveredCell !== cell) {
      hoveredCell.style.removeProperty('cursor');
      hoveredCell = null;
    }
    if (!cell) return;
    if (nearRightEdge(e, cell)) {
      cell.style.cursor = 'col-resize';
      hoveredCell = cell;
    } else {
      cell.style.removeProperty('cursor');
      hoveredCell = null;
    }
  });

  editorEl.addEventListener('mouseleave', () => {
    if (hoveredCell) { hoveredCell.style.removeProperty('cursor'); hoveredCell = null; }
  });

  // Start drag on mousedown near a column border
  editorEl.addEventListener('mousedown', (e) => {
    const cell = getCell(e);
    if (!cell || !nearRightEdge(e, cell)) return;

    e.preventDefault();
    e.stopPropagation();

    const startX   = e.clientX;
    const startW   = cell.offsetWidth;
    const colIdx   = Array.from(cell.parentElement.cells).indexOf(cell);
    const tbl      = cell.closest('table');

    tbl.style.tableLayout = 'fixed';
    if (!tbl.style.width) tbl.style.width = '100%';

    // Show position indicator line
    const initRight = cell.getBoundingClientRect().right;
    colResizeLine.style.left    = initRight + 'px';
    colResizeLine.style.display = 'block';

    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      const newW = Math.max(20, startW + (ev.clientX - startX));
      tbl.querySelectorAll('tr').forEach(r => {
        const c = r.cells[colIdx];
        if (c) c.style.width = newW + 'px';
      });
      colResizeLine.style.left = ev.clientX + 'px';
    }

    function onUp() {
      colResizeLine.style.display   = 'none';
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

function initRichEditor(key) {
  try {
    if (!editors[key]) {
      const config = {
        height: '100%',
        strictHTMLValidation: false,
        lineAttrReset: 'class|style',
        attributesWhitelist: {
          all: 'style|class|data-.+',
          table: 'style|class|border|cellpadding|cellspacing|width',
          colgroup: 'style|class|span',
          col: 'style|class|span|width',
          thead: 'style|class',
          tbody: 'style|class',
          tr: 'style|class',
          th: 'style|class|colspan|rowspan|width',
          td: 'style|class|colspan|rowspan|width'
        },
        plugins: [
          pageBreakPlugin,
          tableCellBackgroundPlugin,
          tableBorderSettingsPlugin,
          tableFullWidthPlugin,
          tableColWidthPlugin
        ],
        buttonList: [
          ['undo', 'redo'],
          ['font', 'fontSize', 'formatBlock'],
          ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
          ['fontColor', 'hiliteColor', 'textStyle'],
          ['removeFormat'],
          ['outdent', 'indent'],
          ['align', 'horizontalRule', 'list', 'table'],
          ['tableCellBackground', 'tableBorderSettings', 'tableFullWidth', 'tableColWidth'],
          ['pageBreak'],
          ['link', 'image', 'video'],
          ['fullScreen', 'showBlocks', 'codeView'],
          ['preview', 'print']
        ],
        placeholder: key === 'html' ? 'Start typing...' : `${key} HTML...`,
        onload: function(core) {
          const wysiwyg = core.context.element.wysiwyg;
          if (wysiwyg) initTableColumnResize(wysiwyg);
        }
      };
      editors[key] = SUNEDITOR.create(`${key}-rich-editor`, config);
      if (pendingEditorContent[key] !== undefined) {
        editors[key].setContents(pendingEditorContent[key]);
        delete pendingEditorContent[key];
      }
    }
  } catch (err) {
    console.error('Failed to init rich editor:', err);
    showToast('Rich editor failed to load.', 'error');
  }
}

function clearAllEditors() {
  ['html', 'header', 'footer'].forEach(key => {
    if (editors[key]) {
      editors[key].setContents('');
    }
    delete pendingEditorContent[key];
  });
}

// Watermark type toggle
wmTypeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    const type = document.querySelector('input[name="wm-type"]:checked').value;
    wmTextControls.classList.toggle('hidden', type !== 'text');
    wmImageControls.classList.toggle('hidden', type !== 'image');
  });
});

// Watermark text control events
wmOpacity.addEventListener('input', () => {
  wmOpacityVal.textContent = (wmOpacity.value / 100).toFixed(2);
});
wmAngle.addEventListener('input', () => {
  wmAngleVal.textContent = wmAngle.value + '°';
});

// Watermark image events
wmImageFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 500 * 1024) {
    showToast('Image must be under 500KB', 'error');
    wmImageFile.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    watermarkImageBase64 = ev.target.result;
    wmPreviewImg.src = watermarkImageBase64;
    wmImagePreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

wmRemoveImage.addEventListener('click', () => {
  watermarkImageBase64 = '';
  wmImageFile.value = '';
  wmPreviewImg.src = '';
  wmImagePreview.classList.add('hidden');
});

wmImageOpacity.addEventListener('input', () => {
  wmImageOpacityVal.textContent = (wmImageOpacity.value / 100).toFixed(2);
});

// PDF Preview Modal
btnPreviewPdf.addEventListener('click', async () => {
  pdfPreviewModal.classList.remove('hidden');
  await updatePdfPreview();
});

btnClosePdfModal.addEventListener('click', () => {
  pdfPreviewModal.classList.add('hidden');
  pdfPreviewFrame.src = '';
  if (pdfBlobUrl) {
    URL.revokeObjectURL(pdfBlobUrl);
    pdfBlobUrl = null;
  }
});

// Close modal on backdrop click
pdfPreviewModal.addEventListener('click', (e) => {
  if (e.target === pdfPreviewModal) {
    pdfPreviewModal.classList.add('hidden');
    pdfPreviewFrame.src = '';
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      pdfBlobUrl = null;
    }
  }
});

// Navigation
const views = {
  editor: document.getElementById('editor-view'),
  list: document.getElementById('list-view'),
  docs: document.getElementById('docs-view')
};

function showView(name) {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
  if (name === 'list') loadTemplatesList();
  if (name === 'docs') loadDocs();
}

document.getElementById('btn-new').addEventListener('click', () => {
  clearAllEditors();
  currentTemplateId = null;
  templateName.value = '';
  templateDesc.value = '';
  dataEditor.value = '{}';
  if (cmEditors.data) cmEditors.data.setValue('{}');
  if (footerSkipPages) footerSkipPages.value = '';
  wmEnabled.checked = false;
  wmText.value = '';
  wmOpacity.value = 8;
  wmOpacityVal.textContent = '0.08';
  wmColor.value = '#000000';
  wmFontSize.value = '100px';
  wmAngle.value = -45;
  wmAngleVal.textContent = '-45°';
  wmImageOpacity.value = 8;
  wmImageOpacityVal.textContent = '0.08';
  watermarkImageBase64 = '';
  wmImageFile.value = '';
  wmPreviewImg.src = '';
  wmImagePreview.classList.add('hidden');
  setWatermarkType('text');
  previewSize.value = 'A4';
  previewOrientation.value = 'portrait';
  marginTop.value = '20px';
  marginRight.value = '20px';
  marginBottom.value = '20px';
  marginLeft.value = '20px';
  showView('editor');
});

document.getElementById('btn-list').addEventListener('click', () => showView('list'));
document.getElementById('btn-docs').addEventListener('click', () => showView('docs'));

// Editor content helpers
function getEditorContent(key) {
  if (['html', 'header', 'footer'].includes(key)) {
    if (editors[key]) {
      let content = editors[key].getContents() || '';
      if (key === 'html') {
        return unescapeTemplateSyntax(content);
      }
      return decodeHeaderFooterPlaceholders(content);
    }
    if (pendingEditorContent[key] !== undefined) {
      if (key === 'html') {
        return unescapeTemplateSyntax(pendingEditorContent[key] || '');
      }
      return decodeHeaderFooterPlaceholders(pendingEditorContent[key] || '');
    }
    return '';
  }
  if (cmEditors[key]) {
    return cmEditors[key].getValue() || '';
  }
  const el = document.getElementById(`${key}-editor`);
  return el ? (el.value || '') : '';
}

function setEditorContent(key, html) {
  const textarea = document.getElementById(`${key}-editor`);
  if (textarea) textarea.value = html || '';
  if (cmEditors[key]) {
    cmEditors[key].setValue(html || '');
  }
  if (['html', 'header', 'footer'].includes(key)) {
    let content = html || '';
    if (key === 'header' || key === 'footer') {
      content = encodeHeaderFooterPlaceholders(content);
    }
    if (editors[key] && editors[key].setContents) {
      editors[key].setContents(content);
    } else {
      pendingEditorContent[key] = content;
    }
  }
}

// Template engine
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
  if (key === '@index') {
    return loopContext && loopContext.index !== undefined ? String(loopContext.index) : '';
  }
  if (loopContext && loopContext.item !== undefined) {
    if (!key.includes('.')) {
      if (loopContext.item && typeof loopContext.item === 'object' && loopContext.item[key] !== undefined) {
        return loopContext.item[key];
      }
      if (loopContext.item !== undefined && !(typeof loopContext.item === 'object' && loopContext.item !== null)) {
        return loopContext.item;
      }
    }
  }
  return getValueByPath(data, key);
}

function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeTemplateSyntax(html) {
  if (!html) return html;
  return html.replace(/\{\{([\s\S]*?)\}\}/g, (match) => {
    try {
      const encoded = btoa(unescape(encodeURIComponent(match)));
      return '<!--TMPL:' + encoded + '-->';
    } catch (e) {
      return match;
    }
  });
}

function unescapeTemplateSyntax(html) {
  if (!html) return html;
  return html.replace(/<!--TMPL:([A-Za-z0-9+/=]+)-->/g, (match, encoded) => {
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch (e) {
      return match;
    }
  });
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

  const eachRegex = /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  rendered = rendered.replace(eachRegex, (match, key, content) => {
    const array = resolveVariable(key, data, loopContext);
    if (!Array.isArray(array) || array.length === 0) return '';
    return array.map((item, index) => {
      return processTemplate(content, data, { item, index });
    }).join('');
  });

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

  const varRegex = /\{\{\s*([\w.@]+)(?:\|(\w+))?\s*\}\}/g;
  rendered = rendered.replace(varRegex, (match, key, filter) => {
    const value = resolveVariable(key, data, loopContext);
    if (filter === 'escape') return escapeHtml(value);
    return value !== undefined && value !== null ? String(value) : '';
  });

  return rendered;
}

function renderTemplatePreview(html, css, data, watermark) {
  let rendered = processTemplate(html, data, null);

  if (watermark && watermark.enabled) {
    const options = watermark.options || {};
    const opacity = options.opacity !== undefined ? options.opacity : 0.08;

    if (watermark.type === 'image' && watermark.image) {
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

  let fullHtml = rendered;
  const allCss = (css && css.trim() ? css.trim() + '\n' : '') + sunEditorCompatCss;
  if (fullHtml.includes('</head>')) {
    fullHtml = fullHtml.replace('</head>', `<style>${allCss}</style></head>`);
  } else {
    fullHtml = `<style>${allCss}</style>${fullHtml}`;
  }

  if (!fullHtml.includes('<!DOCTYPE') && !fullHtml.includes('<html')) {
    fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${allCss}</style></head><body>${fullHtml}</body></html>`;
  }

  return fullHtml;
}

function getWatermarkConfig() {
  const type = document.querySelector('input[name="wm-type"]:checked').value;

  if (type === 'image') {
    return {
      enabled: wmEnabled.checked,
      type: 'image',
      image: watermarkImageBase64,
      text: '',
      options: { opacity: parseInt(wmImageOpacity.value, 10) / 100 }
    };
  }

  return {
    enabled: wmEnabled.checked,
    type: 'text',
    text: wmText.value.trim(),
    image: '',
    options: {
      opacity: parseInt(wmOpacity.value, 10) / 100,
      color: wmColor.value,
      fontSize: wmFontSize.value.trim() || '100px',
      angle: parseInt(wmAngle.value, 10)
    }
  };
}

function setWatermarkType(type) {
  const radio = document.querySelector(`input[name="wm-type"][value="${type}"]`);
  if (radio) radio.checked = true;
  wmTextControls.classList.toggle('hidden', type !== 'text');
  wmImageControls.classList.toggle('hidden', type !== 'image');
}

function getPdfOptions() {
  return {
    pageSize: previewSize.value,
    orientation: previewOrientation.value,
    margin: {
      top: marginTop.value || '20px',
      right: marginRight.value || '20px',
      bottom: marginBottom.value || '20px',
      left: marginLeft.value || '20px'
    }
  };
}

async function updatePdfPreview() {
  try {
    showToast(currentTemplateId ? 'Saving latest changes...' : 'Saving template first...', 'success');
    await saveTemplate();
  } catch (err) {
    showToast(err.message, 'error');
    pdfPreviewModal.classList.add('hidden');
    return;
  }

  pdfPreviewLoader.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/api/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: currentTemplateId,
        data: {},
        options: getPdfOptions()
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }

    const blob = await res.blob();

    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
    }
    pdfBlobUrl = URL.createObjectURL(blob);
    pdfPreviewFrame.src = pdfBlobUrl;
  } catch (err) {
    showToast('PDF preview failed: ' + err.message, 'error');
  } finally {
    pdfPreviewLoader.classList.add('hidden');
  }
}

// Build payload from current form state
function buildPayload() {
  let sampleData = null;
  try {
    sampleData = JSON.parse(dataEditor.value || '{}');
  } catch (e) {
    return { error: 'Invalid JSON in sample data' };
  }

  const wm = getWatermarkConfig();

  return {
    name: templateName.value.trim(),
    description: templateDesc.value.trim(),
    html_content: getEditorContent('html'),
    css_content: '',
    sample_data: sampleData,
    header_html: getEditorContent('header') || null,
    footer_html: getEditorContent('footer') || null,
    footer_skip_pages: footerSkipPages.value.trim() || null,
    watermark_text: wm.type === 'text' ? (wm.text || null) : null,
    watermark_enabled: wm.enabled,
    watermark_type: wm.type,
    watermark_image: wm.type === 'image' ? (wm.image || null) : null,
    watermark_options: wm.type === 'text' ? JSON.stringify(wm.options) : JSON.stringify({ opacity: wm.options.opacity })
  };
}

// Save template
async function saveTemplate() {
  const payload = buildPayload();
  if (payload.error) {
    throw new Error(payload.error);
  }
  if (!payload.name) {
    throw new Error('Template name is required');
  }
  if (!payload.html_content) {
    throw new Error('HTML content is required');
  }

  const url = currentTemplateId ? `${API_BASE}/api/templates/${currentTemplateId}` : `${API_BASE}/api/templates`;
  const method = currentTemplateId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || 'Save failed');
  }

  currentTemplateId = json.data.id;
  return json.data;
}

// Save button handler
document.getElementById('btn-save').addEventListener('click', async () => {
  try {
    await saveTemplate();
    showToast(currentTemplateId ? 'Template updated!' : 'Template saved!', 'success');
    loadSidebarTemplates();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Download PDF handler
async function downloadPdf() {
  try {
    showToast(currentTemplateId ? 'Saving latest changes...' : 'Saving template first...', 'success');
    await saveTemplate();

    pdfPreviewLoader.classList.remove('hidden');

    const res = await fetch(`${API_BASE}/api/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: currentTemplateId,
        data: {},
        options: getPdfOptions()
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName.value.trim() || 'template'}_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    showToast('PDF downloaded!', 'success');
  } catch (err) {
    showToast('Download failed: ' + err.message, 'error');
  } finally {
    pdfPreviewLoader.classList.add('hidden');
  }
}

btnDownload.addEventListener('click', downloadPdf);

// Sidebar template list
async function loadSidebarTemplates() {
  try {
    const res = await fetch(`${API_BASE}/api/templates`);
    const json = await res.json();
    const container = document.getElementById('template-list');

    if (!json.success || !json.data.length) {
      container.innerHTML = '<p style="color:#94a3b8;font-size:12px;padding:10px;">No templates yet</p>';
      return;
    }

    container.innerHTML = json.data.map(t => {
      const badges = [];
      if (t.header_html) badges.push('H');
      if (t.footer_html) badges.push('F');
      if (t.watermark_enabled) badges.push('W');
      const indicatorsHtml = badges.length
        ? `<div class="indicators">${badges.map(b => `<span class="badge">${b}</span>`).join('')}</div>`
        : '';
      return `
        <div class="template-list-item ${t.id === currentTemplateId ? 'active' : ''}" data-id="${t.id}" data-name="${escapeHtml(t.name)}">
          <div class="name">${escapeHtml(t.name)}</div>
          <div class="date">${new Date(t.created_at).toLocaleDateString()}</div>
          ${indicatorsHtml}
          <button class="item-delete-btn" data-id="${t.id}" data-name="${escapeHtml(t.name)}" title="Delete template">&#128465;</button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.template-list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.item-delete-btn')) return;
        loadTemplate(parseInt(item.dataset.id));
      });
    });

    container.querySelectorAll('.item-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirm(btn.dataset.name, () => performDelete(parseInt(btn.dataset.id)));
      });
    });
  } catch (err) {
    console.error('Failed to load templates:', err);
  }
}

async function loadTemplate(id) {
  try {
    const res = await fetch(`${API_BASE}/api/templates/${id}`);
    const json = await res.json();
    if (!json.success) return showToast(json.error, 'error');

    const t = json.data;
    currentTemplateId = t.id;
    templateName.value = t.name;
    templateDesc.value = t.description || '';
    setEditorContent('html', t.html_content);
    dataEditor.value = t.sample_data ? JSON.stringify(JSON.parse(t.sample_data), null, 2) : '{}';
    if (cmEditors.data) cmEditors.data.setValue(t.sample_data ? JSON.stringify(JSON.parse(t.sample_data), null, 2) : '{}');
    setEditorContent('header', t.header_html || '');
    setEditorContent('footer', t.footer_html || '');
    if (footerSkipPages) footerSkipPages.value = t.footer_skip_pages || '';

    // Watermark
    const wmOpts = t.watermark_options ? JSON.parse(t.watermark_options) : {};
    const wmType = t.watermark_type || 'text';
    setWatermarkType(wmType);
    wmEnabled.checked = t.watermark_enabled === 1;
    wmText.value = t.watermark_text || '';
    wmOpacity.value = Math.round((wmOpts.opacity || 0.08) * 100);
    wmOpacityVal.textContent = (wmOpacity.value / 100).toFixed(2);
    wmColor.value = wmOpts.color || '#000000';
    wmFontSize.value = wmOpts.fontSize || '100px';
    wmAngle.value = wmOpts.angle !== undefined ? wmOpts.angle : -45;
    wmAngleVal.textContent = wmAngle.value + '°';

    // Image watermark
    watermarkImageBase64 = t.watermark_image || '';
    wmImageOpacity.value = Math.round((wmOpts.opacity || 0.08) * 100);
    wmImageOpacityVal.textContent = (wmImageOpacity.value / 100).toFixed(2);
    if (watermarkImageBase64) {
      wmPreviewImg.src = watermarkImageBase64;
      wmImagePreview.classList.remove('hidden');
    } else {
      wmPreviewImg.src = '';
      wmImagePreview.classList.add('hidden');
    }
    wmImageFile.value = '';

    showView('editor');
    loadSidebarTemplates();
  } catch (err) {
    showToast('Failed to load template', 'error');
  }
}

// Templates grid (list view)
async function loadTemplatesList() {
  try {
    const res = await fetch(`${API_BASE}/api/templates`);
    const json = await res.json();
    const container = document.getElementById('templates-grid');

    if (!json.success || !json.data.length) {
      container.innerHTML = '<p>No templates yet. Create one from the editor!</p>';
      return;
    }

    container.innerHTML = json.data.map(t => {
      const badges = [];
      if (t.header_html) badges.push('Header');
      if (t.footer_html) badges.push('Footer');
      if (t.watermark_enabled) badges.push('Watermark');
      const indicatorsHtml = badges.length
        ? `<div class="indicators">${badges.map(b => `<span class="badge">${b}</span>`).join('')}</div>`
        : '';
      return `
        <div class="template-card">
          <h3>${escapeHtml(t.name)}</h3>
          <p>${escapeHtml(t.description || 'No description')}</p>
          ${indicatorsHtml}
          <div class="meta">Created: ${new Date(t.created_at).toLocaleDateString()}</div>
          <div class="card-actions">
            <button class="btn" onclick="editTemplate(${t.id})">Edit</button>
            <button class="btn" onclick="duplicateTemplate(${t.id})">Duplicate</button>
            <button class="btn btn-danger" onclick="deleteTemplate(${t.id}, ${JSON.stringify(t.name)})">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load templates list:', err);
  }
}

window.editTemplate = function(id) {
  loadTemplate(id);
};

window.duplicateTemplate = async function(id) {
  try {
    const res = await fetch(`${API_BASE}/api/templates/${id}`);
    const json = await res.json();
    if (!json.success) return showToast(json.error, 'error');

    const t = json.data;
    currentTemplateId = null;
    templateName.value = t.name + ' (Copy)';
    templateDesc.value = t.description || '';
    setEditorContent('html', t.html_content);
    dataEditor.value = t.sample_data ? JSON.stringify(JSON.parse(t.sample_data), null, 2) : '{}';
    if (cmEditors.data) cmEditors.data.setValue(t.sample_data ? JSON.stringify(JSON.parse(t.sample_data), null, 2) : '{}');
    setEditorContent('header', t.header_html || '');
    setEditorContent('footer', t.footer_html || '');
    if (footerSkipPages) footerSkipPages.value = t.footer_skip_pages || '';

    const wmOpts = t.watermark_options ? JSON.parse(t.watermark_options) : {};
    const wmType = t.watermark_type || 'text';
    setWatermarkType(wmType);
    wmEnabled.checked = t.watermark_enabled === 1;
    wmText.value = t.watermark_text || '';
    wmOpacity.value = Math.round((wmOpts.opacity || 0.08) * 100);
    wmOpacityVal.textContent = (wmOpacity.value / 100).toFixed(2);
    wmColor.value = wmOpts.color || '#000000';
    wmFontSize.value = wmOpts.fontSize || '100px';
    wmAngle.value = wmOpts.angle !== undefined ? wmOpts.angle : -45;
    wmAngleVal.textContent = wmAngle.value + '°';

    watermarkImageBase64 = t.watermark_image || '';
    wmImageOpacity.value = Math.round((wmOpts.opacity || 0.08) * 100);
    wmImageOpacityVal.textContent = (wmImageOpacity.value / 100).toFixed(2);
    if (watermarkImageBase64) {
      wmPreviewImg.src = watermarkImageBase64;
      wmImagePreview.classList.remove('hidden');
    } else {
      wmPreviewImg.src = '';
      wmImagePreview.classList.add('hidden');
    }
    wmImageFile.value = '';

    showView('editor');
    showToast('Template duplicated. Save to create a new copy.', 'success');
  } catch (err) {
    showToast('Failed to duplicate template', 'error');
  }
};

// Custom delete confirmation modal
const deleteModal = document.getElementById('delete-confirm-modal');
const deleteConfirmMsg = document.getElementById('delete-confirm-msg');
const deleteConfirmOk = document.getElementById('delete-confirm-ok');
const deleteConfirmCancel = document.getElementById('delete-confirm-cancel');

function showDeleteConfirm(templateName, onConfirm) {
  deleteConfirmMsg.textContent = `Are you sure you want to delete "${templateName}"? This action cannot be undone.`;
  deleteModal.classList.remove('hidden');
  const cleanup = () => {
    deleteModal.classList.add('hidden');
    deleteConfirmOk.removeEventListener('click', onOk);
    deleteConfirmCancel.removeEventListener('click', onCancel);
    deleteModal.removeEventListener('click', onOverlay);
  };
  const onOk = () => { cleanup(); onConfirm(); };
  const onCancel = () => cleanup();
  const onOverlay = (e) => { if (e.target === deleteModal) cleanup(); };
  deleteConfirmOk.addEventListener('click', onOk);
  deleteConfirmCancel.addEventListener('click', onCancel);
  deleteModal.addEventListener('click', onOverlay);
}

async function performDelete(id) {
  try {
    const res = await fetch(`${API_BASE}/api/templates/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Template deleted', 'success');
      if (currentTemplateId === id) {
        currentTemplateId = null;
        templateName.value = '';
        templateDesc.value = '';
        setEditorContent('html', '');
        dataEditor.value = '{}';
        if (cmEditors.data) cmEditors.data.setValue('{}');
        setEditorContent('header', '');
        setEditorContent('footer', '');
        if (footerSkipPages) footerSkipPages.value = '';
        wmEnabled.checked = false;
        wmText.value = '';
        watermarkImageBase64 = '';
        wmPreviewImg.src = '';
        wmImagePreview.classList.add('hidden');
      }
      loadTemplatesList();
      loadSidebarTemplates();
    } else {
      showToast(json.error || 'Delete failed', 'error');
    }
  } catch (err) {
    showToast('Delete failed', 'error');
  }
}

window.deleteTemplate = function(id, name) {
  showDeleteConfirm(name || 'this template', () => performDelete(id));
};

// Docs
async function loadDocs() {
  try {
    const res = await fetch(`${API_BASE}/api/docs`);
    const json = await res.json();
    const container = document.getElementById('docs-content');

    if (!json.success) {
      container.innerHTML = '<p>Failed to load docs</p>';
      return;
    }

    const docs = json.data;
    let html = `<p><strong>${docs.name}</strong> v${docs.version}</p>`;
    html += `<p>Base URL: <code>${docs.baseUrl}</code></p>`;
    html += '<table><thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead><tbody>';
    html += docs.endpoints.map(e => `
      <tr>
        <td><code>${e.method}</code></td>
        <td><code>${e.path}</code></td>
        <td>${e.description}</td>
      </tr>
    `).join('');
    html += '</tbody></table>';

    html += '<h3>Template Syntax</h3>';
    html += '<ul>';
    html += '<li><code>{{variable}}</code> - Insert variable value</li>';
    html += '<li><code>{{variable|escape}}</code> - HTML-escaped variable</li>';
    html += '<li><code>{{#if variable}}...{{/if}}</code> - Conditional block</li>';
    html += '<li><code>{{#each items}}...{{/each}}</code> - Loop over array (use <code>{{name}}</code> inside for item properties, <code>{{@index}}</code> for index)</li>';
    html += '<li><code>{{#table items}}header1|header2\n{{field1}}|{{field2}}{{/table}}</code> - Auto-generate table from array (first line = headers, second line = row template cells separated by <code>|</code>)</li>';
    html += '</ul>';

    html += '<h3>Header / Footer</h3>';
    html += '<p>Use inline CSS only. Available placeholders:</p>';
    html += '<ul>';
    html += docs.headerFooterVariables.map(v => `<li><code>${escapeHtml(v.placeholder)}</code> - ${escapeHtml(v.description)}</li>`).join('');
    html += '</ul>';
    html += '<p>Common page number pattern: <code>Page &lt;span class="pageNumber"&gt;1&lt;/span&gt; of &lt;span class="totalPages"&gt;1&lt;/span&gt;</code></p>';
    html += '<p><strong>Skip footer on specific pages:</strong> In the Footer tab, enter page numbers like <code>1</code>, <code>1,3,5</code>, or <code>first,last</code> to hide the footer on those pages.</p>';

    html += '<h3>Rich Editor</h3>';
    html += '<p>The editor is always in WYSIWYG mode for HTML content. Use the toolbar to format text, insert tables, images, and page breaks.</p>';
    html += '<p>Table formatting tools include: <strong>Cell Background Color</strong>, <strong>Table Border Color</strong>, and <strong>Table Border Width</strong>.</p>';
    html += '<p>Use the <strong>Page Break</strong> button to insert a page break in your document.</p>';

    html += '<h3>Preview & Download</h3>';
    html += '<p>Click <strong>Preview PDF</strong> to see the rendered PDF in a modal window. Click <strong>Download PDF</strong> to save the PDF file.</p>';

    html += '<h3>Request / Response Details</h3>';
    docs.endpoints.forEach(e => {
      html += `<h4><code>${e.method} ${e.path}</code></h4>`;
      if (e.request) html += `<p><strong>Request:</strong></p><pre>${JSON.stringify(e.request, null, 2)}</pre>`;
      if (e.response) html += `<p><strong>Response:</strong> ${e.response}</p>`;
    });

    container.innerHTML = html;
  } catch (err) {
    console.error('Failed to load docs:', err);
  }
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// CodeMirror hint helper
function showCodeMirrorHint(cm) {
  const mode = cm.getMode().name;
  let hintFn = null;
  if (mode === 'htmlmixed' && CodeMirror.hint.html) hintFn = CodeMirror.hint.html;
  else if (mode === 'css' && CodeMirror.hint.css) hintFn = CodeMirror.hint.css;
  else if (mode === 'javascript' && CodeMirror.hint.javascript) hintFn = CodeMirror.hint.javascript;
  else if (CodeMirror.hint.anyword) hintFn = CodeMirror.hint.anyword;
  if (hintFn) cm.showHint({ hint: hintFn });
}

function initCodeMirror() {
  const commonOpts = {
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    tabSize: 2,
    indentWithTabs: false,
    extraKeys: {
      'Ctrl-Space': showCodeMirrorHint,
      'Tab': function(cm) {
        if (cm.somethingSelected()) {
          cm.indentSelection('add');
        } else {
          cm.replaceSelection('  ', 'end');
        }
      }
    }
  };

  // Data editor (JSON)
  const dataTextarea = document.getElementById('data-editor');
  if (dataTextarea) {
    cmEditors.data = CodeMirror.fromTextArea(dataTextarea, {
      ...commonOpts,
      mode: { name: 'javascript', json: true }
    });
    cmEditors.data.on('change', () => cmEditors.data.save());
  }

  // Refresh after flex layout settles
  setTimeout(() => {
    Object.values(cmEditors).forEach(cm => cm.refresh());
  }, 100);
}

// Init
function init() {
  initCodeMirror();
  initRichEditor('html');
  loadSidebarTemplates();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
