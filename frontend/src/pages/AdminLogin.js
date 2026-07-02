import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../api';
import { SettingsContext } from '../App';

export default function AdminLogin() {
  const settings = useContext(SettingsContext);
  const primary = settings.primary_color || '#1a237e';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    const res = await adminLogin(username, password);
    if (res.name) {
      localStorage.setItem('rv_name', res.name);
      localStorage.setItem('rv_role', res.role);
      localStorage.setItem('rv_pw_expires', res.days_until_expiry ?? 90);
      if (res.must_change_password) {
        navigate('/admin/change-password');
      } else {
        navigate('/admin/dashboard');
      }
    } else {
      setError(res.error || 'Invalid credentials');
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={{ ...s.logo, color: '#ffd700' }}>★</div>
        <h2 style={{ ...s.title, color: primary }}>Admin Login</h2>
        <p style={s.sub}>{settings.site_title || 'RaffleVault'}</p>
        {error && <div style={s.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>Username
            <input style={s.input} value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
          </label>
          <label style={s.label}>Password
            <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          <button type="submit" style={{ ...s.btn, background: primary }}>Login</button>
        </form>
        <p style={s.recover}>
          Locked out? <a href="/admin/recover" style={{ color: primary }}>Use recovery code</a>
        </p>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 200px)' },
  card: { background: '#fff', borderRadius: 14, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: 380 },
  logo: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 4 },
  sub: { textAlign: 'center', color: '#888', fontSize: 14, marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 14, fontWeight: 500 },
  input: { padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', fontSize: 15 },
  btn: { color: '#fff', border: 'none', borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 15, marginTop: 4 },
  error: { background: '#ffebee', color: '#c62828', borderRadius: 6, padding: '10px 12px', fontSize: 14, marginBottom: 8 },
  recover: { textAlign: 'center', fontSize: 13, color: '#888', marginTop: 16 },
};
