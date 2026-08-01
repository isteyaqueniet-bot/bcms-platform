# Deploying BCMS Platform

This app is stateless (JWT auth, no server-side sessions) and uses MySQL as its only
stateful dependency besides the `uploads/` folder — so it's straightforward to deploy
almost anywhere that runs Node.js. Three paths are covered below; pick whichever matches
your comfort level and budget.

| Option | Best for | Effort |
|---|---|---|
| A. PaaS (Render/Railway/Fly.io) | Fastest to get live, least ops work | Low |
| B. Docker (this repo includes a Dockerfile) | Portable, works on any VM/cloud | Medium |
| C. Bare VPS + PM2 | Full control, cheapest at scale | Medium-High |

Whichever you choose, you'll need a **managed or self-hosted MySQL 8+ database** (recursive
CTEs used in the leave-approval flow require MySQL 8+, not 5.7).

---

## 0. Before you deploy — checklist

- [ ] Generate strong, unique values for `JWT_SECRET` and `QR_SECRET` (don't reuse the examples in `.env.example`). `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` gives you a good one.
- [ ] Decide where `uploads/` will live in production — it must be **persistent storage**, not the container's local disk if you're using a PaaS with ephemeral filesystems (see Option A notes below).
- [ ] Have your MySQL connection details ready (host, port, user, password, database name).
- [ ] Optional integrations — only fill these in if you're using them: `TWILIO_*` (SMS/WhatsApp), `MAIL_*` (email), `ANTHROPIC_API_KEY` (AI assistant).
- [ ] Run `models/schema.sql` against your production database once, before first boot.

---

## Option A: PaaS (Render, Railway, Fly.io, etc.)

These platforms build and run your app for you — no server management. Steps are similar across providers:

1. **Push this code to a Git repository** (GitHub/GitLab) — most PaaS providers deploy from a repo.
2. **Create a MySQL database** through the platform (Railway and Render both offer managed MySQL/PlanetScale add-ons) or use an external managed MySQL (PlanetScale, AWS RDS, DigitalOcean Managed MySQL).
3. **Create a new "Web Service"** pointing at your repo:
   - Build command: `npm install`
   - Start command: `node app.js`
   - Set the port to `5000` (or whatever `PORT` you configure)
4. **Set environment variables** in the platform's dashboard — copy every key from `.env.example`, filled in with real values. Do NOT commit `.env` to your repository.
5. **Persistent file storage**: most PaaS free/starter tiers use an *ephemeral* filesystem — anything written to `uploads/` disappears on redeploy. Either:
   - Attach a persistent volume/disk if the platform offers one (Render and Railway both do, usually a paid add-on), or
   - Swap local file storage for S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2) — this would mean updating `middleware/upload.js` and `documentController.js` to upload to a bucket instead of local disk. Worth doing if you expect meaningful document/file volume in production.
6. **Run the schema**: connect to your new database with `mysql -h <host> -u <user> -p < models/schema.sql` from your own machine, once.
7. Deploy. Your API is now live at whatever URL the platform gives you.

---

## Option B: Docker

This repo includes a `Dockerfile` and `docker-compose.yml` that runs the app AND a MySQL container together — good for a VM on any cloud (DigitalOcean, AWS EC2, Hetzner, etc.) or for local staging.

```bash
# 1. Copy and fill in your real environment values
cp .env.example .env
nano .env   # fill in JWT_SECRET, QR_SECRET, etc. — leave DB_HOST as-is, compose overrides it

# 2. Build and start both containers
docker compose up -d --build

# 3. Check it's running
docker compose logs -f app
curl http://localhost:5000/api/health
```

The `docker-compose.yml` automatically loads `models/schema.sql` into the MySQL container on its first start (via the `docker-entrypoint-initdb.d` mount) — no manual schema step needed for this path.

**Notes:**
- `uploads_data` and `mysql_data` are named Docker volumes — they persist across `docker compose down`/`up`, but running `docker compose down -v` deletes them. Be careful with `-v` in production.
- The MySQL port (`3306`) is exposed to the host in the compose file for convenience during setup — remove that `ports` mapping for the `mysql` service once you've confirmed everything works, so the database isn't reachable from outside the Docker network.
- If you're running MySQL as a separate managed service instead of in Docker (recommended for real production use — easier backups, no risk of losing the container), delete the `mysql` service from `docker-compose.yml` and point `DB_HOST` at your managed database instead.
- For multiple app replicas behind a load balancer, this same image works — just don't run MySQL itself in more than one place, and put `uploads/` on shared/object storage (see the S3 note in Option A) once you have more than one app container, since local disk isn't shared between them.

**Putting it behind HTTPS:** add an nginx or Caddy container in front (Caddy is the easier of the two — automatic HTTPS via Let's Encrypt with a 4-line Caddyfile). Example minimal `Caddyfile`:
```
yourdomain.com {
    reverse_proxy app:5000
}
```

---

## Option C: Bare VPS + PM2 (no Docker)

For a Linux VM (Ubuntu 22.04/24.04 recommended) where you want full control.

```bash
# 1. Install Node.js 20 and MySQL 8 (Ubuntu example)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs mysql-server

# 2. Secure MySQL and create the database
sudo mysql_secure_installation
mysql -u root -p < models/schema.sql

# 3. Clone/copy this project onto the server, then:
cd bcms-platform
cp .env.example .env
nano .env   # fill in real values, DB_HOST=localhost
npm install --omit=dev

# 4. Install PM2 globally and start the app with it
sudo npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow the printed instructions to make PM2 survive a reboot
```

`ecosystem.config.js` runs the app in cluster mode across all CPU cores — safe here because auth is JWT-based (no server-side session state) and QR tokens are computed from a shared secret, not per-process memory, so any request can be handled by any worker.

**Reverse proxy + HTTPS** (nginx + Let's Encrypt):
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```
Minimal nginx config (`/etc/nginx/sites-available/bcms`):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
Then:
```bash
sudo ln -s /etc/nginx/sites-available/bcms /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com   # sets up free auto-renewing HTTPS
```

**Useful PM2 commands:** `pm2 logs`, `pm2 restart bcms-platform`, `pm2 monit`.

---

## Database backups (all options)

Regardless of hosting choice, back up MySQL regularly — this is a multi-tenant app now, so a lost database means losing every client's data at once, not just BCMS's own.

```bash
# Simple daily dump via cron
mysqldump -u root -p bcms_platform > backup_$(date +%F).sql
```
For anything beyond a hobby deployment, use your cloud provider's managed database backups (point-in-time recovery) instead of relying solely on cron + mysqldump.

## Post-deploy smoke test

Once live, confirm the basics work end-to-end:
```bash
curl https://yourdomain.com/api/health

curl -X POST https://yourdomain.com/api/auth/signup-company \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Test Co","company_slug":"test-co","admin_name":"Admin","admin_email":"admin@test.com","admin_password":"testpass123"}'
```
If both return successful JSON responses, the app, database connection, and multi-tenant signup flow are all working.
