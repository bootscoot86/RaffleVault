const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { log } = require('../middleware/auditLog');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => cb(null, `raffle-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Megabytes
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  }
});

// Compress uploaded image
async function compressImage(filepath) {
  const compressed = filepath.replace(/(\.[^.]+)$/, '-compressed$1');
  await sharp(filepath).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(compressed);
  fs.unlinkSync(filepath);
  fs.renameSync(compressed, filepath);
}

// Get raffle stats
async function withStats(raffle) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS entry_count, COALESCE(SUM(quantity),0)::int AS total_tickets,
     COALESCE(SUM(quantity * $1::numeric),0)::numeric AS revenue
     FROM entries WHERE raffle_id = $2`,
    [raffle.ticket_price, raffle.id]
  );
  const { rows: images } = await pool.query(
    'SELECT id, filename, display_order FROM raffle_images WHERE raffle_id=$1 ORDER BY display_order ASC',
    [raffle.id]
  );
  const stats = rows[0];
  // Also subtract active (unexpired) holds so held tickets don't appear as available
  const { rows: holdRows } = await pool.query(
    `SELECT COALESCE(SUM(quantity),0)::int AS held FROM ticket_holds WHERE raffle_id=$1 AND expires_at > NOW()`,
    [raffle.id]
  );
  const held = holdRows[0].held;
  const tickets_remaining = raffle.max_tickets != null
    ? Math.max(0, raffle.max_tickets - stats.total_tickets - held) : null;
  return { ...raffle, ...stats, tickets_remaining, images };
}

// Public: list active raffles
router.get('/', async (req, res) => {
  // Check maintenance mode
  const { rows: mm } = await pool.query("SELECT value FROM site_settings WHERE key='maintenance_mode'");
  if (mm.length && mm[0].value === 'true') return res.json([]);

  const { rows } = await pool.query(
    'SELECT * FROM raffles WHERE active=true AND deleted=false ORDER BY created_at DESC'
  );
  const result = await Promise.all(rows.map(withStats));
  res.json(result);
});

// Public: single raffle
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM raffles WHERE id=$1 AND deleted=false', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(await withStats(rows[0]));
});

// Public: past raffles (closed, no winner info)
router.get('/past', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM raffles WHERE (closed=true OR sold_out=true) AND deleted=false ORDER BY created_at DESC'
  );
  const result = await Promise.all(rows.map(withStats));
  res.json(result);
});

// Admin: finished raffles (closed or sold out)
router.get('/admin/finished', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM raffles WHERE (closed=true OR sold_out=true) AND deleted=false AND completed=false ORDER BY created_at DESC'
  );
  const result = await Promise.all(rows.map(withStats));
  res.json(result);
});

// Admin: all raffles including inactive
router.get('/admin/all', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM raffles WHERE deleted=false AND completed=false ORDER BY created_at DESC'
  );
  const result = await Promise.all(rows.map(withStats));
  res.json(result);
});

