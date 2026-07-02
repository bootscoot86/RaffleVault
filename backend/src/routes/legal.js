const router = require('express').Router();
const { pool } = require('../db');
const { requireMaster } = require('../middleware/auth');
const { log } = require('../middleware/auditLog');
const { sendDisclaimerAcknowledgment } = require('../email');

const DISCLAIMER_TEXT = `RaffleVault is a software platform provided solely as a fundraising management tool. RaffleVault, its developers, owners, and affiliates make no representation, warranty, or guarantee that the use of this platform complies with any applicable local, state, or federal laws, regulations, or licensing requirements governing charitable gaming, raffles, sweepstakes, or fundraising activities of any kind.

By using RaffleVault, you and any affiliates acknowledge and agree that:

1. You and any affiliates are solely and fully responsible for obtaining all required licenses, permits, and approvals necessary to legally conduct a raffle or charitable gaming event in your jurisdiction.

2. You and any affiliates are solely and fully responsible for ensuring compliance with all applicable local, state, and federal laws, including but not limited to laws governing charitable gaming, taxation, prize reporting, and consumer protection.

3. RaffleVault bears no liability whatsoever for any fines, penalties, legal action, license revocation, or other consequences arising from your failure to comply with applicable laws or regulations.

4. RaffleVault bears no liability for disputes between you and raffle participants, including but not limited to claims related to prizes, refunds, or drawing procedures.

5. You and any affiliates assume full legal responsibility for all raffle activity conducted through this platform and agree to indemnify and hold harmless RaffleVault, its developers, owners, and affiliates from any and all claims, damages, losses, or legal expenses arising from such activity.

Use of this platform constitutes full acceptance of these terms.`;

// Get disclaimer text (public — needed for setup wizard before auth exists)
router.get('/disclaimer', async (req, res) => {
  res.json({ disclaimer: DISCLAIMER_TEXT });
});

// Save acknowledgment (master only)
router.post('/acknowledge', requireMaster, async (req, res) => {
  const ip = req.ip;
  const { rows: orgRows } = await pool.query("SELECT value FROM site_settings WHERE key='org_name'");
  const org_name = orgRows[0]?.value || 'Unknown Organization';

  const { rows: adminRows } = await pool.query(
    'SELECT name, username, email FROM admin_users WHERE id=$1',
    [req.admin.userId]
  );
  const admin = adminRows[0];

  const acknowledged_at = new Date();

  await pool.query(
    `INSERT INTO disclaimer_acknowledgments (org_name, admin_name, admin_username, admin_email, ip_address, acknowledged_at, disclaimer_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [org_name, admin.name, admin.username, admin.email, ip, acknowledged_at, DISCLAIMER_TEXT]
  );

  await log(req.admin.userId, 'DISCLAIMER_ACCEPTED', { org_name, ip }, ip);

  // Send email copy to RaffleVault owner (non-blocking)
  sendDisclaimerAcknowledgment({
    org_name, admin_name: admin.name, admin_username: admin.username,
    admin_email: admin.email, ip_address: ip, acknowledged_at, disclaimer_text: DISCLAIMER_TEXT
  }).catch(err => console.error('Disclaimer email failed:', err));

  res.json({ success: true });
});

// View all acknowledgments (master only)
router.get('/acknowledgments', requireMaster, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, org_name, admin_name, admin_username, admin_email, ip_address, acknowledged_at FROM disclaimer_acknowledgments ORDER BY acknowledged_at DESC'
  );
  res.json(rows);
});

module.exports = { router, DISCLAIMER_TEXT };
