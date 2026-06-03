const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_PATH = path.resolve(process.env.DB_PATH || './data/database.sqlite');
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      html_content TEXT NOT NULL,
      css_content TEXT,
      sample_data TEXT,
      header_html TEXT,
      footer_html TEXT,
      watermark_text TEXT,
      watermark_enabled INTEGER DEFAULT 0,
      watermark_options TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pdf_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);
    CREATE INDEX IF NOT EXISTS idx_pdf_logs_template_id ON pdf_logs(template_id);
    CREATE INDEX IF NOT EXISTS idx_pdf_logs_created_at ON pdf_logs(created_at);
  `);
}

function migrateSchema() {
  const columns = db.prepare("PRAGMA table_info(templates)").all();
  const colNames = columns.map(c => c.name);

  if (!colNames.includes('header_html')) {
    db.exec('ALTER TABLE templates ADD COLUMN header_html TEXT');
  }
  if (!colNames.includes('footer_html')) {
    db.exec('ALTER TABLE templates ADD COLUMN footer_html TEXT');
  }
  if (!colNames.includes('watermark_text')) {
    db.exec('ALTER TABLE templates ADD COLUMN watermark_text TEXT');
  }
  if (!colNames.includes('watermark_enabled')) {
    db.exec('ALTER TABLE templates ADD COLUMN watermark_enabled INTEGER DEFAULT 0');
  }
  if (!colNames.includes('watermark_options')) {
    db.exec('ALTER TABLE templates ADD COLUMN watermark_options TEXT');
  }
  if (!colNames.includes('watermark_type')) {
    db.exec('ALTER TABLE templates ADD COLUMN watermark_type TEXT DEFAULT \'text\'');
  }
  if (!colNames.includes('watermark_image')) {
    db.exec('ALTER TABLE templates ADD COLUMN watermark_image TEXT');
  }
  if (!colNames.includes('footer_skip_pages')) {
    db.exec('ALTER TABLE templates ADD COLUMN footer_skip_pages TEXT');
  }
}

initSchema();
migrateSchema();

module.exports = db;
