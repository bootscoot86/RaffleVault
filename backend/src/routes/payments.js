const router = require('express').Router();
const crypto = require('crypto');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get Stripe public key (public route — needed by buyer page)
router.get('/config', async (req, res) => {
  const { rows } = await pool.query("SELECT value FROM site_settings WHERE key='stripe_public_key'");
  const key = rows.length ? rows[0].value : null;
  res.json({ stripe_public_key: key });
});

// Create a payment intent for a raffle entry
router.post('/create-intent', async (req, res) => {
  const { raffle_id, quantity } = req.body;
  if (!raffle_id || !quantity) return res.status(400).json({ error: 'Missing raffle_id or quantity' });

  try {
    const { rows: keyRows } = await pool.query("SELECT value FROM site_settings WHERE key='stripe_secret_key'");
    if (!keyRows.length || !keyRows[0].value) return res.status(400).json({ error: 'Stripe is not configured' });

    const stripe = require('stripe')(keyRows[0].value);

    const { rows: raffleRows } = await pool.query('SELECT * FROM raffles WHERE id=$1 AND active=true', [raffle_id]);
    if (!raffleRows.length) return res.status(404).json({ error: 'Raffle not found' });

    const raffle = raffleRows[0];

    // Check available tickets accounting for existing holds
    if (raffle.max_tickets) {
      const { rows: soldRows } = await pool.query(
        'SELECT COALESCE(SUM(quantity),0)::int AS sold FROM entries WHERE raffle_id=$1', [raffle_id]
      );
      const { rows: holdRows } = await pool.query(
        'SELECT COALESCE(SUM(quantity),0)::int AS held FROM ticket_holds WHERE raffle_id=$1 AND expires_at > NOW()', [raffle_id]
      );
      const available = raffle.max_tickets - soldRows[0].sold - holdRows[0].held;
      if (available < quantity) {
        return res.status(400).json({ error: `Only ${available} ticket(s) available right now. Some may be held by other buyers — try again in a few minutes.` });
      }
    }

    // Create a 10-minute hold on the tickets
    const hold_token = crypto.randomBytes(24).toString('hex');
    await pool.query(
      `INSERT INTO ticket_holds (raffle_id, quantity, hold_token, expires_at) VALUES ($1,$2,$3, NOW() + INTERVAL '10 minutes')`,
      [raffle_id, quantity, hold_token]
    );

    const amount = Math.round(Number(raffle.ticket_price) * quantity * 100); // cents

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: { raffle_id: String(raffle_id), quantity: String(quantity), raffle_title: raffle.title, hold_token }
    });

    res.json({ client_secret: intent.client_secret, amount, hold_token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
