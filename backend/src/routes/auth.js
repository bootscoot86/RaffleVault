const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');
const { log } = require('../middleware/auditLog');
const { requireAuth, requireMaster } = require('../middleware/auth');

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 60 * 1000 // 30 minutes
};

function getToken(req) {
  return req.cookies?.rv_token || req.headers.authorization?.split(' ')[1];
}

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;

  const { rows } = await pool.query(
    'SELECT * FROM admin_users WHERE username = $1 AND active = true',
    [username]
  );

  if (!rows.length) {
    await log(null, 'LOGIN_FAILED', { username, reason: 'User not found' }, ip);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    await log(user.id, 'LOGIN_FAILED', { username, reason: 'Wrong password' }, ip);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Check password age — expire after 90 days
  const PASSWORD_MAX_DAYS = 90;
  const lastChanged = user.password_changed_at || user.created_at;
  const daysSinceChange = Math.floor((Date.now() - new Date(lastChanged)) / (1000 * 60 * 60 * 24));
  const passwordExpired = daysSinceChange >= PASSWORD_MAX_DAYS;
  const daysUntilExpiry = Math.max(0, PASSWORD_MAX_DAYS - daysSinceChange);
  const mustChangePassword = user.must_change_password || passwordExpired;

  if (passwordExpired) {
    await log(user.id, 'PASSWORD_EXPIRED', { username, days_since_change: daysSinceChange }, ip);
  }

  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    { userId: user.id, username: user.username, name: user.name, role: user.role, jti, must_change_password: mustChangePassword },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );

  // Set token as httpOnly cookie — JS cannot read this
  res.cookie('rv_token', token, COOKIE_OPTS);

  await log(user.id, 'LOGIN', { username }, ip);
  res.json({ name: user.name, role: user.role, must_change_password: mustChangePassword, days_until_expiry: daysUntilExpiry });
});

// Logout — blocklist the token and clear cookie
router.post('/logout', requireAuth, async (req, res) => {
  // Add jti to blocklist so this token can't be reused even before expiry
  if (req.admin.jti) {
    const expiresAt = new Date(req.admin.exp * 1000);
    await pool.query(
      'INSERT INTO token_blocklist (jti, expires_at) VALUES ($1,$2) ON CONFLICT (jti) DO NOTHING',
      [req.admin.jti, expiresAt]
    );
    // Clean up expired blocklist entries while we're here
    await pool.query('DELETE FROM token_blocklist WHERE expires_at < NOW()');
  }
  res.clearCookie('rv_token', COOKIE_OPTS);
  await log(req.admin.userId, 'LOGOUT', { username: req.admin.username }, req.ip);
  res.json({ success: true });
});

// Get all admin users (master only)
router.get('/users', requireMaster, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, name, email, role, active, created_at FROM admin_users ORDER BY role DESC, id ASC'
  );
  res.json(rows);
});

// Create admin user (master only) — generates a one-time temp password
router.post('/users', requireMaster, async (req, res) => {
  const { username, name, email } = req.body;
  if (!username || !name || !email) {
    return res.status(400).json({ error: 'Username, name, and email are required' });
  }
  const { rows: existing } = await pool.query('SELECT id FROM admin_users WHERE username=$1', [username]);
  if (existing.length) return res.status(400).json({ error: 'Username already taken' });

  const { rows: count } = await pool.query("SELECT COUNT(*) as c FROM admin_users WHERE role='admin'");
  if (parseInt(count[0].c) >= 3) return res.status(400).json({ error: 'Maximum of 3 regular admin accounts allowed' });

  // Generate a random temp password
  const crypto = require('crypto');
  const tempPassword = 'Tmp-' + crypto.randomBytes(5).toString('hex');
  const hash = await bcrypt.hash(tempPassword, 12);

  const { rows } = await pool.query(
    'INSERT INTO admin_users (username, name, email, password_hash, role, must_change_password) VALUES ($1,$2,$3,$4,$5,true) RETURNING id, username, name, email, role, active',
    [username, name, email, hash, 'admin']
  );
  await log(req.admin.userId, 'ADMIN_USER_CREATED', { new_user: username }, req.ip);
  res.status(201).json({ ...rows[0], temp_password: tempPassword });
});

// Update admin user (master only)
router.put('/users/:id', requireMaster, async (req, res) => {
  const { name, email, active, new_password } = req.body;
  if (new_password) {
    const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
    if (!pwRegex.test(new_password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character' });
    }
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE admin_users SET name=$1, email=$2, active=$3, password_hash=$4 WHERE id=$5',
      [name, email, active, hash, req.params.id]
    );
  } else {
    await pool.query(
      'UPDATE admin_users SET name=$1, email=$2, active=$3 WHERE id=$4',
      [name, email, active, req.params.id]
    );
  }
  await log(req.admin.userId, 'ADMIN_USER_UPDATED', { updated_user_id: req.params.id }, req.ip);
  res.json({ success: true });
});

