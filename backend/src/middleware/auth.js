const jwt = require('jsonwebtoken');
const { pool } = require('../db');

function getToken(req) {
  // Prefer httpOnly cookie, fall back to Authorization header for backward compat
  return req.cookies?.rv_token || req.headers.authorization?.split(' ')[1];
}

async function isBlocklisted(jti) {
  if (!jti) return false;
  const { rows } = await pool.query(
    'SELECT id FROM token_blocklist WHERE jti=$1 AND expires_at > NOW()',
    [jti]
  );
  return rows.length > 0;
}

async function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (await isBlocklisted(decoded.jti)) {
      return res.status(401).json({ error: 'Session has been logged out' });
    }
    // Block all routes except set-password for accounts that must change password
    if (decoded.must_change_password && !req.originalUrl.includes('/auth/set-password')) {
      return res.status(403).json({ error: 'Password change required', must_change_password: true });
    }
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function requireMaster(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (await isBlocklisted(decoded.jti)) {
      return res.status(401).json({ error: 'Session has been logged out' });
    }
    if (decoded.role !== 'master') return res.status(403).json({ error: 'Master admin access required' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth, requireMaster };