// Admin: create raffle
router.post('/', requireAuth, upload.array('images', 6), async (req, res) => {
  const { title, description, ticket_price, prize_cost, max_tickets, max_tickets_per_person,
          entry_type, drawing_type, youtube_link, category_id, end_date } = req.body;

  // Check disclaimer is set before allowing active listing
  const { rows: disc } = await pool.query("SELECT value FROM site_settings WHERE key='disclaimer'");
  const hasDisclaimer = disc.length && disc[0].value && disc[0].value.trim().length > 0;

  const active = req.body.active === 'true' && hasDisclaimer;

  const { rows } = await pool.query(
    `INSERT INTO raffles (title, description, ticket_price, prize_cost, max_tickets, max_tickets_per_person,
     entry_type, drawing_type, youtube_link, category_id, end_date, active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [title, description, ticket_price, prize_cost || 0, max_tickets || null, max_tickets_per_person || null,
     entry_type || 'multiple', drawing_type || 'closed', youtube_link || null,
     category_id || null, end_date || null, active, req.admin.userId]
  );
  const raffle = rows[0];

  // Save images
  if (req.files && req.files.length) {
    for (let i = 0; i < req.files.length; i++) {
      await compressImage(req.files[i].path);
      await pool.query(
        'INSERT INTO raffle_images (raffle_id, filename, display_order) VALUES ($1,$2,$3)',
        [raffle.id, req.files[i].filename, i]
      );
    }
  }

  await log(req.admin.userId, 'RAFFLE_CREATED', { raffle_id: raffle.id, title }, req.ip);

  if (!active && req.body.active === 'true' && !hasDisclaimer) {
    return res.status(201).json({ ...await withStats(raffle), warning: 'Raffle saved as draft — disclaimer must be set before going live' });
  }

  res.status(201).json(await withStats(raffle));
});

// Admin: update raffle
router.put('/:id', requireAuth, upload.array('images', 6), async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM raffles WHERE id=$1 AND deleted=false', [req.params.id]);
  if (!existing.length) return res.status(404).json({ error: 'Not found' });
  const old = existing[0];

  const { title, description, ticket_price, prize_cost, max_tickets, max_tickets_per_person,
          entry_type, drawing_type, youtube_link, category_id, end_date, active } = req.body;

  const { rows: disc } = await pool.query("SELECT value FROM site_settings WHERE key='disclaimer'");
  const hasDisclaimer = disc.length && disc[0].value && disc[0].value.trim().length > 0;
  const isActive = active === 'true' && hasDisclaimer;

  const { rows } = await pool.query(
    `UPDATE raffles SET title=$1, description=$2, ticket_price=$3, prize_cost=$4, max_tickets=$5,
     max_tickets_per_person=$6, entry_type=$7, drawing_type=$8, youtube_link=$9,
     category_id=$10, end_date=$11, active=$12 WHERE id=$13 RETURNING *`,
    [title, description, ticket_price, prize_cost || 0, max_tickets || null, max_tickets_per_person || null,
     entry_type, drawing_type, youtube_link || null, category_id || null,
     end_date || null, isActive, req.params.id]
  );

  // Add new images if provided (up to 6 total)
  if (req.files && req.files.length) {
    const { rows: imgCount } = await pool.query('SELECT COUNT(*) FROM raffle_images WHERE raffle_id=$1', [req.params.id]);
    const currentCount = parseInt(imgCount[0].count);
    const allowed = Math.min(req.files.length, 6 - currentCount);
    for (let i = 0; i < allowed; i++) {
      await compressImage(req.files[i].path);
      await pool.query(
        'INSERT INTO raffle_images (raffle_id, filename, display_order) VALUES ($1,$2,$3)',
        [req.params.id, req.files[i].filename, currentCount + i]
      );
    }
  }

  // Log changes
  const changes = {};
  if (old.title !== title) changes.title = { before: old.title, after: title };
  if (old.ticket_price !== ticket_price) changes.ticket_price = { before: old.ticket_price, after: ticket_price };
  if (old.active !== isActive) changes.active = { before: old.active, after: isActive };

  await log(req.admin.userId, 'RAFFLE_EDITED', { raffle_id: req.params.id, changes }, req.ip);
  res.json(await withStats(rows[0]));
});

// Admin: delete raffle (soft delete)
router.delete('/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM raffles WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  await pool.query('UPDATE raffles SET deleted=true, deleted_at=NOW(), active=false WHERE id=$1', [req.params.id]);
  await log(req.admin.userId, 'RAFFLE_DELETED', { raffle_id: req.params.id, title: rows[0].title }, req.ip);
  res.json({ success: true });
});

// Master admin: list deleted raffles
router.get('/admin/deleted', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM raffles WHERE deleted=true ORDER BY deleted_at DESC'
  );
  const result = await Promise.all(rows.map(withStats));
  res.json(result);
});

// Master admin: restore deleted raffle
router.post('/:id/restore', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM raffles WHERE id=$1 AND deleted=true', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  await pool.query('UPDATE raffles SET deleted=false, deleted_at=NULL, active=false WHERE id=$1', [req.params.id]);
  await log(req.admin.userId, 'RAFFLE_RESTORED', { raffle_id: req.params.id, title: rows[0].title }, req.ip);
  res.json({ success: true });
});

// Admin: close raffle manually
router.post('/:id/close', requireAuth, async (req, res) => {
  await pool.query('UPDATE raffles SET closed=true, active=false WHERE id=$1', [req.params.id]);
  await log(req.admin.userId, 'RAFFLE_CLOSED', { raffle_id: req.params.id }, req.ip);
  res.json({ success: true });
});

// Admin: duplicate raffle
router.post('/:id/duplicate', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM raffles WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const r = rows[0];
  const { rows: newRaffle } = await pool.query(
    `INSERT INTO raffles (title, description, ticket_price, max_tickets, max_tickets_per_person,
     entry_type, drawing_type, youtube_link, category_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [`${r.title} (Copy)`, r.description, r.ticket_price, r.max_tickets,
     r.max_tickets_per_person, r.entry_type, r.drawing_type, r.youtube_link,
     r.category_id, req.admin.userId]
  );
  await log(req.admin.userId, 'RAFFLE_DUPLICATED', { original_id: req.params.id, new_id: newRaffle[0].id }, req.ip);
  res.status(201).json(await withStats(newRaffle[0]));
});

// Admin: delete image
router.delete('/:id/images/:imageId', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM raffle_images WHERE id=$1 AND raffle_id=$2', [req.params.imageId, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Image not found' });
  const filepath = path.join(__dirname, '../../uploads', rows[0].filename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  await pool.query('DELETE FROM raffle_images WHERE id=$1', [req.params.imageId]);
  res.json({ success: true });
});

