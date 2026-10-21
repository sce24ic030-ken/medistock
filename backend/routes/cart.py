from flask import Blueprint, request, jsonify, session
from models import db
from models.cart import Cart
from models.medicine import Medicine
from models.order import Order, OrderItem
from models.activity import Activity
from utils.decorators import login_required
from datetime import datetime

cart_bp = Blueprint('cart', __name__)

def log_activity(user_id, action, details=None):
    try:
        activity = Activity(user_id=user_id, action=action, details=details)
        db.session.add(activity)
        db.session.commit()
    except:
        db.session.rollback()

@cart_bp.route('/', methods=['GET'])
@login_required
def get_cart():
    try:
        user_id = session['user_id']
        cart_items = Cart.query.filter_by(user_id=user_id).all()
        
        items = []
        total = 0
        for item in cart_items:
            item_dict = item.to_dict()
            if item.medicine:
                item_dict['subtotal'] = item.medicine.price * item.quantity
                total += item_dict['subtotal']
            items.append(item_dict)
        
        return jsonify({'cart': items, 'total': round(total, 2)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/add', methods=['POST'])
@login_required
def add_to_cart():
    try:
        user_id = session['user_id']
        data = request.get_json()
        medicine_id = data.get('medicine_id')
        quantity = int(data.get('quantity', 1))
        
        if not medicine_id:
            return jsonify({'error': 'medicine_id is required'}), 400
        
        medicine = Medicine.query.get(medicine_id)
        if not medicine:
            return jsonify({'error': 'Medicine not found'}), 404
        
        if medicine.quantity < quantity:
            return jsonify({'error': f'Only {medicine.quantity} units available'}), 400
        
        existing = Cart.query.filter_by(user_id=user_id, medicine_id=medicine_id).first()
        
        if existing:
            new_qty = existing.quantity + quantity
            if medicine.quantity < new_qty:
                return jsonify({'error': f'Only {medicine.quantity} units available'}), 400
            existing.quantity = new_qty
        else:
            cart_item = Cart(user_id=user_id, medicine_id=medicine_id, quantity=quantity)
            db.session.add(cart_item)
        
        db.session.commit()
        log_activity(user_id, 'Cart Updated', f'Added {medicine.name} to cart')
        
        return jsonify({'message': 'Added to cart successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/update/<int:item_id>', methods=['PUT'])
@login_required
def update_cart(item_id):
    try:
        user_id = session['user_id']
        cart_item = Cart.query.filter_by(id=item_id, user_id=user_id).first()
        if not cart_item:
            return jsonify({'error': 'Cart item not found'}), 404
        data = request.get_json() or {}
        quantity = int(data.get('quantity', 1))
        
        if quantity <= 0:
            db.session.delete(cart_item)
            db.session.commit()
            return jsonify({'message': 'Item removed from cart'}), 200
        
        if cart_item.medicine.quantity < quantity:
            return jsonify({'error': f'Only {cart_item.medicine.quantity} units available'}), 400
        
        cart_item.quantity = quantity
        db.session.commit()
        
        return jsonify({'message': 'Cart updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/remove/<int:item_id>', methods=['DELETE'])
@login_required
def remove_from_cart(item_id):
    try:
        user_id = session['user_id']
        cart_item = Cart.query.filter_by(id=item_id, user_id=user_id).first()
        if not cart_item:
            return jsonify({'error': 'Cart item not found'}), 404
        db.session.delete(cart_item)
        db.session.commit()
        
        return jsonify({'message': 'Item removed from cart'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/checkout', methods=['POST'])
@login_required
def checkout():
    try:
        user_id = session['user_id']
        cart_items = Cart.query.filter_by(user_id=user_id).all()
        
        if not cart_items:
            return jsonify({'error': 'Cart is empty'}), 400
        
        total = 0
        for item in cart_items:
            if item.medicine.quantity < item.quantity:
                return jsonify({'error': f'Insufficient stock for {item.medicine.name}'}), 400
            total += item.medicine.price * item.quantity
        
        order = Order(user_id=user_id, total_amount=round(total, 2), status='completed')
        db.session.add(order)
        db.session.flush()
        
        for item in cart_items:
            order_item = OrderItem(
                order_id=order.id,
                medicine_id=item.medicine_id,
                quantity=item.quantity,
                price_at_purchase=item.medicine.price
            )
            db.session.add(order_item)
            item.medicine.quantity -= item.quantity
        
        for item in cart_items:
            db.session.delete(item)
        
        db.session.commit()
        
        log_activity(user_id, 'Order Placed', f'Order #{order.id} placed - Total: ${total:.2f}')
        
        return jsonify({'message': 'Order placed successfully', 'order_id': order.id, 'total': round(total, 2)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
