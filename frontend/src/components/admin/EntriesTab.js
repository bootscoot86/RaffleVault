import React, { useEffect, useState } from 'react';
import { getRaffleEntries, getRaffleWinner, drawWinner } from '../../api';

export default function EntriesTab({ raffle, primary, onBack }) {
  const [entries, setEntries] = useState([]);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!raffle) return;
    Promise.all([
      getRaffleEntries(raffle.id),
      getRaffleWinner(raffle.id)
    ]).then(([e, w]) => {
      setEntries(Array.isArray(e) ? e : []);
      setWinner(w);
      setLoading(false);
    });
  }, [raffle]);

  async function handleDraw() {
    if (!window.confirm('Draw a winner now? This cannot be undone without master admin authorization.')) return;
    setDrawing(true);
    const res = await drawWinner(raffle.id);
    setDrawing(false);
    if (res.error) { setMsg(res.error); return; }
    setWinner({ ...res.winner, drawn_at: new Date().toISOString() });
    setMsg('Winner drawn successfully.');
  }

  function exportCSV() {
    const headers = ['Name', 'Email', 'Phone', 'Address', 'Tickets', 'Date Entered'];
    const rows = entries.map(e => [
      e.name, e.email, e.phone || '', e.address || '',
      e.quantity, new Date(e.created_at).toLocaleString()
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${raffle.title}-entries.csv`;
    a.click();
  }

  if (!raffle) return <p style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>Select a raffle from the Raffles tab to view entries.</p>;
  if (loading) return <p style={{ color: '#888' }}>Loading entries...</p>;

  const totalTickets = entries.reduce((a, e) => a + e.quantity, 0);
  const revenue = (totalTickets * Number(raffle.ticket_price)).toFixed(2);
  const canDraw = (raffle.closed || raffle.sold_out) && !winner;

  return (
    <div>
      <div style={s.header}>
        <div>
          <button style={{ ...s.backBtn, color: primary }} onClick={onBack}>← Back to Raffles</button>
          <h2 style={{ ...s.title, color: primary }}>{raffle.title} — Entries</h2>
          <div style={s.stats}>
            <Chip label={`${entries.length} entrants`} />
            <Chip label={`${totalTickets} tickets`} />
            <Chip label={`$${revenue} revenue`} green />
            {raffle.max_tickets && <Chip label={`${raffle.tickets_remaining} remaining`} />}
          </div>
        </div>
        <div style={s.actions}>
          {canDraw && (
            <button style={{ ...s.btn, background: primary }} onClick={handleDraw} disabled={drawing}>
              {drawing ? 'Drawing...' : '🎲 Draw Winner'}
            </button>
          )}
          <button style={s.btnGray} onClick={exportCSV}>📥 Export Comma Separated Values</button>
          <button style={s.btnGray} onClick={() => window.print()}>🖨️ Print</button>
        </div>
      </div>

      {msg && <div style={s.msg}>{msg}</div>}

      {winner && (
        <div style={s.winnerBox}>
          <strong>🏆 Winner:</strong> {winner.name} — {winner.email}
          {winner.phone ? ` · ${winner.phone}` : ''} · {winner.quantity} ticket(s)
          {winner.notification_sent
            ? <span style={s.notified}> ✓ Notified {new Date(winner.notification_sent_at).toLocaleDateString()}</span>
            : <span style={s.pending}> ⏳ Winner notification not yet sent</span>}
        </div>
      )}

      {!entries.length
        ? <p style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No entries yet.</p>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['#', 'Name', 'Email', 'Phone', 'Address', 'Tickets', 'Date Entered'].map(h => (
                    <th key={h} style={{ ...s.th, background: primary }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={s.td}>{e.name}</td>
                    <td style={s.td}>{e.email}</td>
                    <td style={s.td}>{e.phone || '—'}</td>
                    <td style={s.td}>{e.address || '—'}</td>
                    <td style={{ ...s.td, textAlign: 'center', fontWeight: 700 }}>{e.quantity}</td>
                    <td style={s.td}>{new Date(e.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function Chip({ label, green }) {
  return <span style={{ background: green ? '#e8f5e9' : '#e8eaf6', color: green ? '#2e7d32' : '#1a237e', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{label}</span>;
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  backBtn: { background: 'none', border: 'none', fontWeight: 600, fontSize: 13, padding: 0, marginBottom: 6, display: 'block' },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 8 },
  stats: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' },
  btn: { color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontWeight: 600, fontSize: 13 },
  btnGray: { background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 6, padding: '9px 16px', fontWeight: 500, fontSize: 13 },
  msg: { background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 14 },
  winnerBox: { background: '#fff9c4', border: '1px solid #f9a825', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  notified: { color: '#2e7d32', fontWeight: 600 },
  pending: { color: '#e65100', fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 14, borderRadius: 10, overflow: 'hidden' },
  th: { color: '#fff', padding: '10px 14px', textAlign: 'left', fontSize: 13, whiteSpace: 'nowrap' },
  td: { padding: '10px 14px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', color: '#222' },
};