// Admin: get entries
router.get('/:id/entries', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM entries WHERE raffle_id=$1 ORDER BY created_at ASC', [req.params.id]
  );
  res.json(rows);
});

// Admin: draw winner
router.post('/:id/draw', requireAuth, async (req, res) => {
  const { rows: raffle } = await pool.query('SELECT * FROM raffles WHERE id=$1', [req.params.id]);
  if (!raffle.length) return res.status(404).json({ error: 'Raffle not found' });
  if (!raffle[0].closed && !raffle[0].sold_out) return res.status(400).json({ error: 'Raffle must be closed before drawing' });

  const { rows: entries } = await pool.query('SELECT * FROM entries WHERE raffle_id=$1', [req.params.id]);
  if (!entries.length) return res.status(400).json({ error: 'No entries found' });

  const pool_entries = entries.flatMap(e => Array(e.quantity).fill(e));
  const winner = pool_entries[Math.floor(Math.random() * pool_entries.length)];

  const claimDeadline = new Date();
  claimDeadline.setDate(claimDeadline.getDate() + 30);

  const { rows: winnerRecord } = await pool.query(
    'INSERT INTO winners (raffle_id, entry_id, drawn_by, claim_deadline) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, winner.id, req.admin.userId, claimDeadline]
  );

  // Remove raffle from public page after winner is drawn
  await pool.query('UPDATE raffles SET active=false WHERE id=$1', [req.params.id]);

  await log(req.admin.userId, 'WINNER_DRAWN', {
    raffle_id: req.params.id,
    winner_entry_id: winner.id,
    winner_name: winner.name
  }, req.ip);

  res.json({ winner, winner_record: winnerRecord[0] });
});

