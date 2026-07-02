const router = require('express').Router();
const crypto = require('crypto');
const { pool } = require('../db');
const { log } = require('../middleware/auditLog');

// Public: submit entry
router.post('/', async (req, res) => {
  const { raffle_id, name, email, phone, address, quantity, payment_intent_id, hold_token } = req.body;

  if (!raffle_id || !name || !email || !phone || !quantity) {
    return res.status(400).json({ error: 'Name, email, phone number, and ticket quantity are required' });
  }

  // Get raffle
  const { rows: raffleRows } = await pool.query(
    'SELECT * FROM raffles WHERE id=$1 AND active=true AND deleted=false AND sold_out=false',
    [raffle_id]
  );
  if (!raffleRows.length) {
    return res.status(404).json({ error: 'This raffle is not available or has sold out' });
  }
  const raffle = raffleRows[0];

  // Check single entry limit
  if (raffle.entry_type === 'single') {
    const { rows: existing } = await pool.query(
      'SELECT id FROM entries WHERE raffle_id=$1 AND email=$2',
      [raffle_id, email.toLowerCase()]
    );
    if (existing.length) {
      await pool.query(
        'INSERT INTO duplicate_flags (raffle_id, email, reason) VALUES ($1,$2,$3)',
        [raffle_id, email.toLowerCase(), 'Single entry raffle — duplicate email']
      );
      return res.status(400).json({ error: 'You have already entered this raffle. Only one entry is allowed.' });
    }
  }

  // Log repeat entries on multiple-entry raffles for audit (no longer blocked — buyer confirmed via modal)
  if (raffle.entry_type === 'multiple') {
    const { rows: recent } = await pool.query(
      'SELECT id FROM entries WHERE raffle_id=$1 AND email=$2',
      [raffle_id, email.toLowerCase()]
    );
    if (recent.length) {
      await pool.query(
        'INSERT INTO duplicate_flags (raffle_id, email, reason) VALUES ($1,$2,$3)',
        [raffle_id, email.toLowerCase(), 'Multiple entry raffle — repeat purchase confirmed by buyer']
      );
    }
  }

  // Check max tickets per person
  if (raffle.max_tickets_per_person) {
    const { rows: personTotal } = await pool.query(
      'SELECT COALESCE(SUM(quantity),0)::int AS total FROM entries WHERE raffle_id=$1 AND email=$2',
      [raffle_id, email.toLowerCase()]
    );
    if (personTotal[0].total + parseInt(quantity) > raffle.max_tickets_per_person) {
      return res.status(400).json({ error: `Maximum ${raffle.max_tickets_per_person} tickets per person allowed` });
    }
  }

  // Check remaining tickets (accounting for active holds, but excluding this buyer's own hold)
  if (raffle.max_tickets) {
    const { rows: sold } = await pool.query(
      'SELECT COALESCE(SUM(quantity),0)::int AS total FROM entries WHERE raffle_id=$1',
      [raffle_id]
    );
    const { rows: holdRows } = await pool.query(
      `SELECT COALESCE(SUM(quantity),0)::int AS held FROM ticket_holds WHERE raffle_id=$1 AND expires_at > NOW() AND hold_token != $2`,
      [raffle_id, hold_token || '']
    );
    const remaining = raffle.max_tickets - sold[0].total - holdRows[0].held;
    if (remaining <= 0) return res.status(400).json({ error: 'This raffle is sold out' });
    if (parseInt(quantity) > remaining) {
      return res.status(400).json({ error: `Only ${remaining} ticket(s) remaining` });
    }
  }

  // If a hold_token was provided, verify it's still valid
  if (hold_token) {
    const { rows: holdCheck } = await pool.query(
      'SELECT id FROM ticket_holds WHERE hold_token=$1 AND raffle_id=$2 AND expires_at > NOW()',
      [hold_token, raffle_id]
    );
    if (!holdCheck.length) {
      return res.status(400).json({ error: 'Your ticket hold has expired. Please start over.' });
    }
  }

  // Create entry
  const { rows } = await pool.query(
    'INSERT INTO entries (raffle_id, name, email, phone, address, quantity, payment_intent_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [raffle_id, name, email.toLowerCase(), phone || null, address || null, quantity, payment_intent_id || null]
  );

  // Release the hold now that entry is confirmed
  if (hold_token) {
    await pool.query('DELETE FROM ticket_holds WHERE hold_token=$1', [hold_token]);
  }
  const entry = rows[0];

  // Check if now sold out
  if (raffle.max_tickets) {
    const { rows: check } = await pool.query(
      'SELECT COALESCE(SUM(quantity),0)::int AS total FROM entries WHERE raffle_id=$1', [raffle_id]
    );
    if (check[0].total >= raffle.max_tickets) {
      await pool.query('UPDATE raffles SET sold_out=true, active=false, closed=true WHERE id=$1', [raffle_id]);
      // Send sold out notification (handled by email service)
      try {
        const { sendSoldOutNotification } = require('../email');
        await sendSoldOutNotification(raffle);
      } catch (e) { console.error('Sold out email error:', e); }
    }
  }

  // Send confirmation email
  let email_sent = false;
  try {
    const { sendEntryConfirmation } = require('../email');
    const result = await sendEntryConfirmation(entry, raffle);
    email_sent = !!result;
  } catch (e) { console.error('Confirmation email error:', e); }

  res.status(201).json({ ...entry, email_sent });
});

module.exports = router;
