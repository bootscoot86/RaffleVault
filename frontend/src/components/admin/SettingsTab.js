import React, { useEffect, useState } from 'react';

const DISCLAIMER_TEXT = `RaffleVault is a software platform provided solely as a fundraising management tool. RaffleVault, its developers, owners, and affiliates make no representation, warranty, or guarantee that the use of this platform complies with any applicable local, state, or federal laws, regulations, or licensing requirements governing charitable gaming, raffles, sweepstakes, or fundraising activities of any kind.

By using RaffleVault, you and any affiliates acknowledge and agree that:

1. You and any affiliates are solely and fully responsible for obtaining all required licenses, permits, and approvals necessary to legally conduct a raffle or charitable gaming event in your jurisdiction.

2. You and any affiliates are solely and fully responsible for ensuring compliance with all applicable local, state, and federal laws, including but not limited to laws governing charitable gaming, taxation, prize reporting, and consumer protection.

3. RaffleVault bears no liability whatsoever for any fines, penalties, legal action, license revocation, or other consequences arising from your failure to comply with applicable laws or regulations.

4. RaffleVault bears no liability for disputes between you and raffle participants, including but not limited to claims related to prizes, refunds, or drawing procedures.

5. You and any affiliates assume full legal responsibility for all raffle activity conducted through this platform and agree to indemnify and hold harmless RaffleVault, its developers, owners, and affiliates from any and all claims, damages, losses, or legal expenses arising from such activity.

Use of this platform constitutes full acceptance of these terms.`;

