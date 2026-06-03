const db = require('../config/database');

const PdfLogModel = {
  create({ template_id, status, error_message }) {
    const stmt = db.prepare(`
      INSERT INTO pdf_logs (template_id, status, error_message)
      VALUES (?, ?, ?)
    `);
    return stmt.run(template_id || null, status, error_message || null);
  },

  findAll(limit = 100) {
    const stmt = db.prepare(`
      SELECT pdf_logs.*, templates.name as template_name
      FROM pdf_logs
      LEFT JOIN templates ON pdf_logs.template_id = templates.id
      ORDER BY pdf_logs.created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
};

module.exports = PdfLogModel;
