import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsContext } from '../App';

const PW_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

export default function ChangePassword() {
  const settings = useContext(SettingsContext);
  const primary = settings.primary_color || '#1a237e';
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!PW_REGEX.test(newPw)) {
      setError('Password must be 8+ characters with uppercase, number, and special character (!@#$%^&*)');
      return;
    }
    if (newPw !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ new_password: newPw })
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.error) { setError(data.error); return; }
    navigate('/admin/dashboard');
  }

  const checks = [
    { label: '8+ characters', ok: newPw.length >= 8 },
    { label: 'Uppercase letter (A-Z)', ok: /[A-Z]/.test(newPw) },
    { label: 'Number (0-9)', ok: /[0-9]/.test(newPw) },
    { label: 'Special character (!@#$%^&*)', ok: /[!@#$%^&*]/.test(newPw) },
  ];
  const passed = checks.filter(c => c.ok).length;
  const barColors = ['#e0e0e0', '#ef5350', '#ffa726', '#66bb6a', '#2e7d32'];

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={{ fontSize: 36, textAlign: 'center', color: '#ffd700', marginBottom: 8 }}>★</div>
        <h2 style={{ ...s.title, color: primary }}>Set Your Password</h2>
        <p style={s.sub}>You must set a new password before continuing.</p>
        {error && <div style={s.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>New Password
            <input style={s.input} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required autoFocus />
            {newPw && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= passed ? barColors[passed] : '#e0e0e0' }} />
                  ))}
                </div>
                {checks.map(c => (
                  <div key={c.label} style={{ fontSize: 11, color: c.ok ? '#2e7d32' : '#999' }}>
                    {c.ok ? '✓' : '○'} {c.label}
                  </div>
                ))}
              </div>
            )}
          </label>
          <label style={s.label}>Confirm New Password
            <input style={s.input} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            {confirm && (
              <span style={{ fontSize: 12, color: newPw === confirm ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                {newPw === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
              </span>
            )}
          </label>
          <button type="submit" style={{ ...s.btn, background: primary }} disabled={submitting}>
            {submitting ? 'Saving...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 200px)' },
  card: { background: '#fff', borderRadius: 14, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: 400 },
  title: { fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 4 },
  sub: { textAlign: 'center', color: '#888', fontSize: 14, marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 14, fontWeight: 500 },
  input: { padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', fontSize: 15 },
  btn: { color: '#fff', border: 'none', borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 15, marginTop: 4, cursor: 'pointer' },
  error: { background: '#ffebee', color: '#c62828', borderRadius: 6, padding: '10px 12px', fontSize: 14, marginBottom: 8 },
};
