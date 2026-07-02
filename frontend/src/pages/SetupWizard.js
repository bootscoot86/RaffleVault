import React, { useState, useEffect } from 'react';
import { submitSetup } from '../api';

const DISCLAIMER_TEXT = `RaffleVault is a software platform provided solely as a fundraising management tool. RaffleVault, its developers, owners, and affiliates make no representation, warranty, or guarantee that the use of this platform complies with any applicable local, state, or federal laws, regulations, or licensing requirements governing charitable gaming, raffles, sweepstakes, or fundraising activities of any kind.

By using RaffleVault, you and any affiliates acknowledge and agree that:

1. You and any affiliates are solely and fully responsible for obtaining all required licenses, permits, and approvals necessary to legally conduct a raffle or charitable gaming event in your jurisdiction.

2. You and any affiliates are solely and fully responsible for ensuring compliance with all applicable local, state, and federal laws, including but not limited to laws governing charitable gaming, taxation, prize reporting, and consumer protection.

3. RaffleVault bears no liability whatsoever for any fines, penalties, legal action, license revocation, or other consequences arising from your failure to comply with applicable laws or regulations.

4. RaffleVault bears no liability for disputes between you and raffle participants, including but not limited to claims related to prizes, refunds, or drawing procedures.

5. You and any affiliates assume full legal responsibility for all raffle activity conducted through this platform and agree to indemnify and hold harmless RaffleVault, its developers, owners, and affiliates from any and all claims, damages, losses, or legal expenses arising from such activity.

Use of this platform constitutes full acceptance of these terms.`;

