from functools import wraps
from flask import request, jsonify, session

# The four roles the application knows about.
#   admin      - full control over inventory, users and reporting
#   pharmacist - owns the catalogue, dispensing and expiry compliance
#   staff      - runs the counter: picks, packs and hands over orders
#   customer   - shops for medicines and tracks their own orders
ADMIN = 'admin'
PHARMACIST = 'pharmacist'
STAFF = 'staff'
CUSTOMER = 'customer'

ALL_ROLES = (ADMIN, PHARMACIST, STAFF, CUSTOMER)

# Roles that work behind the counter (i.e. everybody except a customer).
COUNTER_ROLES = (ADMIN, PHARMACIST, STAFF)

ROLE_LABELS = {
    ADMIN: 'Administrator',
    PHARMACIST: 'Pharmacist',
    STAFF: 'Counter Staff',
    CUSTOMER: 'Customer'
}


def current_user():
    """Return the signed-in User row (fresh from the database).

    The role is read from the database instead of the session so that a role
    change made by an administrator takes effect on the next request instead
    of waiting for the user to sign in again.
    """
    from models.user import User

    user_id = session.get('user_id')
    if not user_id:
        return None

    user = User.query.get(user_id)
    if not user:
        return None
    if user.is_active is False:
        return None
    return user


def current_role():
    """Role of the signed-in user, or None when nobody is signed in."""
    user = current_user()
    return user.role if user else None


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        if current_role() != ADMIN:
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function


def role_required(*roles):
    """Allow the request only when the signed-in user holds one of `roles`."""
    allowed = tuple(roles)

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Authentication required'}), 401

            role = current_role()
            if role not in allowed:
                labels = ', '.join(ROLE_LABELS.get(r, r) for r in allowed)
                return jsonify({
                    'error': f'This area is restricted to: {labels}',
                    'required_roles': list(allowed)
                }), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def counter_required(f):
    """Any employee role - admin, pharmacist or counter staff."""
    return role_required(*COUNTER_ROLES)(f)
