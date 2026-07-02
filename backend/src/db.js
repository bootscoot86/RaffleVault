const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    -- Site settings (organization info, branding, SMTP, disclaimer)
    CREATE TABLE IF NOT EXISTS site_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT
    );

    -- Admin users
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'admin',  -- 'master' or 'admin'
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Recovery code for master admin reset
    CREATE TABLE IF NOT EXISTS recovery_codes (
      id SERIAL PRIMARY KEY,
      code_hash VARCHAR(255) NOT NULL,
      used BOOLEAN DEFAULT false,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Raffle categories
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Raffle items
    CREATE TABLE IF NOT EXISTS raffles (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      ticket_price NUMERIC(10,2) NOT NULL,
      max_tickets INTEGER,
      max_tickets_per_person INTEGER,
      entry_type VARCHAR(10) NOT NULL DEFAULT 'multiple',  -- 'single' or 'multiple'
      drawing_type VARCHAR(10) NOT NULL DEFAULT 'closed',  -- 'live' or 'closed'
      youtube_link VARCHAR(500),
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      end_date TIMESTAMP,
      active BOOLEAN DEFAULT false,
      closed BOOLEAN DEFAULT false,
      sold_out BOOLEAN DEFAULT false,
      deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      created_by INTEGER REFERENCES admin_users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Raffle images (up to 6 per raffle)
    CREATE TABLE IF NOT EXISTS raffle_images (
      id SERIAL PRIMARY KEY,
      raffle_id INTEGER REFERENCES raffles(id) ON DELETE CASCADE,
      filename VARCHAR(500) NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Entries
    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      raffle_id INTEGER REFERENCES raffles(id) ON DELETE RESTRICT,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Winners
    CREATE TABLE IF NOT EXISTS winners (
      id SERIAL PRIMARY KEY,
      raffle_id INTEGER REFERENCES raffles(id),
      entry_id INTEGER REFERENCES entries(id),
      drawn_by INTEGER REFERENCES admin_users(id),
      drawn_at TIMESTAMP DEFAULT NOW(),
      notification_sent BOOLEAN DEFAULT false,
      notification_sent_at TIMESTAMP,
      notification_sent_by INTEGER REFERENCES admin_users(id),
      claimed BOOLEAN DEFAULT false,
      claim_deadline TIMESTAMP,
      second_draw_authorized BOOLEAN DEFAULT false,
      second_draw_authorized_by INTEGER REFERENCES admin_users(id),
      second_draw_authorized_at TIMESTAMP
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES admin_users(id),
      action VARCHAR(100) NOT NULL,
      details JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Token blocklist (invalidated JWT tokens)
    CREATE TABLE IF NOT EXISTS token_blocklist (
      id SERIAL PRIMARY KEY,
      jti VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- RaffleVault disclaimer acknowledgments
    CREATE TABLE IF NOT EXISTS disclaimer_acknowledgments (
      id SERIAL PRIMARY KEY,
      org_name VARCHAR(255),
      admin_name VARCHAR(255),
      admin_username VARCHAR(100),
      admin_email VARCHAR(255),
      ip_address VARCHAR(50),
      acknowledged_at TIMESTAMP DEFAULT NOW(),
      disclaimer_text TEXT
    );

    -- Duplicate entry flags
    CREATE TABLE IF NOT EXISTS duplicate_flags (
      id SERIAL PRIMARY KEY,
      raffle_id INTEGER REFERENCES raffles(id),
      email VARCHAR(255),
      reason TEXT,
      overridden BOOLEAN DEFAULT false,
      overridden_by INTEGER REFERENCES admin_users(id),
      overridden_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Add columns if they don't exist (safe to run repeatedly)
  await pool.query(`
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
  `);
  await pool.query(`
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT NOW();
  `);
  await pool.query(`
    ALTER TABLE winners ADD COLUMN IF NOT EXISTS winner_contacted BOOLEAN DEFAULT false;
    ALTER TABLE winners ADD COLUMN IF NOT EXISTS prize_collected BOOLEAN DEFAULT false;
    ALTER TABLE winners ADD COLUMN IF NOT EXISTS prize_collected_at TIMESTAMP;
  `);
  await pool.query(`
    ALTER TABLE raffles ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
    ALTER TABLE raffles ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
    ALTER TABLE raffles ADD COLUMN IF NOT EXISTS prize_cost NUMERIC(10,2) DEFAULT 0;
  `);
  await pool.query(`
    ALTER TABLE entries ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_holds (
      id SERIAL PRIMARY KEY,
      raffle_id INTEGER REFERENCES raffles(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      hold_token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Ensure Stripe keys exist in settings so the admin UI renders the section
  await pool.query(`
    INSERT INTO site_settings (key, value) VALUES ('stripe_public_key', '') ON CONFLICT (key) DO NOTHING;
    INSERT INTO site_settings (key, value) VALUES ('stripe_secret_key', '') ON CONFLICT (key) DO NOTHING;
  `);

  console.log('Database initialized');
}

module.exports = { pool, initDb };
