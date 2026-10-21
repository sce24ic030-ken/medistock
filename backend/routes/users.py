from flask import Blueprint, request, jsonify, session
from models import db
from models.user import User
from models.order import Order
from models.cart import Cart
from models.activity import Activity
from flask_bcrypt import Bcrypt
from utils.decorators import login_required, admin_required
import re

users_bp = Blueprint('users', __name__)
bcrypt = Bcrypt()

ROLES = ('admin', 'pharmacist', 'customer')


@users_bp.route('/', methods=['GET'])
@admin_required
def list_users():
    try:
        users = User.query.order_by(User.created_at.asc()).all()

        data = []
        for user in users:
            item = user.to_dict()
            item['order_count'] = Order.query.filter_by(user_id=user.id).count()
            item['cart_count'] = Cart.query.filter_by(user_id=user.id).count()
            item['spend'] = round(sum(o.total_amount for o in Order.query.filter_by(user_id=user.id).all()), 2)
            data.append(item)

        summary = {
            'total_users': len(users),
            'admins': len([u for u in users if u.role == 'admin']),
            'pharmacists': len([u for u in users if u.role == 'pharmacist']),
            'customers': len([u for u in users if u.role == 'customer']),
            'inactive': len([u for u in users if not u.is_active])
        }

        return jsonify({'users': data, 'summary': summary}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@users_bp.route('/', methods=['POST'])
@admin_required
def create_user():
    try:
        data = request.get_json() or {}

        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        role = (data.get('role') or 'customer').strip().lower()

        if not all([name, email, password]):
            return jsonify({'error': 'Name, email and password are required'}), 400
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            return jsonify({'error': 'Invalid email format'}), 400
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        if role not in ROLES:
            return jsonify({'error': 'Invalid role'}), 400
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 400

        user = User(name=name,
                    email=email,
                    password_hash=bcrypt.generate_password_hash(password).decode('utf-8'),
                    role=role,
                    phone=(data.get('phone') or '').strip() or None)
        db.session.add(user)
        db.session.add(Activity(user_id=session.get('user_id'),
                                action='Staff Account Created',
                                details=f'{name} ({email}) added as {role}'))
        db.session.commit()

        return jsonify({'message': 'User created', 'user': user.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@users_bp.route('/<int:user_id>', methods=['PATCH'])
@admin_required
def update_user(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}

        if 'name' in data and data['name']:
            user.name = data['name'].strip()
        if 'phone' in data:
            user.phone = (data['phone'] or '').strip() or None
        if 'role' in data and data['role']:
            role = data['role'].strip().lower()
            if role not in ROLES:
                return jsonify({'error': 'Invalid role'}), 400
            if user.id == session.get('user_id') and role != 'admin':
                return jsonify({'error': 'You cannot remove your own admin access'}), 400
            user.role = role
        if 'is_active' in data:
            if user.id == session.get('user_id') and not data['is_active']:
                return jsonify({'error': 'You cannot deactivate your own account'}), 400
            user.is_active = bool(data['is_active'])

        db.session.add(Activity(user_id=session.get('user_id'),
                                action='Account Updated',
                                details=f'{user.email} updated'))
        db.session.commit()

        return jsonify({'message': 'User updated', 'user': user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
