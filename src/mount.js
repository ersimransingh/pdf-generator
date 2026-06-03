'use strict';

const express = require('express');
const path = require('path');

const PDF_GEN_ROOT = path.resolve(__dirname, '..');

// Resolve DB path to absolute BEFORE any module that reads DB_PATH is required.
// Without this, better-sqlite3 would resolve ./data/database.sqlite relative to
// whatever the main server's CWD is (jarvis_backend) instead of pdfgenerator/.
if (!process.env.PDF_GEN_DB_PATH) {
    process.env.PDF_GEN_DB_PATH = path.join(PDF_GEN_ROOT, 'data', 'database.sqlite');
}
// Override DB_PATH so the existing database.js config picks it up.
process.env.DB_PATH = process.env.PDF_GEN_DB_PATH;

const { seedDatabase } = require('./utils/seedData');
const templateRoutes = require('./routes/templateRoutes');
const pdfRoutes     = require('./routes/pdfRoutes');
const { getDocs }   = require('./controllers/docsController');
const errorHandler  = require('./middleware/errorHandler');

const router = express.Router();

// ── Static files ──────────────────────────────────────────────────────────────
// Served at  /pdfgenerator/public/...  and  /pdfgenerator/uploads/...
// The HTML uses <base href="/pdfgenerator/"> + relative paths, so these resolve correctly.
router.use('/uploads', express.static(path.join(PDF_GEN_ROOT, 'uploads')));
router.use('/public',  express.static(path.join(PDF_GEN_ROOT, 'public')));

// ── Admin UI ──────────────────────────────────────────────────────────────────
router.get('/', (_req, res) => {
    res.sendFile(path.join(PDF_GEN_ROOT, 'views', 'index.html'));
});

// ── API routes ────────────────────────────────────────────────────────────────
router.use('/api/templates', templateRoutes);
router.use('/api',           pdfRoutes);
router.get('/api/docs',      getDocs);

// ── Error handling ────────────────────────────────────────────────────────────
router.use(errorHandler);

// Seed the SQLite database once on mount (no-op if already seeded).
seedDatabase();

module.exports = router;
