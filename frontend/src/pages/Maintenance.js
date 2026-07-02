import React from 'react';

export default function Maintenance({ settings }) {
  return (
    <div style={s.wrap}>
      <div style={s.icon}>🔧</div>
      <h1 style={s.title}>{settings.site_title || 'RaffleVault'}</h1>
      <p style={s.msg}>This site is temporarily unavailable for maintenance.</p>
      <p style={s.sub}>Please check back soon.</p>
      {settings.org_email && <p style={s.contact}>Questions? Contact us at {settings.org_email}</p>}
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 24 },
  icon: { fontSize: 64 },
  title: { fontSize: 28, fontWeight: 800, color: '#1a237e' },
  msg: { fontSize: 18, color: '#333', textAlign: 'center' },
  sub: { fontSize: 15, color: '#888' },
  contact: { fontSize: 14, color: '#666', marginTop: 8 },
};
