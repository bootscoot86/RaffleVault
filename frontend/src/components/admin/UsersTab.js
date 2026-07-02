import React, { useEffect, useState } from 'react';
import { getAdminUsers, createAdminUser, updateAdminUser } from '../../api';

async function deleteAdminUser(id) {
  const res = await fetch(`/api/auth/users/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return res.json();
}

export default function UsersTab({ primary }) {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', active: true, new_password: '' });
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', name: '', email: '' });
  const [tempPassword, setTempPassword] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getAdminUsers();
    setUsers(Array.isArray(data) ? data : []);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    const data = await createAdminUser({ username: addForm.username, name: addForm.name, email: addForm.email });
    if (data.error) { setError(data.error); return; }
    setTempPassword(data.temp_password);
    setAdding(false);
    setAddForm({ username: '', name: '', email: '' });
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Permanently remove this admin account? This cannot be undone.')) return;
    const data = await deleteAdminUser(id);
    if (data.error) { setError(data.error); return; }
    setMsg('Admin account removed.');
    load();
  }

  async function handleEdit(e) {
    e.preventDefault();
    setError('');
    if (editForm.new_password && !PW_REGEX.test(editForm.new_password)) {
      setError('Password must be 8+ characters with uppercase, number, and special character');
      return;
    }
    const data = await updateAdminUser(editing, editForm);
    if (data.error) { setError(data.error); return; }
    setMsg('User updated.');
    setEditing(null);
    load();
  }

  const regularAdmins = users.filter(u => u.role !== 'master');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ ...s.title, color: primary }}>Admin Users</h2>
        {!adding && !editing && regularAdmins.length < 3 && (
          <button style={{ ...s.addBtn, background: primary }} onClick={() => { setAdding(true); setError(''); }}>
            + Add Admin
          </button>
        )}
      </div>

      {msg && <div style={s.msg}>{msg} <button style={s.dismiss} onClick={() => setMsg('')}>✕</button></div>}
      {error && <div style={s.errorBox}>{error}</div>}
      {tempPassword && (
        <div style={s.tempBox}>
          <strong>Account created.</strong> Give this temporary password to the new admin — they will be required to change it on first login. This is shown only once.
          <div style={s.tempCode}>{tempPassword}</div>
          <button style={s.dismissTemp} onClick={() => setTempPassword(null)}>I've recorded this — dismiss</button>
        </div>
      )}

      <div style={s.list}>
        {users.map(u => (
          <div key={u.id} style={s.userRow}>
            <div>
              <div style={s.userName}>
                {u.name}
                {u.role === 'master' && <span style={s.masterBadge}>⭐ Master Admin</span>}
                {!u.active && <span style={s.inactiveBadge}>Disabled</span>}
              </div>
              <div style={s.userMeta}>@{u.username} · {u.email}</div>
            </div>
            {u.role !== 'master' && !adding && !editing && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...s.editBtn, color: primary }} onClick={() => {
                  setEditForm({ name: u.name, email: u.email, active: u.active, new_password: '' });
                  setEditing(u.id);
                  setError('');
                }}>Edit</button>
                <button style={s.deleteBtn} onClick={() => handleDelete(u.id)}>Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {regularAdmins.length === 0 && !adding && (
        <p style={{ color: '#888', fontSize: 13 }}>No regular admin accounts yet. Add up to 3.</p>
      )}

      {adding && (
        <form onSubmit={handleAdd} style={s.form}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: primary }}>New Admin Account</h3>
          <p style={{ fontSize: 13, color: '#666', margin: 0 }}>A temporary password will be generated for you to share with the new admin. They will set their own password on first login.</p>
          <F label="Username"><input style={s.input} required value={addForm.username} onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))} /></F>
          <F label="Full Name"><input style={s.input} required value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} /></F>
          <F label="Email"><input style={s.input} type="email" required value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></F>
          <div style={s.btns}>
            <button type="submit" style={{ ...s.btn, background: primary }}>Create Account</button>
            <button type="button" style={s.btnGray} onClick={() => { setAdding(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      )}

      {editing && (
        <form onSubmit={handleEdit} style={s.form}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: primary }}>Edit User</h3>
          <F label="Full Name"><input style={s.input} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></F>
          <F label="Email"><input style={s.input} type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></F>
          <F label="New Password (leave blank to keep current)" hint="8+ characters, uppercase, number, special character (!@#$%^&*)">
            <input style={s.input} type="password" value={editForm.new_password} onChange={e => setEditForm(f => ({ ...f, new_password: e.target.value }))} />
          </F>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={editForm.active} onChange={e => setEditForm(f => ({ ...f, active: e.target.checked }))} />
            Account active
          </label>
          <div style={s.btns}>
            <button type="submit" style={{ ...s.btn, background: primary }}>Save</button>
            <button type="button" style={s.btnGray} onClick={() => { setEditing(null); setError(''); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function F({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, fontWeight: 500 }}>
      {label}
      {hint && <span style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>{hint}</span>}
      {children}
    </label>
  );
}

const s = {
  title: { fontSize: 20, fontWeight: 800, marginBottom: 0 },
  msg: { background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, display: 'flex', justifyContent: 'space-between' },
  errorBox: { background: '#ffebee', color: '#c62828', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13 },
  dismiss: { background: 'none', border: 'none', cursor: 'pointer', color: '#2e7d32', fontWeight: 700 },
  list: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  userRow: { background: '#fff', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  userName: { fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  userMeta: { fontSize: 14, color: '#333' },
  masterBadge: { background: '#fff9c4', color: '#f57f17', borderRadius: 4, padding: '2px 7px', fontSize: 12, fontWeight: 700 },
  inactiveBadge: { background: '#eee', color: '#555', borderRadius: 4, padding: '2px 7px', fontSize: 12 },
  editBtn: { background: 'none', border: '1px solid currentColor', borderRadius: 6, padding: '6px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  deleteBtn: { background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  addBtn: { color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  tempBox: { background: '#fff9c4', border: '1px solid #f9a825', borderRadius: 8, padding: 16, fontSize: 13, marginBottom: 16 },
  tempCode: { fontFamily: 'monospace', fontSize: 20, fontWeight: 800, letterSpacing: 2, color: '#1a237e', margin: '12px 0', padding: '10px', background: '#fff', borderRadius: 6, textAlign: 'center' },
  dismissTemp: { background: '#1a237e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' },
  form: { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 14 },
  input: { padding: '9px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 },
  btns: { display: 'flex', gap: 10 },
  btn: { color: '#fff', border: 'none', borderRadius: 6, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnGray: { background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 6, padding: '9px 16px', fontWeight: 500, fontSize: 13, cursor: 'pointer' },
};
