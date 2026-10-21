"""Medistock demo data.

The seeding logic lives here (instead of in seed.py) so that it can be used
from two places:

  * `python seed.py`          - manual seeding of a local database
  * app.py                    - automatic seeding on start-up when the
                                AUTO_SEED environment variable is set

It is idempotent: running it twice never duplicates a row.
"""
from datetime import date, timedelta, datetime

from flask_bcrypt import Bcrypt

from models import db
from models.user import User
from models.medicine import Medicine
from models.supplier import Supplier
from models.order import Order, OrderItem
from models.movement import StockMovement
from models.activity import Activity
from models.feedback import Feedback

bcrypt = Bcrypt()

USERS = [
    {'name': 'Admin User', 'email': 'admin@smartmed.com', 'password': 'Admin@123', 'role': 'admin', 'phone': '+91 90000 00001'},
    {'name': 'John Doe', 'email': 'customer@test.com', 'password': 'Customer@123', 'role': 'customer', 'phone': '+91 90000 00002'},
    {'name': 'Nisha Sharma', 'email': 'pharmacist@smartmed.com', 'password': 'Pharmacist@123', 'role': 'pharmacist', 'phone': '+91 90000 00003'},
    {'name': 'Ravi Patel', 'email': 'ravi@smartmed.com', 'password': 'Staff@123', 'role': 'pharmacist', 'phone': '+91 90000 00004'},
    {'name': 'Aisha Khan', 'email': 'aisha@smartmed.com', 'password': 'Customer@123', 'role': 'customer', 'phone': '+91 90000 00005'}
]

SUPPLIERS = [
    {'name': 'MedPlus Distribution', 'contact_person': 'Anil Sharma', 'email': 'orders@medplus.in', 'phone': '+91 98111 11101', 'city': 'Mumbai', 'lead_time_days': 4, 'rating': 4.6},
    {'name': 'Apex Pharma Wholesale', 'contact_person': 'Sneha Iyer', 'email': 'supply@apexpharma.in', 'phone': '+91 98222 22202', 'city': 'Pune', 'lead_time_days': 7, 'rating': 4.2},
    {'name': 'CityCare Suppliers', 'contact_person': 'Imran Qureshi', 'email': 'info@citycare.in', 'phone': '+91 98333 33303', 'city': 'Delhi', 'lead_time_days': 2, 'rating': 4.8},
    {'name': 'HealthLine Logistics', 'contact_person': 'Meera Nair', 'email': 'logistics@healthline.in', 'phone': '+91 98444 44404', 'city': 'Kochi', 'lead_time_days': 10, 'rating': 3.9}
]

