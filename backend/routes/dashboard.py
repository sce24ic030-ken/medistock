from flask import Blueprint, request, jsonify, session
from models import db
from models.medicine import Medicine
from models.user import User
from models.order import Order
from models.activity import Activity
from models.cart import Cart
from models.movement import StockMovement
from models.supplier import Supplier
from utils.decorators import (login_required, admin_required, current_role,
                              current_user, ROLE_LABELS, ADMIN, PHARMACIST,
                              STAFF, CUSTOMER)
from datetime import date, datetime, timedelta
from sqlalchemy import func

dashboard_bp = Blueprint('dashboard', __name__)


# --------------------------------------------------------------- helpers

def _kpi(key, label, value, icon, tone='k-indigo', trend='', hint='',
         prefix='', suffix='', display=None):
    """Build one KPI card description used by every role dashboard."""
    return {
        'key': key,
        'label': label,
        'value': value,
        'display': display if display is not None else str(value),
        'prefix': prefix,
        'suffix': suffix,
        'icon': icon,
        'tone': tone,
        'trend': trend,
        'hint': hint
    }


def _stock_snapshot(today):
    """Catalogue health counters shared by the employee dashboards."""
    medicines = Medicine.query.all()
    expired = [m for m in medicines if m.expiry_date < today]
    expiring = [m for m in medicines
                 if today <= m.expiry_date <= today + timedelta(days=30)]
    low = [m for m in medicines if m.quantity < 10]
    return {
        'medicines': medicines,
        'expired': expired,
        'expiring': expiring,
        'low': low,
        'units': sum(m.quantity for m in medicines),
        'value': round(sum(m.quantity * m.price for m in medicines), 2)
    }


def _alerts_for(medicines, today):
    alerts = []
    for m in medicines:
        if m.expiry_date < today:
            alerts.append({
                'type': 'expired',
                'severity': 'danger',
                'message': f'{m.name} has EXPIRED',
                'medicine': m.to_dict()
            })
        elif (m.expiry_date - today).days <= 30:
            days = (m.expiry_date - today).days
            alerts.append({
                'type': 'expiring',
                'severity': 'warning',
                'message': f'{m.name} expires in {days} days',
                'medicine': m.to_dict()
            })
        if m.quantity < 10:
            alerts.append({
                'type': 'low_stock',
                'severity': 'warning',
                'message': f'{m.name} is low on stock ({m.quantity} left)',
                'medicine': m.to_dict()
            })
    return alerts


def _category_chart():
    rows = db.session.query(
        Medicine.category, func.sum(Medicine.quantity).label('total')
    ).filter(Medicine.category != '').group_by(Medicine.category).all()
    return [{'category': r[0], 'count': int(r[1])} for r in rows]


def _expiry_timeline(today):
    timeline = []
    for i in range(6):
        start = today + timedelta(days=i * 15)
        end = today + timedelta(days=(i + 1) * 15)
        count = Medicine.query.filter(
            Medicine.expiry_date >= start, Medicine.expiry_date < end).count()
        timeline.append({'label': start.strftime('%d %b'), 'count': count})
    return timeline


def _queue(limit=8):
    """Orders that still need to be picked, packed or handed over."""
    orders = Order.query.filter(
        Order.status.in_(['pending', 'packed'])
    ).order_by(Order.created_at.asc()).limit(limit).all()
    return [o.to_dict() for o in orders]


# ------------------------------------------------------- existing routes

