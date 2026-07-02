import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { getPublicSettings, getSetupStatus } from './api';
import RaffleList from './pages/RaffleList';
import RaffleDetail from './pages/RaffleDetail';
import PastRaffles from './pages/PastRaffles';
import SetupWizard from './pages/SetupWizard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Maintenance from './pages/Maintenance';
import ChangePassword from './pages/ChangePassword';

export const SettingsContext = React.createContext({});

function Navbar({ settings }) {
  const primaryColor = settings.primary_color || '#1a237e';
  return (
    <nav style={{ ...s.nav, background: primaryColor }}>
      <Link to="/" style={s.brand}>
        {settings.logo_url
          ? <img src={settings.logo_url} alt="Logo" style={s.logo} />
          : <span style={s.star}>★</span>}
        {settings.site_title || 'RaffleVault'}
      </Link>
      <div style={s.navCenter}>
        {settings.logo_url && (
          <img src={settings.logo_url} alt="Organization Logo" style={s.centerLogo} />
        )}
      </div>
      <div style={s.navLinks}></div>
    </nav>
  );
}

function Footer({ settings }) {
  return (
    <footer style={s.footer}>
      {settings.footer_text || `© ${new Date().getFullYear()} ${settings.org_name || 'RaffleVault'} — All rights reserved`}
    </footer>
  );
}

export default function App() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);

  useEffect(() => {
    async function init() {
      const status = await getSetupStatus();
      if (!status.setup_complete) { setSetupNeeded(true); setLoading(false); return; }
      const s = await getPublicSettings();
      setSettings(s);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <div style={s.loading}>Loading...</div>;
  if (setupNeeded) return <SetupWizard onComplete={() => window.location.reload()} />;
  if (settings.maintenance_mode === 'true') return <Maintenance settings={settings} />;

  return (
    <SettingsContext.Provider value={settings}>
      <BrowserRouter>
        <Navbar settings={settings} />
        <main style={s.main}>
          <Routes>
            <Route path="/" element={<RaffleList />} />
            <Route path="/raffle/:id" element={<RaffleDetail />} />
            <Route path="/past" element={<PastRaffles />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
            <Route path="/admin/change-password" element={<ChangePassword />} />
          </Routes>
        </main>
        <Footer settings={settings} />
      </BrowserRouter>
    </SettingsContext.Provider>
  );
}

const s = {
  nav: { color: '#fff', padding: '0 2rem', height: 112, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  brand: { color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, flex: 1 },
  logo: { maxHeight: 52, maxWidth: 180, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block', borderRadius: 4 },
  star: { color: '#ffd700', fontSize: 24 },
  navCenter: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  centerLogo: { maxHeight: 80, maxWidth: 220, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block', borderRadius: 6, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' },
  navLinks: { display: 'flex', gap: 20, alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  navLink: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500 },
  main: { maxWidth: 1140, margin: '2rem auto', padding: '0 1rem', minHeight: 'calc(100vh - 140px)' },
  footer: { textAlign: 'center', padding: '1.2rem', color: '#888', fontSize: 13, borderTop: '1px solid #e0e0e0', background: '#fff' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 18, color: '#666' },
};
