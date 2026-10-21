"""Seed the Medistock demo database.

Idempotent: running it twice will not duplicate rows.
    python seed.py

The data itself lives in seed_data.py so that the application can also seed
itself on start-up (see the AUTO_SEED environment variable).
"""
from app import app
from seed_data import seed_all

with app.app_context():
    seed_all()

    print("\nAdmin:       admin@smartmed.com / Admin@123")
    print("Pharmacist:  pharmacist@smartmed.com / Pharmacist@123")
    print("Customer:    customer@test.com / Customer@123")
