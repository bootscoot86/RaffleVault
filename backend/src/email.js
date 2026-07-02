const nodemailer = require('nodemailer');
const { pool } = require('./db');

async function getTransporter() {
  const { rows } = await pool.query(
    "SELECT key, value FROM site_settings WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from')"
  );
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  if (!s.smtp_host || !s.smtp_user) return null;
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: parseInt(s.smtp_port || '587'),
    secure: false,
    auth: { user: s.smtp_user, pass: s.smtp_pass }
  });
}

async function getOrgInfo() {
  const { rows } = await pool.query(
    "SELECT key, value FROM site_settings WHERE key IN ('org_name','org_email','org_phone','org_address','org_website','smtp_from')"
  );
  const info = {};
  rows.forEach(r => info[r.key] = r.value);
  return info;
}

async function getAdminEmails() {
  const { rows } = await pool.query('SELECT email, name FROM admin_users WHERE active=true');
  return rows;
}

// Entry confirmation to buyer
async function sendEntryConfirmation(entry, raffle) {
  const transporter = await getTransporter();
  if (!transporter) return;
  const org = await getOrgInfo();

  await transporter.sendMail({
    from: org.smtp_from || org.smtp_user,
    to: entry.email,
    subject: `Your entry for ${raffle.title} — ${org.org_name || 'RaffleVault'}`,
    html: `
      <h2>Thank you for entering!</h2>
      <p>Hi ${entry.name},</p>
      <p>Your entry for <strong>${raffle.title}</strong> has been received.</p>
      <table>
        <tr><td><strong>Tickets purchased:</strong></td><td>${entry.quantity}</td></tr>
        <tr><td><strong>Total amount:</strong></td><td>$${(entry.quantity * Number(raffle.ticket_price)).toFixed(2)}</td></tr>
        ${raffle.end_date ? `<tr><td><strong>Drawing date:</strong></td><td>${new Date(raffle.end_date).toLocaleDateString()}</td></tr>` : ''}
      </table>
      <p>Good luck!</p>
      <hr/>
      <p><strong>${org.org_name}</strong><br/>
      ${org.org_email ? `Email: ${org.org_email}<br/>` : ''}
      ${org.org_phone ? `Phone: ${org.org_phone}<br/>` : ''}
      ${org.org_address ? `Address: ${org.org_address}<br/>` : ''}
      ${org.org_website ? `Website: ${org.org_website}` : ''}</p>
    `
  });
  return true;
}

// Sold out notification to all admins
async function sendSoldOutNotification(raffle) {
  const transporter = await getTransporter();
  if (!transporter) return;
  const org = await getOrgInfo();
  const admins = await getAdminEmails();
  if (!admins.length) return;

  const toList = admins.map(a => `"${a.name}" <${a.email}>`).join(', ');
  await transporter.sendMail({
    from: org.smtp_from,
    to: toList,
    subject: `Raffle Sold Out: ${raffle.title}`,
    html: `
      <h2>Raffle Sold Out</h2>
      <p>The raffle <strong>${raffle.title}</strong> has sold all ${raffle.max_tickets} tickets.</p>
      <p>Log in to the admin panel to trigger the drawing when ready.</p>
      <p>Total revenue: $${(Number(raffle.ticket_price) * raffle.max_tickets).toFixed(2)}</p>
    `
  });
}

// Winner notification email (sent manually by admin)
async function sendWinnerNotification(winner, raffle) {
  const transporter = await getTransporter();
  if (!transporter) return;
  const org = await getOrgInfo();

  await transporter.sendMail({
    from: org.smtp_from,
    to: winner.email,
    subject: `Congratulations! You won — ${raffle.title}`,
    html: `
      <h2>Congratulations, ${winner.name}!</h2>
      <p>You are the winner of <strong>${raffle.title}</strong>!</p>
      <p>Please contact us within <strong>30 days</strong> to claim your prize.</p>
      <hr/>
      <p><strong>${org.org_name}</strong><br/>
      ${org.org_email ? `Email: ${org.org_email}<br/>` : ''}
      ${org.org_phone ? `Phone: ${org.org_phone}<br/>` : ''}
      ${org.org_address ? `Address: ${org.org_address}` : ''}</p>
    `
  });
}

// Unclaimed prize alert to master admin (30 days)
async function sendUnclaimedAlert(raffle, winner) {
  const transporter = await getTransporter();
  if (!transporter) return;
  const org = await getOrgInfo();
  const { rows } = await pool.query("SELECT email, name FROM admin_users WHERE role='master' AND active=true LIMIT 1");
  if (!rows.length) return;

  await transporter.sendMail({
    from: org.smtp_from,
    to: rows[0].email,
    subject: `Unclaimed Prize — ${raffle.title}`,
    html: `
      <h2>Unclaimed Prize Alert</h2>
      <p>The winner of <strong>${raffle.title}</strong> has not claimed their prize within 30 days.</p>
      <p>Winner: ${winner.name} (${winner.email})</p>
      <p>Notification sent: ${new Date(winner.notification_sent_at).toLocaleDateString()}</p>
      <p>Log in to the admin panel to authorize a second drawing if needed.</p>
    `
  });
}

// Disclaimer acknowledgment copy to RaffleVault owner
async function sendDisclaimerAcknowledgment({ org_name, admin_name, admin_username, admin_email, ip_address, acknowledged_at, disclaimer_text }) {
  const ownerEmail = process.env.RAFFLEVAULT_OWNER_EMAIL;
  if (!ownerEmail || ownerEmail === 'YOUR_EMAIL_HERE@example.com') {
    console.warn('⚠️  RAFFLEVAULT_OWNER_EMAIL not set — disclaimer acknowledgment email not sent. Set this before going live.');
    return;
  }
  const transporter = await getTransporter();
  if (!transporter) return;
  const org = await getOrgInfo();

  await transporter.sendMail({
    from: org.smtp_from || org.smtp_user,
    to: ownerEmail,
    subject: `RaffleVault — Disclaimer Accepted — ${org_name}`,
    html: `
      <h2>RaffleVault Platform Disclaimer — Accepted</h2>
      <table style="border-collapse:collapse;width:100%;font-size:15px;">
        <tr><td style="padding:8px;font-weight:bold;width:180px;">Organization:</td><td style="padding:8px;">${org_name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Admin Name:</td><td style="padding:8px;">${admin_name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Username:</td><td style="padding:8px;">@${admin_username}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Email:</td><td style="padding:8px;">${admin_email}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Date &amp; Time:</td><td style="padding:8px;">${new Date(acknowledged_at).toLocaleString()}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">IP Address:</td><td style="padding:8px;">${ip_address}</td></tr>
      </table>
      <hr/>
      <h3>Full Disclaimer Text Accepted:</h3>
      <p style="font-size:13px;color:#333;line-height:1.7;">${disclaimer_text.replace(/\n/g, '<br/>')}</p>
      <hr/>
      <p style="font-size:12px;color:#888;">This record is automatically generated by RaffleVault and stored in the platform database. Keep this email as part of your legal records.</p>
    `
  });
}

module.exports = { sendEntryConfirmation, sendSoldOutNotification, sendWinnerNotification, sendUnclaimedAlert, sendDisclaimerAcknowledgment };
