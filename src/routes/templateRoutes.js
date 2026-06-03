const express = require('express');
const router = express.Router();
const TemplateController = require('../controllers/templateController');
const { validateCreateTemplate, validateUpdateTemplate } = require('../middleware/validators');

router.post('/', validateCreateTemplate, TemplateController.create);
router.get('/', TemplateController.list);
router.get('/:id', TemplateController.getById);
router.put('/:id', validateUpdateTemplate, TemplateController.update);
router.delete('/:id', TemplateController.delete);

module.exports = router;
