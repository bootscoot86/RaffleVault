import React, { useEffect, useState } from 'react';

const ACTION_LABELS = {
  LOGIN: '🔐 Login',
  LOGOUT: '🚪 Logout',
  LOGIN_FAILED: '⚠️ Failed Login',
  RAFFLE_CREATED: '➕ Raffle Created',
  RAFFLE_EDITED: '✏️ Raffle Edited',
  RAFFLE_DELETED: '🗑 Raffle Deleted',
  RAFFLE_CLOSED: '🔒 Raffle Closed',
  RAFFLE_DUPLICATED: '📋 Raffle Duplicated',
  WINNER_DRAWN: '🎲 Winner Drawn',
  WINNER_NOTIFIED: '📧 Winner Notified',
  ADMIN_USER_CREATED: '👤 Admin Created',
  ADMIN_USER_UPDATED: '✏️ Admin Updated',
  MASTER_TRANSFER: '⭐ Master Transferred',
  RECOVERY_CODE_USED: '🔑 Recovery Code Used',
  DISCLAIMER_CHANGED: '📄 Disclaimer Changed',
  SETTINGS_UPDATED: '⚙️ Settings Updated',
  MAINTENANCE_ON: '🔧 Maintenance On',
  MAINTENANCE_OFF: '✅ Maintenance Off',
};

export default function AuditTab({ primary }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  useEffect(() => {
    fetch('/api/auth/audit', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const filtered = logs.filter(l => {
    if (filter && !l.action.includes(filter.toUpperCase()) && !l.admin_username?.toLowerCase().includes(filter.toLowerCase())) return false;
    if (dateFrom && new Date(l.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(l.created_at) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const pages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loading) return <p style={{ color: '#888' }}>Loading audit log...</p>;

  return (
    <div>
      <h2 style={{ ...s.title, color: primary }}>Audit Log</h2>
      <div style={s.filters}>
        <input style={s.filterInput} placeholder="Search by admin or action..." value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} />
        <input style={s.filterInput} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input style={s.filterInput} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <span style={s.count}>{filtered.length} records</span>
      </div>

      {!paged.length
        ? <p style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No log entries found.</p>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Date & Time', 'Admin', 'Action', 'Details', 'Internet Protocol Address'].map(h => (
                    <th key={h} style={{ ...s.th, background: primary }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((l, i) => (
                  <tr key={l.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={s.td}>{new Date(l.created_at).toLocaleString()}</td>
                    <td style={s.td}>{l.admin_username || '—'}</td>
                    <td style={s.td}>{ACTION_LABELS[l.action] || l.action}</td>
                    <td style={{ ...s.td, maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-word', fontSize: 12 }}>
                      {l.details && Object.keys(l.details).length ? JSON.stringify(l.details) : '—'}
                    </td>
                    <td style={s.td}>{l.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {pages > 1 && (
        <div style={s.pagination}>
          <button style={s.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 13 }}>Page {page} of {pages}</span>
          <button style={s.pageBtn} disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

const s = {
  title: { fontSize: 20, fontWeight: 800, marginBottom: 16 },
  filters: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  filterInput: { padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 },
  count: { fontSize: 14, color: '#333', marginLeft: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 14 },
  th: { color: '#fff', padding: '10px 14px', textAlign: 'left', fontSize: 13, whiteSpace: 'nowrap' },
  td: { padding: '9px 14px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', color: '#222' },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 },
  pageBtn: { background: '#e8eaf6', border: 'none', borderRadius: 6, padding: '7px 14px', fontWeight: 600, fontSize: 13 },
};
