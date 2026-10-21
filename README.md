# Medistock

**Medistock — Smart Medicine Inventory Management System**

A full-stack medicine inventory management system with a Flask REST API backend, a static
frontend, and a MySQL database (Aiven). Built for college demonstration: every feature is
wired to a real API call and ships with realistic sample data.

---

## Tech Stack

### Backend (deploy on Render Web Service)
- Flask
- Flask-SQLAlchemy
- PyMySQL
- Flask-Bcrypt
- Flask-CORS
- Flask-WTF
- python-dotenv

### Frontend (static HTML/CSS/JS)
- HTML5, CSS3, JavaScript (vanilla, no build step)
- Bootstrap 5
- Chart.js
- Font Awesome
- Google Fonts (Inter)

### Database
- Aiven MySQL (with SSL)
- SQLite fallback for local development when no `DB_*` environment variables are set

---

## Project Structure

```
Smart-Medicine-Inventory/
├── backend/
│   ├── app.py             # Flask app factory, blueprints, migrations
│   ├── models/            # SQLAlchemy models
│   ├── routes/            # REST blueprints
│   ├── seed.py            # idempotent demo data
│   └── requirements.txt
└── frontend/
    ├── *.html             # 20 pages (4 auth + 16 app tabs)
    ├── css/style.css      # full design system
    └── js/                # page scripts + shared nav.js / ui.js / role-summary.js
```

---

## Tabs & Features (16 app tabs + 4 auth pages)

### Authentication
| Page | What it does |
|---|---|
| `index.html` | Split-screen login — animated brand panel (rotating headline, orbit rings, floating particles, count-up stats, 10 feature chips), remember-email, password reveal. The screen always fills the window: both halves scroll inside themselves instead of pushing the page down |
| `signup.html` | Register a new customer account |
| `admin-login.html` | Admin console sign-in (separate entry point) |
| `forgot-password.html` | Request a reset token, then set a new password |

### Role home pages (each role lands on its own screen)

| Role | Home page | What it shows |
|---|---|---|
| Administrator | `dashboard.html` | Hero with animated counters, KPI cards with trend bars, Chart.js category + expiry charts, stock-health meter, smart alerts panel, recent activity timeline |
| Pharmacist | `pharmacist.html` | Dispensing queue, expiring batches, prescription-style order queue, stock to review, quick restock / order actions |
| Counter Staff | `staff.html` | Orders to pack, units issued today, today's stock movements, shelf alerts, one-click status updates |
| Customer | `customer.html` (+ `shop.html`) | Personal dashboard (my orders, spend, reorders) and a browsable medicine shop with cart |

### Shared app tabs
| Tab | File | Who can open it | What it does |
|---|---|---|---|
| **Medicines** | `medicines.html` | admin, pharmacist, staff | Add / edit / delete (admin + pharmacist), search, category filter, live stock & expiry columns, counter-sale |
| **Orders** | `orders.html` | all roles | Order register with search + status filter, revenue KPIs, create order, update fulfilment status, CSV export. Customers only see their own orders |
| **Shop medicines** | `shop.html` | customer | Browse the catalogue, search, add to cart |
| **Cart** | `cart.html` | all roles | Add to cart, update quantity, remove, totals, checkout deducts stock |
| **Smart Alerts** | `alerts.html` | admin, pharmacist, staff | Unified alert centre (low stock / expiring / expired), severity grouping, one-click **Restock 25** |
| **Stock Ledger** | `movements.html` | admin, pharmacist, staff | Every stock movement (purchase / sale / adjustment / return) with running quantity and reason filter |
| **Suppliers** | `suppliers.html` | admin, pharmacist, staff | Supplier directory, contact details, lead time, linked catalogue, add / edit / deactivate (admin only writes) |
| **Reports** | `reports.html` | admin, pharmacist | Stock, low stock, expiring, expired and activity reports, CSV export, print-to-PDF |
| **Feedback** | `feedback.html` | all roles | Star rating + comments from customers |
| **FAQs & Contact** | `faqs.html` | all roles | Accordion FAQs plus a contact form |
| **Users & Roles** | `users.html` | admin | Admin-only user directory: role changes, activate/deactivate, add user |
| **Profile** | `profile.html` | all roles | Edit name/phone, change password, notification preferences, sign out |

### Role access rules

| Capability | admin | pharmacist | staff | customer |
|---|:--:|:--:|:--:|:--:|
| Own home page | `dashboard.html` | `pharmacist.html` | `staff.html` | `customer.html` + `shop.html` |
| See every order / update fulfilment | yes | yes | yes | own orders only |
| See the catalogue | yes | yes | yes | shop only |
| Create / edit / delete medicines | yes | create + edit | – | – |
| Smart alerts, stock ledger, suppliers (read) | yes | yes | yes | – |
| Reports | yes | yes | – | – |
| Manage suppliers (write) | yes | – | – | – |
| Users & roles | yes | – | – | – |

The rules are enforced twice: the sidebar and the page buttons hide what a role may not use
(`data-roles="admin,pharmacist"`), and the API rejects the call with `role_required` /
`counter_required` so the UI can never be bypassed.

