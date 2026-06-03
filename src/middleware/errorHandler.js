const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('API Error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      data: null,
      error: err.message || 'Validation failed'
    });
  }

  if (err.message && err.message.includes('not found')) {
    return res.status(404).json({
      success: false,
      data: null,
      error: err.message
    });
  }

  res.status(err.status || 500).json({
    success: false,
    data: null,
    error: err.message || 'Internal server error'
  });
}

module.exports = errorHandler;
