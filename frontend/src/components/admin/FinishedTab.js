import React, { useEffect, useState } from 'react';
import { getFinishedRaffles, getRaffleWinner, updateWinnerStatus, completeRaffle } from '../../api';

export default function FinishedTab({ primary, onViewEntries, onMoveToCompleted }) {
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    getFinishedRaffles().then(data => {
      setRaffles(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p style={{ color: '#888' }}>Loading...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: primary, marginBottom: 16 }}>Finished Raffles</h2>

      {!raffles.length && (
        <p style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No finished raffles yet.</p>
      )}

      {raffles.map(r => (
        <div key={r.id} style={s.row}>
          {r.images && r.images.length
            ? <img src={`/uploads/${r.images[0].filename}`} alt="" style={s.thumb} />
            : <div style={s.noThumb}>No Image</div>}

          <div style={s.info}>
            <div style={s.title}>
              {r.title}
              <span style={{ ...s.badge, background: r.sold_out ? '#c62828' : '#555' }}>
                {r.sold_out ? 'SOLD OUT' : 'CLOSED'}
              </span>
            </div>
            <div style={s.meta}>
              ${Number(r.ticket_price).toFixed(2)}/ticket &nbsp;·&nbsp;
              {r.total_tickets || 0} tickets sold &nbsp;·&nbsp;
              <span style={{ color: '#2e7d32', fontWeight: 700 }}>
                ${Number(r.revenue || 0).toFixed(2)} revenue
              </span>
            </div>
            {r.end_date && (
              <div style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                End date: {new Date(r.end_date).toLocaleDateString()}
              </div>
            )}
            <WinnerStatus raffleId={r.id} primary={primary}
              onComplete={() => { load(); if (onMoveToCompleted) onMoveToCompleted(); }} />
          </div>

          <button style={{ ...s.btn, background: primary }} onClick={() => onViewEntries(r)}>
            Entries ({r.entry_count || 0})
          </button>
        </div>
      ))}
    </div>
  );
}

function WinnerStatus({ raffleId, primary, onComplete }) {
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
          <button style={ws.completeBtn} onClick={handleComplete}>
            Move to Completed
          </button>
        )}
      </div>
      <div style={ws.winnerName}>
        Winner: {winner.name.split(' ')[0]} {winner.name.split(' ').slice(-1)[0][0]}.
      </div>
    </div>
  );
}

const ws = {
  wrap: { background: '#f0f4ff', borderRadius: 6, padding: '8px 12px', marginTop: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  winnerName: { fontSize: 13, color: '#333', marginTop: 4, fontWeight: 500 },
  completeBtn: { background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 12px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
};

const s = {
  row: { background: '#fff', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  thumb: { width: 60, height: 60, objectFit: 'cover', borderRadius: 8, flexShrink: 0 },
  noThumb: { width: 60, height: 60, borderRadius: 8, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#aaa', flexShrink: 0 },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 },
  meta: { fontSize: 14, color: '#222' },
  badge: { color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700 },
  btn: { color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start' },
};
