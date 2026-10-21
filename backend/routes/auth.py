from flask import Blueprint, request, jsonify, session
from models import db
from models.user import User
from models.activity import Activity
from flask_bcrypt import Bcrypt
from datetime import datetime, timedelta
from utils.decorators import login_required
import secrets
import re

auth_bp = Blueprint('auth', __name__)
bcrypt = Bcrypt()

def log_activity(user_id, action, details=None):
    try:
        activity = Activity(user_id=user_id, action=action, details=details)
        db.session.add(activity)
        db.session.commit()
    except:
        db.session.rollback()

@auth_bp.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        
        if not all([name, email, password]):
            return jsonify({'error': 'All fields are required'}), 400
        
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 400
        
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        user = User(name=name, email=email, password_hash=password_hash, role='customer')
        db.session.add(user)
        db.session.commit()
        
        log_activity(user.id, 'User Registration', f'New user registered: {email}')
        
        return jsonify({'message': 'Registration successful', 'user': user.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not all([email, password]):
            return jsonify({'error': 'Email and password are required'}), 400
        
        user = User.query.filter_by(email=email).first()
        
        if not user or not bcrypt.check_password_hash(user.password_hash, password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        if user.is_active is False:
            return jsonify({'error': 'This account has been deactivated. Contact an administrator.'}), 403
        
        session['user_id'] = user.id
        session['email'] = user.email
        session['name'] = user.name
        session['role'] = user.role
        
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        log_activity(user.id, 'User Login', f'User logged in: {email}')
        
        return jsonify({'message': 'Login successful', 'user': user.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/admin/login', methods=['POST'])
def admin_login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not all([email, password]):
            return jsonify({'error': 'Email and password are required'}), 400
        
        user = User.query.filter_by(email=email).first()
        
        if not user or not bcrypt.check_password_hash(user.password_hash, password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        if user.role != 'admin':
            return jsonify({'error': 'Access denied. Admin credentials required.'}), 403
        
        if user.is_active is False:
            return jsonify({'error': 'This account has been deactivated.'}), 403
        
        session['user_id'] = user.id
        session['email'] = user.email
        session['name'] = user.name
        session['role'] = user.role
        
        log_activity(user.id, 'Admin Login', f'Admin logged in: {email}')
        
        return jsonify({'message': 'Admin login successful', 'user': user.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    try:
        user_id = session.get('user_id')
        if user_id:
            log_activity(user_id, 'User Logout', 'User logged out')
        session.clear()
        return jsonify({'message': 'Logout successful'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    try:
        if 'user_id' not in session:
            return jsonify({'user': None}), 200
        user = User.query.get(session['user_id'])
        if not user:
            session.clear()
            return jsonify({'user': None}), 200
        return jsonify({'user': user.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update the signed-in user's own profile details."""
    try:
        data = request.get_json() or {}
        user = User.query.get(session.get('user_id'))
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if 'name' in data and data['name']:
            user.name = str(data['name']).strip()

        if 'phone' in data:
            user.phone = (str(data['phone']).strip() or None)

        if 'email' in data and data['email']:
            email = str(data['email']).strip().lower()
            if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
                return jsonify({'error': 'Invalid email format'}), 400
            existing = User.query.filter(User.email == email, User.id != user.id).first()
            if existing:
                return jsonify({'error': 'That email is already in use'}), 400
            user.email = email

        db.session.add(Activity(user_id=user.id, action='Profile Updated', details=f'{user.email} updated their profile'))
        db.session.commit()

        session['name'] = user.name
        session['email'] = user.email

        return jsonify({'message': 'Profile updated', 'user': user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Change the signed-in user's password (current password required)."""
    try:
        data = request.get_json() or {}
        current_password = data.get('current_password')
        new_password = data.get('new_password')

        if not current_password or not new_password:
            return jsonify({'error': 'Current and new password are required'}), 400
        if len(new_password) < 6:
            return jsonify({'error': 'New password must be at least 6 characters'}), 400

        user = User.query.get(session.get('user_id'))
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if not bcrypt.check_password_hash(user.password_hash, current_password):
            return jsonify({'error': 'Current password is incorrect'}), 400

        user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
        db.session.add(Activity(user_id=user.id, action='Password Changed', details='Password updated from profile settings'))
        db.session.commit()

        return jsonify({'message': 'Password updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'message': 'If email exists, reset link has been sent'}), 200
        
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
        db.session.commit()
        
        log_activity(user.id, 'Password Reset Requested', f'Reset token generated for {email}')
        
        return jsonify({
            'message': 'If email exists, reset link has been sent',
            'reset_token': token  # For demo purposes
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        token = data.get('token')
        password = data.get('password')
        
        if not all([token, password]):
            return jsonify({'error': 'Token and password are required'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        user = User.query.filter_by(reset_token=token).first()
        
        if not user or not user.reset_token_expiry or user.reset_token_expiry < datetime.utcnow():
            return jsonify({'error': 'Invalid or expired token'}), 400
        
        user.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        user.reset_token = None
        user.reset_token_expiry = None
        db.session.commit()
        
        log_activity(user.id, 'Password Reset', 'Password successfully reset')
        
        return jsonify({'message': 'Password reset successful'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
