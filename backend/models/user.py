from datetime import datetime
from models import db

ROLE_LABELS = {
    'admin': 'Administrator',
    'pharmacist': 'Pharmacist',
    'staff': 'Counter Staff',
    'customer': 'Customer'
}


class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='customer')  # admin | pharmacist | staff | customer
    phone = db.Column(db.String(40))
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime, nullable=True)
    reset_token = db.Column(db.String(255), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    carts = db.relationship('Cart', backref='user', lazy=True, cascade='all, delete-orphan')
    orders = db.relationship('Order', backref='user', lazy=True, cascade='all, delete-orphan')
    activities = db.relationship('Activity', backref='user', lazy=True, cascade='all, delete-orphan')
    feedbacks = db.relationship('Feedback', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'role_label': ROLE_LABELS.get(self.role, (self.role or '').title()),
            'phone': self.phone,
            'is_active': self.is_active if self.is_active is not None else True,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    @property
    def is_admin(self):
        return self.role == 'admin'

    @property
    def is_counter_staff(self):
        """True for everybody who works behind the counter."""
        return self.role in ('admin', 'pharmacist', 'staff')