export default function SettingsTab({ role, primary }) {
  const [settings, setSettings] = useState({});
  const [acknowledgments, setAcknowledgments] = useState([]);
  const [form, setForm] = useState({});
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [msg, setMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const isMaster = role === 'master';

  useEffect(() => {
    fetch('/api/settings', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setForm({ smtp_host: 'smtp.gmail.com', smtp_port: '587', ...data });
      });
    if (isMaster) {
      fetch('/api/legal/acknowledgments', { credentials: 'include' })
        .then(r => r.json())
        .then(data => setAcknowledgments(Array.isArray(data) ? data : []));
    }
  }, []);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave(e) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v || ''));
    if (logo) fd.append('logo', logo);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      credentials: 'include',
      body: fd
    });
    const data = await res.json();
    if (data.error) { setMsg(data.error); return; }
    setMsg('Settings saved.');
  }

  async function toggleMaintenance() {
    const enabled = settings.maintenance_mode !== 'true';
    await fetch('/api/settings/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled })
    });
    setSettings(s => ({ ...s, maintenance_mode: enabled ? 'true' : 'false' }));
    setMsg(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}.`);
  }

  async function testEmail() {
    setTesting(true);
    setTestResult('');
    const res = await fetch('/api/settings/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        smtp_host: form.smtp_host, smtp_port: form.smtp_port,
        smtp_user: form.smtp_user, smtp_pass: form.smtp_pass,
        smtp_from: form.smtp_from, test_to: form.smtp_user
      })
    });
    const data = await res.json();
    setTestResult(data.success ? '✓ Test email sent successfully!' : `✗ ${data.error}`);
    setTesting(false);
  }

  return (
    <div>
      <h2 style={{ ...s.title, color: primary }}>Site Settings</h2>
      {msg && <div style={s.msg}>{msg} <button style={s.dismiss} onClick={() => setMsg('')}>✕</button></div>}

      {/* Contact Info — view for all, edit for master only */}
      <Section title="Organization Contact Info">
        {isMaster ? (
          <form onSubmit={handleSave} style={s.form}>
            <F label="Organization Name"><input style={s.input} value={form.org_name || ''} onChange={e => set('org_name', e.target.value)} /></F>
            <F label="Contact Email"><input style={s.input} type="email" value={form.org_email || ''} onChange={e => set('org_email', e.target.value)} /></F>
            <F label="Phone"><input style={s.input} value={form.org_phone || ''} onChange={e => set('org_phone', e.target.value)} /></F>
            <F label="Address"><input style={s.input} value={form.org_address || ''} onChange={e => set('org_address', e.target.value)} /></F>
            <F label="Website"><input style={s.input} value={form.org_website || ''} onChange={e => set('org_website', e.target.value)} /></F>
            <button type="submit" style={{ ...s.btn, background: primary }}>Save</button>
          </form>
        ) : (
          <div style={s.viewOnly}>
            <Row label="Organization" value={settings.org_name} />
            <Row label="Email" value={settings.org_email} />
            <Row label="Phone" value={settings.org_phone} />
            <Row label="Address" value={settings.org_address} />
            <Row label="Website" value={settings.org_website} />
          </div>
        )}
      </Section>

      {isMaster && (
        <>
          <Section title="Branding">
            <form onSubmit={handleSave} style={s.form}>
              <F label="Site Title"><input style={s.input} value={form.site_title || ''} onChange={e => set('site_title', e.target.value)} /></F>
              <F label="Tagline"><input style={s.input} value={form.tagline || ''} onChange={e => set('tagline', e.target.value)} /></F>
              <F label="Primary Color">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={form.primary_color || '#1a237e'} onChange={e => set('primary_color', e.target.value)} style={{ width: 48, height: 36, borderRadius: 4, border: '1px solid #ddd', padding: 2 }} />
                  <input style={{ ...s.input, flex: 1 }} value={form.primary_color || '#1a237e'} onChange={e => set('primary_color', e.target.value)} />
                </div>
              </F>
              <F label="Footer Text"><input style={s.input} value={form.footer_text || ''} onChange={e => set('footer_text', e.target.value)} /></F>
              <F label="Logo">
                {(logoPreview || settings.logo_url) && (
                  <div style={{ background: '#f0f0f0', borderRadius: 8, padding: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, border: '1px solid #ddd' }}>
                    <img
                      src={logoPreview || settings.logo_url}
                      alt="Logo preview"
                      style={{ maxHeight: 80, maxWidth: 260, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block', borderRadius: 4 }}
                    />
                  </div>
                )}
                <input type="file" accept="image/*" onChange={e => {
                  const file = e.target.files[0];
                  setLogo(file);
                  setLogoPreview(file ? URL.createObjectURL(file) : null);
                }} />
                {logoPreview && <span style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Preview — click Save Branding to apply</span>}
              </F>
              <button type="submit" style={{ ...s.btn, background: primary }}>Save Branding</button>
            </form>
          </Section>

          <Section title="Disclaimer">
            <form onSubmit={handleSave} style={s.form}>
              <F label="Disclaimer Text" hint="This will automatically appear after every raffle item description. Raffles cannot go live without this.">
                <textarea style={{ ...s.input, minHeight: 120, resize: 'vertical' }} value={form.disclaimer || ''} onChange={e => set('disclaimer', e.target.value)} />
              </F>
              <button type="submit" style={{ ...s.btn, background: primary }}>Save Disclaimer</button>
            </form>
          </Section>

          <Section title="Email Notifications">
            <form onSubmit={handleSave} style={s.form}>

              <div style={{ background: '#e8eaf6', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#333', lineHeight: 1.8 }}>
                <strong>📧 What is this?</strong><br />
                RaffleVault can send emails — like winner notifications — using your organization's Gmail account. You only need to set this up once.<br /><br />
                <strong>Step-by-step setup (takes about 5 minutes):</strong>
                <ol style={{ margin: '8px 0 0 16px', padding: 0, lineHeight: 2 }}>
                  <li>Sign into the Gmail account you want to send emails from.</li>
                  <li>Go to <strong>myaccount.google.com</strong> → Security → 2-Step Verification and make sure it is <strong>turned on</strong>.</li>
                  <li>Search for <strong>"App Passwords"</strong> in your Google account settings.</li>
                  <li>Create a new App Password — name it "RaffleVault". Google will show you a 16-character password.</li>
                  <li>Copy that password and paste it into the <strong>Gmail App Password</strong> field below.</li>
                </ol>
              </div>

              <F label="Your Gmail Address" hint="The Gmail account that will send emails (e.g. yourorg@gmail.com)">
                <input style={s.input} type="email" placeholder="yourorg@gmail.com" value={form.smtp_user || ''} onChange={e => set('smtp_user', e.target.value)} />
              </F>

              <F label="Gmail App Password" hint="The 16-character password generated in your Google account — NOT your regular Gmail password">
                <input style={s.input} type="password" placeholder="xxxx xxxx xxxx xxxx" value={form.smtp_pass || ''} onChange={e => set('smtp_pass', e.target.value)} />
              </F>

              <F label="Display Name (From Address)" hint='The name and email shown to recipients — e.g. "Post 751 Raffle <yourorg@gmail.com>"'>
                <input style={s.input} placeholder="Post 751 Raffle <yourorg@gmail.com>" value={form.smtp_from || ''} onChange={e => set('smtp_from', e.target.value)} />
              </F>


              {testResult && <div style={testResult.startsWith('✓') ? s.success : s.errMsg}>{testResult}</div>}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="submit" style={{ ...s.btn, background: primary }}>Save Email Settings</button>
                <button type="button" style={s.btnGray} onClick={testEmail} disabled={testing}>{testing ? 'Sending test...' : '📨 Send Test Email'}</button>
              </div>
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>After saving, click "Send Test Email" to confirm everything is working.</p>

            </form>
          </Section>

          <Section title="Payment Settings (Stripe)">
            <form onSubmit={handleSave} style={s.form}>
              <p style={{ fontSize: 13, color: '#333', background: '#f9f9f9', borderRadius: 6, padding: '10px 12px' }}>
                Enter your organization's Stripe API keys to enable card payments on raffle entries. Keys are kept private and never shared. Get your keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" style={{ color: primary }}>dashboard.stripe.com/apikeys</a>.
              </p>
              <F label="Stripe Publishable Key (pk_live_... or pk_test_...)">
                <input style={s.input} value={form.stripe_public_key || ''} onChange={e => set('stripe_public_key', e.target.value)} placeholder="pk_live_..." />
              </F>
              <F label="Stripe Secret Key (sk_live_... or sk_test_...)" hint="This is kept private on the server and never exposed to buyers.">
                <input style={s.input} type="password" value={form.stripe_secret_key || ''} onChange={e => set('stripe_secret_key', e.target.value)} placeholder="sk_live_..." />
              </F>
              {form.stripe_public_key && form.stripe_secret_key && (
                <div style={s.success}>✓ Stripe is configured — card payments will be collected on entry forms.</div>
              )}
              {(!form.stripe_public_key || !form.stripe_secret_key) && (
                <div style={{ fontSize: 13, color: '#e65100' }}>⚠ Stripe keys not set — entries will be recorded without payment collection.</div>
              )}
              <button type="submit" style={{ ...s.btn, background: primary }}>Save Payment Settings</button>
            </form>
          </Section>

          <Section title="Maintenance Mode">
            <p style={{ fontSize: 14, color: '#333', marginBottom: 12 }}>
              When maintenance mode is on, the public site shows "temporarily unavailable." Admins can still log in.
              Currently: <strong style={{ color: settings.maintenance_mode === 'true' ? '#c62828' : '#2e7d32' }}>
                {settings.maintenance_mode === 'true' ? 'ON' : 'OFF'}
              </strong>
            </p>
            <button style={{ ...s.btn, background: settings.maintenance_mode === 'true' ? '#2e7d32' : '#c62828' }} onClick={toggleMaintenance}>
              {settings.maintenance_mode === 'true' ? 'Turn Maintenance Off' : 'Turn Maintenance On'}
            </button>
          </Section>
        <Section title="Legal — RaffleVault Platform Disclaimer">
          <div style={{ background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 8, padding: 16, fontSize: 13, color: '#333', lineHeight: 1.8, whiteSpace: 'pre-line', marginBottom: 16 }}>
            {DISCLAIMER_TEXT}
          </div>
          {acknowledgments.length > 0 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 8 }}>Acknowledgment Records</div>
              {acknowledgments.map(a => (
                <div key={a.id} style={{ background: '#e8f5e9', borderRadius: 6, padding: '10px 14px', marginBottom: 8, fontSize: 13 }}>
                  ✓ Accepted by <strong>{a.admin_name}</strong> (@{a.admin_username}) on {new Date(a.acknowledged_at).toLocaleString()}
                  {a.ip_address && <span style={{ color: '#555' }}> · IP: {a.ip_address}</span>}
                </div>
              ))}
            </div>
          )}
        </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #e8eaf6' }}>{title}</h3>
      {children}
    </div>
  );
}

function F({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, fontWeight: 500 }}>
      {label}
      {hint && <span style={{ fontSize: 13, color: '#444', fontWeight: 400 }}>{hint}</span>}
      {children}
    </label>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14 }}>
      <span style={{ color: '#444', minWidth: 120 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value || '—'}</span>
    </div>
  );
}

const s = {
  title: { fontSize: 20, fontWeight: 800, marginBottom: 20 },
  msg: { background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, display: 'flex', justifyContent: 'space-between' },
  dismiss: { background: 'none', border: 'none', cursor: 'pointer', color: '#2e7d32', fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 },
  input: { padding: '9px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 },
  btn: { color: '#fff', border: 'none', borderRadius: 6, padding: '9px 18px', fontWeight: 600, fontSize: 13, alignSelf: 'flex-start' },
  btnGray: { background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 6, padding: '9px 16px', fontWeight: 500, fontSize: 13 },
  viewOnly: { background: '#fff', borderRadius: 10, padding: '8px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  success: { background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, padding: '8px 12px', fontSize: 13 },
  errMsg: { background: '#ffebee', color: '#c62828', borderRadius: 6, padding: '8px 12px', fontSize: 13 },
};
