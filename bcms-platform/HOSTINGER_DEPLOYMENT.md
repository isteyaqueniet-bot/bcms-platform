# Deploying to Hostinger (Business Plan)

Hostinger's Business plan includes managed **Node.js Web App hosting** through hPanel — it's
a mini-PaaS: you connect a GitHub repo (or upload a ZIP), Hostinger runs `npm install` and
starts your app for you. You do **not** need Docker, PM2, or nginx configs here — that's for
VPS-only. Hostinger also only supports **MySQL** as a database (no Postgres/Mongo on
shared/Business plans), which matches this app perfectly since it's already MySQL.

## 1. Push this project to GitHub

Hostinger's Node.js hosting deploys from a Git repository (recommended) or a ZIP upload.
If you don't already have this in a repo:
```bash
cd bcms-platform
git init
git add .
git commit -m "Initial commit"
# create a repo on GitHub, then:
git remote add origin https://github.com/yourusername/bcms-platform.git
git push -u origin main
```
Make sure `.env`, `node_modules`, and `uploads/*` are gitignored (there's a `.gitignore`-style
pattern already in `.dockerignore` you can reuse — create a `.gitignore` with the same contents
if you don't have one).

## 2. Create the MySQL database in hPanel

1. hPanel → **Databases → MySQL Databases → Create Database**
2. Fill in a database name, username, and password — **save these**, you'll need them for env vars.
3. Note the **database host** Hostinger gives you (usually `localhost` since the database and
   app run on the same infrastructure).

## 3. Load the schema

You need to run `models/schema.sql` against this new, empty database once. Two ways:
- **phpMyAdmin** (usually linked right next to the database you just created in hPanel) — open it,
  select your new database, use the "Import" tab, and upload `models/schema.sql`.
- **SSH**, if enabled on your plan (hPanel → Advanced → SSH Access): `mysql -u <user> -p <dbname> < models/schema.sql`

## 4. Create the Node.js Web App

1. hPanel → **Websites → Add Website → Node.js Web App**
2. Choose **Import Git Repository**, authorize GitHub, and select your `bcms-platform` repo.
3. Hostinger will try to auto-detect the framework — since this is plain Express (not Next.js/Nest/etc.), it may not recognize it. If so, manually select **"Other"** from the framework dropdown.
4. Set the **startup file** to `app.js`.
5. Choose a **Node.js version** — 18 or 20 (this app was built against Node 20; either works).

## 5. Set environment variables

In the Node.js app dashboard → **Environment Variables**, either paste the contents of a filled-in
`.env` file directly (fastest) or add each key manually. At minimum:

```
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=<the database user you created in step 2>
DB_PASSWORD=<the database password you created in step 2>
DB_NAME=<the database name you created in step 2>
JWT_SECRET=<generate a real one — see note below>
JWT_EXPIRES_IN=8h
QR_SECRET=<generate a real one — see note below>
```
Then add whichever of these you're actually using (leave the rest blank — every feature
gated on these already fails gracefully if unset):
```
MAIL_HOST=... / MAIL_USER=... / MAIL_PASSWORD=... / MAIL_FROM=...
TWILIO_ACCOUNT_SID=... / TWILIO_AUTH_TOKEN=... / TWILIO_SMS_FROM=... / TWILIO_WHATSAPP_FROM=...
ANTHROPIC_API_KEY=...
```
Generate strong secrets locally before pasting them in:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run that twice — once for `JWT_SECRET`, once for `QR_SECRET`.

**Environment variables are never committed to your repo** — this is exactly where they belong on Hostinger, so `.env` itself should stay out of GitHub entirely.

## 6. Deploy

Click **Deploy** (or it may auto-trigger after connecting the repo). Hostinger runs `npm install`
and starts the app. Watch the **build/deployment log** from the Node.js dashboard — this is where
you'll see if a dependency failed to install or the app crashed on boot (most likely cause: a
missing/wrong env var, especially DB credentials).

Every future `git push` to your connected branch triggers an automatic redeploy.

## 7. Connect your domain + SSL

hPanel → your Node.js app → **Domain** — point your domain or a subdomain at this app. Hostinger
issues a free SSL certificate automatically (Business plan includes this) — no Certbot/nginx
steps needed like the VPS path.

## 8. File uploads (`uploads/` folder) — verify persistence

This app writes uploaded documents to a local `uploads/` folder (`middleware/upload.js`). On
Hostinger's managed Node.js hosting this sits on your regular hosting storage, which is
persistent (unlike some containerized PaaS free tiers) — but **confirm this holds across
redeploys** by uploading a test document, triggering a redeploy (e.g. a small commit), and
checking it's still there via **File Manager** in hPanel. If it turns out redeploys wipe it,
the fix is switching document storage to S3-compatible object storage instead of local disk —
worth flagging here now so it's not a surprise later.

## 9. Post-deploy smoke test

Once live at your domain:
```bash
curl https://yourdomain.com/api/health

curl -X POST https://yourdomain.com/api/auth/signup-company \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Test Co","company_slug":"test-co","admin_name":"Admin","admin_email":"admin@test.com","admin_password":"testpass123"}'
```
Both returning successful JSON confirms the app, database connection, and multi-tenant signup
flow are all working end-to-end.

## Notes specific to this app on Hostinger

- **No PM2/Docker needed** — Hostinger's Node.js hosting manages the process for you. The `Dockerfile`, `docker-compose.yml`, and `ecosystem.config.js` in this repo are for the VPS/Docker paths in `DEPLOYMENT.md`, not this one — you can ignore them here.
- **MySQL 8+ requirement still applies** — the leave-approval flow uses a recursive CTE that needs MySQL 8+. Hostinger's managed MySQL should already be 8.x, but worth confirming in hPanel if leave approvals ever error out.
- **Restarting after env var changes**: hPanel → your app → **Restart** whenever you add/change an environment variable — the running process won't pick up new values otherwise.
- **Scaling**: this managed tier runs a single instance — fine for most small-to-mid business use. If you outgrow it, the `Dockerfile`/`ecosystem.config.js` already in this repo are your path to a Hostinger VPS or elsewhere without rewriting anything.
