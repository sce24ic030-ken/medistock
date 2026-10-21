from datetime import datetime
from models import db

class Cart(db.Model):
    __tablename__ = 'cart_items'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    medicine_id = db.Column(db.Integer, db.ForeignKey('medicines.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'medicine_id': self.medicine_id,
            'medicine': self.medicine.to_dict() if self.medicine else None,
            'quantity': self.quantity,
            'added_at': self.added_at.isoformat() if self.added_at else None
        }
