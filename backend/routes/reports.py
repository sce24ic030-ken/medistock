from flask import Blueprint, request, jsonify, session
from models import db
from models.medicine import Medicine
from models.activity import Activity
from models.order import Order
from utils.decorators import login_required, admin_required, role_required, ADMIN, PHARMACIST
from datetime import date
import csv
import io

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/stock', methods=['GET'])
@role_required(ADMIN, PHARMACIST)
def stock_report():
    try:
        medicines = Medicine.query.order_by(Medicine.name).all()
        today = date.today()
        
        report = []
        for m in medicines:
            days_to_expire = (m.expiry_date - today).days
            if m.expiry_date < today:
                status = 'Expired'
            elif days_to_expire <= 30:
                status = 'Expiring Soon'
            elif m.quantity < 10:
                status = 'Low Stock'
            else:
                status = 'Good'
            
            report.append({
                'id': m.id,
                'name': m.name,
                'generic_name': m.generic_name,
                'category': m.category,
                'quantity': m.quantity,
                'price': m.price,
                'total_value': round(m.quantity * m.price, 2),
                'expiry_date': m.expiry_date.isoformat(),
                'days_to_expire': days_to_expire,
                'status': status
            })
        
        return jsonify({'report': report}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/activity', methods=['GET'])
@role_required(ADMIN, PHARMACIST)
def activity_report():
    try:
        activities = Activity.query.order_by(Activity.created_at.desc()).limit(100).all()
        return jsonify({'activities': [a.to_dict() for a in activities]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/low-stock', methods=['GET'])
@role_required(ADMIN, PHARMACIST)
def low_stock_report():
    try:
        medicines = Medicine.query.filter(Medicine.quantity < 10).order_by(Medicine.quantity).all()
        return jsonify({'medicines': [m.to_dict() for m in medicines]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/expiring', methods=['GET'])
@role_required(ADMIN, PHARMACIST)
def expiring_report():
    try:
        today = date.today()
        from datetime import timedelta
        limit_date = today + timedelta(days=30)
        medicines = Medicine.query.filter(Medicine.expiry_date >= today, Medicine.expiry_date <= limit_date).order_by(Medicine.expiry_date).all()
        result = []
        for m in medicines:
            med_dict = m.to_dict()
            med_dict['days_to_expire'] = (m.expiry_date - today).days
            result.append(med_dict)
        return jsonify({'medicines': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/expired', methods=['GET'])
@role_required(ADMIN, PHARMACIST)
def expired_report():
    try:
        today = date.today()
        medicines = Medicine.query.filter(Medicine.expiry_date < today).order_by(Medicine.expiry_date).all()
        result = []
        for m in medicines:
            med_dict = m.to_dict()
            med_dict['days_expired'] = (today - m.expiry_date).days
            result.append(med_dict)
        return jsonify({'medicines': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
