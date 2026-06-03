const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./config/database');
const { seedDatabase } = require('./utils/seedData');
const templateRoutes = require('./routes/templateRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const { getDocs } = require('./controllers/docsController');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Admin panel
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'));
});

// API routes
app.use('/api/templates', templateRoutes);
app.use('/api', pdfRoutes);
app.get('/api/docs', getDocs);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, data: null, error: 'Endpoint not found' });
});

// Cleanup on exit
process.on('SIGINT', () => {
  logger.info('Shutting down server...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down server...');
  db.close();
  process.exit(0);
});

// Seed database
seedDatabase();

app.listen(PORT, () => {
  logger.info(`PDF Generator SaaS running on http://localhost:${PORT}`);
});

module.exports = app;
