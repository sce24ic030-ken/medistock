from datetime import datetime
from models import db

class StockMovement(db.Model):
    """Audit trail for every stock change (purchase, sale, adjustment, return)."""
    __tablename__ = 'stock_movements'

    id = db.Column(db.Integer, primary_key=True)
    # Nullable so the audit trail survives if the medicine is later deleted.
    medicine_id = db.Column(db.Integer, db.ForeignKey('medicines.id', ondelete='SET NULL'), nullable=True)
    change = db.Column(db.Integer, nullable=False)          # + inbound, - outbound
    balance_after = db.Column(db.Integer, nullable=False, default=0)
    reason = db.Column(db.String(40), default='adjustment') # purchase | sale | adjustment | return
    reference = db.Column(db.String(80))
    note = db.Column(db.Text)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    medicine = db.relationship('Medicine', backref='movements', lazy=True)
    user = db.relationship('User', backref='stock_movements', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'medicine_id': self.medicine_id,
            'medicine': self.medicine.to_dict() if self.medicine else None,
            'change': self.change,
            'balance_after': self.balance_after,
            'reason': self.reason,
            'reference': self.reference,
            'note': self.note,
            'user': self.user.to_dict() if self.user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
