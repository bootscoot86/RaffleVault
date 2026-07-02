# RaffleVault

A self-hosted, containerized raffle management platform built for nonprofit organizations — American Legion posts, VFW posts, fire departments, and similar groups. No coding required to install or operate.

---

## Features

### Public Buyer Experience
- Browse active raffles with photos, ticket prices, and availability
- Purchase tickets with credit card (Stripe) or free entry
- Confirmation email sent automatically after entry
- Live ticket counter and sold-out detection

### Admin Dashboard
- **Raffle management** — create, edit, close, duplicate, and restore raffles with up to 6 photos each
- **Winner drawing** — manual draw with random selection weighted by ticket quantity
- **Entries** — view, export (CSV), and print full entry lists per raffle
- **Financial reports** — revenue by raffle and time period, Stripe fee breakdown
- **Audit log** — full tamper-evident record of all admin actions (master admin only)
- **Multi-admin support** — master admin + up to 3 regular admins with role separation
- **Maintenance mode** — take the public site offline without stopping the container

### Security
- JWT authentication stored in httpOnly cookies (never localStorage)
- Token blocklist — immediate invalidation on logout
- 90-day password expiry with 15-day warning banner
- 4-tier rate limiting (login, entries, payments, general API)
- Helmet.js security headers
- Input sanitization on all endpoints
- Sharp image re-encoding — strips embedded payloads from uploads
- Docker runs as non-root user
- `must_change_password` enforced server-side — cannot be bypassed by direct URL navigation
- Legal disclaimer acknowledgment recorded to database and emailed to owner on setup

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Node.js / Express |
| Database | PostgreSQL |
| Containerization | Docker + Docker Compose |
| Web server | Nginx |
| Payments | Stripe |
| Email | Gmail SMTP / any SMTP provider |

---

## Quick Start

### Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — install and make sure it is running before proceeding

### Windows
1. Download or clone this repository
2. Double-click **`install.bat`**
3. Enter your email address when prompted
4. Wait for Docker to finish (a few minutes the first time)
5. Open **http://localhost:3000** in your browser

### Linux / macOS
1. Download or clone this repository
2. Open a terminal in the project folder
3. Run:
```bash
chmod +x install.sh
./install.sh
```
4. Enter your email address when prompted
5. Open **http://localhost:3000** in your browser

The installer automatically generates secure passwords and starts everything for you. The setup wizard will walk you through the rest.

> **Admin panel:** http://localhost:3000/admin — bookmark this.

---

### Manual Install (advanced)
If you prefer to set things up yourself:
```bash
cp .env.example .env
# Edit .env and fill in your values
docker compose up --build -d
```

---

## First-Time Setup Wizard

1. **Organization Info** — name, contact details, website
2. **Master Admin Account** — create your admin username and password
3. **Confirm & Launch** — review and go live
4. **Recovery Code** — a one-time recovery code is generated and shown. Print it and store it securely.
5. **Disclaimer** — accept the platform terms to complete setup

---

## Going Live (Production)

See [DEPLOY.md](DEPLOY.md) for the full guide covering:
- Firewall setup (UFW)
- Nginx + SSL (Let's Encrypt)
- Daily database backups
- Gmail SMTP configuration
- Stripe live key switchover
- Pre-launch checklist

---

## Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL database password |
| `JWT_SECRET` | Secret key for signing JWT tokens — use a long random string |
| `RAFFLEVAULT_OWNER_EMAIL` | Email address where legal acknowledgments are sent |
| `SITE_ORIGIN` | Your public domain (e.g. `https://raffle.yourorg.com`) — set before going live |

---

## License

All rights reserved. This software is not open source. You may view the code for evaluation purposes only.
