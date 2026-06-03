function getTimestamp() {
  return new Date().toISOString();
}

function info(message, meta = {}) {
  console.log(`[${getTimestamp()}] INFO: ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
}

function error(message, meta = {}) {
  console.error(`[${getTimestamp()}] ERROR: ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
}

function warn(message, meta = {}) {
  console.warn(`[${getTimestamp()}] WARN: ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
}

module.exports = { info, error, warn };
