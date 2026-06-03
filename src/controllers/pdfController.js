const TemplateModel = require('../models/templateModel');
const PdfLogModel = require('../models/pdfLogModel');
const pdfService = require('../services/pdfService');
const logger = require('../utils/logger');

function safeLog(props) {
  try {
    PdfLogModel.create(props);
  } catch (logErr) {
    logger.error('Failed to write PDF log', { error: logErr.message });
  }
}

const PdfController = {
  async generate(req, res, next) {
    const { template_id, data, options } = req.body;
    const id = parseInt(template_id, 10);

    try {
      const template = TemplateModel.findById(id);
      if (!template) {
        safeLog({ template_id: id, status: 'error', error_message: 'Template not found' });
        return res.status(404).json({ success: false, data: null, error: 'Template not found' });
      }

      const mergeData = data || {};
      let templateData = mergeData;
      if (template.sample_data) {
        try {
          const sample = JSON.parse(template.sample_data);
          templateData = { ...sample, ...mergeData };
        } catch (e) {
          // use mergeData as-is
        }
      }

      const pdfOptions = options || {};
      const pdfBuffer = await pdfService.generatePdf(template, templateData, pdfOptions);

      safeLog({ template_id: id, status: 'success', error_message: null });
      logger.info('PDF generated', { templateId: id, size: pdfBuffer.length });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="generated_${id}_${Date.now()}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      safeLog({ template_id: id, status: 'error', error_message: err.message });
      logger.error('PDF generation failed', { templateId: id, error: err.message });
      next(err);
    }
  },

  async generateToFile(req, res, next) {
    const { template_id, data, options } = req.body;
    const id = parseInt(template_id, 10);

    try {
      const template = TemplateModel.findById(id);
      if (!template) {
        safeLog({ template_id: id, status: 'error', error_message: 'Template not found' });
        return res.status(404).json({ success: false, data: null, error: 'Template not found' });
      }

      const mergeData = data || {};
      let templateData = mergeData;
      if (template.sample_data) {
        try {
          const sample = JSON.parse(template.sample_data);
          templateData = { ...sample, ...mergeData };
        } catch (e) {
          // use mergeData as-is
        }
      }

      const pdfOptions = options || {};
      const { filename } = await pdfService.generatePdfToFile(template, templateData, pdfOptions);

      safeLog({ template_id: id, status: 'success', error_message: null });
      logger.info('PDF generated to file', { templateId: id, filename });

      res.json({
        success: true,
        data: {
          download_url: `/uploads/${filename}`,
          filename
        },
        error: ''
      });
    } catch (err) {
      safeLog({ template_id: id, status: 'error', error_message: err.message });
      logger.error('PDF generation to file failed', { templateId: id, error: err.message });
      next(err);
    }
  }
};

module.exports = PdfController;
