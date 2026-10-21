from flask import Blueprint, request, jsonify, session
from models import db
from models.movement import StockMovement
from models.medicine import Medicine
from models.activity import Activity
from utils.decorators import login_required, admin_required
from sqlalchemy import func

movements_bp = Blueprint('movements', __name__)

REASONS = ('purchase', 'sale', 'adjustment', 'return', 'expiry')


@movements_bp.route('/', methods=['GET'])
@login_required
def list_movements():
    try:
        query = StockMovement.query

        medicine_id = request.args.get('medicine_id')
        reason = (request.args.get('reason') or '').strip().lower()

        if medicine_id:
            query = query.filter_by(medicine_id=int(medicine_id))
        if reason and reason != 'all':
            query = query.filter(func.lower(StockMovement.reason) == reason)

        limit = min(int(request.args.get('limit') or 100), 500)
        movements = query.order_by(StockMovement.created_at.desc()).limit(limit).all()

        total_in = sum(m.change for m in movements if m.change > 0)
        total_out = abs(sum(m.change for m in movements if m.change < 0))

        return jsonify({
            'movements': [m.to_dict() for m in movements],
            'summary': {
                'total_movements': len(movements),
                'units_in': total_in,
                'units_out': total_out,
                'net': total_in - total_out
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@movements_bp.route('/', methods=['POST'])
@admin_required
def create_movement():
    """Record a stock movement (purchase, sale, adjustment, return)."""
    try:
        data = request.get_json() or {}

        medicine_id = data.get('medicine_id')
        if not medicine_id:
            return jsonify({'error': 'medicine_id is required'}), 400

        medicine = Medicine.query.get(medicine_id)
        if not medicine:
            return jsonify({'error': 'Medicine not found'}), 404

        try:
            change = int(data.get('change'))
        except (TypeError, ValueError):
            return jsonify({'error': 'Change amount must be a number'}), 400

        if change == 0:
            return jsonify({'error': 'Change amount cannot be zero'}), 400

        reason = (data.get('reason') or 'adjustment').strip().lower()
        if reason not in REASONS:
            return jsonify({'error': 'Invalid movement reason'}), 400

        if medicine.quantity + change < 0:
            return jsonify({'error': f'Cannot remove {abs(change)} units - only {medicine.quantity} in stock'}), 400

        medicine.quantity += change

        movement = StockMovement(
            medicine_id=medicine.id,
            change=change,
            balance_after=medicine.quantity,
            reason=reason,
            reference=(data.get('reference') or '').strip() or None,
            note=(data.get('note') or '').strip() or None,
            user_id=session.get('user_id')
        )
        db.session.add(movement)
        db.session.add(Activity(user_id=session.get('user_id'),
                                action=f'Stock {reason.title()}',
                                details=f'{medicine.name}: {change:+d} units (balance {medicine.quantity})'))
        db.session.commit()

        return jsonify({'message': 'Stock movement recorded', 'movement': movement.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
