const express = require('express');
const router = express.Router();
const PdfController = require('../controllers/pdfController');
const { validateGeneratePdf } = require('../middleware/validators');

router.post('/generate-pdf', validateGeneratePdf, PdfController.generate);
router.post('/generate-pdf-file', validateGeneratePdf, PdfController.generateToFile);

module.exports = router;
