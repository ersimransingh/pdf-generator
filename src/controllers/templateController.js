const TemplateModel = require('../models/templateModel');
const logger = require('../utils/logger');

function parseSampleData(sample_data) {
  let parsed = sample_data;
  if (typeof sample_data === 'string') {
    try {
      parsed = JSON.parse(sample_data);
    } catch (e) {
      // keep as string if not valid JSON
    }
  }
  return parsed;
}

function buildTemplatePayload(body, existing = null) {
  const payload = {};

  const stringFields = ['name', 'description', 'html_content', 'css_content', 'header_html', 'footer_html', 'footer_skip_pages', 'watermark_text', 'watermark_type', 'watermark_image'];
  stringFields.forEach(field => {
    if (body[field] !== undefined) {
      payload[field] = body[field] ? body[field].trim() : null;
    } else if (existing) {
      payload[field] = existing[field];
    }
  });

  if (body.sample_data !== undefined) {
    const parsed = parseSampleData(body.sample_data);
    payload.sample_data = parsed ? JSON.stringify(parsed) : null;
  } else if (existing) {
    payload.sample_data = existing.sample_data;
  }

  if (body.watermark_enabled !== undefined) {
    payload.watermark_enabled = Boolean(body.watermark_enabled);
  } else if (existing) {
    payload.watermark_enabled = existing.watermark_enabled;
  }

  if (body.watermark_options !== undefined) {
    const opts = typeof body.watermark_options === 'string' ? JSON.parse(body.watermark_options) : body.watermark_options;
    payload.watermark_options = opts ? JSON.stringify(opts) : null;
  } else if (existing) {
    payload.watermark_options = existing.watermark_options;
  }

  return payload;
}

const TemplateController = {
  create(req, res, next) {
    try {
      const payload = buildTemplatePayload(req.body);
      const template = TemplateModel.create(payload);
      logger.info('Template created', { templateId: template.id });
      res.status(201).json({ success: true, data: template, error: '' });
    } catch (err) {
      next(err);
    }
  },

  list(req, res, next) {
    try {
      const templates = TemplateModel.findAll();
      res.json({ success: true, data: templates, error: '' });
    } catch (err) {
      next(err);
    }
  },

  getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const template = TemplateModel.findById(id);
      if (!template) {
        return res.status(404).json({ success: false, data: null, error: 'Template not found' });
      }
      res.json({ success: true, data: template, error: '' });
    } catch (err) {
      next(err);
    }
  },

  update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = TemplateModel.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, data: null, error: 'Template not found' });
      }

      const payload = buildTemplatePayload(req.body, existing);
      const template = TemplateModel.update(id, payload);

      logger.info('Template updated', { templateId: id });
      res.json({ success: true, data: template, error: '' });
    } catch (err) {
      next(err);
    }
  },

  delete(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = TemplateModel.delete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, data: null, error: 'Template not found' });
      }
      logger.info('Template deleted', { templateId: id });
      res.json({ success: true, data: { deleted: true }, error: '' });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = TemplateController;
