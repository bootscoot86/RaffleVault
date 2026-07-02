import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { getRaffles } from '../api';
import { SettingsContext } from '../App';

export default function RaffleList() {
  const settings = useContext(SettingsContext);
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRaffles().then(data => {
      setRaffles(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const primary = settings.primary_color || '#1a237e';

  if (loading) return <p style={s.msg}>Loading raffles...</p>;

  return (
    <div>
      {settings.tagline && <p style={s.tagline}>{settings.tagline}</p>}
      <h1 style={{ ...s.heading, color: primary }}>Current Raffles</h1>
      {!raffles.length
        ? <p style={s.msg}>No active raffles at this time. Check back soon!</p>
        : <div style={s.grid} className="raffle-grid">
            {raffles.map(r => <RaffleCard key={r.id} raffle={r} primary={primary} />)}
          </div>
      }
    </div>
  );
}

function RaffleCard({ raffle: r, primary }) {
  const firstImage = r.images && r.images.length ? r.images[0] : null;
  const pct = r.max_tickets ? Math.round((r.total_tickets / r.max_tickets) * 100) : null;

  return (
    <Link to={`/raffle/${r.id}`} style={s.card}>
      <div style={s.imgWrap}>
        {firstImage
          ? <img src={`/uploads/${firstImage.filename}`} alt={r.title} style={s.img} />
          : <div style={s.noImg}>No Image</div>}
        {r.sold_out && <div style={s.soldBadge}>SOLD OUT</div>}
      </div>
      <div style={s.body}>
        <h2 style={s.title}>{r.title}</h2>
        <p style={s.desc}>{r.description?.slice(0, 90)}{r.description?.length > 90 ? '…' : ''}</p>
        {pct !== null && (
          <div style={s.progressWrap}>
            <div style={{ ...s.progressBar, width: `${pct}%`, background: primary }} />
          </div>
        )}
        <div style={s.footer}>
          <span style={{ ...s.price, color: primary }}>${Number(r.ticket_price).toFixed(2)}/ticket</span>
          {r.tickets_remaining !== null && !r.sold_out && (
            <span style={s.remaining}>{r.tickets_remaining} left</span>
          )}
          {r.end_date && <span style={s.date}>{new Date(r.end_date).toLocaleDateString()}</span>}
        </div>
        <button style={{ ...s.btn, background: primary }}>Enter to Win</button>
      </div>
    </Link>
  );
}

const s = {
  heading: { fontSize: 28, fontWeight: 800, marginBottom: 8 },
  tagline: { color: '#333', marginBottom: 16, fontSize: 16 },
  msg: { textAlign: 'center', marginTop: 60, color: '#333', fontSize: 18 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 },
  card: { background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  imgWrap: { width: '100%', height: 210, overflow: 'hidden', background: '#eee', position: 'relative' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 14 },
  soldBadge: { position: 'absolute', top: 0, left: 0, right: 0, background: '#c62828', color: '#fff', textAlign: 'center', padding: '6px 0', fontSize: 13, fontWeight: 800, letterSpacing: 2 },
  body: { padding: '1rem', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  title: { fontSize: 17, fontWeight: 700 },
  desc: { fontSize: 14, color: '#333', flex: 1 },
  progressWrap: { height: 5, background: '#eee', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  price: { fontSize: 15, fontWeight: 700 },
  remaining: { fontSize: 12, color: '#e65100', fontWeight: 600 },
  date: { fontSize: 13, color: '#444' },
  btn: { marginTop: 4, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 14, width: '100%' },
};
