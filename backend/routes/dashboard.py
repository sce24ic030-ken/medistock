from flask import Blueprint, request, jsonify, session
from models import db
from models.medicine import Medicine
from models.user import User
from models.order import Order
from models.activity import Activity
from utils.decorators import login_required, admin_required
from datetime import date, timedelta
from sqlalchemy import func

dashboard_bp = Blueprint('dashboard', __name__)

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
        expiry_timeline = []
        for i in range(6):
            start = today + timedelta(days=i*15)
            end = today + timedelta(days=(i+1)*15)
            count = Medicine.query.filter(Medicine.expiry_date >= start, Medicine.expiry_date < end).count()
            expiry_timeline.append({'label': f'{start.strftime("%d %b")}', 'count': count})
        
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
        
        return jsonify({'alerts': alerts}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
