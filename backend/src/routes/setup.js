const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db');
const { DISCLAIMER_TEXT } = require('./legal');
const { sendDisclaimerAcknowledgment } = require('../email');

// Check if setup has been completed
router.get('/status', async (req, res) => {
  const { rows } = await pool.query(
    "SELECT value FROM site_settings WHERE key = 'setup_complete'"
  );
  res.json({ setup_complete: rows.length > 0 && rows[0].value === 'true' });
});

// Complete initial setup
router.post('/', async (req, res) => {
  // Ensure setup hasn't already been done
  const { rows: existing } = await pool.query(
    "SELECT value FROM site_settings WHERE key = 'setup_complete'"
  );
  if (existing.length > 0 && existing[0].value === 'true') {
    return res.status(400).json({ error: 'Setup already completed' });
  }

  const {
    org_name, org_email, org_phone, org_address, org_website,
    site_title, tagline,
    master_username, master_name, master_email, master_password,
    smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from
  } = req.body;

  // Save organization settings
  const settings = {
    org_name, org_email, org_phone, org_address, org_website,
    site_title: site_title || org_name + ' Raffle',
    tagline: tagline || 'Supporting our community',
    smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
    setup_complete: 'true'
  };

  for (const [key, value] of Object.entries(settings)) {
    await pool.query(
      'INSERT INTO site_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
      [key, value || '']
    );
  }

  // Create master admin account
  const hash = await bcrypt.hash(master_password, 12);
  await pool.query(
    'INSERT INTO admin_users (username, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
    [master_username, master_name, master_email, hash, 'master']
  );

  // Save disclaimer acknowledgment — master admin accepted during setup
  const acknowledged_at = new Date();
  const ip = req.ip;
  await pool.query(
    `INSERT INTO disclaimer_acknowledgments (org_name, admin_name, admin_username, admin_email, ip_address, acknowledged_at, disclaimer_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [org_name, master_name, master_username, master_email, ip, acknowledged_at, DISCLAIMER_TEXT]
  );
  sendDisclaimerAcknowledgment({
    org_name, admin_name: master_name, admin_username: master_username,
    admin_email: master_email, ip_address: ip, acknowledged_at, disclaimer_text: DISCLAIMER_TEXT
  }).catch(err => console.error('Disclaimer email failed:', err));

  // Generate recovery code
  const recoveryCode = [
    crypto.randomBytes(3).toString('hex').toUpperCase(),
    crypto.randomBytes(3).toString('hex').toUpperCase(),
    crypto.randomBytes(3).toString('hex').toUpperCase(),
    crypto.randomBytes(3).toString('hex').toUpperCase()
  ].join('-');

  const recoveryHash = await bcrypt.hash(recoveryCode, 12);
  await pool.query(
    'INSERT INTO recovery_codes (code_hash) VALUES ($1)',
    [recoveryHash]
  );

  res.json({
    success: true,
    recovery_code: recoveryCode,
    org_name,
    generated_at: new Date().toLocaleDateString()
  });
});

module.exports = router;
