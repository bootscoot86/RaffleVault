import React, { useEffect, useState } from 'react';
import { getAdminRaffles, createRaffle, updateRaffle, deleteRaffle, closeRaffle, duplicateRaffle, getCategories, createCategory, deleteImage, getDeletedRaffles, restoreRaffle, getRaffleWinner, updateWinnerStatus, completeRaffle } from '../../api';

const emptyForm = {
  title: '', description: '', ticket_price: '', prize_cost: '', max_tickets: '', max_tickets_per_person: '',
  entry_type: 'multiple', drawing_type: 'closed', youtube_link: '', category_id: '',
  end_date: '', active: false
};

export default function RafflesTab({ role, primary, onViewEntries }) {
  const [raffles, setRaffles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [view, setView] = useState('list'); // 'list' or 'form'
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [newImages, setNewImages] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletedRaffles, setDeletedRaffles] = useState([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [disclaimerSet, setDisclaimerSet] = useState(false);
  const isMaster = role === 'master';

  useEffect(() => { load(); }, []);

  async function load() {
    const [r, c, pub] = await Promise.all([getAdminRaffles(), getCategories(), fetch('/api/settings/public').then(r => r.json())]);
    setRaffles(Array.isArray(r) ? r : []);
    setCategories(Array.isArray(c) ? c : []);
    setDisclaimerSet(!!pub.disclaimer);
    setLoading(false);
  }

  async function loadDeleted() {
    const d = await getDeletedRaffles();
    setDeletedRaffles(Array.isArray(d) ? d : []);
  }

  async function handleRestore(id) {
    await restoreRaffle(id);
    setMsg('Raffle restored as draft.');
    load();
    loadDeleted();
  }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave(e) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    newImages.forEach(f => fd.append('images', f));
    const res = editing ? await updateRaffle(editing, fd) : await createRaffle(fd);
    if (res.error) { setMsg(res.error); return; }
    if (res.warning) setMsg(res.warning);
    else setMsg(editing ? 'Raffle updated.' : 'Raffle created.');
    setForm(emptyForm); setEditing(null); setNewImages([]); setView('list');
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this raffle? It can be restored by the master admin.')) return;
    await deleteRaffle(id);
    setMsg('Raffle deleted.');
    load();
  }

  async function handleClose(id) {
    if (!window.confirm('Close this raffle to new entries?')) return;
    await closeRaffle(id);
    setMsg('Raffle closed.');
    load();
  }

  async function handleDuplicate(id) {
    await duplicateRaffle(id);
    setMsg('Raffle duplicated.');
    load();
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    await createCategory(newCategory.trim());
    setNewCategory('');
    const c = await getCategories();
    setCategories(Array.isArray(c) ? c : []);
  }

  function startEdit(r) {
    setForm({
      title: r.title, description: r.description || '',
      ticket_price: r.ticket_price, prize_cost: r.prize_cost || '', max_tickets: r.max_tickets || '',
      max_tickets_per_person: r.max_tickets_per_person || '',
      entry_type: r.entry_type, drawing_type: r.drawing_type,
      youtube_link: r.youtube_link || '', category_id: r.category_id || '',
      end_date: r.end_date?.slice(0, 10) || '', active: r.active
    });
    setEditing(r.id); setNewImages([]); setView('form');
  }

  const totalRevenue = raffles.reduce((a, r) => a + Number(r.revenue || 0), 0);

  if (loading) return <p style={{ color: '#888' }}>Loading...</p>;

  if (view === 'form') return (
    <div>
      <button style={{ ...s.backBtn, color: primary }} onClick={() => { setView('list'); setEditing(null); setForm(emptyForm); }}>
        ← Back to Raffles
      </button>
      <form onSubmit={handleSave} style={s.form}>
        <h2 style={{ ...s.formTitle, color: primary }}>{editing ? 'Edit Raffle' : 'New Raffle'}</h2>
        {msg && <div style={s.msgBox}>{msg}</div>}

        <F label="Title *"><input style={s.input} required value={form.title} onChange={e => set('title', e.target.value)} /></F>
        <F label="Description"><textarea style={{ ...s.input, minHeight: 100, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} /></F>

        <div style={s.row}>
          <F label="Ticket Price ($) *"><input style={s.input} type="number" min="1" step="1" required value={form.ticket_price} onChange={e => set('ticket_price', e.target.value)} /></F>
          <F label="Max Tickets (optional)"><input style={s.input} type="number" min="1" placeholder="Unlimited" value={form.max_tickets} onChange={e => set('max_tickets', e.target.value)} /></F>
        </div>
        <div style={s.row}>
          <F label="Prize Cost ($)" hint="What the prize cost your organization"><input style={s.input} type="number" min="0" step="1" placeholder="0" value={form.prize_cost} onChange={e => set('prize_cost', e.target.value)} /></F>
        </div>

        <div style={s.row}>
          <F label="Entry Type">
            <select style={s.input} value={form.entry_type} onChange={e => set('entry_type', e.target.value)}>
              <option value="multiple">Multiple entries allowed</option>
              <option value="single">Single entry only</option>
            </select>
          </F>
          {form.entry_type === 'multiple' && (
            <F label="Max Tickets Per Person (optional)"><input style={s.input} type="number" min="1" value={form.max_tickets_per_person} onChange={e => set('max_tickets_per_person', e.target.value)} /></F>
          )}
        </div>

        <div style={s.row}>
          <F label="Drawing Type">
            <select style={s.input} value={form.drawing_type} onChange={e => set('drawing_type', e.target.value)}>
              <option value="closed">Closed drawing</option>
              <option value="live">Live drawing (YouTube)</option>
            </select>
          </F>
          {form.drawing_type === 'live' && (
            <F label="YouTube Link"><input style={s.input} placeholder="https://youtube.com/..." value={form.youtube_link} onChange={e => set('youtube_link', e.target.value)} /></F>
          )}
        </div>

        <div style={s.row}>
          <F label="Category">
            <select style={s.input} value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </F>
          <F label="End Date (optional)"><input style={s.input} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></F>
        </div>

        <div style={s.categoryAdd}>
          <input style={{ ...s.input, flex: 1 }} placeholder="New category name" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
          <button type="button" style={{ ...s.btnSm, background: primary }} onClick={addCategory}>Add Category</button>
        </div>

        <F label="Photos (max 6, max 10 Megabytes each)" hint="Select up to 6 photos from your phone or computer">
          <input type="file" accept="image/*" multiple onChange={e => setNewImages(Array.from(e.target.files).slice(0, 6))} />
          {newImages.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {newImages.map((file, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`preview ${i + 1}`}
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '2px solid #ddd' }}
                  />
                  <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, borderRadius: 3, padding: '1px 4px' }}>{i + 1}</div>
                </div>
              ))}
            </div>
          )}
        </F>

        <label style={{ ...s.checkLabel }}>
          <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
          Active — visible to the public (requires disclaimer to be set)
        </label>

        {!disclaimerSet && (
          <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#7f4f00', marginBottom: 4 }}>
            ⚠️ A disclaimer must be set in <strong>Settings → Disclaimer</strong> before saving.
          </div>
        )}
        <div style={s.formBtns}>
          <button type="submit" disabled={!disclaimerSet} style={{ ...s.btn, background: primary, opacity: disclaimerSet ? 1 : 0.4, cursor: disclaimerSet ? 'pointer' : 'not-allowed' }}>{editing ? 'Save Changes' : 'Create Raffle'}</button>
          <button type="button" style={s.btnGray} onClick={() => { setView('list'); setEditing(null); setForm(emptyForm); }}>Cancel</button>
        </div>
      </form>
    </div>
  );

  return (
    <div>
      <div style={s.listHeader}>
        <div style={s.summaryCards}>
          <Card label="Active Raffles" value={raffles.filter(r => r.active).length} primary={primary} />
          <Card label="Total Tickets Sold" value={raffles.reduce((a, r) => a + (r.total_tickets || 0), 0)} primary={primary} />
          <Card label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} primary={primary} green />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <button style={{ ...s.btn, background: primary }} onClick={() => { setForm(emptyForm); setEditing(null); setView('form'); }}>+ New Raffle</button>
          {isMaster && (
            <button style={{ ...s.btn, background: '#757575', fontSize: 12 }} onClick={() => { setShowDeleted(!showDeleted); if (!showDeleted) loadDeleted(); }}>
              🗑 Deleted Raffles
            </button>
          )}
        </div>
      </div>

      {msg && <div style={s.msgBox}>{msg} <button style={s.dismiss} onClick={() => setMsg('')}>✕</button></div>}

      {!raffles.length && <p style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No raffles yet. Create your first one!</p>}

      {raffles.map(r => {
        const pct = r.max_tickets ? Math.round((r.total_tickets / r.max_tickets) * 100) : null;
        return (
          <div key={r.id} style={{ ...s.raffleRow, ...(r.sold_out ? s.raffleRowSoldOut : {}) }}>
            {r.images && r.images.length
              ? <img src={`/uploads/${r.images[0].filename}`} alt="" style={s.thumb} />
              : <div style={s.noThumb}>No Image</div>}
            <div style={s.raffleInfo}>
              <div style={s.raffleTitle}>
                {r.title}
                {r.sold_out && <Badge label="SOLD OUT" color="#c62828" />}
                {r.closed && !r.sold_out && <Badge label="CLOSED" color="#e65100" />}
                {!r.active && !r.closed && <Badge label="DRAFT" color="#9e9e9e" />}
                {r.active && <Badge label="ACTIVE" color="#2e7d32" />}
              </div>
              <div style={s.raffleMeta}>
                <span>${Number(r.ticket_price).toFixed(2)}/ticket</span>
                <span>🎟 {r.total_tickets || 0} sold</span>
                {r.max_tickets && <span>{r.tickets_remaining} remaining of {r.max_tickets}</span>}
                <span style={{ color: '#2e7d32', fontWeight: 600 }}>💰 ${Number(r.revenue || 0).toFixed(2)}</span>
              </div>
              {pct !== null && (
                <div style={s.progressWrap}>
                  <div style={{ ...s.progressBar, width: `${pct}%`, background: primary }} />
                </div>
              )}
            </div>
            <div style={s.raffleActions}>
              <button style={{ ...s.btnSm, background: primary }} onClick={() => onViewEntries(r)}>
                Entries ({r.entry_count || 0})
              </button>
              {!r.closed && !r.sold_out && (
                <>
                  <button style={s.btnSmGray} onClick={() => handleClose(r.id)}>Close</button>
                  <button style={s.btnSmGray} onClick={() => startEdit(r)}>Edit</button>
                  <button style={s.btnSmGray} onClick={() => handleDuplicate(r.id)}>Copy</button>
                  <button style={s.btnSmRed} onClick={() => handleDelete(r.id)}>Delete</button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {isMaster && showDeleted && (
        <div style={{ marginTop: 32 }}>
          {true && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#888', marginBottom: 10 }}>Deleted Raffles</h3>
              {deletedRaffles.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>No deleted raffles.</p>}
              {deletedRaffles.map(r => (
                <div key={r.id} style={{ ...s.raffleRow, opacity: 0.7, marginBottom: 8 }}>
                  <div style={s.raffleInfo}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      Deleted {r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <button style={{ ...s.btnSm, background: '#2e7d32' }} onClick={() => handleRestore(r.id)}>
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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

function Badge({ label, color }) {
  return <span style={{ background: color, color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, marginLeft: 6 }}>{label}</span>;
}

function Card({ label, value, primary, green }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', minWidth: 140, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: green ? '#2e7d32' : primary }}>{value}</div>
    </div>
  );
}

function WinnerStatus({ raffleId, primary, onComplete, onViewEntries, entryCount }) {
  const [winner, setWinner] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRaffleWinner(raffleId).then(data => setWinner(data));
  }, [raffleId]);

  if (!winner) return null;

  async function toggle(field, value) {
    setSaving(true);
    await updateWinnerStatus(raffleId, { [field]: value });
    setWinner(w => ({ ...w, [field]: value }));
    setSaving(false);
  }

  async function handleComplete() {
    if (!window.confirm('Mark this auction as completed? It will move to the Completed Auctions tab.')) return;
    await completeRaffle(raffleId);
    onComplete();
  }

  return (
    <div style={ws.wrap}>
      <div style={ws.row}>
        <button style={{ ...ws.entriesBtn, background: primary }} onClick={onViewEntries}>
          Entries ({entryCount})
        </button>
        <label style={ws.check}>
          <input type="checkbox" checked={!!winner.winner_contacted} disabled={saving}
            onChange={e => toggle('winner_contacted', e.target.checked)} />
          Winner Contacted
        </label>
        <label style={ws.check}>
          <input type="checkbox" checked={!!winner.prize_collected} disabled={saving || !winner.winner_contacted}
            onChange={e => toggle('prize_collected', e.target.checked)} />
          Prize Collected
        </label>
        {winner.prize_collected && (
          <button style={{ ...ws.completeBtn, background: '#2e7d32' }} onClick={handleComplete}>
            Move to Completed
          </button>
        )}
      </div>
      <div style={ws.winnerName}>Winner: {winner.name.split(' ')[0]} {winner.name.split(' ').slice(-1)[0][0]}.</div>
    </div>
  );
}

const ws = {
  wrap: { background: '#f9f9f9', borderRadius: 6, padding: '8px 12px', marginTop: 8, width: '100%' },
  row: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  winnerName: { fontSize: 13, color: '#333', marginTop: 4, fontWeight: 500 },
  completeBtn: { color: '#fff', border: 'none', borderRadius: 5, padding: '5px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  entriesBtn: { color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
};

const s = {
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  summaryCards: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  backBtn: { background: 'none', border: 'none', fontWeight: 600, fontSize: 13, padding: 0, marginBottom: 16, display: 'block' },
  form: { background: '#fff', borderRadius: 12, padding: 28, maxWidth: 640, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 14 },
  formTitle: { fontSize: 20, fontWeight: 800, marginBottom: 4 },
  input: { padding: '9px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  categoryAdd: { display: 'flex', gap: 8, alignItems: 'center' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500 },
  formBtns: { display: 'flex', gap: 10, marginTop: 4 },
  btn: { color: '#fff', border: 'none', borderRadius: 6, padding: '9px 18px', fontWeight: 600, fontSize: 13 },
  btnSm: { color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 12 },
  btnGray: { background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 6, padding: '9px 16px', fontWeight: 500, fontSize: 13 },
  btnSmGray: { background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 500, fontSize: 12 },
  btnSmRed: { background: '#c62828', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 500, fontSize: 12 },
  msgBox: { background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, padding: '10px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  dismiss: { background: 'none', border: 'none', cursor: 'pointer', color: '#2e7d32', fontWeight: 700 },
  raffleRow: { background: '#fff', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 10, flexWrap: 'wrap' },
  raffleRowSoldOut: { border: '2px solid #c62828', boxShadow: '0 0 0 3px rgba(198,40,40,0.15)' },
  thumb: { width: 80, height: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0 },
  noThumb: { width: 80, height: 80, background: '#eee', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#aaa', flexShrink: 0 },
  raffleInfo: { flex: 1, minWidth: 200 },
  raffleTitle: { fontSize: 15, fontWeight: 700, marginBottom: 5, display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
  raffleMeta: { display: 'flex', gap: 12, fontSize: 14, color: '#222', flexWrap: 'wrap', marginBottom: 6 },
  progressWrap: { height: 5, background: '#eee', borderRadius: 3, overflow: 'hidden', maxWidth: 300 },
  progressBar: { height: '100%', borderRadius: 3 },
  raffleActions: { display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 },
};
