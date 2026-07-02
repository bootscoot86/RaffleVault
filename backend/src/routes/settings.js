const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { pool } = require('../db');
const { requireAuth, requireMaster } = require('../middleware/auth');
const { log } = require('../middleware/auditLog');
const nodemailer = require('nodemailer');

// Memory storage — re-encode through Sharp before saving so any embedded payloads are stripped
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Get public settings (org info only)
router.get('/public', async (req, res) => {
  const { rows } = await pool.query(
    "SELECT key, value FROM site_settings WHERE key IN ('org_name','org_email','org_phone','org_address','org_website','site_title','tagline','logo_url','primary_color','footer_text','maintenance_mode','disclaimer')"
  );
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

// Get all settings (any admin)
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM site_settings');
  const settings = {};
  rows.forEach(r => {
    // Hide sensitive keys from non-master admins
    if ((r.key === 'smtp_pass' || r.key === 'stripe_secret_key') && req.admin.role !== 'master') {
      settings[r.key] = '••••••••';
    } else {
      settings[r.key] = r.value;
    }
  });
  res.json(settings);
});

// Update settings (master only)
router.put('/', requireMaster, upload.single('logo'), async (req, res) => {
  const updates = { ...req.body };
  if (req.file) {
    const filename = `logo-${Date.now()}.png`;
    const dest = path.join(__dirname, '../../uploads', filename);
    // Re-encode through Sharp — strips any embedded payloads, normalizes to PNG
    await sharp(req.file.buffer).resize({ width: 400, height: 200, fit: 'inside', withoutEnlargement: true }).png().toFile(dest);
    updates.logo_url = `/uploads/${filename}`;
  }

  // Save disclaimer version history before updating
  if (updates.disclaimer) {
    const { rows } = await pool.query("SELECT value FROM site_settings WHERE key='disclaimer'");
    if (rows.length && rows[0].value) {
      await log(req.admin.userId, 'DISCLAIMER_CHANGED', {
        previous: rows[0].value,
        new: updates.disclaimer
      }, req.ip);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    await pool.query(
      'INSERT INTO site_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
      [key, value]
    );
  }

  await log(req.admin.userId, 'SETTINGS_UPDATED', { keys: Object.keys(updates) }, req.ip);
  res.json({ success: true });
});

// Toggle maintenance mode (master only)
router.post('/maintenance', requireMaster, async (req, res) => {
  const { enabled } = req.body;
  await pool.query(
    "INSERT INTO site_settings (key, value) VALUES ('maintenance_mode',$1) ON CONFLICT (key) DO UPDATE SET value=$1",
    [enabled ? 'true' : 'false']
  );
  await log(req.admin.userId, enabled ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF', {}, req.ip);
  res.json({ success: true });
});

// Test SMTP (Simple Mail Transfer Protocol) email (master only)
router.post('/test-email', requireMaster, async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, test_to } = req.body;
  try {
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: parseInt(smtp_port || '587'),
      secure: false,
      auth: { user: smtp_user, pass: smtp_pass }
    });
    await transporter.sendMail({
      from: smtp_from,
      to: test_to || smtp_user,
      subject: 'RaffleVault — Email Test',
      text: 'Your RaffleVault email setup is working correctly.'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
