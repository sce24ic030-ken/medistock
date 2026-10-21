from flask import Blueprint, request, jsonify, session
from models import db
from models.supplier import Supplier
from models.medicine import Medicine
from models.activity import Activity
from utils.decorators import login_required, admin_required, counter_required

suppliers_bp = Blueprint('suppliers', __name__)


@suppliers_bp.route('/', methods=['GET'])
@counter_required
def list_suppliers():
    try:
        suppliers = Supplier.query.order_by(Supplier.name.asc()).all()

        data = []
        for supplier in suppliers:
            meds = [m for m in supplier.medicines]
            stock_value = sum(m.quantity * m.price for m in meds)
            low_stock = len([m for m in meds if m.quantity < 10])
            data.append(supplier.to_dict(medicine_count=len(meds), stock_value=stock_value))

        summary = {
            'total_suppliers': len(suppliers),
            'active_suppliers': len([s for s in suppliers if s.is_active]),
            'linked_medicines': Medicine.query.filter(Medicine.supplier_id.isnot(None)).count(),
            'avg_lead_time': round(sum(s.lead_time_days or 0 for s in suppliers) / len(suppliers), 1) if suppliers else 0.0
        }

        return jsonify({'suppliers': data, 'summary': summary}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@suppliers_bp.route('/<int:supplier_id>', methods=['GET'])
@counter_required
def get_supplier(supplier_id):
    try:
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            return jsonify({'error': 'Supplier not found'}), 404
        meds = supplier.medicines
        return jsonify({
            'supplier': supplier.to_dict(medicine_count=len(meds),
                                         stock_value=sum(m.quantity * m.price for m in meds)),
            'medicines': [m.to_dict() for m in meds]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _payload(data):
    name = (data.get('name') or '').strip()
    if not name:
        return None, 'Supplier name is required'
    return {
        'name': name,
        'contact_person': (data.get('contact_person') or '').strip() or None,
        'email': (data.get('email') or '').strip() or None,
        'phone': (data.get('phone') or '').strip() or None,
        'city': (data.get('city') or '').strip() or None,
        'lead_time_days': int(data.get('lead_time_days') or 7),
        'rating': float(data.get('rating') or 0.0),
        'is_active': bool(data.get('is_active', True))
    }, None


@suppliers_bp.route('/', methods=['POST'])
@admin_required
def create_supplier():
    try:
        data = request.get_json() or {}
        values, error = _payload(data)
        if error:
            return jsonify({'error': error}), 400

        supplier = Supplier(**values)
        db.session.add(supplier)
        db.session.add(Activity(user_id=session.get('user_id'),
                                action='Supplier Added',
                                details=f'Supplier "{supplier.name}" added'))
        db.session.commit()

        return jsonify({'message': 'Supplier added', 'supplier': supplier.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@suppliers_bp.route('/<int:supplier_id>', methods=['PUT'])
@admin_required
def update_supplier(supplier_id):
    try:
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            return jsonify({'error': 'Supplier not found'}), 404

        data = request.get_json() or {}
        values, error = _payload(data)
        if error:
            return jsonify({'error': error}), 400

        for key, value in values.items():
            setattr(supplier, key, value)

        db.session.add(Activity(user_id=session.get('user_id'),
                                action='Supplier Updated',
                                details=f'Supplier "{supplier.name}" updated'))
        db.session.commit()

        return jsonify({'message': 'Supplier updated', 'supplier': supplier.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@suppliers_bp.route('/<int:supplier_id>', methods=['DELETE'])
@admin_required
def delete_supplier(supplier_id):
    try:
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            return jsonify({'error': 'Supplier not found'}), 404

        linked = len(supplier.medicines)
        if linked:
            # keep the catalogue intact - unlink the medicines instead of deleting
            for medicine in supplier.medicines:
                medicine.supplier_id = None

        db.session.delete(supplier)
        db.session.add(Activity(user_id=session.get('user_id'),
                                action='Supplier Removed',
                                details=f'Supplier removed, {linked} medicine(s) unlinked'))
        db.session.commit()

        return jsonify({'message': 'Supplier removed', 'unlinked_medicines': linked}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
