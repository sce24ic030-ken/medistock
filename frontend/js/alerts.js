/* Medistock - Smart Alerts centre */
let alerts = [];
let currentType = 'all';

const TYPE_META = {
    expired: { icon: 'fa-skull-crossbones', cls: 'alert-danger' },
    expiring: { icon: 'fa-hourglass-half', cls: 'alert-warning' },
    low_stock: { icon: 'fa-arrow-trend-down', cls: 'alert-info' }
};

function summarise() {
    const counts = { expired: 0, expiring: 0, low_stock: 0 };

    alerts.forEach(function (alert) {
        if (counts[alert.type] !== undefined) counts[alert.type] += 1;
    });

    const total = alerts.length;

    document.getElementById('kpiExpired').textContent = counts.expired;
    document.getElementById('kpiExpiring').textContent = counts.expiring;
    document.getElementById('kpiLow').textContent = counts.low_stock;
    document.getElementById('kpiTotal').textContent = total;

    const max = Math.max(total, 1);
    document.getElementById('kpiExpiredBar').style.width = (counts.expired / max) * 100 + '%';
    document.getElementById('kpiExpiringBar').style.width = (counts.expiring / max) * 100 + '%';
    document.getElementById('kpiLowBar').style.width = (counts.low_stock / max) * 100 + '%';
    document.getElementById('kpiTotalBar').style.width = '100%';

    document.getElementById('kpiExpiredFoot').textContent = 'Remove from sale immediately';
    document.getElementById('kpiExpiringFoot').textContent = 'Within the next 30 days';
    document.getElementById('kpiLowFoot').textContent = 'Fewer than 10 units on hand';

    const trend = document.getElementById('kpiAlertTrend');
    trend.textContent = counts.expired ? counts.expired + ' critical' : 'clear';
    trend.className = 'kpi-trend ' + (counts.expired ? 't-bad' : 't-good');

    document.getElementById('kpiTotalFoot').textContent = total
        ? 'Needs attention right now'
        : 'Everything is in good shape';
}

function renderAlerts() {
    const list = document.getElementById('alertList');
    const search = document.getElementById('alertSearch').value.trim().toLowerCase();

    const filtered = alerts.filter(function (alert) {
        if (currentType !== 'all' && alert.type !== currentType) return false;
        if (!search) return true;
        return (alert.medicine ? alert.medicine.name : '').toLowerCase().indexOf(search) !== -1;
    });

    document.getElementById('alertChip').textContent = filtered.length + ' shown';

    if (!filtered.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-circle-check"></i>' +
            '<h3>No alerts here</h3><p>Nothing in the catalogue needs attention for this filter right now.</p></div>';
        return;
    }

    const admin = App.user && App.user.role === 'admin';

    list.innerHTML = filtered.map(function (alert) {
        const meta = TYPE_META[alert.type] || { icon: 'fa-circle-info', cls: 'alert-info' };
        const medicine = alert.medicine || {};
        const days = App.daysUntil(medicine.expiry_date);
        const supplier = medicine.supplier ? medicine.supplier.name : null;

        const details = [];
        if (medicine.expiry_date) {
            details.push('Expires ' + App.date(medicine.expiry_date) +
                (days !== null ? ' (' + (days < 0 ? Math.abs(days) + ' days ago' : 'in ' + days + ' days') + ')' : ''));
        }
        details.push(medicine.quantity + ' units in stock');
        if (medicine.batch_no) details.push('Batch ' + medicine.batch_no);
        if (supplier) details.push('Supplier: ' + supplier);

        const actions = admin
            ? '<button class="btn-ghost" style="padding:0.35rem 0.7rem;font-size:0.75rem;" ' +
              'onclick="restock(' + medicine.id + ', 25)"><i class="fas fa-plus"></i> Restock 25</button>' +
              '<a class="icon-btn" title="Edit medicine" href="medicines.html"><i class="fas fa-pen"></i></a>'
            : '<a class="icon-btn" title="View medicine" href="medicines.html"><i class="fas fa-capsules"></i></a>';

        return '<div class="alert-center-item">' +
            '<span class="alert-center-icon ' + meta.cls + '"><i class="fas ' + meta.icon + '"></i></span>' +
            '<div class="alert-center-body">' +
            '<strong>' + App.escape(medicine.name || 'Medicine') + '</strong>' +
            '<small>' + App.escape(details.join(' · ')) + '</small>' +
            '</div>' +
            '<div class="alert-center-actions">' + actions + '</div>' +
            '</div>';
    }).join('');
}

function loadAlerts() {
    return apiCall('/api/dashboard/alerts', 'GET')
        .then(function (data) {
            alerts = data.alerts || [];
            summarise();
            renderAlerts();
        })
        .catch(function (error) {
            App.toast(error.message, 'error');
            document.getElementById('alertList').innerHTML =
                '<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h3>Alerts unavailable</h3>' +
                '<p>' + App.escape(error.message) + '</p></div>';
        });
}

function restock(medicineId, amount) {
    apiCall('/api/movements/', 'POST', {
        medicine_id: medicineId,
        change: amount,
        reason: 'purchase',
        reference: 'ALERT-RESTOCK',
        note: 'Quick restock from the alert centre'
    })
        .then(function () {
            App.toast('Added ' + amount + ' units to stock', 'success');
            loadAlerts();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function exportAlerts() {
    const rows = [['Type', 'Medicine', 'Quantity', 'Batch', 'Expiry', 'Supplier']];
    alerts.forEach(function (alert) {
        const medicine = alert.medicine || {};
        rows.push([
            alert.type,
            medicine.name || '',
            medicine.quantity || 0,
            medicine.batch_no || '',
            medicine.expiry_date || '',
            medicine.supplier ? medicine.supplier.name : ''
        ]);
    });
    App.exportCsv('medistock-alerts.csv', rows);
    App.toast('Alert report exported', 'success');
}

document.addEventListener('DOMContentLoaded', function () {
    App.init().then(function () {
        loadAlerts();

        document.getElementById('alertSearch').addEventListener('input', renderAlerts);

        document.querySelectorAll('.chip-filter[data-type]').forEach(function (chip) {
            chip.addEventListener('click', function () {
                document.querySelectorAll('.chip-filter[data-type]').forEach(function (other) {
                    other.classList.remove('active');
                });
                chip.classList.add('active');
                currentType = chip.getAttribute('data-type');
                renderAlerts();
            });
        });

        document.getElementById('exportAlerts').addEventListener('click', exportAlerts);
    });
});
