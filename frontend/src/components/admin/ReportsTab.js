import React, { useState } from 'react';
import { getRevenueReport } from '../../api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const now = new Date();

export default function ReportsTab({ primary }) {
  const [period, setPeriod] = useState('year');
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 10; y--) years.push(String(y));

  async function runReport() {
    setLoading(true);
    const params = { period, year };
    if (period === 'month') params.month = month;
    const data = await getRevenueReport(params);
    setReport(data);
    setLoading(false);
  }

  function periodLabel() {
    if (period === 'year') return `Year ${year}`;
    if (period === 'month') return `${MONTHS[parseInt(month) - 1]} ${year}`;
    return '';
  }

  function handlePrint() { window.print(); }

  return (
    <div>
      <div style={s.header}>
        <h2 style={{ ...s.title, color: primary }}>Financial Report</h2>
        {report && (
          <button style={{ ...s.printBtn, background: primary }} onClick={handlePrint}>
            🖨️ Print / Save PDF
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={s.filters}>
        <div style={s.filterGroup}>
          <label style={s.filterLabel}>Period</label>
          <select style={s.select} value={period} onChange={e => { setPeriod(e.target.value); setReport(null); }}>
            <option value="year">Yearly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
        <div style={s.filterGroup}>
          <label style={s.filterLabel}>Year</label>
          <select style={s.select} value={year} onChange={e => { setYear(e.target.value); setReport(null); }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {period === 'month' && (
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Month</label>
            <select style={s.select} value={month} onChange={e => { setMonth(e.target.value); setReport(null); }}>
              {MONTHS.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
            </select>
          </div>
        )}
        <button style={{ ...s.runBtn, background: primary }} onClick={runReport} disabled={loading}>
          {loading ? 'Loading...' : 'Run Report'}
        </button>
      </div>

      {report && (
        <div style={s.reportWrap}>
          {/* Summary Cards */}
          <h3 style={s.sectionTitle}>Summary — {periodLabel()}</h3>
          <div style={s.cards}>
            <SummaryCard label="Total Income" value={`$${Number(report.summary?.total_revenue || 0).toFixed(2)}`} color="#1a237e" />
            <SummaryCard label="Total Prize Cost" value={`$${Number(report.summary?.total_prize_cost || 0).toFixed(2)}`} color="#c62828" />
            <SummaryCard label="Gross Profit" value={`$${Number(report.summary?.total_profit || 0).toFixed(2)}`} color="#2e7d32" />
            <SummaryCard label="Total Tickets Sold" value={report.summary?.total_tickets || 0} color="#555" />
          </div>

          {/* Stripe Fee Breakdown */}
          {Number(report.summary?.total_revenue || 0) > 0 && (
            <div style={s.cards}>
              <div style={sc.card}>
                <div style={sc.label}>Stripe Fees (2.9% + $0.30/ticket)</div>
                <div style={{ ...sc.value, color: '#c62828' }}>
                  −${stripeTotal(report.summary?.total_revenue || 0, report.summary?.total_tickets || 0)}
                </div>
              </div>
              <div style={sc.card}>
                <div style={sc.label}>Profit After Stripe & Prize Cost</div>
                <div style={{ ...sc.value, color: '#6b21a8' }}>
                  ${(Number(stripeNet(report.summary?.total_revenue || 0, report.summary?.total_tickets || 0)) - Number(report.summary?.total_prize_cost || 0)).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Breakdown chart (text-based) */}
          {report.breakdown && report.breakdown.length > 0 && (
            <div style={s.section}>
              <h3 style={s.sectionTitle}>{period === 'year' ? 'Monthly Breakdown' : 'Daily Breakdown'}</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>{period === 'year' ? 'Month' : 'Day'}</th>
                    <th style={s.th}>Tickets Sold</th>
                    <th style={s.th}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.breakdown.map((row, i) => (
                    <tr key={i} style={i % 2 === 0 ? s.rowEven : {}}>
                      <td style={s.td}>
                        {period === 'year' ? MONTHS[row.month - 1] : `Day ${row.day}`}
                      </td>
                      <td style={s.td}>{row.tickets}</td>
                      <td style={{ ...s.td, color: '#2e7d32', fontWeight: 700 }}>
                        ${Number(row.revenue).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* By Raffle */}
          <div style={s.section}>
            <h3 style={s.sectionTitle}>Revenue by Raffle</h3>
            {!report.by_raffle?.length
              ? <p style={{ color: '#aaa', fontSize: 13 }}>No raffle data for this period.</p>
              : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Raffle</th>
                      <th style={s.th}>Ticket Price</th>
                      <th style={s.th}>Tickets Sold</th>
                      <th style={s.th}>Total Income</th>
                      <th style={s.th}>Prize Cost</th>
                      <th style={s.th}>Net Profit</th>
                      <th style={s.th}>Last Entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_raffle.map((r, i) => (
                      <tr key={r.id} style={i % 2 === 0 ? s.rowEven : {}}>
                        <td style={{ ...s.td, fontWeight: 600 }}>{r.title}</td>
                        <td style={s.td}>${Number(r.ticket_price).toFixed(2)}</td>
                        <td style={s.td}>{r.tickets_sold}</td>
                        <td style={{ ...s.td, color: '#1a237e', fontWeight: 700 }}>
                          ${Number(r.revenue).toFixed(2)}
                        </td>
                        <td style={{ ...s.td, color: '#c62828' }}>
                          ${Number(r.prize_cost || 0).toFixed(2)}
                        </td>
                        <td style={{ ...s.td, color: Number(r.profit) >= 0 ? '#2e7d32' : '#c62828', fontWeight: 700 }}>
                          ${Number(r.profit || 0).toFixed(2)}
                        </td>
                        <td style={s.td}>
                          {r.last_entry ? new Date(r.last_entry).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr style={s.totalRow}>
                      <td style={s.td} colSpan={2}><strong>TOTAL</strong></td>
                      <td style={s.td}><strong>{report.summary?.total_tickets || 0}</strong></td>
                      <td style={{ ...s.td, color: '#1a237e', fontWeight: 800 }}>
                        ${Number(report.summary?.total_revenue || 0).toFixed(2)}
                      </td>
                      <td style={{ ...s.td, color: '#c62828', fontWeight: 800 }}>
                        ${Number(report.summary?.total_prize_cost || 0).toFixed(2)}
                      </td>
                      <td style={{ ...s.td, color: '#2e7d32', fontWeight: 800, fontSize: 15 }}>
                        ${Number(report.summary?.total_profit || 0).toFixed(2)}
                      </td>
                      <td style={s.td} />
                    </tr>
                  </tbody>
                </table>
              )
            }
          </div>

          <div style={s.footer}>
            Report generated: {new Date().toLocaleString()} &nbsp;·&nbsp; Period: {periodLabel()}
          </div>
        </div>
      )}
    </div>
  );
}

function stripeTotal(revenue, tickets) {
  const fees = Number(revenue) * 0.029 + Number(tickets) * 0.30;
  return fees.toFixed(2);
}

function stripeNet(revenue, tickets) {
  const net = Number(revenue) - (Number(revenue) * 0.029 + Number(tickets) * 0.30);
  return net.toFixed(2);
}

function StripeRow({ label, value, red, green, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0e8ff' }}>
      <span style={{ fontSize: 13, color: '#555', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: red ? '#c62828' : green ? '#2e7d32' : '#333' }}>{value}</span>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={sc.card}>
      <div style={sc.label}>{label}</div>
      <div style={{ ...sc.value, color }}>{value}</div>
    </div>
  );
}

const sc = {
  card: { background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', minWidth: 140 },
  label: { fontSize: 13, color: '#444', marginBottom: 6, fontWeight: 500 },
  value: { fontSize: 24, fontWeight: 800 },
};

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 800 },
  filters: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 24 },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  filterLabel: { fontSize: 13, fontWeight: 600, color: '#333' },
  select: { padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, minWidth: 120 },
  runBtn: { color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  printBtn: { color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  reportWrap: { display: 'flex', flexDirection: 'column', gap: 24 },
  cards: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  section: { background: '#fff', borderRadius: 10, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#222' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#333', padding: '8px 12px', borderBottom: '2px solid #eee', textTransform: 'uppercase' },
  td: { padding: '10px 12px', fontSize: 14, color: '#222', borderBottom: '1px solid #f5f5f5' },
  rowEven: { background: '#fafafa' },
  totalRow: { background: '#f0f4ff', borderTop: '2px solid #e0e0e0' },
  footer: { fontSize: 12, color: '#555', textAlign: 'right', paddingTop: 8 },
};
