import os
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from config import Config
from models import db
from datetime import datetime, timedelta

# Import all models
from models.user import User
from models.medicine import Medicine
from models.cart import Cart
from models.order import Order, OrderItem
from models.feedback import Feedback
from models.activity import Activity
from models.contact import Contact
from models.supplier import Supplier
from models.movement import StockMovement

# Import routes
from routes.auth import auth_bp
from routes.medicines import medicines_bp
from routes.cart import cart_bp
from routes.dashboard import dashboard_bp
from routes.reports import reports_bp
from routes.feedback import feedback_bp
from routes.contact import contact_bp
from routes.orders import orders_bp
from routes.suppliers import suppliers_bp
from routes.movements import movements_bp
from routes.users import users_bp

app = Flask(__name__)
app.config.from_object(Config)

# The frontend lives next to the backend in the repository. Serving it from the
# same Flask process means the whole app runs on a single origin, so the
# session cookie is a first-party cookie and no CORS/cookie dance is needed.
FRONTEND_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
)

# Initialize extensions
db.init_app(app)

# The frontend may be served from any local port during development
# (Live Server on 5500, VS Code on 8080, python -m http.server on 8000, ...),
# so every loopback origin is allowed with credentials. The deployed origins
# still come from FRONTEND_URL / EXTRA_ORIGINS; the public Render host of this
# project is allowed as well so a deployment without dashboard environment
# variables still works.
CORS(app, supports_credentials=True, resources={r"/api/*": {
    "origins": [
        app.config['FRONTEND_URL'],
        'http://localhost:5500', 'http://127.0.0.1:5500',
        'http://localhost:8080', 'http://127.0.0.1:8080',
        'http://localhost:8000', 'http://127.0.0.1:8000',
        'http://localhost:3000', 'http://127.0.0.1:3000',
        r'http://localhost:\d+', r'http://127\.0\.0\.1:\d+',
        'https://medistock-web.onrender.com',
        r'https://[\w-]+\.onrender\.com'
    ] + app.config.get('EXTRA_ORIGINS', [])
}})


# ---------------------------------------------------------------------------
# Session cookie flags
# ---------------------------------------------------------------------------
# "onrender.com" is a public suffix, so https://medistock-web.onrender.com and
# https://medistock-api-zudg.onrender.com are *different sites* for the
# browser. A cookie without an explicit SameSite attribute counts as Lax and
# browsers then refuse to send it on the cross-site fetch calls the frontend
# makes - the API answers 401 and the user is bounced back to the login form
# over and over.
#
# Therefore a public https deployment gets "SameSite=None; Secure" (the only
# combination a browser accepts for a cross-site cookie) while local
# development stays on plain Lax. An explicit environment variable always
# wins, so a deployment can still override the behaviour.
LOOPBACK_HOSTS = ('localhost', '127.0.0.1', '0.0.0.0', '::1')


def _is_cross_site_deployment():
    """True when the request comes from a public https host (the deployment)."""
    host = (request.host or '').split(':')[0].lower()
    if host in LOOPBACK_HOSTS:
        return False
    if host.replace('.', '').isdigit():
        # A bare IP address does not guarantee that https is available.
        return False
    proto = request.headers.get('X-Forwarded-Proto', request.scheme)
    return proto == 'https'


@app.before_request
def _apply_session_cookie_flags():
    """Let Flask build the session cookie with the right flags."""
    if app.config.get('SESSION_COOKIE_EXPLICIT'):
        return
    if _is_cross_site_deployment():
        app.config['SESSION_COOKIE_SAMESITE'] = 'None'
        app.config['SESSION_COOKIE_SECURE'] = True
    else:
        # Local development keeps the plain, first-party cookie.
        app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
        app.config['SESSION_COOKIE_SECURE'] = False


@app.after_request
def _enforce_session_cookie_flags(response):
    """Safety net: make sure the session cookie really carries the flags.

    Browsers silently drop a cookie that is stored from a cross-site response
    without "SameSite=None; Secure", so the header is patched directly in case
    the session was written before the flags were applied.
    """
    if app.config.get('SESSION_COOKIE_EXPLICIT'):
        return response
    if not _is_cross_site_deployment():
        return response

    for header, value in list(response.headers.items()):
        if header.lower() != 'set-cookie':
            continue
        if not value.startswith('session='):
            continue
        parts = [p.strip() for p in value.split(';')]
        names = {p.split('=')[0].strip().lower() for p in parts[1:] if '=' in p}
        if 'samesite' not in names:
            parts.append('SameSite=None')
        if 'secure' not in names:
            parts.append('Secure')
        response.headers[header] = '; '.join(parts)

    return response

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(medicines_bp, url_prefix='/api/medicines')
app.register_blueprint(cart_bp, url_prefix='/api/cart')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
app.register_blueprint(reports_bp, url_prefix='/api/reports')
app.register_blueprint(feedback_bp, url_prefix='/api/feedback')
app.register_blueprint(contact_bp, url_prefix='/api/contact')
app.register_blueprint(orders_bp, url_prefix='/api/orders')
app.register_blueprint(suppliers_bp, url_prefix='/api/suppliers')
app.register_blueprint(movements_bp, url_prefix='/api/movements')
app.register_blueprint(users_bp, url_prefix='/api/users')

