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

  function buildRowsHtml(items) {
    return items.length
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
  }

  function attachRowHandlers() {
    el.querySelectorAll('.vp-row').forEach(row => {
      row.addEventListener('mouseenter', () => { row.style.background = '#f8fafc'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', () => {
        navigator.clipboard.writeText(row.dataset.insert).then(() => {
          showToast(`Copied: ${row.dataset.insert}`, 'success');
        }).catch(() => {
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
  }

  function render(vars) {
    // Build the full panel structure once — input element is never rebuilt after this
    el.innerHTML = `
      <div style="padding:12px 14px 8px;border-bottom:1px solid #f1f5f9;flex-shrink:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;font-weight:600;color:#1e293b;">Insert Variable</span>
          <button id="vp-close" style="background:none;border:none;cursor:pointer;font-size:16px;color:#94a3b8;line-height:1;padding:0 2px;">&#10005;</button>
        </div>
        <input id="vp-search" type="text" placeholder="Search variables…"
               style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;outline:none;">
      </div>
      <div style="display:flex;gap:10px;padding:6px 10px 4px;flex-shrink:0;">
        <span style="font-size:10px;color:#2563eb;">■ VAR = value</span>
        <span style="font-size:10px;color:#7c3aed;">■ ROW = table row field</span>
        <span style="font-size:10px;color:#059669;">■ ARR = array</span>
      </div>
      <div id="vp-list" style="overflow-y:auto;flex:1;padding:4px 6px 8px;">${buildRowsHtml(buildList(vars, ''))}</div>`;

    el.querySelector('#vp-close').onclick = () => { el.style.display = 'none'; };

    const searchEl = el.querySelector('#vp-search');

    // On each keystroke: update ONLY the list — never touch the input element
    searchEl.addEventListener('input', e => {
      el.querySelector('#vp-list').innerHTML = buildRowsHtml(buildList(vars, e.target.value));
      attachRowHandlers();
    });
    searchEl.addEventListener('keydown', e => { if (e.key === 'Escape') el.style.display = 'none'; });

    attachRowHandlers();

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
    render(vars);

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
    const existing = editors[target].value || '';
    const spacer = existing.trim() !== '' ? '&nbsp;' : '';
    editors[target].value = existing.trim() === '' ? snippet : existing + spacer + snippet;
  });
});

function registerJoditControls() {
  Jodit.modules.Icon.set('tableBorderToggle',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>'
  );
  Jodit.modules.Icon.set('pageBreak',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 15h16v2H4zm0 4h16v2H4zM4 5h16v2H4zm0 4h16v2H4zm0-8h16v2H4zm0 4h5v2H4zm11 0h5v2h-5z"/></svg>'
  );

  Jodit.defaultOptions.controls.tableBorderToggle = {
    tooltip: 'Toggle borders on selected table',
    icon: 'tableBorderToggle',
    exec(editor) {
      const cur = editor.s.current();
      if (!cur) { showToast('Place your cursor inside a table first', 'warning'); return; }
      let node = cur.nodeType === 1 ? cur : cur.parentElement;
      let table = null;
      while (node && node !== editor.editor) {
        if (node.nodeName === 'TABLE') { table = node; break; }
        node = node.parentElement;
      }
      if (!table) { showToast('Place your cursor inside a table first', 'warning'); return; }
      const cells = table.querySelectorAll('td, th');
      if (!cells.length) return;
      const bordersOff = cells[0].style.border === 'none' || cells[0].style.borderStyle === 'none';
      cells.forEach(cell => {
        cell.style.border = bordersOff ? '1px solid #000' : 'none';
      });
    }
  };

  Jodit.defaultOptions.controls.pageBreak = {
    tooltip: 'Insert Page Break',
    icon: 'pageBreak',
    exec(editor) {
      editor.s.insertHTML('<div style="page-break-after:always;height:0;border-top:2px dashed #94a3b8;margin:8px 0;"></div>');
    }
  };
}

function initRichEditor(key) {
  try {
    if (!editors[key]) {
      const config = {
        height: '100%',
        minHeight: 300,
        buttons: [
          'undo', 'redo', '|',
          'bold', 'strikethrough', 'underline', 'italic', '|',
          'superscript', 'subscript', '|',
          'font', 'fontsize', 'brush', 'paragraph', '|',
          'align', 'ul', 'ol', '|',
          'outdent', 'indent', '|',
          'hr', 'table', 'tableBorderToggle', '|',
          'link', 'image', '|',
          'eraser', 'copyformat', '|',
          'symbols', '|',
          'pageBreak', '|',
          'fullsize', 'source', 'preview', 'print'
        ],
        uploader: {
          insertImageAsBase64URI: true
        },
        createAttributes: {
          table: { style: 'border-collapse:collapse;width:100%' },
          td:    { style: 'border:1px solid #000;padding:8px' },
          th:    { style: 'border:1px solid #000;padding:8px;font-weight:bold;background:#f8fafc' }
        },
        cleanHTML: {
          timeout: 300,
          denyTags: false,
          allowTags: false,
          fillEmptyParagraph: false,
          replaceNBSP: false
        },
        askBeforePasteHTML: false,
        askBeforePasteFromWord: false,
        processPasteHTML: false,
        disablePlugins: ['speechRecognize'],
        placeholder: key === 'html' ? 'Start typing...' : `${key} HTML...`
      };

      editors[key] = Jodit.make(`#${key}-rich-editor`, config);
      if (pendingEditorContent[key] !== undefined) {
        editors[key].value = pendingEditorContent[key];
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
      editors[key].value = '';
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
      let content = editors[key].value || '';
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
    if (editors[key]) {
      editors[key].value = content;
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

function evaluateMathExpr(expr) {
  const sanitized = String(expr).replace(/[^0-9+\-*/.() \t]/g, '').trim();
  if (!sanitized) return '0';
  try {
    const result = new Function('return (' + sanitized + ')')(); // eslint-disable-line no-new-func
    if (typeof result !== 'number' || !isFinite(result)) return '0';
    return parseFloat(result.toFixed(10)).toString();
  } catch (e) {
    return 'NaN';
  }
}

function processMathExpressions(html, data, loopContext) {
  if (!html || !html.includes('#$math(')) return html;
  let result = '';
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf('#$math(', i);
    if (start === -1) { result += html.slice(i); break; }
    result += html.slice(i, start);
    // Track parenthesis depth to find the matching closing paren
    let depth = 1;
    let j = start + 7;
    while (j < html.length && depth > 0) {
      if (html[j] === '(') depth++;
      else if (html[j] === ')') depth--;
      if (depth > 0) j++;
    }
    if (depth !== 0) { result += '#$math('; i = start + 7; continue; }
    const expression = html.slice(start + 7, j);
    // Resolve [[${varName}]] references to their numeric values
    const resolvedExpr = expression.replace(/\[\[\$\{([\w.@]+)\}\]\]/g, (_, varPath) => {
      const val = resolveVariable(varPath, data, loopContext);
      const num = parseFloat(String(val));
      return isNaN(num) ? '0' : String(num);
    });
    result += evaluateMathExpr(resolvedExpr);
    i = j + 1;
  }
  return result;
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

  rendered = processMathExpressions(rendered, data, loopContext);

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

  const editorCompatCss = `
    body { margin: 0; padding: 0; }
    p { margin: 0; padding: 0; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #000; padding: 8px; word-break: break-word; }
    img { max-width: 100%; height: auto; }
    iframe { max-width: 100%; }
  `;

  let fullHtml = rendered;
  const allCss = (css && css.trim() ? css.trim() + '\n' : '') + editorCompatCss;
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
    html += '<h3>Math Expressions</h3>';
    html += '<p>Use <code>#$math(expression)</code> to evaluate arithmetic. Reference variables inside with <code>[[${varName}]]</code> (values are coerced to numbers; non-numeric values become <code>0</code>).</p>';
    html += '<pre>#$math([[${price}]] * [[${qty}]])\n#$math([[${subtotal}]] + [[${tax}]] - [[${discount}]])\n#$math(([[${a}]] + [[${b}]]) / 2)</pre>';
    html += '<p>Supports <code>+ - * / ()</code>. The result is a plain number (trailing zeros removed). Works inside <code>{{#each}}</code> loops — loop-item variables resolve correctly.</p>';

    html += '<h3>Header / Footer</h3>';
    html += '<p>Use inline CSS only. Available placeholders:</p>';
    html += '<ul>';
    html += docs.headerFooterVariables.map(v => `<li><code>${escapeHtml(v.placeholder)}</code> - ${escapeHtml(v.description)}</li>`).join('');
    html += '</ul>';
    html += '<p>Common page number pattern: <code>Page &lt;span class="pageNumber"&gt;1&lt;/span&gt; of &lt;span class="totalPages"&gt;1&lt;/span&gt;</code></p>';
    html += '<p><strong>Skip footer on specific pages:</strong> In the Footer tab, enter page numbers like <code>1</code>, <code>1,3,5</code>, or <code>first,last</code> to hide the footer on those pages.</p>';

    html += '<h3>Rich Editor</h3>';
    html += '<p>The editor is always in WYSIWYG mode for HTML content. Use the toolbar to format text, insert tables, images, and page breaks.</p>';
    html += '<p>Table tools: right-click any table cell to access <strong>Cell Properties</strong> (background color, borders, padding) and <strong>Table Properties</strong> (width, alignment, borders). Drag column borders to resize columns.</p>';
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
  registerJoditControls();
  initCodeMirror();
  initRichEditor('html');
  loadSidebarTemplates();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