MEDICINES = [
    {'name': 'Paracetamol 500mg', 'generic_name': 'Acetaminophen', 'category': 'Pain Relief', 'quantity': 5, 'price': 2.50, 'expiry_date': date.today() + timedelta(days=15), 'batch_no': 'PCM-2401', 'supplier': 'MedPlus Distribution'},
    {'name': 'Amoxicillin 250mg', 'generic_name': 'Amoxicillin', 'category': 'Antibiotics', 'quantity': 3, 'price': 8.99, 'expiry_date': date.today() - timedelta(days=10), 'batch_no': 'AMX-2388', 'supplier': 'Apex Pharma Wholesale'},
    {'name': 'Cetirizine 10mg', 'generic_name': 'Cetirizine HCl', 'category': 'Antihistamine', 'quantity': 25, 'price': 3.75, 'expiry_date': date.today() + timedelta(days=180), 'batch_no': 'CET-2410', 'supplier': 'CityCare Suppliers'},
    {'name': 'Pantoprazole 40mg', 'generic_name': 'Pantoprazole', 'category': 'Gastrointestinal', 'quantity': 8, 'price': 12.50, 'expiry_date': date.today() + timedelta(days=25), 'batch_no': 'PAN-2415', 'supplier': 'MedPlus Distribution'},
    {'name': 'Ibuprofen 400mg', 'generic_name': 'Ibuprofen', 'category': 'Pain Relief', 'quantity': 50, 'price': 4.25, 'expiry_date': date.today() + timedelta(days=365), 'batch_no': 'IBU-2402', 'supplier': 'HealthLine Logistics'},
    {'name': 'Azithromycin 500mg', 'generic_name': 'Azithromycin', 'category': 'Antibiotics', 'quantity': 12, 'price': 15.99, 'expiry_date': date.today() + timedelta(days=90), 'batch_no': 'AZI-2405', 'supplier': 'Apex Pharma Wholesale'},
    {'name': 'Metformin 500mg', 'generic_name': 'Metformin HCl', 'category': 'Diabetes', 'quantity': 7, 'price': 6.50, 'expiry_date': date.today() + timedelta(days=20), 'batch_no': 'MET-2411', 'supplier': 'CityCare Suppliers'},
    {'name': 'Amlodipine 5mg', 'generic_name': 'Amlodipine Besylate', 'category': 'Cardiovascular', 'quantity': 30, 'price': 9.75, 'expiry_date': date.today() + timedelta(days=200), 'batch_no': 'AML-2408', 'supplier': 'HealthLine Logistics'},
    {'name': 'Omeprazole 20mg', 'generic_name': 'Omeprazole', 'category': 'Gastrointestinal', 'quantity': 4, 'price': 7.25, 'expiry_date': date.today() - timedelta(days=5), 'batch_no': 'OMP-2385', 'supplier': 'MedPlus Distribution'},
    {'name': 'Vitamin C 500mg', 'generic_name': 'Ascorbic Acid', 'category': 'Vitamins', 'quantity': 100, 'price': 1.99, 'expiry_date': date.today() + timedelta(days=400), 'batch_no': 'VTC-2420', 'supplier': 'CityCare Suppliers'},
    {'name': 'Azelastine Eye Drops', 'generic_name': 'Azelastine', 'category': 'Ophthalmology', 'quantity': 14, 'price': 18.40, 'expiry_date': date.today() + timedelta(days=120), 'batch_no': 'AZE-2421', 'supplier': 'HealthLine Logistics'},
    {'name': 'Salbutamol Inhaler', 'generic_name': 'Salbutamol', 'category': 'Respiratory', 'quantity': 22, 'price': 26.90, 'expiry_date': date.today() + timedelta(days=260), 'batch_no': 'SAL-2412', 'supplier': 'MedPlus Distribution'},
    {'name': 'Cough Syrup 100ml', 'generic_name': 'Dextromethorphan', 'category': 'Respiratory', 'quantity': 6, 'price': 11.60, 'expiry_date': date.today() + timedelta(days=28), 'batch_no': 'CSY-2413', 'supplier': 'Apex Pharma Wholesale'},
    {'name': 'Insulin Glargine 100U', 'generic_name': 'Insulin Glargine', 'category': 'Diabetes', 'quantity': 9, 'price': 84.00, 'expiry_date': date.today() + timedelta(days=95), 'batch_no': 'INS-2409', 'supplier': 'HealthLine Logistics'},
    {'name': 'Vitamin D3 60K', 'generic_name': 'Cholecalciferol', 'category': 'Vitamins', 'quantity': 45, 'price': 13.25, 'expiry_date': date.today() + timedelta(days=330), 'batch_no': 'VTD-2414', 'supplier': 'CityCare Suppliers'},
    {'name': 'Diclofenac Gel', 'generic_name': 'Diclofenac', 'category': 'Pain Relief', 'quantity': 2, 'price': 10.75, 'expiry_date': date.today() - timedelta(days=22), 'batch_no': 'DIC-2379', 'supplier': 'MedPlus Distribution'}
]

ORDERS = [
    {'customer': 'customer@test.com', 'status': 'completed', 'days': 12, 'items': [('Paracetamol 500mg', 6), ('Vitamin C 500mg', 10)]},
    {'customer': 'customer@test.com', 'status': 'completed', 'days': 8, 'items': [('Ibuprofen 400mg', 4), ('Cetirizine 10mg', 2)]},
    {'customer': 'aisha@smartmed.com', 'status': 'packed', 'days': 3, 'items': [('Amlodipine 5mg', 5), ('Metformin 500mg', 3)]},
    {'customer': 'aisha@smartmed.com', 'status': 'pending', 'days': 1, 'items': [('Azithromycin 500mg', 2), ('Pantoprazole 40mg', 1)]},
    {'customer': 'customer@test.com', 'status': 'completed', 'days': 21, 'items': [('Vitamin D3 60K', 3), ('Insulin Glargine 100U', 1)]},
    {'customer': 'aisha@smartmed.com', 'status': 'cancelled', 'days': 6, 'items': [('Omeprazole 20mg', 2)]}
]

MOVEMENTS = [
    ('Paracetamol 500mg', 120, 'purchase', 'PO-2041', 'Weekly replenishment from MedPlus'),
    ('Paracetamol 500mg', -6, 'sale', 'ORD-1001', 'Counter sale'),
    ('Amoxicillin 250mg', 60, 'purchase', 'PO-2039', 'Antibiotic batch intake'),
    ('Ibuprofen 400mg', -4, 'sale', 'ORD-1002', 'Counter sale'),
    ('Cough Syrup 100ml', 48, 'purchase', 'PO-2044', 'Seasonal demand restock'),
    ('Cough Syrup 100ml', -10, 'adjustment', 'ADJ-01', 'Damaged units written off'),
    ('Vitamin C 500mg', -10, 'sale', 'ORD-1001', 'Bulk order'),
    ('Insulin Glargine 100U', 30, 'purchase', 'PO-2042', 'Cold-chain consignment'),
    ('Insulin Glargine 100U', -1, 'sale', 'ORD-1005', 'Prescription sale'),
    ('Amlodipine 5mg', -5, 'sale', 'ORD-1003', 'Counter sale'),
    ('Metformin 500mg', 90, 'purchase', 'PO-2043', 'Monthly replenishment'),
    ('Metformin 500mg', -3, 'sale', 'ORD-1003', 'Counter sale')
]