@dashboard_bp.route('/stats', methods=['GET'])
@login_required
def get_dashboard_stats():
    try:
        today = date.today()
        
        total_medicines = Medicine.query.count()
        total_users = User.query.filter_by(role='customer').count()
        total_orders = Order.query.count()
        
        # Calculate total stock value
        medicines = Medicine.query.all()
        total_stock_value = sum(m.quantity * m.price for m in medicines)
        total_stock_units = sum(m.quantity for m in medicines)
        
        # Alerts
        expired = 0
        expiring_soon = 0
        low_stock = 0
        for m in medicines:
            if m.expiry_date < today:
                expired += 1
            elif (m.expiry_date - today).days <= 30:
                expiring_soon += 1
            if m.quantity < 10:
                low_stock += 1
        
        # Recent activities
        recent_activities = Activity.query.order_by(Activity.created_at.desc()).limit(10).all()
        
        # Category distribution
        categories = db.session.query(Medicine.category, func.sum(Medicine.quantity).label('total')).filter(Medicine.category != '').group_by(Medicine.category).all()
        category_data = [{'category': c[0], 'count': int(c[1])} for c in categories]
        
        # Expiry timeline (next 90 days)
        expiry_timeline = _expiry_timeline(today)
        
        return jsonify({
            'stats': {
                'total_medicines': total_medicines,
                'total_users': total_users,
                'total_orders': total_orders,
                'total_stock_value': round(total_stock_value, 2),
                'total_stock_units': total_stock_units,
                'expired': expired,
                'expiring_soon': expiring_soon,
                'low_stock': low_stock
            },
            'recent_activities': [a.to_dict() for a in recent_activities],
            'category_data': category_data,
            'expiry_timeline': expiry_timeline
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/alerts', methods=['GET'])
@login_required
def get_alerts():
    try:
        today = date.today()
        medicines = Medicine.query.all()
        return jsonify({'alerts': _alerts_for(medicines, today)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------- role summary API

@dashboard_bp.route('/summary', methods=['GET'])
@login_required
def role_summary():
    """One payload per role, so every landing page renders from real data.

    The shape is identical for every role (greeting / kpis / quick_actions plus
    the panels that role is allowed to see), which keeps the frontend simple
    while each role still gets its own numbers and its own panels.
    """
    try:
        user = current_user()
        role = user.role
        today = date.today()
        first_name = (user.name or 'there').split(' ')[0]

        payload = {
            'role': role,
            'role_label': ROLE_LABELS.get(role, role.title()),
            'user': {'id': user.id, 'name': user.name, 'email': user.email},
            'greeting': {},
            'kpis': [],
            'quick_actions': [],
            'alerts': [],
            'orders': [],
            'activity': [],
            'stock': [],
            'medicines': [],
            'movements': [],
            'charts': {'category': [], 'expiry': []}
        }

        if role == ADMIN:
            payload.update(_admin_summary(user, today, first_name))
        elif role == PHARMACIST:
            payload.update(_pharmacist_summary(user, today, first_name))
        elif role == STAFF:
            payload.update(_staff_summary(user, today, first_name))
        else:
            payload.update(_customer_summary(user, today, first_name))

        return jsonify(payload), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def _admin_summary(user, today, first_name):
    snapshot = _stock_snapshot(today)
    orders = Order.query.order_by(Order.created_at.desc()).all()
    revenue = round(sum(o.total_amount for o in orders), 2)
    staff_count = User.query.filter(User.role.in_(['admin', 'pharmacist', 'staff'])).count()
    customers = User.query.filter_by(role='customer').count()

    kpis = [
        _kpi('catalogue', 'Total Medicines', len(snapshot['medicines']),
             'fa-capsules', 'k-indigo', 'catalogue',
             'Unique SKUs on the shelf'),
        _kpi('units', 'Stock Units', snapshot['units'], 'fa-boxes-stacked',
             'k-teal', 'on hand', 'Units physically available'),
        _kpi('value', 'Inventory Value', snapshot['value'], 'fa-sack-dollar',
             'k-violet', 'inventory', 'Quantity x unit price', prefix='$',
             display=f'{snapshot["value"]:,.2f}'),
        _kpi('revenue', 'Revenue', revenue, 'fa-indian-rupee-sign', 'k-teal',
             'all orders', 'Completed plus pending orders', prefix='$',
             display=f'{revenue:,.2f}'),
        _kpi('low', 'Low Stock', len(snapshot['low']), 'fa-arrow-trend-down',
             'k-orange', 'needs reorder', 'Fewer than 10 units on hand'),
        _kpi('expiring', 'Expiring Soon', len(snapshot['expiring']),
             'fa-hourglass-half', 'k-amber', '30d window',
             'Batches expiring within 30 days'),
        _kpi('expired', 'Expired Stock', len(snapshot['expired']),
             'fa-skull-crossbones', 'k-red', 'pull from shelf',
             'Batches past their expiry date'),
        _kpi('people', 'Accounts', staff_count + customers, 'fa-users',
             'k-indigo', 'team + customers',
             f'{staff_count} staff / {customers} customers')
    ]

    return {
        'greeting': {
            'eyebrow': 'Administrator console',
            'title': f'Welcome back, {first_name}',
            'subtitle': 'Full control of catalogue, people, suppliers and reporting.'
        },
        'kpis': kpis,
        'quick_actions': [
            {'label': 'Add medicine', 'icon': 'fa-plus', 'href': 'medicines.html'},
            {'label': 'Record order', 'icon': 'fa-receipt', 'href': 'orders.html'},
            {'label': 'Stock ledger', 'icon': 'fa-right-left', 'href': 'movements.html'},
            {'label': 'Suppliers', 'icon': 'fa-truck-medical', 'href': 'suppliers.html'},
            {'label': 'Reports', 'icon': 'fa-file-alt', 'href': 'reports.html'},
            {'label': 'Users & roles', 'icon': 'fa-users-cog', 'href': 'users.html'}
        ],
        'alerts': _alerts_for(snapshot['medicines'], today),
        'orders': [o.to_dict() for o in Order.query.order_by(
            Order.created_at.desc()).limit(6).all()],
        'activity': [a.to_dict() for a in Activity.query.order_by(
            Activity.created_at.desc()).limit(10).all()],
        'stock': [m.to_dict() for m in snapshot['low'][:8]],
        'medicines': [],
        'movements': [],
        'charts': {
            'category': _category_chart(),
            'expiry': _expiry_timeline(today)
        }
    }


def _pharmacist_summary(user, today, first_name):
    snapshot = _stock_snapshot(today)
    orders = Order.query.order_by(Order.created_at.desc()).all()
    month_start = datetime.utcnow() - timedelta(days=30)
    dispensed = Order.query.filter(Order.created_at >= month_start).all()
    dispensed_units = sum(i.quantity for o in dispensed for i in o.items)
    expiry_window = today + timedelta(days=7)
    expiring_week = [m for m in snapshot['expiring'] if m.expiry_date <= expiry_window]
    kpis = [
        _kpi('catalogue', 'Catalogue SKUs', len(snapshot['medicines']),
             'fa-capsules', 'k-indigo', 'in catalogue',
             'Medicines you are responsible for'),
        _kpi('units', 'Units on Hand', snapshot['units'], 'fa-boxes-stacked',
             'k-teal', 'on hand', 'Sellable units across every batch'),
        _kpi('dispensed', 'Dispensed (30d)', dispensed_units,
             'fa-pill', 'k-violet', 'last 30 days',
             'Units handed out in the last month'),
        _kpi('pending', 'Awaiting Fulfilment',
             Order.query.filter(Order.status.in_(['pending', 'packed'])).count(),
             'fa-box-open', 'k-orange', 'queue',
             'Orders still to be picked or handed over'),
        _kpi('expiring', 'Expiring <= 30 days', len(snapshot['expiring']),
             'fa-hourglass-half', 'k-amber', 'act now',
             f'{len(expiring_week)} of them within 7 days - discount or rotate'),
        _kpi('expired', 'Expired Batches', len(snapshot['expired']),
             'fa-skull-crossbones', 'k-red', 'quarantine',
             'Must be removed from sale'),
        _kpi('low', 'Below Reorder Level', len(snapshot['low']),
             'fa-arrow-trend-down', 'k-orange', 'reorder',
             'Fewer than 10 units left'),
        _kpi('suppliers', 'Suppliers', Supplier.query.count(),
             'fa-truck-medical', 'k-teal', 'vendors',
             'Approved pharmaceutical vendors')
    ]

    return {
        'greeting': {
            'eyebrow': 'Pharmacy workspace',
            'title': f'Good day, {first_name}',
            'subtitle': 'Dispensing, expiry compliance and stock health for your pharmacy.'
        },
        'kpis': kpis,
        'quick_actions': [
            {'label': 'Catalogue', 'icon': 'fa-capsules', 'href': 'medicines.html'},
            {'label': 'Fulfilment queue', 'icon': 'fa-receipt', 'href': 'orders.html'},
            {'label': 'Expiry alerts', 'icon': 'fa-bell', 'href': 'alerts.html'},
            {'label': 'Adjust stock', 'icon': 'fa-right-left', 'href': 'movements.html'},
            {'label': 'Suppliers', 'icon': 'fa-truck-medical', 'href': 'suppliers.html'},
            {'label': 'Reports', 'icon': 'fa-file-alt', 'href': 'reports.html'}
        ],
        'alerts': _alerts_for(snapshot['medicines'], today),
        'orders': _queue(),
        'activity': [a.to_dict() for a in Activity.query.order_by(
            Activity.created_at.desc()).limit(8).all()],
        'stock': [m.to_dict() for m in snapshot['expiring'][:8]],
        'medicines': [],
        'movements': [],
        'charts': {
            'category': _category_chart(),
            'expiry': _expiry_timeline(today)
        }
    }


def _staff_summary(user, today, first_name):
    snapshot = _stock_snapshot(today)
    start_of_day = datetime.combine(today, datetime.min.time())
    todays_orders = Order.query.filter(Order.created_at >= start_of_day).all()
    pending = Order.query.filter(Order.status == 'pending').count()
    packed = Order.query.filter(Order.status == 'packed').count()
    todays_movements = StockMovement.query.filter(
        StockMovement.created_at >= start_of_day).order_by(
        StockMovement.created_at.desc()).limit(8).all()
    units_issued = sum(abs(m.change) for m in todays_movements if m.change < 0)

    kpis = [
        _kpi('orders_today', 'Orders Today', len(todays_orders),
             'fa-receipt', 'k-indigo', 'since midnight',
             'Orders raised at the counter today'),
        _kpi('pending', 'To Pack', pending, 'fa-box-open', 'k-orange',
             'waiting', 'Orders that still need picking'),
        _kpi('packed', 'Ready to Hand Over', packed, 'fa-hand-holding',
             'k-teal', 'packed', 'Orders packed and waiting for the customer'),
        _kpi('units_issued', 'Units Issued', units_issued, 'fa-boxes-stacked',
             'k-violet', 'today', 'Units deducted from the shelf today'),
        _kpi('low', 'Shelf Reorder List', len(snapshot['low']),
             'fa-arrow-trend-down', 'k-orange', 'restock',
             'Items running out on the shelf'),
        _kpi('expiring', 'Expiring Soon',
             len(snapshot['expiring']),
             'fa-hourglass-half', 'k-amber', '30d window',
             'Move these batches first'),
        _kpi('expired', 'Do Not Sell', len(snapshot['expired']),
             'fa-skull-crossbones', 'k-red', 'quarantine',
             'Expired batches to pull from the shelf'),
        _kpi('catalogue', 'Items On Shelf', len(snapshot['medicines']),
             'fa-capsules', 'k-indigo', 'catalogue',
             'Total medicines you can hand out')
    ]

    return {
        'greeting': {
            'eyebrow': 'Counter desk',
            'title': f'Counter ready, {first_name}',
            'subtitle': 'Pick, pack and hand over orders — plus the shelf alerts you need today.'
        },
        'kpis': kpis,
        'quick_actions': [
            {'label': 'Fulfilment queue', 'icon': 'fa-receipt', 'href': 'orders.html'},
            {'label': 'Stock ledger', 'icon': 'fa-right-left', 'href': 'movements.html'},
            {'label': 'Shelf catalogue', 'icon': 'fa-capsules', 'href': 'medicines.html'},
            {'label': 'Smart alerts', 'icon': 'fa-bell', 'href': 'alerts.html'}
        ],
        'alerts': [a for a in _alerts_for(snapshot['medicines'], today)
                   if a['type'] in ('low_stock', 'expiring', 'expired')],
        'orders': _queue(),
        'activity': [],
        'stock': [m.to_dict() for m in snapshot['low'][:8]],
        'medicines': [],
        'movements': [m.to_dict() for m in todays_movements],
        'charts': {
            'category': _category_chart(),
            'expiry': []
        }
    }


def _customer_summary(user, today, first_name):
    my_orders = Order.query.filter_by(user_id=user.id).order_by(
        Order.created_at.desc()).all()
    spend = round(sum(o.total_amount for o in my_orders), 2)
    cart_items = Cart.query.filter_by(user_id=user.id).all()
    cart_units = sum(c.quantity for c in cart_items)
    on_sale = [m for m in Medicine.query.filter(Medicine.quantity > 0).all()
               if m.expiry_date >= today]
    categories = sorted({m.category for m in on_sale if m.category})

    # "Popular" = medicines this customer already ordered before.
    bought = {i.medicine_id for o in my_orders for i in o.items}
    popular = [m for m in on_sale if m.id in bought]
    others = [m for m in on_sale if m.id not in bought]
    featured = (popular + others)[:8]

    kpis = [
        _kpi('my_orders', 'My Orders', len(my_orders), 'fa-receipt',
             'k-indigo', 'all time', 'Orders you have placed'),
        _kpi('spend', 'Total Spend', spend, 'fa-indian-rupee-sign', 'k-violet',
             'lifetime', 'Everything you have bought', prefix='$',
             display=f'{spend:,.2f}'),
        _kpi('cart', 'In My Cart', cart_units, 'fa-shopping-basket',
             'k-teal', 'units', 'Units waiting in your basket'),
        _kpi('available', 'Medicines Available', len(on_sale), 'fa-capsules',
             'k-teal', 'in stock', 'Ready to order right now'),
        _kpi('categories', 'Categories', len(categories), 'fa-tags',
             'k-indigo', 'therapies', 'Therapeutic areas in stock'),
        _kpi('delivered', 'Completed Orders',
             len([o for o in my_orders if o.status == 'completed']),
             'fa-circle-check', 'k-teal', 'delivered',
             'Orders already handed over')
    ]

    return {
        'greeting': {
            'eyebrow': 'My pharmacy',
            'title': f'Welcome back, {first_name}',
            'subtitle': 'Browse medicines, track your orders and keep your prescriptions in one place.'
        },
        'kpis': kpis,
        'quick_actions': [
            {'label': 'Shop medicines', 'icon': 'fa-store', 'href': 'shop.html'},
            {'label': 'My cart', 'icon': 'fa-shopping-basket', 'href': 'cart.html'},
            {'label': 'My orders', 'icon': 'fa-receipt', 'href': 'orders.html'},
            {'label': 'Give feedback', 'icon': 'fa-comment-medical', 'href': 'feedback.html'}
        ],
        'alerts': [],
        'orders': [o.to_dict() for o in my_orders[:6]],
        'activity': [],
        'stock': [],
        'medicines': [m.to_dict() for m in featured],
        'movements': [],
        'charts': {
            'category': _category_chart(),
            'expiry': []
        }
    }
