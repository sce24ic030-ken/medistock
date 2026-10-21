import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'smart-medicine-secret-key-2024'
    
    DB_HOST = os.environ.get('DB_HOST')
    DB_PORT = os.environ.get('DB_PORT')
    DB_USER = os.environ.get('DB_USER')
    DB_PASSWORD = os.environ.get('DB_PASSWORD')
    DB_NAME = os.environ.get('DB_NAME')

    # MySQL (Aiven) is used whenever its credentials are present in backend/.env.
    # Without them the app falls back to a local SQLite file so the project can be
    # run and demonstrated offline with no configuration.
    if DB_HOST and DB_USER and DB_PASSWORD and DB_NAME:
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
        )
        SQLALCHEMY_ENGINE_OPTIONS = {
            'pool_recycle': 280,
            'pool_pre_ping': True,
            'connect_args': {
                'ssl': {'ssl_mode': 'REQUIRED'}
            }
        }
    else:
        DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'smart_medicine.db')
        SQLALCHEMY_DATABASE_URI = os.environ.get('SQLITE_URI') or f"sqlite:///{DB_FILE}"
        SQLALCHEMY_ENGINE_OPTIONS = {}

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-key-2024'
    
    FRONTEND_URL = os.environ.get('FRONTEND_URL') or 'http://127.0.0.1:5500'

    # Extra origins allowed to call the API (comma separated).
    EXTRA_ORIGINS = [o.strip() for o in (os.environ.get('EXTRA_ORIGINS') or '').split(',') if o.strip()]
    
    # Email settings
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'smtp.gmail.com'
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')
