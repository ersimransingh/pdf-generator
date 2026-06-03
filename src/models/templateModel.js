const db = require('../config/database');

const TemplateModel = {
  create({ name, description, html_content, css_content, sample_data, header_html, footer_html, footer_skip_pages, watermark_text, watermark_enabled, watermark_options, watermark_type, watermark_image }) {
    const stmt = db.prepare(`
      INSERT INTO templates (name, description, html_content, css_content, sample_data, header_html, footer_html, footer_skip_pages, watermark_text, watermark_enabled, watermark_options, watermark_type, watermark_image, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const result = stmt.run(
      name,
      description || null,
      html_content,
      css_content || null,
      sample_data || null,
      header_html || null,
      footer_html || null,
      footer_skip_pages || null,
      watermark_text || null,
      watermark_enabled ? 1 : 0,
      watermark_options || null,
      watermark_type || 'text',
      watermark_image || null
    );
    return this.findById(result.lastInsertRowid);
  },

  findAll() {
    const stmt = db.prepare('SELECT id, name, description, sample_data, header_html, footer_html, footer_skip_pages, watermark_text, watermark_enabled, watermark_type, watermark_image, created_at, updated_at FROM templates ORDER BY created_at DESC');
    return stmt.all();
  },

  findById(id) {
    const stmt = db.prepare('SELECT * FROM templates WHERE id = ?');
    return stmt.get(id);
  },

  update(id, { name, description, html_content, css_content, sample_data, header_html, footer_html, footer_skip_pages, watermark_text, watermark_enabled, watermark_options, watermark_type, watermark_image }) {
    const stmt = db.prepare(`
      UPDATE templates
      SET name = ?, description = ?, html_content = ?, css_content = ?, sample_data = ?, header_html = ?, footer_html = ?, footer_skip_pages = ?, watermark_text = ?, watermark_enabled = ?, watermark_options = ?, watermark_type = ?, watermark_image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(
      name,
      description || null,
      html_content,
      css_content || null,
      sample_data || null,
      header_html || null,
      footer_html || null,
      footer_skip_pages !== undefined ? (footer_skip_pages ? footer_skip_pages.trim() : null) : undefined,
      watermark_text || null,
      watermark_enabled !== undefined ? (watermark_enabled ? 1 : 0) : undefined,
      watermark_options || null,
      watermark_type || 'text',
      watermark_image || null,
      id
    );
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  delete(id) {
    const stmt = db.prepare('DELETE FROM templates WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
};

module.exports = TemplateModel;
