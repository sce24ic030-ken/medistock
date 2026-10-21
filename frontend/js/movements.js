/* Medistock - Stock Ledger tab */
let movements = [];
let currentReason = 'all';

const REASON_META = {
    purchase: { icon: 'fa-cart-plus', label: 'Purchase' },
    sale: { icon: 'fa-cart-minus', label: 'Sale' },
    adjustment: { icon: 'fa-sliders', label: 'Adjustment' },
    return: { icon: 'fa-rotate-left', label: 'Return' }
};

function renderSummary(summary) {
    summary = summary || {};

    document.getElementById('kpiMovements').textContent = App.number(summary.total_movements);
    document.getElementById('kpiUnitsIn').textContent = App.number(summary.units_in);
    document.getElementById('kpiUnitsOut').textContent = App.number(summary.units_out);
    document.getElementById('kpiNet').textContent = App.number(summary.net);

    const max = Math.max(summary.units_in || 0, summary.units_out || 0, 1);
    document.getElementById('kpiMovementsBar').style.width = '100%';
    document.getElementById('kpiUnitsInBar').style.width = ((summary.units_in || 0) / max) * 100 + '%';
    document.getElementById('kpiUnitsOutBar').style.width = ((summary.units_out || 0) / max) * 100 + '%';
    document.getElementById('kpiNetBar').style.width = Math.min(100, Math.abs(summary.net || 0) / 3) + '%';

    document.getElementById('kpiMovementsFoot').textContent = 'Recorded in the audit trail';
    document.getElementById('kpiUnitsInFoot').textContent = 'Purchases and returns received';
    document.getElementById('kpiUnitsOutFoot').textContent = 'Sales and write-offs issued';
    document.getElementById('kpiNetFoot').textContent = (summary.net || 0) >= 0
        ? 'More received than issued'
        : 'More issued than received';
}

function renderLedger() {
    const list = document.getElementById('ledgerList');

    if (!movements.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-right-left"></i>' +
            '<h3>No movements recorded</h3><p>Stock receipts, issues and adjustments will appear here.</p></div>';
        return;
    }

    list.innerHTML = movements.map(function (movement) {
        const meta = REASON_META[movement.reason] || { icon: 'fa-circle', label: movement.reason };
        const inbound = movement.change >= 0;
        const medicine = movement.medicine ? movement.medicine.name : 'Medicine #' + movement.medicine_id;

        return '<div class="ledger-row">' +
            '<span class="ledger-icon ' + (inbound ? 'ledger-in' : 'ledger-out') + '">' +
            '<i class="fas ' + meta.icon + '"></i></span>' +
            '<div class="ledger-main">' +
            '<strong>' + App.escape(medicine) + '</strong>' +
            '<small>' + meta.label +
            (movement.reference ? ' · ' + App.escape(movement.reference) : '') +
            (movement.note ? ' · ' + App.escape(movement.note) : '') +
            ' · ' + App.dateTime(movement.created_at) + '</small>' +
            '</div>' +
            '<span class="ledger-delta ' + (inbound ? 'money-pos' : 'money-neg') + '">' +
            (inbound ? '+' : '') + movement.change + '</span>' +
            '<span class="ledger-balance">Balance<br><strong>' + movement.balance_after + '</strong></span>' +
            '</div>';
    }).join('');
}

function loadMovements() {
    let url = '/api/movements/?';
    if (currentReason !== 'all') url += 'reason=' + currentReason;

    return apiCall(url, 'GET')
        .then(function (data) {
            movements = data.movements || [];
            renderSummary(data.summary);
            renderLedger();
            document.getElementById('ledgerChip').textContent = movements.length + ' entries';
        })
        .catch(function (error) {
            App.toast(error.message, 'error');
            document.getElementById('ledgerList').innerHTML =
                '<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h3>Could not load the ledger</h3>' +
                '<p>' + App.escape(error.message) + '</p></div>';
        });
}

function loadMedicines() {
    return apiCall('/api/medicines/', 'GET')
        .then(function (data) {
            const select = document.getElementById('movementMedicine');
            select.innerHTML = (data.medicines || []).map(function (med) {
                return '<option value="' + med.id + '">' + App.escape(med.name) +
                    ' (' + med.quantity + ' in stock)</option>';
            }).join('');
        });
}

function saveMovement() {
    const medicineId = document.getElementById('movementMedicine').value;
    const change = parseInt(document.getElementById('movementChange').value, 10);
    const reason = document.getElementById('movementReason').value;

    if (!medicineId || !change) {
        App.toast('Choose a medicine and enter a non-zero quantity', 'error');
        return;
    }

    apiCall('/api/movements/', 'POST', {
        medicine_id: parseInt(medicineId, 10),
        change: change,
        reason: reason,
        reference: document.getElementById('movementRef').value.trim(),
        note: document.getElementById('movementNote').value.trim()
    })
        .then(function (data) {
            App.toast(data.message || 'Movement recorded', 'success');
            bootstrap.Modal.getInstance(document.getElementById('movementModal')).hide();
            document.getElementById('movementForm').reset();
            loadMovements();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function exportLedger() {
    const rows = [['Medicine', 'Change', 'Balance after', 'Reason', 'Reference', 'Note', 'When']];
    movements.forEach(function (movement) {
        rows.push([
            movement.medicine ? movement.medicine.name : movement.medicine_id,
            movement.change,
            movement.balance_after,
            movement.reason,
            movement.reference || '',
            movement.note || '',
            App.dateTime(movement.created_at)
        ]);
    });
    App.exportCsv('medistock-stock-ledger.csv', rows);
    App.toast('Stock ledger exported', 'success');
}

document.addEventListener('DOMContentLoaded', function () {
    App.init().then(function () {
        loadMovements();
        loadMedicines();

        document.querySelectorAll('.chip-filter[data-reason]').forEach(function (chip) {
            chip.addEventListener('click', function () {
                document.querySelectorAll('.chip-filter[data-reason]').forEach(function (other) {
                    other.classList.remove('active');
                });
                chip.classList.add('active');
                currentReason = chip.getAttribute('data-reason');
                loadMovements();
            });
        });

        const recordBtn = document.getElementById('recordMovementBtn');
        if (recordBtn) {
            recordBtn.addEventListener('click', function () {
                new bootstrap.Modal(document.getElementById('movementModal')).show();
            });
        }

        document.getElementById('saveMovementBtn').addEventListener('click', saveMovement);
        document.getElementById('exportLedger').addEventListener('click', exportLedger);
    });
});
