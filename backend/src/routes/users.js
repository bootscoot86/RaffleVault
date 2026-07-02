const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireAuth, requireMaster } = require('../middleware/auth');

const router = express.Router();

const PW_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

// GET /api/users — list all admin users (master only)
router.get('/', requireMaster, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, name, email, role, active FROM admin_users ORDER BY role DESC, name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — create a new admin (master only)
router.post('/', requireMaster, async (req, res) => {
  const { username, name, email, password } = req.body;
  if (!username || !name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (!PW_REGEX.test(password))
    return res.status(400).json({ error: 'Password must be 8+ characters with uppercase, number, and special character' });

  try {
    const { rows: count } = await pool.query(`SELECT COUNT(*) as c FROM admin_users WHERE role = 'admin'`);
    if (parseInt(count[0].c) >= 3)
      return res.status(400).json({ error: 'Maximum of 3 regular admin accounts allowed' });

    const { rows: existing } = await pool.query(`SELECT id FROM admin_users WHERE username = $1`, [username]);
    if (existing.length) return res.status(400).json({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO admin_users (username, name, email, password_hash, role, active) VALUES ($1,$2,$3,$4,'admin',true)`,
      [username, name, email, hash]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — update an admin (master only)
router.put('/:id', requireMaster, async (req, res) => {
  const { name, email, active, new_password } = req.body;
  try {
    const { rows } = await pool.query(`SELECT * FROM admin_users WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (rows[0].role === 'master') return res.status(403).json({ error: 'Cannot edit master admin here' });

    if (new_password) {
      if (!PW_REGEX.test(new_password))
        return res.status(400).json({ error: 'Password must be 8+ characters with uppercase, number, and special character' });
      const hash = await bcrypt.hash(new_password, 12);
      await pool.query(`UPDATE admin_users SET name=$1, email=$2, active=$3, password_hash=$4 WHERE id=$5`,
        [name, email, active, hash, req.params.id]);
    } else {
      await pool.query(`UPDATE admin_users SET name=$1, email=$2, active=$3 WHERE id=$4`,
        [name, email, active, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
