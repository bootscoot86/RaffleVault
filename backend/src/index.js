const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { sanitizeBodySafe } = require('./middleware/sanitize');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const allowedOrigin = process.env.SITE_ORIGIN || true; // set SITE_ORIGIN in .env before going live
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// Rate limiting — general API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiting — login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiting — entry form submissions
const entryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: { error: 'Too many entry submissions from this connection. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiting — payment intents
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: { error: 'Too many payment attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);
app.use(sanitizeBodySafe);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Warn if JWT secret is still the default — block in production
if (process.env.JWT_SECRET === 'change_this_in_production') {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET must be changed before running in production. Set a strong random string in docker-compose.yml.');
    process.exit(1);
  } else {
    console.warn('⚠️  WARNING: JWT_SECRET is still set to the default. Change it in docker-compose.yml before going live.');
  }
}

// Routes
app.use('/api/setup', require('./routes/setup'));
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/recover', loginLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/raffles', require('./routes/raffles'));
app.use('/api/entries', entryLimiter, require('./routes/entries'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/payments/create-intent', paymentLimiter);
app.use('/api/payments', require('./routes/payments'));
app.use('/api/legal', require('./routes/legal').router);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

initDb().then(() => {
  app.listen(PORT, () => console.log(`RaffleVault backend running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
