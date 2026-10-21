from datetime import date, timedelta

def get_alert_status(expiry_date, quantity):
    today = date.today()
    days_to_expire = (expiry_date - today).days
    
    if expiry_date < today:
        return 'expired', 'Expired'
    elif days_to_expire <= 30:
        return 'warning', f'Expiring in {days_to_expire} days'
    elif quantity < 10:
        return 'low_stock', f'Low Stock ({quantity} left)'
    else:
        return 'normal', 'OK'

def get_alerts_summary(medicines):
    today = date.today()
    expired = []
    expiring_soon = []
    low_stock = []
    
    for med in medicines:
        if med.expiry_date < today:
            expired.append(med)
        elif (med.expiry_date - today).days <= 30:
            expiring_soon.append(med)
        if med.quantity < 10:
            low_stock.append(med)
    
    return {
        'expired': expired,
        'expiring_soon': expiring_soon,
        'low_stock': low_stock,
        'expired_count': len(expired),
        'expiring_soon_count': len(expiring_soon),
        'low_stock_count': len(low_stock)
    }
