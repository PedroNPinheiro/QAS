# QAS — Quality, Security & Environment

Internal app for the Quality Department to manage:

| Section | Modules | Source spreadsheet |
|---|---|---|
| **Quality** | Internal Non-Conformities (`NCI`), External/Supplier Non-Conformities (`NCE`) | RC.QCP.0020.003, RC.QCP.0020.009 |
| **Security** | Work Accidents (`ACC`), Near Misses (`NM`) | LTI sheet, RC.QUA.0020.019 |
| **Environment** | Waste Production Records (`WST`) | RC.QUA.0020.014 |

Forms match the department's Excel templates (in `docs/`), plus a light
status/severity layer for dashboards. Every record gets an automatic reference
in the spreadsheet-compatible format `PREFIX+MMYY.NN` (e.g. `NCI0726.01` =
internal NC nr. 1 of July 2026, counters reset monthly), file attachments,
full-text search, status filtering and Excel export (all four Quality/Security
exports include a Root Cause Analysis column). The dashboard shows open
counts, delayed near-miss actions, days without accident, waste kg/€ and
12-month trends.

Attachments support drag & drop, multi-file upload and in-app preview (images,
PDF, txt/csv); only document/image file types are accepted. Every create,
update, delete and file operation is written to an audit trail with
field-level before → after diffs — visible per record in its History panel and
globally in the admin Audit Log page. Logins are rate-limited (5 failures →
5-minute lockout) and `/api/health` also checks database connectivity.

The **Analytics** page (`/analytics`) lets any user explore each module by
metric (count, cost €, days/hours lost, waste kg, invoiced €…), grouped by a
dimension (sector, supplier, department, body part, waste type…), over any
month/year range — with a monthly trend chart, a breakdown chart, KPI tiles
and a full data table. The backend endpoint is `/api/analytics`; its options
are defined in `backend/app/routers/analytics.py` (`CONFIG`) and mirrored in
`frontend/src/pages/AnalyticsPage.tsx` (`MODULES`).

## Sharing / running as a service

The backend serves the built frontend (`frontend/dist`), so the whole app runs
on one port: `http://<server-ip>:8000`. After frontend changes, rebuild with
`cd frontend && npm run build`.

To run QAS permanently (starts on boot, restarts on failure):

```bash
sudo cp /opt/QAS/deploy/qas.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now qas
```

Check status/logs with `systemctl status qas` and `journalctl -u qas -f`.
For development, `npm run dev` in `frontend/` still gives hot reload on :5173.

## Stack

- **Backend** — FastAPI + SQLAlchemy 2 + PostgreSQL (`backend/`)
- **Frontend** — React 19 + TypeScript + Vite + Tailwind CSS 4 + TanStack Query + Recharts (`frontend/`)
- **Auth** — email/password with JWT. Users are stored with a *nullable* password
  hash so SSO (OIDC/Entra ID) can be added later without schema changes: keep the
  `users` table, replace the login endpoint, provision users on first SSO login.

## Getting started

### 1. Database (PostgreSQL)

```sql
CREATE USER qas WITH PASSWORD 'choose-a-password';
CREATE DATABASE qas OWNER qas;
```

(Already created on this machine.)

### 2. Backend

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env        # adjust DATABASE_URL / SECRET_KEY
./venv/bin/python seed.py   # creates tables + admin user; add --demo for sample data
./venv/bin/uvicorn app.main:app --port 8000 --reload
```

API docs: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :8000)
```

### Default login

- **Email:** `admin@example.com`
- **Password:** `admin123` — **change it immediately** (Users → your user → new password).

Admins manage users and can delete records; regular users create and edit them.

## Project layout

```
backend/
  app/
    main.py            FastAPI app, CORS, routers
    config.py          settings from .env
    models.py          SQLAlchemy models (5 record types, users, attachments, sequences)
    schemas.py         Pydantic schemas
    auth.py            JWT + bcrypt + role guard
    sequences.py       race-safe yearly reference counters
    crud_router.py     generic CRUD factory (list/search/sort/export/get/create/update/delete)
    routers/           auth, users, records, attachments, dashboard
  seed.py              admin user + optional demo data
  uploads/             attachment storage (gitignored)
frontend/
  src/
    modules.ts         ★ single registry driving all module pages (columns + form fields)
    pages/             Dashboard, ListPage, RecordPage, Users, Login (List/Record are generic)
    components/        Layout (sidebar), Badges, Attachments
    api/client.ts      fetch wrapper with JWT + download helper
```

**To add a field to any form:** add the column in `backend/app/models.py`, the
field in `backend/app/schemas.py`, and one entry in `frontend/src/modules.ts` —
tables are updated automatically on backend start (new columns require a manual
`ALTER TABLE` or a migration tool once in production).

## Notes for production

- Set a fresh `SECRET_KEY` and a real password in `.env`; never commit `.env`.
- Run the API behind a reverse proxy and serve `frontend/dist` (run `npm run build`)
  from the same origin, proxying `/api` to uvicorn — then CORS can be disabled.
- Waste quantities are always in kg (as in the spreadsheet); invoiced value can
  represent revenue from sold recyclables.
- Wipe and reseed: `DROP DATABASE qas; CREATE DATABASE qas OWNER qas;` then `seed.py`.