FEEDBACK = [
    ('John Doe', 'customer@test.com', 5, 'Excellent dashboard - the expiry timeline and stock health meter make daily checks instant.'),
    ('Aisha Khan', 'aisha@smartmed.com', 4, 'Very easy to use - adding stock from the ledger takes seconds and the audit trail is clear.'),
    ('Ravi Patel', 'ravi@smartmed.com', 5, 'Great for ward rounds - batch numbers and supplier details are exactly what we needed.')
]

ACTIVITIES = [
    ('System Startup', 'Medistock - Smart Medicine Inventory Management System initialized'),
    ('Medicines Added', '16 sample medicines added to the catalogue'),
    ('Suppliers Onboarded', '4 pharmaceutical suppliers registered'),
    ('Stock Audit', 'Stock ledger verified against physical count')
]


def seed_all(verbose=True):
    """Insert the demo data. Must be called inside an application context.

    Returns a small summary of what was created.
    """
    log = print if verbose else (lambda *a, **k: None)

    log("Seeding Medistock database...")

    # ------------------------------------------------------------------ users
    created_users = {}
    for entry in USERS:
        user = User.query.filter_by(email=entry['email']).first()
        if not user:
            user = User(name=entry['name'],
                        email=entry['email'],
                        password_hash=bcrypt.generate_password_hash(entry['password']).decode('utf-8'),
                        role=entry['role'],
                        phone=entry['phone'])
            db.session.add(user)
            db.session.commit()
            log(f"  user created: {entry['email']} / {entry['password']} ({entry['role']})")
        created_users[entry['email']] = user

    admin = created_users['admin@smartmed.com']

    # -------------------------------------------------------------- suppliers
    suppliers = {}
    for entry in SUPPLIERS:
        supplier = Supplier.query.filter_by(name=entry['name']).first()
        if not supplier:
            supplier = Supplier(**entry)
            db.session.add(supplier)
            db.session.commit()
            log(f"  supplier created: {entry['name']}")
        suppliers[entry['name']] = supplier

    # ------------------------------------------------------------- medicines
    for entry in MEDICINES:
        payload = dict(entry)
        supplier_name = payload.pop('supplier', None)
        medicine = Medicine.query.filter_by(name=entry['name']).first()
        if not medicine:
            medicine = Medicine(**payload)
            db.session.add(medicine)
        else:
            # keep the catalogue up to date on re-seeds
            medicine.quantity = payload['quantity']
            medicine.price = payload['price']
            medicine.expiry_date = payload['expiry_date']
            medicine.batch_no = payload.get('batch_no')
        if supplier_name and supplier_name in suppliers:
            medicine.supplier_id = suppliers[supplier_name].id

    db.session.commit()
    log(f"  {len(MEDICINES)} medicines seeded!")

    # ---------------------------------------------------------------- orders
    if Order.query.count() == 0:
        for spec in ORDERS:
            total = 0.0
            order = Order(user_id=created_users[spec['customer']].id,
                          total_amount=0.0,
                          status=spec['status'],
                          created_at=datetime.utcnow() - timedelta(days=spec['days']))
            for medicine_name, quantity in spec['items']:
                medicine = Medicine.query.filter_by(name=medicine_name).first()
                if not medicine:
                    continue
                order.items.append(OrderItem(medicine_id=medicine.id,
                                             quantity=quantity,
                                             price_at_purchase=medicine.price))
                total += medicine.price * quantity
            order.total_amount = round(total, 2)
            db.session.add(order)

        db.session.commit()
        log(f"  {len(ORDERS)} orders seeded!")

    # ------------------------------------------------------------- movements
    if StockMovement.query.count() == 0:
        for index, (medicine_name, change, reason, reference, note) in enumerate(MOVEMENTS):
            medicine = Medicine.query.filter_by(name=medicine_name).first()
            if not medicine:
                continue
            db.session.add(StockMovement(
                medicine_id=medicine.id,
                change=change,
                balance_after=medicine.quantity,
                reason=reason,
                reference=reference,
                note=note,
                user_id=admin.id,
                created_at=datetime.utcnow() - timedelta(days=len(MOVEMENTS) - index)
            ))

        db.session.commit()
        log(f"  {len(MOVEMENTS)} stock movements seeded!")

    # -------------------------------------------------------------- feedback
    if Feedback.query.count() == 0:
        for name, email, rating, message in FEEDBACK:
            db.session.add(Feedback(user_id=created_users[email].id if email in created_users else None,
                                    name=name, email=email, rating=rating, comment=message))
        db.session.commit()
        log(f"  {len(FEEDBACK)} feedback entries seeded!")

    # ------------------------------------------------------------ activities
    for action, details in ACTIVITIES:
        if not Activity.query.filter_by(action=action, details=details).first():
            db.session.add(Activity(user_id=admin.id, action=action, details=details))

    db.session.commit()
    log("  activities seeded!")

    summary = {
        'users': User.query.count(),
        'suppliers': Supplier.query.count(),
        'medicines': Medicine.query.count(),
        'orders': Order.query.count(),
        'movements': StockMovement.query.count(),
        'feedback': Feedback.query.count()
    }
    log(f"Seeding completed successfully! {summary}")
    return summary
