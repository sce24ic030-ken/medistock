from flask import Blueprint, request, jsonify, session
from models import db
from models.medicine import Medicine
from models.cart import Cart
from models.activity import Activity
from utils.decorators import login_required, admin_required
from datetime import datetime, date

medicines_bp = Blueprint('medicines', __name__)

def log_activity(user_id, action, details=None):
    try:
        activity = Activity(user_id=user_id, action=action, details=details)
        db.session.add(activity)
        db.session.commit()
    except:
        db.session.rollback()

@medicines_bp.route('/', methods=['GET'])
def get_all_medicines():
    try:
        search = request.args.get('search', '')
        category = request.args.get('category', '')
        
        query = Medicine.query
        
        if search:
            query = query.filter(Medicine.name.ilike(f'%{search}%') | Medicine.generic_name.ilike(f'%{search}%'))
        if category:
            query = query.filter_by(category=category)
        
        medicines = query.order_by(Medicine.name).all()
        
        result = []
        today = date.today()
        for med in medicines:
            med_dict = med.to_dict()
            days_to_expire = (med.expiry_date - today).days
            if med.expiry_date < today:
                med_dict['alert'] = 'expired'
                med_dict['alert_text'] = 'Expired'
            elif days_to_expire <= 30:
                med_dict['alert'] = 'warning'
                med_dict['alert_text'] = f'Expiring in {days_to_expire} days'
            elif med.quantity < 10:
                med_dict['alert'] = 'low_stock'
                med_dict['alert_text'] = f'Low Stock ({med.quantity} left)'
            else:
                med_dict['alert'] = 'normal'
                med_dict['alert_text'] = 'OK'
            result.append(med_dict)
        
        return jsonify({'medicines': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@medicines_bp.route('/<int:med_id>', methods=['GET'])
def get_medicine(med_id):
    try:
        med = Medicine.query.get(med_id)
        if not med:
            return jsonify({'error': 'Medicine not found'}), 404
        return jsonify({'medicine': med.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@medicines_bp.route('/', methods=['POST'])
@admin_required
def add_medicine():
    try:
        data = request.get_json() or {}
        name = data.get('name')
        generic_name = data.get('generic_name', '')
        category = data.get('category', '')
        quantity = int(data.get('quantity', 0))
        price = float(data.get('price', 0))
        expiry_date_str = data.get('expiry_date')
        
        if not all([name, expiry_date_str]):
            return jsonify({'error': 'Name and expiry date are required'}), 400
        
        expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d').date()
        
        medicine = Medicine(
            name=name,
            generic_name=generic_name,
            category=category,
            quantity=quantity,
            price=price,
            expiry_date=expiry_date,
            batch_no=(data.get('batch_no') or '').strip() or None,
            supplier_id=data.get('supplier_id') or None
        )
        db.session.add(medicine)
        db.session.commit()
        
        log_activity(session.get('user_id'), 'Medicine Added', f'Added medicine: {name}')
        
        return jsonify({'message': 'Medicine added successfully', 'medicine': medicine.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@medicines_bp.route('/<int:med_id>', methods=['PUT'])
@admin_required
def update_medicine(med_id):
    try:
        medicine = Medicine.query.get(med_id)
        if not medicine:
            return jsonify({'error': 'Medicine not found'}), 404
        data = request.get_json() or {}
        
        if 'name' in data:
            medicine.name = data['name']
        if 'generic_name' in data:
            medicine.generic_name = data['generic_name']
        if 'category' in data:
            medicine.category = data['category']
        if 'quantity' in data:
            medicine.quantity = int(data['quantity'])
        if 'price' in data:
            medicine.price = float(data['price'])
        if 'expiry_date' in data:
            medicine.expiry_date = datetime.strptime(data['expiry_date'], '%Y-%m-%d').date()
        if 'batch_no' in data:
            medicine.batch_no = (data['batch_no'] or '').strip() or None
        if 'supplier_id' in data:
            medicine.supplier_id = data['supplier_id'] or None
        
        medicine.updated_at = datetime.utcnow()
        db.session.commit()
        
        log_activity(session.get('user_id'), 'Medicine Updated', f'Updated medicine: {medicine.name}')
        
        return jsonify({'message': 'Medicine updated successfully', 'medicine': medicine.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@medicines_bp.route('/<int:med_id>', methods=['DELETE'])
@admin_required
def delete_medicine(med_id):
    try:
        medicine = Medicine.query.get(med_id)
        if not medicine:
            return jsonify({'error': 'Medicine not found'}), 404
        name = medicine.name

        # Cart lines are transient, so they go with the medicine. Ledger rows and
        # order lines stay behind (their medicine_id is set to NULL) so the
        # history of the stock is never lost.
        Cart.query.filter_by(medicine_id=med_id).delete()

        db.session.delete(medicine)
        db.session.commit()

        log_activity(session.get('user_id'), 'Medicine Deleted', f'Deleted medicine: {name}')

        return jsonify({'message': 'Medicine deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@medicines_bp.route('/categories', methods=['GET'])
def get_categories():
    try:
        categories = db.session.query(Medicine.category).distinct().filter(Medicine.category != '').all()
        return jsonify({'categories': [c[0] for c in categories]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
