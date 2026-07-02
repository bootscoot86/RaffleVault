import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getRaffle, submitEntry } from '../api';
import { SettingsContext } from '../App';

const emptyForm = { name: '', email: '', phone: '', address: '', quantity: 1 };

export default function RaffleDetail() {
  const { id } = useParams();
  const settings = useContext(SettingsContext);
  const primary = settings.primary_color || '#1a237e';
  const [raffle, setRaffle] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    getRaffle(id).then(data => setRaffle(data));
    fetch('/api/payments/config').then(r => r.json()).then(data => {
      if (data.stripe_public_key) setStripePromise(loadStripe(data.stripe_public_key));
    });
  }, [id]);

  if (!raffle) return <p style={s.msg}>Loading...</p>;

  return stripePromise ? (
    <Elements stripe={stripePromise}>
      <RaffleDetailInner raffle={raffle} primary={primary} settings={settings} id={id} stripeEnabled={true} />
    </Elements>
  ) : (
    <RaffleDetailInner raffle={raffle} primary={primary} settings={settings} id={id} stripeEnabled={false} />
  );
}

function RaffleDetailInner({ raffle, primary, settings, id, stripeEnabled }) {
  const navigate = useNavigate();
  const stripe = stripeEnabled ? useStripe() : null;
  const elements = stripeEnabled ? useElements() : null;

  const stripeStyle = { style: { base: { fontSize: '15px', color: '#1a1a2e', '::placeholder': { color: '#aaa' } }, invalid: { color: '#c62828' } } };

  const [activeImg, setActiveImg] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const enteredKey = `rv_entered_${id}`;
  const alreadyEntered = !!localStorage.getItem(enteredKey);

  const isSoldOut = raffle.sold_out || raffle.tickets_remaining === 0;
  const isClosed = raffle.closed || isSoldOut;
  const total = (Number(raffle.ticket_price) * (form.quantity || 1)).toFixed(2);
  const maxQty = raffle.tickets_remaining !== null
    ? Math.min(raffle.tickets_remaining, raffle.max_tickets_per_person || 999)
    : (raffle.max_tickets_per_person || 100);

  function handleSubmit(e) {
    e.preventDefault();
    // If buyer has already entered a multiple-entry raffle, ask to confirm before proceeding
    if (alreadyEntered && raffle.entry_type === 'multiple') {
      setShowConfirm(true);
      return;
    }
    processSubmit();
  }

  async function processSubmit() {
    setShowConfirm(false);
    setError('');
    setSubmitting(true);

    try {
      if (stripeEnabled && stripe && elements) {
        // Create payment intent
        const intentRes = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raffle_id: id, quantity: form.quantity || 1 })
        });
        const intentData = await intentRes.json();
        if (intentData.error) { setError(intentData.error); setSubmitting(false); return; }

        // Confirm card payment
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(intentData.client_secret, {
          payment_method: {
            card: elements.getElement(CardNumberElement),
            billing_details: { name: form.name, email: form.email, phone: form.phone }
          }
        });

        if (stripeError) { setError(stripeError.message); setSubmitting(false); return; }
        if (paymentIntent.status !== 'succeeded') { setError('Payment did not complete. Please try again.'); setSubmitting(false); return; }

        // Submit entry with payment reference and hold token
        const res = await submitEntry({ ...form, raffle_id: id, payment_intent_id: paymentIntent.id, hold_token: intentData.hold_token });
        if (res.error) { setError(res.error); setSubmitting(false); return; }
        setEmailSent(!!res.email_sent);
      } else {
        // No Stripe — submit entry without payment
        const res = await submitEntry({ ...form, raffle_id: id });
        if (res.error) { setError(res.error); setSubmitting(false); return; }
        setEmailSent(!!res.email_sent);
      }

      localStorage.setItem(enteredKey, '1');
      setSubmitted(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  }

  if (submitted) return (
    <div style={s.success}>
      <div style={s.successIcon}>🎉</div>
      <h2 style={{ color: primary }}>You're entered!</h2>
      <p>Good luck, <strong>{form.name}</strong>!</p>
      {stripeEnabled && <p style={{ color: '#2e7d32', fontWeight: 600 }}>Payment of ${total} collected successfully.</p>}
      {emailSent && <p style={{ color: '#333', fontSize: 15 }}>A confirmation email has been sent to {form.email}</p>}
      <button style={{ ...s.submitBtn, background: primary }} onClick={() => navigate('/')}>Back to Raffles</button>
    </div>
  );

  return (
    <div style={s.wrap}>
      <button style={{ ...s.back, color: primary }} onClick={() => navigate('/')}>← Back to Raffles</button>
      <div style={s.layout} className="raffle-layout">

        {/* Left — Images */}
        <div style={s.left} className="raffle-left">
          <div style={s.mainImgWrap} className="raffle-main-img">
            {raffle.images && raffle.images.length
              ? <img src={`/uploads/${raffle.images[activeImg]?.filename}`} alt={raffle.title} style={s.mainImg} />
              : <div style={s.noImg}>No Image</div>}
            {raffle.images && raffle.images.length > 1 && (
              <>
                <button style={s.arrowLeft} onClick={() => setActiveImg(i => (i - 1 + raffle.images.length) % raffle.images.length)}>&#8249;</button>
                <button style={s.arrowRight} onClick={() => setActiveImg(i => (i + 1) % raffle.images.length)}>&#8250;</button>
                <div style={s.imgCounter}>{activeImg + 1} / {raffle.images.length}</div>
              </>
            )}
          </div>
          {raffle.images && raffle.images.length > 1 && (
            <div style={s.thumbs}>
              {raffle.images.map((img, i) => (
                <img key={img.id} src={`/uploads/${img.filename}`} alt=""
                  style={{ ...s.thumb, border: i === activeImg ? `2px solid ${primary}` : '2px solid transparent' }}
                  onClick={() => setActiveImg(i)} />
              ))}
            </div>
          )}

          {/* Stats box */}
          <div style={s.statsBox}>
            <StatRow label="Ticket Price" value={`$${Number(raffle.ticket_price).toFixed(2)}`} color={primary} />
            <StatRow label="Tickets Sold" value={raffle.total_tickets || 0} />
            {raffle.tickets_remaining !== null && (
              <StatRow label="Tickets Remaining"
                value={isSoldOut ? 'SOLD OUT' : raffle.tickets_remaining}
                color={isSoldOut ? '#c62828' : undefined} />
            )}
            {raffle.end_date && <StatRow label="Drawing Date" value={new Date(raffle.end_date).toLocaleDateString()} />}
            {raffle.youtube_link && (
              <a href={raffle.youtube_link} target="_blank" rel="noreferrer"
                style={{ ...s.ytLink, background: '#ff0000' }}>
                ▶ Watch Live Drawing on YouTube
              </a>
            )}
          </div>

          {/* Description below stats */}
          {raffle.description && (
            <div style={s.descBox}>
              <p style={{ margin: 0, fontSize: 15, color: '#222', lineHeight: 1.7 }}>{raffle.description}</p>
            </div>
          )}
        </div>

        {/* Right — Details and form */}
        <div style={s.right} className="raffle-right">
          <h1 style={{ ...s.title, color: primary }}>{raffle.title}</h1>
          {isSoldOut && <div style={s.soldOut}>🎟️ This raffle is sold out — no more entries accepted</div>}
          {!isSoldOut && isClosed && <div style={s.closed}>This raffle is closed to new entries</div>}
          {!isClosed && alreadyEntered && raffle.entry_type === 'single' && (
            <div style={s.alreadyEntered}>✓ You have already entered this raffle. Good luck!</div>
          )}

          {!isClosed && !(alreadyEntered && raffle.entry_type === 'single') && (
            <form onSubmit={handleSubmit} style={s.form}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: primary }}>Enter this Raffle</h3>
              {error && <div style={s.error}>{error}</div>}

              <label style={s.label}>Full Name *
                <input style={s.input} required value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>
              <label style={s.label}>Email Address *
                <input style={s.input} type="email" required value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} />
              </label>
              <label style={s.label}>Phone Number *
                <input style={s.input} required value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label style={s.label}>Address
                <input style={s.input} placeholder="Street, City, State, ZIP" value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })} />
              </label>

              {raffle.entry_type === 'multiple' && (
                <label style={s.label}>Number of Tickets
                  <div style={s.qtyWrap}>
                    <button type="button" style={{ ...s.qtyBtn, background: primary }}
                      onClick={() => setForm({ ...form, quantity: Math.max(1, (form.quantity || 1) - 1) })}>−</button>
                    <input
                      style={s.qtyInput}
                      type="number"
                      min="1"
                      max={maxQty}
                      value={form.quantity}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '' || raw === '0') { setForm({ ...form, quantity: '' }); return; }
                        const val = parseInt(raw);
                        if (!isNaN(val)) setForm({ ...form, quantity: Math.min(maxQty, Math.max(1, val)) });
                      }}
                      onBlur={() => {
                        if (!form.quantity || form.quantity < 1) setForm({ ...form, quantity: 1 });
                      }}
                    />
                    <button type="button" style={{ ...s.qtyBtn, background: primary }}
                      onClick={() => setForm({ ...form, quantity: Math.min(maxQty, (form.quantity || 1) + 1) })}>+</button>
                  </div>
                </label>
              )}

              <div style={s.total}>
                Total: <strong style={{ color: primary }}>${total}</strong>
              </div>

              {/* Stripe Card Input */}
              {stripeEnabled && (
                <div style={s.cardSection}>
                  <label style={{ ...s.label, marginBottom: 2 }}>Card Number</label>
                  <div style={s.cardBox}>
                    <CardNumberElement options={{ style: stripeStyle }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...s.label, marginBottom: 2, whiteSpace: 'nowrap' }}>Expiration Date</label>
                      <div style={s.cardBox}>
                        <CardExpiryElement options={{ style: stripeStyle }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...s.label, marginBottom: 2, whiteSpace: 'nowrap' }}>CVC</label>
                      <div style={s.cardBox}>
                        <CardCvcElement options={{ style: stripeStyle }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...s.label, marginBottom: 2, whiteSpace: 'nowrap' }}>ZIP Code</label>
                      <input style={{ ...s.input, padding: '10px 12px' }} placeholder="12345" maxLength={10}
                        value={form.zip || ''} onChange={e => setForm({ ...form, zip: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#444', marginTop: 6 }}>🔒 Secured by Stripe</div>
                </div>
              )}

              <button type="submit" style={{ ...s.submitBtn, background: primary }} disabled={submitting}>
                {submitting ? 'Processing...' : stripeEnabled ? `Pay $${total} & Enter` : 'Submit Entry'}
              </button>
            </form>
          )}
        </div>
      </div>

      {settings.disclaimer && (
        <div style={s.disclaimer}>
          <strong>Disclaimer:</strong> {settings.disclaimer}
        </div>
      )}

      {/* Confirmation modal for repeat buyers */}
      {showConfirm && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Purchase More Tickets?</h3>
            <p style={{ fontSize: 15, color: '#333', marginBottom: 20 }}>
              You have already entered this raffle. Do you want to purchase <strong>{form.quantity || 1} more ticket{(form.quantity || 1) > 1 ? 's' : ''}</strong> for <strong style={{ color: primary }}>${total}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={s.cancelBtn} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button style={{ ...s.submitBtn, background: primary, padding: '10px 24px', fontSize: 14 }} onClick={processSubmit}>
                Yes, Purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontSize: 14, color: '#333' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: color || '#1a237e' }}>{value}</span>
    </div>
  );
}