@app.route('/')
def home():
    """The login page - the API also serves the frontend so both share an origin."""
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:filename>')
def frontend_files(filename):
    """Serve the frontend assets (html/css/js) bundled with the API."""
    return send_from_directory(FRONTEND_DIR, filename)


@app.route('/api/info')
def api_info():
    return jsonify({
        'message': 'Medistock - Smart Medicine Inventory Management System API',
        'status': 'running',
        'version': '2.0.0'
    })

@app.route('/api/health')
def health():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

def ensure_columns():
    """Add columns introduced after the database was first created.

    db.create_all() only creates missing tables, so new columns on existing
    tables are applied here with a lightweight ALTER TABLE (works on both
    SQLite and MySQL).
    """
    inspector = db.inspect(db.engine)
    tables = inspector.get_table_names()
    additions = {
        'users': [
            ('phone', 'VARCHAR(40)'),
            ('is_active', 'BOOLEAN NOT NULL DEFAULT 1'),
            ('last_login', 'DATETIME')
        ],
        'medicines': [
            ('batch_no', 'VARCHAR(60)'),
            ('supplier_id', 'INTEGER')
        ]
    }

    for table, columns in additions.items():
        if table not in tables:
            continue
        existing = {column['name'] for column in inspector.get_columns(table)}
        for name, ddl in columns:
            if name in existing:
                continue
            db.session.execute(db.text(f'ALTER TABLE {table} ADD COLUMN {name} {ddl}'))
            print(f"Migration: added {table}.{name}")
    db.session.commit()

def ensure_medicine_fk_nullable():
    """Let a medicine be deleted while its ledger / order history stays intact.

    `stock_movements.medicine_id` and `order_items.medicine_id` used to be
    NOT NULL, so deleting a medicine that appeared in a movement or an order
    raised an integrity error. Both columns are relaxed here for databases
    that were created before that change (fresh databases already use the
    nullable definition from the models).
    """
    from sqlalchemy import MetaData, text
    from sqlalchemy.schema import CreateTable

    inspector = db.inspect(db.engine)
    tables = inspector.get_table_names()
    targets = ['stock_movements', 'order_items']

    if db.engine.dialect.name == 'mysql':
        for table in targets:
            if table not in tables:
                continue
            columns = {c['name']: c for c in inspector.get_columns(table)}
            if columns.get('medicine_id', {}).get('nullable', False):
                continue

            fk_names = [row[0] for row in db.session.execute(text(
                "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t "
                "AND COLUMN_NAME = 'medicine_id' AND REFERENCED_TABLE_NAME IS NOT NULL"
            ), {'t': table})]

            for fk in fk_names:
                db.session.execute(text(f'ALTER TABLE {table} DROP FOREIGN KEY {fk}'))
            db.session.execute(text(f'ALTER TABLE {table} MODIFY COLUMN medicine_id INT NULL'))
            db.session.execute(text(
                f'ALTER TABLE {table} ADD CONSTRAINT {table}_medicine_fk '
                'FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE SET NULL'
            ))
            print(f"Migration: relaxed {table}.medicine_id")
        db.session.commit()
        return

    if db.engine.dialect.name != 'sqlite':
        return

    for table in targets:
        if table not in tables:
            continue
        columns = {c['name']: c for c in inspector.get_columns(table)}
        if columns.get('medicine_id', {}).get('nullable', False):
            continue

        model_table = db.metadata.tables[table]
        temp_metadata = MetaData()
        # Copy every table so the foreign keys can be resolved, then rebuild
        # only the table we are relaxing.
        for existing_table in db.metadata.sorted_tables:
            existing_table.to_metadata(temp_metadata)
        new_table = temp_metadata.tables[table]
        new_table.name = f'{table}_new'

        old_columns = [c['name'] for c in inspector.get_columns(table)]
        shared = [c for c in old_columns if c in new_table.c]
        column_list = ', '.join(shared)

        # SQLite needs the rebuild to run outside a transaction, otherwise the
        # PRAGMA and the DDL statements fight over the file lock.
        db.session.commit()
        db.session.remove()

        with db.engine.connect().execution_options(isolation_level='AUTOCOMMIT') as conn:
            conn.execute(text('PRAGMA foreign_keys=OFF'))
            conn.execute(text(f'DROP TABLE IF EXISTS {table}_new'))
            conn.execute(CreateTable(new_table))
            conn.execute(text(
                f'INSERT INTO {table}_new ({column_list}) SELECT {column_list} FROM {table}'
            ))
            conn.execute(text(f'DROP TABLE {table}'))
            conn.execute(text(f'ALTER TABLE {table}_new RENAME TO {table}'))
            conn.execute(text('PRAGMA foreign_keys=ON'))

        print(f"Migration: relaxed {table}.medicine_id")


with app.app_context():
    db.create_all()
    ensure_columns()
    ensure_medicine_fk_nullable()
    print("Database tables created successfully!")

    # On a fresh deployment the demo database is empty. Render's free plan
    # does not run pre-deploy commands, so the app seeds itself here instead.
    if os.environ.get('AUTO_SEED', '').lower() in ('1', 'true', 'yes'):
        try:
            from seed_data import seed_all
            seed_all()
        except Exception as exc:  # never block the boot because of demo data
            print(f"Auto-seed skipped: {exc}")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