// Admin: get winner for a raffle
router.get('/:id/winner', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT w.*, e.name, e.email, e.phone, e.address, e.quantity,
     w.winner_contacted, w.prize_collected, w.prize_collected_at
     FROM winners w JOIN entries e ON w.entry_id = e.id
     WHERE w.raffle_id=$1 ORDER BY w.drawn_at DESC LIMIT 1`,
    [req.params.id]
  );
  if (!rows.length) return res.json(null);
  res.json(rows[0]);
});

// Admin: update winner contacted / prize collected status
router.put('/:id/winner-status', requireAuth, async (req, res) => {
  const { winner_contacted, prize_collected } = req.body;
  const { rows } = await pool.query('SELECT * FROM winners WHERE raffle_id=$1 ORDER BY drawn_at DESC LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'No winner found' });
  const updates = [];
  const values = [];
  if (winner_contacted !== undefined) { updates.push(`winner_contacted=$${values.length+1}`); values.push(winner_contacted); }
  if (prize_collected !== undefined) {
    updates.push(`prize_collected=$${values.length+1}`); values.push(prize_collected);
    if (prize_collected) { updates.push(`prize_collected_at=NOW()`); }
    else { updates.push(`prize_collected_at=NULL`); }
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  values.push(rows[0].id);
  await pool.query(`UPDATE winners SET ${updates.join(',')} WHERE id=$${values.length}`, values);
  await log(req.admin.userId, 'WINNER_STATUS_UPDATED', { raffle_id: req.params.id, winner_contacted, prize_collected }, req.ip);
  res.json({ success: true });
});

// Admin: mark raffle as completed (prize collected and archived)
router.post('/:id/complete', requireAuth, async (req, res) => {
  const { rows: winner } = await pool.query('SELECT * FROM winners WHERE raffle_id=$1 ORDER BY drawn_at DESC LIMIT 1', [req.params.id]);
  if (!winner.length || !winner[0].prize_collected) return res.status(400).json({ error: 'Prize must be marked as collected before completing' });
  await pool.query('UPDATE raffles SET completed=true, completed_at=NOW(), active=false WHERE id=$1', [req.params.id]);
  await log(req.admin.userId, 'RAFFLE_COMPLETED', { raffle_id: req.params.id }, req.ip);
  res.json({ success: true });
});

// Admin: completed raffles
router.get('/admin/completed', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM raffles WHERE completed=true AND deleted=false ORDER BY completed_at DESC'
  );
  const result = await Promise.all(rows.map(withStats));
  res.json(result);
});

// Categories
router.get('/categories/all', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json(rows);
});

router.post('/categories', requireAuth, async (req, res) => {
  const { name } = req.body;
  const { rows } = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
  res.status(201).json(rows[0]);
});

// Admin: revenue report
router.get('/admin/report', requireAuth, async (req, res) => {
  const { period, year, month, week } = req.query;

  let dateFilter = '';
  const values = [];

  if (period === 'year' && year) {
    dateFilter = `AND EXTRACT(YEAR FROM e.created_at) = $1`;
    values.push(year);
  } else if (period === 'month' && year && month) {
    dateFilter = `AND EXTRACT(YEAR FROM e.created_at) = $1 AND EXTRACT(MONTH FROM e.created_at) = $2`;
    values.push(year, month);
  } else if (period === 'week' && year && week) {
    dateFilter = `AND EXTRACT(YEAR FROM e.created_at) = $1 AND EXTRACT(WEEK FROM e.created_at) = $2`;
    values.push(year, week);
  }

  const { rows: byRaffle } = await pool.query(`
    SELECT r.id, r.title, r.ticket_price, COALESCE(r.prize_cost, 0)::numeric AS prize_cost,
      COUNT(DISTINCT e.id)::int AS entry_count,
      COALESCE(SUM(e.quantity), 0)::int AS tickets_sold,
      COALESCE(SUM(e.quantity * r.ticket_price::numeric), 0)::numeric AS revenue,
      COALESCE(SUM(e.quantity * r.ticket_price::numeric), 0)::numeric - COALESCE(r.prize_cost, 0)::numeric AS profit,
      MIN(e.created_at) AS first_entry,
      MAX(e.created_at) AS last_entry
    FROM raffles r
    LEFT JOIN entries e ON e.raffle_id = r.id ${dateFilter}
    WHERE r.deleted = false
    GROUP BY r.id, r.title, r.ticket_price, r.prize_cost
    HAVING COUNT(e.id) > 0
    ORDER BY revenue DESC
  `, values);

  const { rows: summary } = await pool.query(`
    SELECT
      COALESCE(SUM(rd.tickets_sold), 0)::int AS total_tickets,
      COALESCE(SUM(rd.revenue), 0)::numeric AS total_revenue,
      COALESCE(SUM(rd.prize_cost), 0)::numeric AS total_prize_cost,
      COALESCE(SUM(rd.revenue), 0)::numeric - COALESCE(SUM(rd.prize_cost), 0)::numeric AS total_profit,
      COALESCE(SUM(rd.entry_count), 0)::int AS total_entries,
      COUNT(rd.id)::int AS total_raffles
    FROM (
      SELECT r.id,
        COALESCE(r.prize_cost, 0)::numeric AS prize_cost,
        COALESCE(SUM(e.quantity), 0)::int AS tickets_sold,
        COALESCE(SUM(e.quantity * r.ticket_price::numeric), 0)::numeric AS revenue,
        COUNT(DISTINCT e.id)::int AS entry_count
      FROM entries e
      JOIN raffles r ON e.raffle_id = r.id
      WHERE r.deleted = false ${dateFilter}
      GROUP BY r.id, r.prize_cost
    ) rd
  `, values);

  // Breakdown by month for year view, by week for month view
  let breakdown = [];
  if (period === 'year' && year) {
    const { rows } = await pool.query(`
      SELECT EXTRACT(MONTH FROM e.created_at)::int AS month,
        COALESCE(SUM(e.quantity * r.ticket_price::numeric), 0)::numeric AS revenue,
        COALESCE(SUM(e.quantity), 0)::int AS tickets
      FROM entries e JOIN raffles r ON e.raffle_id = r.id
      WHERE r.deleted = false AND EXTRACT(YEAR FROM e.created_at) = $1
      GROUP BY month ORDER BY month
    `, [year]);
    breakdown = rows;
  } else if (period === 'month' && year && month) {
    const { rows } = await pool.query(`
      SELECT EXTRACT(DAY FROM e.created_at)::int AS day,
        COALESCE(SUM(e.quantity * r.ticket_price::numeric), 0)::numeric AS revenue,
        COALESCE(SUM(e.quantity), 0)::int AS tickets
      FROM entries e JOIN raffles r ON e.raffle_id = r.id
      WHERE r.deleted = false AND EXTRACT(YEAR FROM e.created_at) = $1 AND EXTRACT(MONTH FROM e.created_at) = $2
      GROUP BY day ORDER BY day
    `, [year, month]);
    breakdown = rows;
  }

  res.json({ summary: summary[0], by_raffle: byRaffle, breakdown });
});

module.exports = router;
