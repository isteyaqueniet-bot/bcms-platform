# BCMS Platform — Backend (Phases 1-5)

Node.js + Express + MySQL multi-tenant backend for BCMS: Authentication, Dashboard, Employee Management (EMS), CRM, Attendance (manual/QR/GPS), Leave, Payroll, Projects, Tasks, Notifications, Documents, Business Analytics, and Multi-Company support — so the same platform can serve BCMS itself and its clients (schools, hospitals, clinics, retailers, etc.) as separate, isolated tenants.

## Setup

> Running this locally for development? Follow the steps below. Deploying it somewhere real? See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for VPS/Docker/PaaS options, or [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md) specifically for Hostinger's managed Node.js hosting (Business/Cloud plans).

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your MySQL credentials and a strong `JWT_SECRET`.

3. **Create the database**
   ```bash
   mysql -u root -p < models/schema.sql
   ```

4. **Run the server**
   ```bash
   npm run dev     # with nodemon (auto-restart)
   # or
   npm start
   ```

   Server starts on `http://localhost:5000` by default.

## First-time use

1. Create your company and its first admin account in one call:
   ```
   POST /api/auth/signup-company
   {
     "company_name": "BCMS",
     "company_slug": "bcms",
     "industry": "IT services",
     "admin_name": "Admin",
     "admin_email": "admin@bcms.com",
     "admin_password": "yourpassword"
   }
   ```
2. Log in to get a JWT:
   ```
   POST /api/auth/login
   { "email": "admin@bcms.com", "password": "yourpassword" }
   ```
3. Use the returned `token` as `Authorization: Bearer <token>` on all other requests. From here, use `POST /api/auth/register` (while logged in as this admin) to add HR, sales, or employee users — they'll automatically belong to the same company.

## Endpoints (Phase 1)

| Method | Endpoint                    | Access                          |
|--------|------------------------------|----------------------------------|
| POST   | /api/auth/register            | Public (restrict in production) |
| POST   | /api/auth/login               | Public                           |
| GET    | /api/auth/me                  | Authenticated                   |
| GET    | /api/dashboard                 | Authenticated                   |
| GET    | /api/employees                | super_admin, admin, hr          |
| GET    | /api/employees/:id             | super_admin, admin, hr, employee|
| POST   | /api/employees                 | super_admin, admin              |
| PUT    | /api/employees/:id              | super_admin, admin, hr          |
| DELETE | /api/employees/:id              | super_admin, admin              |
| GET    | /api/customers                 | super_admin, admin, sales       |
| POST   | /api/customers                 | super_admin, admin, sales       |
| PUT    | /api/customers/:id              | super_admin, admin, sales       |
| DELETE | /api/customers/:id              | super_admin, admin              |
| GET    | /api/customers/leads/all         | super_admin, admin, sales       |
| POST   | /api/customers/leads             | super_admin, admin, sales       |

## Endpoints (Phase 2)

| Method | Endpoint                          | Access                          |
|--------|------------------------------------|----------------------------------|
| POST   | /api/attendance/check-in            | all authenticated roles         |
| POST   | /api/attendance/check-out           | all authenticated roles         |
| GET    | /api/attendance/today               | super_admin, admin, hr          |
| GET    | /api/attendance/employee/:employeeId | super_admin, admin, hr, employee|
| PUT    | /api/attendance/:id                  | super_admin, admin, hr          |
| POST   | /api/leaves                          | all authenticated roles         |
| GET    | /api/leaves                          | super_admin, admin, hr          |
| GET    | /api/leaves/employee/:employeeId      | super_admin, admin, hr, employee|
| PUT    | /api/leaves/:id/decision               | super_admin, admin, hr          |
| POST   | /api/payroll/generate                 | super_admin, admin, hr          |
| GET    | /api/payroll                          | super_admin, admin, hr          |
| PUT    | /api/payroll/:id/finalize              | super_admin, admin              |
| GET    | /api/reports/attendance/pdf            | super_admin, admin, hr          |
| GET    | /api/reports/payroll/excel             | super_admin, admin, hr          |
| GET    | /api/reports/customers/excel           | super_admin, admin, sales       |

