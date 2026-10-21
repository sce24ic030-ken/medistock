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
    ├── *.html             # 16 pages (4 auth + 12 app tabs)
    ├── css/style.css      # full design system
    └── js/                # page scripts + shared nav.js / ui.js
```

---

## Tabs & Features (12 app tabs + 4 auth pages)

### Authentication
| Page | What it does |
|---|---|
| `index.html` | Split-screen login — animated brand panel (rotating headline, orbit rings, floating particles, count-up stats, 10 feature chips), remember-email, password reveal |
| `signup.html` | Register a new customer account |
| `admin-login.html` | Admin console sign-in (separate entry point) |
| `forgot-password.html` | Request a reset token, then set a new password |

### Signed-in app tabs
| Tab | File | What it does |
|---|---|---|
| **Dashboard** | `dashboard.html` | Hero with animated counters, 6 KPI cards with trend bars, Chart.js category + expiry charts, stock-health meter, smart alerts panel, recent activity timeline |
| **Medicines** | `medicines.html` | Add / edit / delete, search, category filter, live stock & expiry columns |
| **Orders** | `orders.html` | Order register with search + status filter, revenue KPIs, create order, update fulfilment status, CSV export |
| **Cart** | `cart.html` | Add to cart, update quantity, remove, totals, checkout deducts stock |
| **Smart Alerts** | `alerts.html` | Unified alert centre (low stock / expiring / expired), severity grouping, one-click **Restock 25** |
| **Stock Ledger** | `movements.html` | Every stock movement (purchase / sale / adjustment / return) with running quantity and reason filter |
| **Suppliers** | `suppliers.html` | Supplier directory, contact details, lead time, linked catalogue, add / edit / deactivate |
| **Reports** | `reports.html` | Stock, low stock, expiring, expired and activity reports, CSV export, print-to-PDF |
| **Feedback** | `feedback.html` | Star rating + comments from customers |
| **FAQs & Contact** | `faqs.html` | Accordion FAQs plus a contact form |
| **Users & Roles** | `users.html` | Admin-only user directory: role changes, activate/deactivate, add user |
| **Profile** | `profile.html` | Edit name/phone, change password, notification preferences, sign out |

### Cross-cutting features
- **Role-based access** — `admin`, `pharmacist`, `customer`. Admin-only tabs and buttons are hidden
  for everyone else and protected on the API with `admin_required`.
- **Smart alerts** — red below 10 units, amber within 30 days of expiry, red when expired.
- **Full-screen app shell** — collapsible sidebar, sticky top bar, live clock, cart badge,
  toasts, responsive down to mobile.
- **Shared helpers** — `js/nav.js` renders the whole sidebar (brand, 4 nav groups, 12 links,
  user block) from one source of truth, so adding a tab needs no HTML edits.
  `js/ui.js` provides `App.escape / money / number / date / daysUntil / toast / exportCsv /
  statusBadge / adminOnly`.
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

### Deployment (Render)
1. **Backend (Web Service)** — push the repo to GitHub, create a Render Web Service with the
   `backend/` root, and add the Aiven environment variables (`DB_HOST`, `DB_PORT`, `DB_USER`,
   `DB_PASSWORD`, `DB_NAME`, plus `SECRET_KEY`).
2. **Frontend (Static Site)** — create a Render Static Site with the `frontend/` root, then
   point `js/config.js` `API_BASE_URL` at the deployed backend URL.

---

## Demo Credentials (created by `seed.py`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@smartmed.com` | `Admin@123` |
| Pharmacist | `pharmacist@smartmed.com` | `Pharmacist@123` |
| Pharmacist | `ravi@smartmed.com` | `Staff@123` |
| Customer | `customer@test.com` | `Customer@123` |
| Customer | `aisha@smartmed.com` | `Customer@123` |

Sample data seeded: 16 medicines with batches and suppliers, 4 suppliers, 6 orders,
12 stock movements, 3 feedback entries, activity history, and alerts across all severities.
