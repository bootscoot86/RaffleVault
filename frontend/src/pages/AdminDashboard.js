import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogout } from '../api';
import { SettingsContext } from '../App';
import useInactivityTimeout from '../hooks/useInactivityTimeout';
import RafflesTab from '../components/admin/RafflesTab';
import EntriesTab from '../components/admin/EntriesTab';
import UsersTab from '../components/admin/UsersTab';
import AuditTab from '../components/admin/AuditTab';
import SettingsTab from '../components/admin/SettingsTab';
import FinishedTab from '../components/admin/FinishedTab';
import CompletedTab from '../components/admin/CompletedTab';
import ReportsTab from '../components/admin/ReportsTab';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const settings = useContext(SettingsContext);
  const primary = settings.primary_color || '#1a237e';
  const name = localStorage.getItem('rv_name');
  const role = localStorage.getItem('rv_role');
  const isMaster = role === 'master';
  const pwExpiresDays = parseInt(localStorage.getItem('rv_pw_expires') ?? '999', 10);
  const showPwWarning = pwExpiresDays <= 15;
  const [tab, setTab] = useState('raffles');
  const [selectedRaffle, setSelectedRaffle] = useState(null);
  const [showEntries, setShowEntries] = useState(false);
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  function openEntries(raffle) { setSelectedRaffle(raffle); setShowEntries(true); }
  function closeEntries() { setShowEntries(false); setSelectedRaffle(null); }

  useEffect(() => {
    if (!role) navigate('/admin');
  }, []);

  async function handleLogout() {
    await adminLogout();
    localStorage.removeItem('rv_name');
    localStorage.removeItem('rv_role');
    localStorage.removeItem('rv_pw_expires');
    navigate('/admin');
  }

  const handleWarn = useCallback((seconds) => {
    setCountdown(seconds);
    setTimeoutWarning(true);
    // Tick the countdown down every second
    let remaining = seconds;
    const ticker = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) clearInterval(ticker);
    }, 1000);
  }, []);

  const handleInactivityLogout = useCallback(async () => {
    setTimeoutWarning(false);
    await adminLogout();
    localStorage.removeItem('rv_name');
    localStorage.removeItem('rv_role');
    localStorage.removeItem('rv_pw_expires');
    navigate('/admin');
  }, [navigate]);

  const { stayLoggedIn } = useInactivityTimeout({
    onWarn: handleWarn,
    onLogout: handleInactivityLogout
  });

  function handleStayLoggedIn() {
    setTimeoutWarning(false);
    setCountdown(60);
    stayLoggedIn();
  }

  const tabs = [
    { id: 'raffles', label: 'Raffles' },
    { id: 'finished', label: 'Finished Raffles' },
    { id: 'completed', label: 'Completed Auctions' },
    ...(isMaster ? [
      { id: 'users', label: 'Admin Users' },
      { id: 'audit', label: 'Audit Log' },
      { id: 'reports', label: 'Financial Report' },
    ] : []),
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div>
      {timeoutWarning && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>⏱️</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#c62828', textAlign: 'center', marginBottom: 8 }}>
              Session Expiring
            </h2>
            <p style={{ fontSize: 15, color: '#333', textAlign: 'center', marginBottom: 6 }}>
              You have been inactive for 15 minutes.
            </p>
            <p style={{ fontSize: 15, color: '#333', textAlign: 'center', marginBottom: 24 }}>
              You will be automatically logged out in{' '}
              <strong style={{ color: '#c62828', fontSize: 20 }}>{countdown}</strong> second{countdown !== 1 ? 's' : ''}.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={{ ...s.stayBtn, background: primary }} onClick={handleStayLoggedIn}>
                Stay Logged In
              </button>
              <button style={s.logoutNowBtn} onClick={handleInactivityLogout}>
                Logout Now
              </button>
            </div>
          </div>
        </div>
      )}
      {showPwWarning && (
        <div style={s.pwWarning}>
          ⚠️ Your password {pwExpiresDays === 0 ? 'has expired' : `expires in ${pwExpiresDays} day${pwExpiresDays !== 1 ? 's' : ''}`}.
          {' '}<a href="/admin/change-password" style={{ color: '#7f4f00', fontWeight: 700, textDecoration: 'underline' }}>Change it now</a>
        </div>
      )}
      <div style={s.header} className="admin-header">
        <div>
          <h1 style={{ ...s.heading, color: primary }}>Admin Dashboard</h1>
          <span style={s.welcome}>{isMaster ? '⭐ Master Admin' : 'Admin'} — {name}</span>
        </div>
        <div style={s.tabBar} className="admin-tabs">
          {tabs.map(t => (
            <button key={t.id}
              style={tab === t.id && !showEntries ? { ...s.tab, ...s.tabActive, background: primary } : s.tab}
              onClick={() => { setTab(t.id); setShowEntries(false); setSelectedRaffle(null); }}>
              {t.label}
            </button>
          ))}
        </div>
        <button style={s.logout} onClick={handleLogout}>Logout</button>
      </div>

      {showEntries
        ? <EntriesTab raffle={selectedRaffle} primary={primary} onBack={closeEntries} />
        : <>
            {tab === 'raffles' && <RafflesTab role={role} primary={primary} onViewEntries={openEntries} />}
            {tab === 'completed' && <CompletedTab primary={primary} onViewEntries={openEntries} />}
            {tab === 'finished' && <FinishedTab primary={primary} onViewEntries={openEntries} />}
          </>
      }
      {tab === 'users' && isMaster && <UsersTab primary={primary} />}
      {tab === 'audit' && isMaster && <AuditTab primary={primary} />}
      {tab === 'reports' && isMaster && <ReportsTab primary={primary} />}
      {tab === 'settings' && <SettingsTab role={role} primary={primary} />}
    </div>
  );
}

const s = {
  pwWarning: { background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14, color: '#7f4f00', fontWeight: 500 },
  header: { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  heading: { fontSize: 22, fontWeight: 800 },
  welcome: { fontSize: 13, color: '#888' },
  tabBar: { display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 },
  tab: { background: '#e8eaf6', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 500, color: '#1a237e', fontSize: 13 },
  tabActive: { color: '#fff', fontWeight: 700 },
  logout: { background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '8px 14px', color: '#666', fontSize: 13 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 14, padding: 36, maxWidth: 400, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' },
  stayBtn: { color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  logoutNowBtn: { background: '#f5f5f5', color: '#555', border: '1px solid #ddd', borderRadius: 8, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
};
