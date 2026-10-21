from flask import Blueprint, request, jsonify, session
from models import db
from models.order import Order, OrderItem
from models.medicine import Medicine
from models.user import User
from models.activity import Activity
from utils.decorators import login_required, admin_required, counter_required, current_role

orders_bp = Blueprint('orders', __name__)

ORDER_STATUSES = ('pending', 'packed', 'completed', 'cancelled')

# Roles that work the counter and therefore see the full order register.
COUNTER_ROLES = ('admin', 'pharmacist', 'staff')


def _is_counter():
    """Counter staff (admin, pharmacist, staff) see every order."""
    return current_role() in COUNTER_ROLES


@orders_bp.route('/', methods=['GET'])
@login_required
def list_orders():
    try:
        query = Order.query

        if not _is_counter():
            query = query.filter_by(user_id=session.get('user_id'))

        status = (request.args.get('status') or '').strip().lower()
        search = (request.args.get('search') or '').strip()

        if status and status != 'all':
            query = query.filter_by(status=status)

        if search:
            like = f'%{search}%'
            clauses = [User.name.ilike(like), User.email.ilike(like), Order.status.ilike(like)]
            if search.isdigit():
                clauses.append(Order.id == int(search))
            query = query.join(User, Order.user_id == User.id, isouter=True).filter(db.or_(*clauses))

        orders = query.order_by(Order.created_at.desc()).all()

        # summary for the page header cards
        base = Order.query if _is_counter() else Order.query.filter_by(user_id=session.get('user_id'))
        all_orders = base.all()
        count = len(all_orders)
        revenue = sum(o.total_amount for o in all_orders)

        summary = {
            'total_orders': count,
            'total_revenue': round(revenue, 2),
            'avg_order': round(revenue / count, 2) if count else 0.0,
            'pending': len([o for o in all_orders if o.status in ('pending', 'packed')]),
            'completed': len([o for o in all_orders if o.status == 'completed']),
            'cancelled': len([o for o in all_orders if o.status == 'cancelled']),
            'units_sold': sum(i.quantity for o in all_orders for i in o.items)
        }

        return jsonify({
            'orders': [o.to_dict() for o in orders],
            'summary': summary
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/<int:order_id>', methods=['GET'])
@login_required
def get_order(order_id):
    try:
        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        if not _is_counter() and order.user_id != session.get('user_id'):
            return jsonify({'error': 'Access denied'}), 403
        return jsonify({'order': order.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/', methods=['POST'])
@counter_required
def create_order():
    """Record a walk-in / manual sale straight from the Orders tab."""
    try:
        data = request.get_json() or {}
        items = data.get('items') or []

        if not items:
            return jsonify({'error': 'Add at least one medicine to the order'}), 400

        total = 0.0
        order = Order(user_id=data.get('user_id') or session.get('user_id'),
                      total_amount=0.0,
                      status=data.get('status') or 'completed')

        for item in items:
            medicine_id = item.get('medicine_id')
            if not medicine_id:
                return jsonify({'error': 'Every order line needs a medicine_id'}), 400

            medicine = Medicine.query.get(medicine_id)
            if not medicine:
                return jsonify({'error': f"Medicine {medicine_id} not found"}), 400

            quantity = int(item.get('quantity') or 0)
            if quantity <= 0:
                return jsonify({'error': f"Invalid quantity for {medicine.name}"}), 400
            if medicine.quantity < quantity:
                return jsonify({'error': f"Only {medicine.quantity} units of {medicine.name} in stock"}), 400

            medicine.quantity -= quantity
            order.items.append(OrderItem(medicine_id=medicine.id,
                                         quantity=quantity,
                                         price_at_purchase=medicine.price))
            total += medicine.price * quantity

        order.total_amount = round(total, 2)
        db.session.add(order)
        db.session.add(Activity(user_id=session.get('user_id'),
                                action='Order Created',
                                details=f'Order #{order.id} recorded with {len(order.items)} item(s)'))
        db.session.commit()

        return jsonify({'message': 'Order created', 'order': order.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/<int:order_id>', methods=['PATCH'])
@counter_required
def update_order_status(order_id):
    try:
        data = request.get_json() or {}
        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        status = (data.get('status') or '').strip().lower()
        if status not in ORDER_STATUSES:
            return jsonify({'error': 'Invalid order status'}), 400

        order.status = status
        db.session.add(Activity(user_id=session.get('user_id'),
                                action='Order Status Updated',
                                details=f'Order #{order.id} marked as {status}'))
        db.session.commit()

        return jsonify({'message': 'Order updated', 'order': order.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
