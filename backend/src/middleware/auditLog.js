const { pool } = require('../db');

async function log(adminId, action, details, ipAddress) {
  try {
    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details, ip_address) VALUES ($1,$2,$3,$4)',
      [adminId, action, JSON.stringify(details || {}), ipAddress || null]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = { log };
