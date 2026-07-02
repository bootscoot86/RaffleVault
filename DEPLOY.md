# RaffleVault — Live Deployment Guide

## STEP 1 — Update docker-compose.yml

Open docker-compose.yml and change these three values before deploying:

```yaml
JWT_SECRET: REPLACE_WITH_A_LONG_RANDOM_STRING_AT_LEAST_64_CHARACTERS
RAFFLEVAULT_OWNER_EMAIL: your_real_email@gmail.com
NODE_ENV: production
```

To generate a strong JWT secret, run this on your server:
```
openssl rand -base64 64
```

---

## STEP 2 — Server Firewall (UFW on Ubuntu)

Run these commands on your server after logging in via SSH:

```bash
# Enable firewall
ufw enable

# Allow SSH (your admin access)
ufw allow 22/tcp

# Allow HTTP (redirects to HTTPS)
ufw allow 80/tcp

# Allow HTTPS (secure traffic)
ufw allow 443/tcp

# Block everything else
ufw default deny incoming
ufw default allow outgoing

# Confirm rules
ufw status
```

---

## STEP 3 — Install Nginx & SSL (HTTPS)

```bash
# Install Nginx
apt update && apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config (replace yourdomain.com with your actual domain)
nano /etc/nginx/sites-available/rafflevault
```

Paste this into the file (replace yourdomain.com):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://localhost:4000;
    }
}
```

```bash
# Enable the site
ln -s /etc/nginx/sites-available/rafflevault /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Get SSL certificate (free — Let's Encrypt)
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renew SSL (runs twice daily)
systemctl enable certbot.timer
```

---

## STEP 4 — Automated Database Backups

```bash
# Create backup directory
mkdir -p /backups/rafflevault

# Create backup script
nano /usr/local/bin/rafflevault-backup.sh
```

Paste this into the file:

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M)
docker exec rafflevault-db-1 pg_dump -U rafflevault rafflevault > /backups/rafflevault/backup_$DATE.sql
# Keep only last 30 days of backups
find /backups/rafflevault -name "*.sql" -mtime +30 -delete
echo "Backup completed: backup_$DATE.sql"
```

```bash
# Make it executable
chmod +x /usr/local/bin/rafflevault-backup.sh

# Schedule it to run every day at 2am
crontab -e
# Add this line:
0 2 * * * /usr/local/bin/rafflevault-backup.sh >> /var/log/rafflevault-backup.log 2>&1
```

---

## STEP 5 — Dedicated Gmail for SMTP

1. Create a new Gmail account (example: post751raffles@gmail.com)
2. Go to **Google Account → Security → 2-Step Verification** — turn ON
3. Go to **Google Account → Security → App Passwords**
4. Create an App Password for "Mail"
5. Copy the 16-character password
6. Enter in RaffleVault Admin → Settings → Email Settings:
   - SMTP Host: `smtp.gmail.com`
   - Port: `587`
   - Gmail Address: `post751raffles@gmail.com`
   - App Password: (the 16-character code)
   - From Address: `post751raffles@gmail.com`
7. Click **Send Test Email** to confirm it works

---

## STEP 6 — Switch Stripe to Live Mode

1. Log into dashboard.stripe.com
2. Complete identity verification if not done
3. Toggle from **Test Mode** to **Live Mode** (top left)
4. Go to **Developers → API Keys**
5. Copy `pk_live_...` (publishable key)
6. Copy `sk_live_...` (secret key)
7. Enter both in RaffleVault Admin → Settings → Payment Settings
8. Click Save

---

## STEP 7 — Deploy RaffleVault

```bash
# Copy rafflevault folder to server (from your machine)
scp -r rafflevault/ user@your-server-ip:/opt/rafflevault

# SSH into server
ssh user@your-server-ip

# Navigate to folder
cd /opt/rafflevault

# Build and start
docker-compose up --build -d

# Confirm all 3 containers running
docker-compose ps
```

---

## STEP 8 — Final Pre-Launch Checklist

- [ ] JWT_SECRET changed to long random string
- [ ] RAFFLEVAULT_OWNER_EMAIL set to your real email
- [ ] NODE_ENV set to production
- [ ] Firewall configured (ports 22, 80, 443 only)
- [ ] Nginx installed and running
- [ ] SSL certificate active (https:// works)
- [ ] Security headers active
- [ ] Daily database backup scheduled
- [ ] Gmail SMTP configured and test email sent
- [ ] Stripe live keys entered in Settings
- [ ] Setup wizard completed (recovery code printed and stored)
- [ ] Disclaimer accepted and email received
- [ ] Test raffle created and entry submitted
- [ ] Confirmation email received by test buyer
- [ ] Disclaimer acknowledgment email received at owner email

---

## Emergency Contacts

| Service | Support |
|---|---|
| Stripe payments | support.stripe.com |
| SSL certificate | certbot.eff.org/docs |
| Server issues | Your VPS provider support |
| Database recovery | Use recovery code at yourdomain.com/admin/recover |