const steps = ['Organization Info', 'Master Admin Account', 'Confirm & Launch'];

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    org_name: '', org_email: '', org_phone: '', org_address: '', org_website: '',
    site_title: '', tagline: '',
    master_username: '', master_name: '', master_email: '', master_password: '', master_confirm: '',
    smtp_host: 'smtp.gmail.com', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '',
  });
  const [emailTested, setEmailTested] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [errors, setErrors] = useState({});
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [disclaimerSubmitting, setDisclaimerSubmitting] = useState(false);
  const [disclaimerDone, setDisclaimerDone] = useState(false);

  function set(key, value) { setData(d => ({ ...d, [key]: value })); }

  function validateStep() {
    const e = {};
    if (step === 0) {
      if (!data.org_name) e.org_name = 'Required';
      if (!data.org_email) e.org_email = 'Required';
    }
    if (step === 1) {
      if (!data.master_username) e.master_username = 'Required';
      if (!data.master_name) e.master_name = 'Required';
      if (!data.master_email) e.master_email = 'Required';
      if (!data.master_password) e.master_password = 'Required';
      const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
      if (data.master_password && !pwRegex.test(data.master_password))
        e.master_password = 'Must be 8+ characters with uppercase, number, and special character';
      if (data.master_password !== data.master_confirm) e.master_confirm = 'Passwords do not match';
    }
setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function testEmail() {
    setEmailTesting(true);
    setEmailError('');
    try {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp_host: data.smtp_host, smtp_port: data.smtp_port,
          smtp_user: data.smtp_user, smtp_pass: data.smtp_pass,
          smtp_from: data.smtp_from || data.smtp_user,
          test_to: data.smtp_user
        })
      });
      const result = await res.json();
      if (result.success) { setEmailTested(true); setEmailError(''); }
      else setEmailError(result.error || 'Test failed');
    } catch { setEmailError('Connection failed. Check your settings.'); }
    setEmailTesting(false);
  }

  async function handleLaunch() {
    setSubmitting(true);
    const res = await submitSetup(data);
    setSubmitting(false);
    if (res.error) { setErrors({ launch: res.error }); return; }
    setRecoveryCode(res.recovery_code);
    setStep(4); // Recovery code display
  }

  function next() { if (validateStep()) setStep(s => s + 1); }
  function prev() { setStep(s => s - 1); }

  // Step 4 — Recovery code + printable document
  if (step === 4 && recoveryCode && !disclaimerDone) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          {/* Screen view */}
          <div className="no-print">
            <div style={s.icon}>🔐</div>
            <h2 style={s.title}>Save Your Recovery Code</h2>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#555', marginBottom: 16 }}>
              Print this page and store it in a secure location. Your recovery code and platform disclaimer are included on the printed document.
            </p>
          </div>

          {/* Printable document — visible on screen too */}
          <div id="print-doc">
            <div style={{ borderBottom: '2px solid #1a237e', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1a237e', marginBottom: 2 }}>RaffleVault — Account Setup Document</div>
              <div style={{ fontSize: 13, color: '#555' }}>Print this page and store it in a secure location. This information will not be shown again.</div>
            </div>

            <table style={{ width: '100%', fontSize: 14, marginBottom: 16, borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ padding: '5px 0', fontWeight: 600, width: 160 }}>Organization:</td><td>{data.org_name}</td></tr>
                <tr><td style={{ padding: '5px 0', fontWeight: 600 }}>Admin Username:</td><td>@{data.master_username}</td></tr>
                <tr><td style={{ padding: '5px 0', fontWeight: 600 }}>Admin Name:</td><td>{data.master_name}</td></tr>
                <tr><td style={{ padding: '5px 0', fontWeight: 600 }}>Date Created:</td><td>{new Date().toLocaleString()}</td></tr>
              </tbody>
            </table>

            <div style={s.recoveryBox}>
              <p style={s.recoveryLabel}>RAFFLEVAULT — MASTER ADMIN RECOVERY CODE</p>
              <p style={s.recoveryOrg}>{data.org_name}</p>
              <p style={s.recoveryDate}>Generated: {new Date().toLocaleDateString()}</p>
              <div style={s.code}>{recoveryCode}</div>
            </div>

            <div style={s.warning}>
              <strong>⚠️ IMPORTANT — DO NOT DISCARD</strong>
              <p>This code is the only way to recover access to your RaffleVault master admin account if it is ever lost or unavailable. This code is displayed one time only and cannot be retrieved again.</p>
              <p>Store this document in a secure location such as a locked safe or lockbox. At least two trusted members of your organization should know where it is kept.</p>
            </div>

            <div style={{ borderTop: '2px solid #1a237e', paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>RaffleVault Platform Disclaimer — Acknowledgment</div>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{DISCLAIMER_TEXT}</div>
              <table style={{ width: '100%', fontSize: 13, marginTop: 14, borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ padding: '5px 0', fontWeight: 600, width: 160 }}>Accepted by:</td><td>{data.master_name}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 600 }}>Username:</td><td>@{data.master_username}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 600 }}>Date &amp; Time:</td><td>{new Date().toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee', fontSize: 11, color: '#888', textAlign: 'center' }}>
              RaffleVault — Confidential Account Document
            </div>
          </div>

          <div className="no-print" style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={s.printBtn} onClick={() => window.print()}>🖨️ Print This Page</button>
            <button style={{ ...s.nextBtn }} onClick={() => setStep(5)}>I Have Printed This — Continue →</button>
          </div>
        </div>
      </div>
    );
  }

  // Step 5 — Disclaimer acknowledgment (record already saved during setup POST)
  if (step === 5 && recoveryCode) {
    function handleDisclaimerAgree() {
      onComplete();
    }

    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={s.icon}>📋</div>
          <h2 style={s.title}>Platform Disclaimer</h2>
          <p style={{ textAlign: 'center', fontSize: 14, color: '#555', marginBottom: 16 }}>
            Before launching RaffleVault, you must read and accept the following terms.
          </p>
          <div style={{ background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 8, padding: 16, maxHeight: 320, overflowY: 'auto', fontSize: 13, color: '#333', lineHeight: 1.8, whiteSpace: 'pre-line', marginBottom: 16 }}>
            {DISCLAIMER_TEXT}
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 20 }}>
            <input type="checkbox" checked={disclaimerChecked} onChange={e => setDisclaimerChecked(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
            I have read and understand this disclaimer. I and any affiliates accept full legal responsibility for all raffle activity conducted through this platform.
          </label>
          <button
            style={{ ...s.launchBtn, opacity: disclaimerChecked ? 1 : 0.4, cursor: disclaimerChecked ? 'pointer' : 'not-allowed' }}
            disabled={!disclaimerChecked}
            onClick={handleDisclaimerAgree}
          >
            ✓ I Agree — Launch RaffleVault
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.icon}>★</div>
        <h1 style={s.mainTitle}>Welcome to RaffleVault</h1>
        <p style={s.sub}>Let's get your organization set up. This will only take a few minutes.</p>

        {/* Progress */}
        <div style={s.progress}>
          {steps.map((label, i) => (
            <div key={i} style={{ ...s.stepDot, background: i <= step ? '#1a237e' : '#e0e0e0' }}>
              {i < step ? '✓' : i + 1}
            </div>
          ))}
        </div>
        <p style={s.stepLabel}>Step {step + 1} of {steps.length}: <strong>{steps[step]}</strong></p>

        {/* Step 1 — Org Info */}
        {step === 0 && (
          <div style={s.fields}>
            <Field label="Organization Name *" error={errors.org_name}>
              <input style={s.input} value={data.org_name} onChange={e => set('org_name', e.target.value)} />
            </Field>
            <Field label="Contact Email *" error={errors.org_email}>
              <input style={s.input} type="email" value={data.org_email} onChange={e => set('org_email', e.target.value)} />
            </Field>
            <Field label="Phone Number">
              <input style={s.input} value={data.org_phone} onChange={e => set('org_phone', e.target.value)} />
            </Field>
            <Field label="Mailing Address">
              <input style={s.input} value={data.org_address} onChange={e => set('org_address', e.target.value)} />
            </Field>
            <Field label="Your Organization's Website">
              <input style={s.input} value={data.org_website} onChange={e => set('org_website', e.target.value)} />
            </Field>
          </div>
        )}

        {/* Step 2 — Master Admin */}
        {step === 1 && (
          <div style={s.fields}>
            <p style={s.note}>This is the master admin account. Keep these credentials secure. Only one master admin account can exist at a time.</p>
            <Field label="Username *" error={errors.master_username}>
              <input style={s.input} value={data.master_username} onChange={e => set('master_username', e.target.value)} />
            </Field>
            <Field label="Full Name *" error={errors.master_name}>
              <input style={s.input} value={data.master_name} onChange={e => set('master_name', e.target.value)} />
            </Field>
            <Field label="Email Address *" error={errors.master_email}>
              <input style={s.input} type="email" value={data.master_email} onChange={e => set('master_email', e.target.value)} />
            </Field>
            <Field label="Password *" error={errors.master_password}>
              <input style={s.input} type="password" value={data.master_password} onChange={e => set('master_password', e.target.value)} />
              <PasswordStrength password={data.master_password} />
            </Field>
            <Field label="Confirm Password *" error={errors.master_confirm}>
              <input style={s.input} type="password" value={data.master_confirm} onChange={e => set('master_confirm', e.target.value)} />
              {data.master_confirm && (
                <span style={{ fontSize: 12, color: data.master_password === data.master_confirm ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                  {data.master_password === data.master_confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                </span>
              )}
            </Field>
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step === 2 && (
          <div style={s.fields}>
            <div style={s.summary}>
              <SummaryRow label="Organization" value={data.org_name} />
              <SummaryRow label="Contact Email" value={data.org_email} />
              <SummaryRow label="Site Title" value={data.site_title || data.org_name + ' Raffle'} />
              <SummaryRow label="Master Admin Username" value={data.master_username} />
              <SummaryRow label="Email Notifications" value={data.smtp_user} />
            </div>
            {errors.launch && <div style={s.error}>{errors.launch}</div>}
            <p style={{ ...s.note, marginTop: 12 }}>After clicking Launch, you will be shown your master admin recovery code. <strong>Print it and store it safely.</strong></p>
          </div>
        )}

        {/* Navigation */}
        <div style={s.navBtns}>
          {step > 0 && <button style={s.prevBtn} onClick={prev}>← Back</button>}
          {step < 2 && <button style={s.nextBtn} onClick={next}>Next →</button>}
          {step === 2 && (
            <button style={s.launchBtn} onClick={handleLaunch} disabled={submitting}>
              {submitting ? 'Setting up...' : '🚀 Launch RaffleVault'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordStrength({ password }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter (A-Z)', ok: /[A-Z]/.test(password) },
    { label: 'Number (0-9)', ok: /[0-9]/.test(password) },
    { label: 'Special character (!@#$%^&*)', ok: /[!@#$%^&*]/.test(password) },
  ];
  const passed = checks.filter(c => c.ok).length;
  const colors = ['#e0e0e0', '#ef5350', '#ffa726', '#66bb6a', '#2e7d32'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= passed ? colors[passed] : '#e0e0e0', transition: 'background 0.2s' }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: colors[passed], fontWeight: 600, marginBottom: 4 }}>{labels[passed]}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {checks.map(c => (
          <span key={c.label} style={{ fontSize: 11, color: c.ok ? '#2e7d32' : '#999' }}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, fontWeight: 500 }}>
      {label}
      {hint && <span style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>{hint}</span>}
      {children}
      {error && <span style={{ fontSize: 12, color: '#c62828' }}>{error}</span>}
    </label>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14 }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const s = {
  wrap: { minHeight: '100vh', background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { background: '#fff', borderRadius: 16, padding: 40, maxWidth: 540, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' },
  icon: { fontSize: 40, color: '#ffd700', textAlign: 'center', marginBottom: 8 },
  mainTitle: { fontSize: 26, fontWeight: 800, color: '#1a237e', textAlign: 'center', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: 700, color: '#1a237e', textAlign: 'center', marginBottom: 8 },
  sub: { textAlign: 'center', color: '#666', fontSize: 14, marginBottom: 24 },
  progress: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 },
  stepDot: { width: 30, height: 30, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 },
  stepLabel: { textAlign: 'center', fontSize: 14, color: '#666', marginBottom: 24 },
  fields: { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 },
  input: { padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 15 },
  note: { fontSize: 13, color: '#666', background: '#f9f9f9', borderRadius: 6, padding: '10px 12px' },
  instructions: { background: '#e8eaf6', borderRadius: 8, padding: '12px 16px', fontSize: 13 },
  error: { background: '#ffebee', color: '#c62828', borderRadius: 6, padding: '10px 12px', fontSize: 13 },
  successMsg: { background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, padding: '10px 12px', fontSize: 13, fontWeight: 600 },
  testBtn: { background: '#e8eaf6', color: '#1a237e', border: 'none', borderRadius: 6, padding: '10px 16px', fontWeight: 600, fontSize: 14 },
  summary: { background: '#f9f9f9', borderRadius: 8, padding: '8px 16px' },
  navBtns: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  prevBtn: { background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 8, padding: '12px 20px', fontWeight: 600, flex: 1 },
  nextBtn: { background: '#1a237e', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontWeight: 700, flex: 1 },
  launchBtn: { background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 24px', fontWeight: 700, fontSize: 16, flex: 1 },
  recoveryBox: { background: '#fff9c4', border: '2px solid #f9a825', borderRadius: 10, padding: 20, textAlign: 'center', margin: '16px 0' },
  recoveryLabel: { fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8 },
  recoveryOrg: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  recoveryDate: { fontSize: 13, color: '#888', marginBottom: 12 },
  code: { fontSize: 28, fontWeight: 800, letterSpacing: 4, color: '#1a237e', fontFamily: 'monospace', margin: '8px 0' },
  warning: { background: '#ffebee', borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  printBtn: { background: '#1a237e', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, width: '100%', fontSize: 15 },
};