### Notes on Phase 2 logic

- **Attendance**: `check-in`/`check-out` write/update one row per employee per day. HR can retroactively correct records via `PUT /api/attendance/:id`.
- **Leave**: employees apply via `POST /api/leaves`; HR/Admin approve or reject via `PUT /api/leaves/:id/decision`. Approving a leave automatically backfills `attendance` rows with `status = 'leave'` for each day in the range (requires MySQL 8+ for the recursive CTE used).
- **Payroll**: `POST /api/payroll/generate` computes `net_salary` from each employee's `attendance` (present + leave days are paid, absent days are not), storing one row per employee per month/year. Re-running it for the same month recalculates and resets status to `draft`. Use `PUT /api/payroll/:id/finalize` to lock a record once reviewed.
- **Reports**: attendance exports as PDF (PDFKit), payroll and customer lists export as Excel (ExcelJS) — matching the stack decided for BCMS.

## Endpoints (Phase 3)

| Method | Endpoint                              | Access                                |
|--------|-----------------------------------------|-----------------------------------------|
| GET    | /api/projects                            | super_admin, admin, sales, employee   |
| GET    | /api/projects/:id                         | super_admin, admin, sales, employee   |
| POST   | /api/projects                            | super_admin, admin                    |
| PUT    | /api/projects/:id                         | super_admin, admin                    |
| DELETE | /api/projects/:id                         | super_admin, admin                    |
| GET    | /api/tasks                               | super_admin, admin, sales, employee   |
| GET    | /api/tasks/my/:userId                      | all authenticated roles               |
| POST   | /api/tasks                               | super_admin, admin                    |
| PUT    | /api/tasks/:id                            | super_admin, admin                    |
| PUT    | /api/tasks/:id/status                      | super_admin, admin, sales, employee   |
| DELETE | /api/tasks/:id                            | super_admin, admin                    |
| GET    | /api/notifications/:userId                 | all authenticated roles (own only)    |
| POST   | /api/notifications                        | super_admin, admin, hr                |
| PUT    | /api/notifications/:id/read                 | all authenticated roles               |
| PUT    | /api/notifications/user/:userId/read-all      | all authenticated roles               |
| DELETE | /api/notifications/:id                      | all authenticated roles               |
| POST   | /api/documents/upload                       | all authenticated roles               |
| GET    | /api/documents                            | all authenticated roles               |
| GET    | /api/documents/:id/download                   | all authenticated roles               |
| DELETE | /api/documents/:id                          | super_admin, admin                    |

### Notes on Phase 3 logic

- **Projects**: `GET /api/projects/:id` returns the project plus its full task list in one call — convenient for a project detail page.
- **Tasks**: creating a task (`POST /api/tasks`) automatically drops a notification for the assignee. `PUT /api/tasks/:id/status` is a lightweight endpoint meant for a kanban board (drag between todo/in_progress/done) without needing the full update payload.
- **Notifications**: a simple per-user feed. Other modules (tasks, leave approvals, etc.) insert directly into the `notifications` table — extend this pattern for new features rather than routing everything through the API layer internally.
- **Documents**: reuses the `middleware/upload.js` Multer config from Phase 1 (5MB limit, jpg/png/pdf/doc/docx/xlsx only). Files are saved to `/uploads` and tracked in the `documents` table with a polymorphic `related_type` / `related_id` pair (e.g. `employee` + employee ID, `project` + project ID) so any entity can have attachments without extra join tables.

## Endpoints (Phase 4 — QR/GPS attendance + Business Analytics)

| Method | Endpoint                          | Access                          |
|--------|------------------------------------|----------------------------------|
| GET    | /api/attendance/qr/today             | super_admin, admin, hr          |
| POST   | /api/attendance/qr/check-in           | all authenticated roles         |
| POST   | /api/attendance/gps/check-in          | all authenticated roles         |
| GET    | /api/settings                        | all authenticated roles         |
| PUT    | /api/settings                        | super_admin, admin              |
| GET    | /api/analytics/overview               | super_admin, admin              |
| GET    | /api/analytics/attendance-trend        | super_admin, admin              |
| GET    | /api/analytics/lead-conversion-trend    | super_admin, admin              |
| GET    | /api/analytics/payroll-cost            | super_admin, admin              |
| GET    | /api/analytics/project-health           | super_admin, admin              |
| GET    | /api/analytics/department-headcount     | super_admin, admin              |

