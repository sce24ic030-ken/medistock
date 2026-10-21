from datetime import datetime
from models import db

class Supplier(db.Model):
    __tablename__ = 'suppliers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    contact_person = db.Column(db.String(100))
    email = db.Column(db.String(120))
    phone = db.Column(db.String(40))
    city = db.Column(db.String(100))
    lead_time_days = db.Column(db.Integer, default=7)
    rating = db.Column(db.Float, default=0.0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    medicines = db.relationship('Medicine', backref='supplier', lazy=True)

    def to_dict(self, medicine_count=None, stock_value=None):
        return {
            'id': self.id,
            'name': self.name,
            'contact_person': self.contact_person,
            'email': self.email,
            'phone': self.phone,
            'city': self.city,
            'lead_time_days': self.lead_time_days,
            'rating': self.rating,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'medicine_count': medicine_count if medicine_count is not None else len(self.medicines),
            'stock_value': round(stock_value, 2) if stock_value is not None else 0.0
        }
