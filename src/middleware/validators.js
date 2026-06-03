const { sanitizeHtml, sanitizeCss } = require('../utils/templateEngine');

function validateCreateTemplate(req, res, next) {
  const { name, html_content } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name is required and must be a non-empty string');
  }

  if (!html_content || typeof html_content !== 'string' || html_content.trim().length === 0) {
    errors.push('html_content is required and must be a non-empty string');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: errors.join('; ')
    });
  }

  // Sanitize inputs
  req.body.html_content = sanitizeHtml(req.body.html_content);
  if (req.body.css_content) {
    req.body.css_content = sanitizeCss(req.body.css_content);
  }
  if (req.body.header_html) {
    req.body.header_html = sanitizeHtml(req.body.header_html);
  }
  if (req.body.footer_html) {
    req.body.footer_html = sanitizeHtml(req.body.footer_html);
  }

  next();
}

function validateUpdateTemplate(req, res, next) {
  const { name, html_content } = req.body;
  const errors = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    errors.push('name must be a non-empty string');
  }

  if (html_content !== undefined && (typeof html_content !== 'string' || html_content.trim().length === 0)) {
    errors.push('html_content must be a non-empty string');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: errors.join('; ')
    });
  }

  if (req.body.html_content) {
    req.body.html_content = sanitizeHtml(req.body.html_content);
  }
  if (req.body.css_content) {
    req.body.css_content = sanitizeCss(req.body.css_content);
  }
  if (req.body.header_html) {
    req.body.header_html = sanitizeHtml(req.body.header_html);
  }
  if (req.body.footer_html) {
    req.body.footer_html = sanitizeHtml(req.body.footer_html);
  }

  next();
}

function validateGeneratePdf(req, res, next) {
  const { template_id, data } = req.body;
  const errors = [];

  if (template_id === undefined || template_id === null) {
    errors.push('template_id is required');
  } else if (!Number.isInteger(Number(template_id)) || Number(template_id) <= 0) {
    errors.push('template_id must be a positive integer');
  }

  if (data !== undefined && data !== null && typeof data !== 'object') {
    errors.push('data must be an object');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: errors.join('; ')
    });
  }

  next();
}

module.exports = {
  validateCreateTemplate,
  validateUpdateTemplate,
  validateGeneratePdf
};