### Setting up QR + GPS attendance

1. **Configure the office location** (one-time, per office):
   ```
   PUT /api/settings
   { "office_latitude": "12.9716", "office_longitude": "77.5946", "geofence_radius_meters": "150" }
   ```
2. **QR flow**: display `GET /api/attendance/qr/today` (returns a PNG) on a screen or poster at the entrance. It encodes a token that's valid only for the current day (HMAC-signed with `QR_SECRET` — set a strong one in `.env`, never commit it). Employees scan it with a phone app, which then calls:
   ```
   POST /api/attendance/qr/check-in
   { "employee_id": 12, "token": "<scanned token>", "latitude": 12.9718, "longitude": 77.5949 }
   ```
   If a geofence is configured, the employee's GPS is also checked against it.
3. **Pure GPS flow** (no QR/poster needed): employees check in directly from their phone's location:
   ```
   POST /api/attendance/gps/check-in
   { "employee_id": 12, "latitude": 12.9718, "longitude": 77.5949 }
   ```
   This always requires a geofence to be configured — there's no QR token to fall back on.
4. If you provisioned your database before this phase, run the migration first:
   ```
   mysql -u root -p bcms_platform < models/migrations/phase4_attendance_gps.sql
   ```

### Business Analytics

`GET /api/analytics/overview` is a single-call summary (recent leads/conversions, active projects, overdue tasks, 30-day attendance rate) meant for a dashboard landing page. The other `/api/analytics/*` endpoints return time-series or breakdown data meant to feed charts (monthly attendance trend, payroll cost, lead conversion, project completion %, department headcount/tenure).

Note: there's no finance/invoicing module yet, so "revenue" isn't tracked directly — lead conversion is used as the closest available proxy. A true revenue trend needs an Invoicing module, which isn't built yet.

## Multi-Company (Multi-Tenant) Support

Every table now carries a `company_id`. Every route that touches business data goes through two middlewares in order: `authenticate` (verifies the JWT) then `requireCompany` (rejects the request unless the token has a `company_id`, and sets `req.companyId` for controllers to filter on). This means **no controller trusts a company_id from the request body or query string** — it always comes from the logged-in user's own token, so there's no way to read or write another company's data by guessing IDs.

### Roles, now company-aware

- `super_admin`, `admin`, `hr`, `sales`, `employee` — same as before, but scoped to whichever company the user belongs to. An "admin" only administers their own company.
- `platform_admin` (new) — BCMS's own staff. Has `company_id = NULL` and manages tenants via `/api/companies`. Platform admins are deliberately blocked from `/api/employees`, `/api/customers`, etc. by `requireCompany` — they don't have day-to-day access to any one company's data.

### Onboarding a new company (self-serve)

```
POST /api/auth/signup-company
{
  "company_name": "Acme Hospital",
  "company_slug": "acme-hospital",
  "industry": "healthcare",
  "admin_name": "Dr. Jane Doe",
  "admin_email": "jane@acmehospital.com",
  "admin_password": "yourpassword"
}
```
This creates the company AND its first `admin` user in one transaction. That admin then logs in via the normal `/api/auth/login` and can invite more users (HR, sales, employees) via `POST /api/auth/register`, which always creates the new user inside the caller's own company — the endpoint ignores any company_id sent in the body.

### Platform admin endpoints (managing tenants)

| Method | Endpoint                     | Notes                                     |
|--------|--------------------------------|----------------------------------------------|
| GET    | /api/companies                  | List all tenants with user/employee counts |
| GET    | /api/companies/:id                | One tenant's details                       |
| POST   | /api/companies                  | Manually create a tenant (no first user)   |
| PUT    | /api/companies/:id                | Update name/industry/contact/plan/status   |
| PUT    | /api/companies/:id/suspend          | Blocks all logins for that company         |
| PUT    | /api/companies/:id/activate          | Re-enables logins                          |
| DELETE | /api/companies/:id                | Deletes the company and ALL its data (cascades) |