// Delete admin user (master only)
router.delete('/users/:id', requireMaster, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM admin_users WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  if (rows[0].role === 'master') return res.status(403).json({ error: 'Cannot delete master admin' });
  await pool.query('UPDATE raffles SET created_by=NULL WHERE created_by=$1', [req.params.id]);
  await pool.query('UPDATE winners SET drawn_by=NULL WHERE drawn_by=$1', [req.params.id]);
  await pool.query('UPDATE winners SET notification_sent_by=NULL WHERE notification_sent_by=$1', [req.params.id]);
  await pool.query('UPDATE winners SET second_draw_authorized_by=NULL WHERE second_draw_authorized_by=$1', [req.params.id]);
  await pool.query('UPDATE audit_log SET admin_id=NULL WHERE admin_id=$1', [req.params.id]);
  await pool.query('UPDATE duplicate_flags SET overridden_by=NULL WHERE overridden_by=$1', [req.params.id]);
  await pool.query('DELETE FROM admin_users WHERE id=$1', [req.params.id]);
  await log(req.admin.userId, 'ADMIN_USER_DELETED', { deleted_user: rows[0].username }, req.ip);
  res.json({ success: true });
});

// Transfer master admin role (master only)
router.post('/transfer-master', requireMaster, async (req, res) => {
  const { new_master_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE admin_users SET role=$1 WHERE id=$2', ['admin', req.admin.userId]);
    await client.query('UPDATE admin_users SET role=$1 WHERE id=$2', ['master', new_master_id]);
    await client.query('COMMIT');
    await log(req.admin.userId, 'MASTER_TRANSFER', { from: req.admin.userId, to: new_master_id }, req.ip);
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Transfer failed' });
  } finally {
    client.release();
  }
});

// First-time password set (no current password required — must_change_password must be true)
router.post('/set-password', requireAuth, async (req, res) => {
  const { new_password } = req.body;
  const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
  if (!pwRegex.test(new_password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character' });
  }
  const { rows } = await pool.query('SELECT * FROM admin_users WHERE id=$1', [req.admin.userId]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  if (!rows[0].must_change_password) return res.status(403).json({ error: 'Not required' });
  const hash = await bcrypt.hash(new_password, 12);
  await pool.query('UPDATE admin_users SET password_hash=$1, must_change_password=false, password_changed_at=NOW() WHERE id=$2', [hash, req.admin.userId]);

  // Issue a fresh token — must_change_password cleared
  const jti = crypto.randomBytes(16).toString('hex');
  const newToken = jwt.sign(
    { userId: rows[0].id, username: rows[0].username, name: rows[0].name, role: rows[0].role, jti, must_change_password: false },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
  res.cookie('rv_token', newToken, COOKIE_OPTS);

  await log(req.admin.userId, 'PASSWORD_CHANGED', { first_time: true }, req.ip);
  res.json({ success: true });
});

// Change own password
router.put('/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
  if (!pwRegex.test(new_password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character' });
  }
  const { rows } = await pool.query('SELECT * FROM admin_users WHERE id=$1', [req.admin.userId]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  const valid = await bcrypt.compare(current_password, rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
  const hash = await bcrypt.hash(new_password, 12);
  await pool.query('UPDATE admin_users SET password_hash=$1, must_change_password=false, password_changed_at=NOW() WHERE id=$2', [hash, req.admin.userId]);
  await log(req.admin.userId, 'PASSWORD_CHANGED', {}, req.ip);
  res.json({ success: true });
});

// Audit log (master only)
router.get('/audit', requireMaster, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, u.username AS admin_username
     FROM audit_log a
     LEFT JOIN admin_users u ON a.admin_id = u.id
     ORDER BY a.created_at DESC
     LIMIT 2000`
  );
  res.json(rows);
});

// Recovery code reset
router.post('/recover', async (req, res) => {
  const { recovery_code, new_username, new_password, new_name, new_email } = req.body;
  const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
  if (!pwRegex.test(new_password)) {
    return res.status(400).json({ error: 'Password must meet strength requirements' });
  }
  const { rows } = await pool.query('SELECT * FROM recovery_codes WHERE used = false ORDER BY id DESC LIMIT 1');
  if (!rows.length) return res.status(400).json({ error: 'No valid recovery code found' });
  const valid = await bcrypt.compare(recovery_code, rows[0].code_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid recovery code' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Disable current master
    await client.query("UPDATE admin_users SET active=false WHERE role='master'");
    // Create new master
    const hash = await bcrypt.hash(new_password, 12);
    await client.query(
      'INSERT INTO admin_users (username, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
      [new_username, new_name, new_email, hash, 'master']
    );
    // Mark recovery code used
    await client.query('UPDATE recovery_codes SET used=true, used_at=NOW() WHERE id=$1', [rows[0].id]);
    await client.query('COMMIT');
    await log(null, 'RECOVERY_CODE_USED', { new_master: new_username }, req.ip);
    res.json({ success: true, message: 'Master admin account reset. Please generate a new recovery code from settings.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Recovery failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