### Cross-cutting features
- **Role-based access** — `admin`, `pharmacist`, `staff`, `customer`. Admin-only tabs and buttons are hidden
  for everyone else and protected on the API with `role_required` / `counter_required`.
- **One shared role payload** — `GET /api/dashboard/summary` answers with the blocks the signed-in
  role actually needs (KPIs, alerts, order queue, stock, activity, movements, medicines, charts).
  `js/role-summary.js` renders it, so every role page shows live data with its own layout.
- **No login loop** — the session cookie is kept on the same hostname as the page
  (`js/config.js` mirrors `location.hostname`), and if the API still loses the session the app
  explains the problem on the page instead of bouncing between the login screen and the home page.
- **Smart alerts** — red below 10 units, amber within 30 days of expiry, red when expired.
- **Full-screen app shell** — collapsible sidebar, sticky top bar, live clock, cart badge,
  toasts, responsive down to mobile.
- **Shared helpers** — `js/nav.js` renders the whole sidebar (brand, 4 nav groups, 12 links,
  user block) from one source of truth, so adding a tab needs no HTML edits.
  `js/ui.js` provides `App.escape / money / number / date / daysUntil / toast / exportCsv /
  statusBadge / kpiHtml / applyRole`.
- **Permanent storage** — every record lives in Aiven MySQL.

---

## Setup Instructions

### Backend
1. `cd backend`
2. Create a virtual environment: `python -m venv venv`
3. Activate: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Linux/Mac)
4. Install dependencies: `pip install -r requirements.txt`
5. Copy `.env.example` to `.env` and add your Aiven MySQL credentials
6. Run: `python app.py`
7. Seed demo data: `python seed.py` (idempotent — safe to re-run)

### Frontend
1. `cd frontend`
2. Update `js/config.js` with your backend URL (e.g. `http://127.0.0.1:5000` for local)
3. Open `index.html` in a browser, or serve the folder statically

### Deployment (Render) — live

| Service | URL |
|---|---|
| Frontend (Static Site) | **https://medistock-web.onrender.com** |
| Backend API (Flask) | **https://medistock-api-zudg.onrender.com** |
| Health check | https://medistock-api-zudg.onrender.com/api/health |

The repository also contains a `render.yaml` blueprint, so the same two services can be
recreated from the Render dashboard in one click:

1. **Backend (Web Service)** — repository root, build `pip install -r backend/requirements.txt`,
   start `gunicorn --chdir backend app:app`, health check `/api/health`, pre-deploy `python seed.py`
   (seeds the demo database on every deploy).
   Environment variables: `SECRET_KEY`, `JWT_SECRET_KEY`, `FRONTEND_URL`,
   `EXTRA_ORIGINS` and — for Aiven MySQL — `DB_HOST`, `DB_PORT`, `DB_USER`,
   `DB_PASSWORD`, `DB_NAME`.
2. **Frontend (Static Site)** — `frontend/` root, publish path `./`.
   `js/config.js` automatically targets the live API for any non-local hostname;
   a local copy keeps using `http://127.0.0.1:5000`.

The API also serves the `frontend/` folder itself, so the whole app can be opened on a
single address (`https://medistock-api-zudg.onrender.com/`). That is the recommended
link: page and API share one origin, the session cookie stays a normal first-party
cookie and no cross-site rules are involved at all.

> **The "logged in but back at the login screen" loop on the split deployment**
> `onrender.com` is a public suffix, so `medistock-web.onrender.com` and
> `medistock-api-zudg.onrender.com` are *different sites* for the browser. A
> session cookie without an explicit `SameSite` attribute counts as `Lax`, and a
> `Lax` cookie is never sent on the cross-site `fetch` calls the static site
> makes — the API answers `401` and the user is bounced back to the login form.
> `backend/app.py` therefore sends `SameSite=None; Secure` automatically on any
> public https host (and keeps plain `Lax` for local development). Setting
> `SESSION_COOKIE_SAMESITE=None` / `SESSION_COOKIE_SECURE=true` in the service
> environment does the same thing explicitly.

> The live instance currently stores its data in SQLite (the Render filesystem).
> Adding the Aiven MySQL environment variables above switches the backend to
> MySQL on the next deploy — no code change needed.

---

## Demo Credentials (created by `seed.py`)

| Role | Email | Password | Lands on |
|---|---|---|---|
| Administrator | `admin@smartmed.com` | `Admin@123` | `dashboard.html` |
| Pharmacist | `pharmacist@smartmed.com` | `Pharmacist@123` | `pharmacist.html` |
| Counter Staff | `ravi@smartmed.com` | `Staff@123` | `staff.html` |
| Counter Staff | `sana@smartmed.com` | `Staff@123` | `staff.html` |
| Customer | `customer@test.com` | `Customer@123` | `customer.html` |
| Customer | `aisha@smartmed.com` | `Customer@123` | `customer.html` |

Every account is created on the first `seed.py` run; re-running it only refreshes the demo
orders and stock movements so the counter desk always shows a realistic "today" queue.

Sample data seeded: 16 medicines with batches and suppliers, 4 suppliers, 6 orders,
12 stock movements, 3 feedback entries, activity history, and alerts across all severities.
