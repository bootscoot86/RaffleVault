import React, { useEffect, useState } from 'react';
import { getCompletedRaffles } from '../../api';

export default function CompletedTab({ primary, onViewEntries }) {
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompletedRaffles().then(data => {
      setRaffles(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <p style={{ color: '#888' }}>Loading...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: primary, marginBottom: 16 }}>Completed Auctions</h2>

      {!raffles.length && (
        <p style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No completed auctions yet.</p>
      )}

      {raffles.map(r => (
        <div key={r.id} style={s.row}>
          {r.images && r.images.length
            ? <img src={`/uploads/${r.images[0].filename}`} alt="" style={s.thumb} />
            : <div style={s.noThumb}>No Image</div>}

          <div style={s.info}>
            <div style={s.title}>
              {r.title}
              <span style={s.badge}>✓ COMPLETED</span>
            </div>
            <div style={s.meta}>
              ${Number(r.ticket_price).toFixed(2)}/ticket &nbsp;·&nbsp;
              {r.total_tickets || 0} tickets sold &nbsp;·&nbsp;
              <span style={{ color: '#2e7d32', fontWeight: 700 }}>
                ${Number(r.revenue || 0).toFixed(2)} revenue
              </span>
            </div>
            <div style={s.financials}>
              <span style={s.finItem}>
                <span style={s.finLabel}>Prize Cost</span>
                <span style={{ color: '#c62828', fontWeight: 700 }}>${Number(r.prize_cost || 0).toFixed(2)}</span>
              </span>
              <span style={s.finDivider}>|</span>
              <span style={s.finItem}>
                <span style={s.finLabel}>Net Profit</span>
                <span style={{ color: Number(r.revenue || 0) - Number(r.prize_cost || 0) >= 0 ? '#2e7d32' : '#c62828', fontWeight: 700 }}>
                  ${(Number(r.revenue || 0) - Number(r.prize_cost || 0)).toFixed(2)}
                </span>
              </span>
            </div>
            {r.completed_at && (
              <div style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                Completed: {new Date(r.completed_at).toLocaleDateString()}
              </div>
            )}
          </div>

          <button style={{ ...s.btn, background: primary }} onClick={() => onViewEntries(r)}>
            Entries ({r.entry_count || 0})
          </button>
        </div>
      ))}
    </div>
  );
}

const s = {
  row: { background: '#fff', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  thumb: { width: 60, height: 60, objectFit: 'cover', borderRadius: 8, flexShrink: 0 },
  noThumb: { width: 60, height: 60, borderRadius: 8, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#aaa', flexShrink: 0 },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 },
  meta: { fontSize: 14, color: '#222' },
  financials: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, marginTop: 4 },
  finItem: { display: 'flex', alignItems: 'center', gap: 5 },
  finLabel: { color: '#333', fontSize: 13, fontWeight: 500 },
  finDivider: { color: '#aaa' },
  badge: { background: '#2e7d32', color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700 },
  btn: { color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
};