const s = {
  wrap: { maxWidth: 980, margin: '0 auto' },
  back: { background: 'none', border: 'none', fontWeight: 600, fontSize: 14, marginBottom: 16, padding: 0 },
  layout: { display: 'flex', gap: 32, flexWrap: 'wrap' },
  left: { flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 14 },
  right: { flex: '1 1 380px' },
  mainImgWrap: { width: '100%', height: 340, borderRadius: 12, overflow: 'hidden', background: '#eee', position: 'relative' },
  arrowLeft: { position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none', borderRadius: 6, width: 36, height: 48, fontSize: 28, fontWeight: 700, cursor: 'pointer', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  arrowRight: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none', borderRadius: 6, width: 36, height: 48, fontSize: 28, fontWeight: 700, cursor: 'pointer', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  imgCounter: { position: 'absolute', bottom: 8, right: 10, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 12, borderRadius: 4, padding: '2px 8px' },
  mainImg: { width: '100%', height: '100%', objectFit: 'cover' },
  noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' },
  thumbs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  thumb: { width: 64, height: 64, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' },
  statsBox: { background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  descBox: { background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' },
  ytLink: { display: 'block', textAlign: 'center', color: '#fff', borderRadius: 6, padding: '8px', fontWeight: 600, fontSize: 13, marginTop: 10 },
  title: { fontSize: 26, fontWeight: 800, marginBottom: 12 },
  soldOut: { background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontWeight: 700, marginBottom: 12 },
  closed: { background: '#fff3e0', color: '#e65100', borderRadius: 8, padding: '10px 14px', fontWeight: 600, marginBottom: 12 },
  alreadyEntered: { background: '#e8f5e9', color: '#2e7d32', borderRadius: 8, padding: '10px 14px', fontWeight: 600, marginBottom: 12 },
  desc: { color: '#444', lineHeight: 1.7, marginBottom: 20 },
  disclaimer: { marginTop: 12, fontSize: 14, color: '#333', background: '#f9f9f9', borderRadius: 6, padding: '10px 12px', borderLeft: '3px solid #ccc' },

  form: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 15, fontWeight: 600, color: '#222' },
  input: { padding: '9px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 15 },
  qtyWrap: { display: 'flex', alignItems: 'center', gap: 12 },
  qtyBtn: { color: '#fff', border: 'none', borderRadius: 6, width: 36, height: 36, fontSize: 20, fontWeight: 700 },
  qtyInput: { fontSize: 20, fontWeight: 700, width: 60, textAlign: 'center', border: '1px solid #ddd', borderRadius: 6, padding: '4px 0' },
  qtyNum: { fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: 'center' },
  total: { fontSize: 16 },
  cardSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  cardBox: { border: '1px solid #ddd', borderRadius: 6, padding: '12px', background: '#fafafa' },
  submitBtn: { color: '#fff', border: 'none', borderRadius: 8, padding: 14, fontWeight: 700, fontSize: 16 },
  error: { background: '#ffebee', color: '#c62828', borderRadius: 6, padding: '10px 12px', fontSize: 14 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  cancelBtn: { background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14 },
  msg: { textAlign: 'center', marginTop: 60, color: '#333' },
  success: { textAlign: 'center', marginTop: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  successIcon: { fontSize: 72 },
};
