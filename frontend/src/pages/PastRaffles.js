import React, { useEffect, useState, useContext } from 'react';
import { SettingsContext } from '../App';

export default function PastRaffles() {
  const settings = useContext(SettingsContext);
  const primary = settings.primary_color || '#1a237e';

  // Past raffles are closed/sold out — fetched from public endpoint filtered client side
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/raffles/past')
      .then(r => r.json())
      .then(data => { setRaffles(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  if (loading) return <p style={s.msg}>Loading...</p>;

  return (
    <div>
      <h1 style={{ ...s.heading, color: primary }}>Past Raffles</h1>
      {!raffles.length
        ? <p style={s.msg}>No past raffles yet.</p>
        : <div style={s.grid}>
            {raffles.map(r => (
              <div key={r.id} style={s.card}>
                {r.images && r.images.length
                  ? <img src={`/uploads/${r.images[0].filename}`} alt={r.title} style={s.img} />
                  : <div style={s.noImg}>No Image</div>}
                <div style={s.body}>
                  <h3 style={s.title}>{r.title}</h3>
                  <div style={s.meta}>
                    <span>{r.total_tickets} tickets sold</span>
                    {r.end_date && <span>Ended {new Date(r.end_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

const s = {
  heading: { fontSize: 26, fontWeight: 800, marginBottom: 20 },
  msg: { textAlign: 'center', marginTop: 60, color: '#666', fontSize: 18 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 },
  card: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' },
  img: { width: '100%', height: 180, objectFit: 'cover' },
  noImg: { height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eee', color: '#aaa' },
  body: { padding: '12px 14px' },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  meta: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888' },
};
