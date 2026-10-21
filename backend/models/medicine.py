from datetime import datetime
from models import db

class Medicine(db.Model):
    __tablename__ = 'medicines'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    generic_name = db.Column(db.String(150))
    category = db.Column(db.String(100))
    quantity = db.Column(db.Integer, nullable=False, default=0)
    price = db.Column(db.Float, nullable=False, default=0.0)
    expiry_date = db.Column(db.Date, nullable=False)
    batch_no = db.Column(db.String(60))
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    cart_items = db.relationship('Cart', backref='medicine', lazy=True)
    order_items = db.relationship('OrderItem', backref='medicine', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'generic_name': self.generic_name,
            'category': self.category,
            'quantity': self.quantity,
            'price': self.price,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'batch_no': self.batch_no,
            'supplier_id': self.supplier_id,
            'supplier': ({'id': self.supplier.id, 'name': self.supplier.name} if self.supplier else None),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
