const validator = require('validator');

// Recursively sanitize all string values in an object
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Trim whitespace and escape HTML entities
      clean[key] = validator.escape(validator.trim(value));
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeObject(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// Middleware — sanitizes req.body in place
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

// Fields that should NOT be escaped (passwords, keys — escaping breaks them)
const SKIP_SANITIZE_FIELDS = ['password', 'new_password', 'current_password', 'master_password', 'master_confirm', 'smtp_pass', 'stripe_secret_key', 'stripe_public_key', 'recovery_code'];

function sanitizeBodySafe(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (SKIP_SANITIZE_FIELDS.includes(key)) {
        clean[key] = value; // leave sensitive fields untouched
      } else if (typeof value === 'string') {
        clean[key] = validator.escape(validator.trim(value));
      } else {
        clean[key] = value;
      }
    }
    req.body = clean;
  }
  next();
}

module.exports = { sanitizeBody, sanitizeBodySafe };