There's no `platform_admin` self-signup endpoint on purpose — create that first account directly in the database:
```sql
INSERT INTO users (company_id, name, email, password, role_id)
VALUES (NULL, 'BCMS Staff', 'staff@bcms.com', '<bcrypt hash>', 6);
```
(Generate the bcrypt hash with `node -e "require('bcrypt').hash('yourpassword', 10).then(console.log)"` after `npm install`.)

### Departments (new)

A gap from Phase 1 is closed here — departments never had their own API before, even though employees reference `department_id`. Now scoped per company:

| Method | Endpoint              | Access                |
|--------|-------------------------|-------------------------|
| GET    | /api/departments          | all authenticated roles |
| POST   | /api/departments          | super_admin, admin      |
| PUT    | /api/departments/:id        | super_admin, admin      |
| DELETE | /api/departments/:id        | super_admin, admin      |

### Upgrading an existing (single-company) database

If you already ran `schema.sql` from Phase 1-4, don't re-run the new `schema.sql` — run the migration instead, which wraps all your existing data into a "Default Company" (`company_id = 1`) so nothing breaks:
```
mysql -u root -p bcms_platform < models/migrations/phase5_multi_company.sql
```
Then rename it to your real company:
```sql
UPDATE companies SET name = 'Your Company Name', slug = 'your-company' WHERE id = 1;
```
Every existing user, employee, customer, etc. now belongs to that company automatically.

### What was NOT changed

- QR attendance tokens are now company-scoped (embed the company ID in the signed payload), so a QR poster from one company can never check someone into another.
- The `QR_SECRET` env var is shared across all companies — it's used to *sign* tokens, not to distinguish between companies, so this is safe as-is.
- Report exports (`/api/reports/...`) and analytics (`/api/analytics/...`) were already rewritten to filter by `req.companyId` alongside everything else.

## WhatsApp / SMS Notifications

Uses Twilio for both channels (one provider, one set of credentials — Twilio's WhatsApp Business API covers WhatsApp, so there's no separate Meta Cloud API setup needed). The existing in-app `notifications` table is still always written to; SMS/WhatsApp are additive, controlled per company.

**Setup:**
1. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, and/or `TWILIO_WHATSAPP_FROM` in `.env`. These are platform-level credentials (BCMS's own Twilio account) — companies don't bring their own.
2. Each company opts in to which channels they want, in addition to in-app:
   ```
   PUT /api/settings
   { "notification_channels": "app,sms,whatsapp" }
   ```
   Default is `app` only if this setting is never set.
3. For a user to actually receive SMS/WhatsApp, their linked employee record needs a `phone` number on file — the dispatcher looks it up via `employees.user_id`. If there's no phone or no employee link, the in-app notification still gets created; the external send is silently skipped.

**Where it fires today:** task assignment (`POST /api/tasks`) and leave approval/rejection (`PUT /api/leaves/:id/decision`) now go through `services/notificationDispatch.js` instead of writing to the table directly. `POST /api/notifications` (the manual send endpoint) uses the same path. Any new feature that needs to notify a user should call `notifyUser(companyId, userId, message)` from that service rather than inserting into `notifications` directly, so it automatically gets SMS/WhatsApp/email behavior for free.

Email is included too — `MAIL_HOST`/`MAIL_USER`/`MAIL_PASSWORD` (already in `.env` since Phase 1 via Nodemailer) now actually gets used. Add `email` to a company's `notification_channels` to enable it: `PUT /api/settings { "notification_channels": "app,email" }`. Unlike SMS/WhatsApp, email doesn't need an employee record — it just uses the user's login email.

**Not done:** delivery status tracking (Twilio webhooks for delivered/failed), rate limiting per company, and quiet-hours scheduling. All straightforward additions once you're using this in practice and know what you actually need.

## Inventory & Asset Management

Two related but distinct modules, both company-scoped like everything else:

**Inventory** (`/api/inventory`) — consumable stock (supplies, spare parts, etc.). Quantity can never be edited directly through `PUT /api/inventory/:id` — that endpoint only touches descriptive fields (name, SKU, category, reorder level, cost). The only way to change how much you have is:
```
POST /api/inventory/:id/adjust
{ "change_qty": -5, "reason": "Used for client site visit" }
```
Positive numbers add stock, negative numbers remove it, and every adjustment is logged to `inventory_transactions` with who did it and why — so stock counts always have a full audit trail, and it's impossible for the number to drift without a reason attached. `GET /api/inventory?low_stock=true` filters to items at or below their configured `reorder_level`.

**Assets** (`/api/assets`) — non-consumable, trackable items (laptops, vehicles, furniture). These have a lifecycle (`available` → `assigned` → back to `available`, or `maintenance`/`retired`), so assignment goes through dedicated endpoints rather than a generic status update:
```
POST /api/assets/:id/assign   { "employee_id": 12, "notes": "For remote work" }
POST /api/assets/:id/return
```
Each assignment opens a row in `asset_assignments`; returning it closes that row with today's date, so `GET /api/assets/:id` always returns a full history of who's held that asset and when. `PUT /api/assets/:id` deliberately refuses `status: "assigned"` — it points you at the assign endpoint instead, so history can't get out of sync with the current holder.

**Not done:** low-stock email/SMS alerts (would plug into `notifyUser()` from the dispatcher above — a natural follow-up), barcode/QR scanning for check-in/check-out (would reuse the `qrService.js` pattern from attendance), and depreciation tracking on assets.

## AI Assistant

Scope decision made here (flagged as open in Phase 4): this is a **natural-language query assistant over the company's own data** — "how many people are on leave today?", "who hasn't checked in yet?", "what's overdue on the Acme project?" — not a general chatbot, not task automation (it can't create/edit/delete anything), and not a FAQ bot over documentation. Those are different, separately-scoped builds if you want them later.

Built on the Anthropic API using tool-use: Claude is given a fixed set of read-only tools (`services/assistantTools.js`) and decides which to call based on the question; the server executes them and feeds results back until Claude has enough to answer. Same security rule as everywhere else in this app: **tools receive `companyId` and `role` from the authenticated request, never from the model or the request body** — the assistant physically cannot query another company's data because the tool functions don't accept a company_id as an argument at all.

**Setup:** set `ANTHROPIC_API_KEY` in `.env`. Without it, `POST /api/assistant/ask` returns a 503 explaining the assistant isn't configured, rather than failing obscurely.

**Usage:**
```
POST /api/assistant/ask
{ "question": "How many employees are on leave today, and who hasn't checked in yet?" }
```
Response includes `answer` (plain text) and `conversation` (the full message history, including tool calls/results) — pass `conversation` back on the next request to keep a multi-turn chat going.

**Available tools today:** dashboard summary, pending leave requests, today's attendance (checked-in vs not-yet), overdue tasks, department headcount, employee search, lead pipeline by status, and payroll summary (this last one is role-gated inside the tool itself — only `super_admin`/`admin`/`hr` get real numbers back, everyone else gets a permission message, regardless of what the model tries to ask for).

**Extending it:** add a new entry to the `tools` array in `services/assistantTools.js` with a `name`, `description`, `input_schema`, and an `execute(input, { companyId, role })` function. That's the only place that needs to change — the controller loop and route are already generic.

**Not done:** conversation persistence across sessions (currently the frontend must resend `conversation` each time), streaming responses, and any tool that writes data (by design, for now — a write-capable assistant needs its own confirmation/audit story before it's safe to build).



## Still open (needs its own scoping pass)

- **Face recognition attendance** — needs a dedicated computer-vision service (e.g. AWS Rekognition, Azure Face API, or a self-hosted model) and a decision on where face embeddings are stored/how consent is handled per company.
- **Mobile app** — this REST API is already mobile-ready; building the actual Android/iOS client is a separate, much larger project.
