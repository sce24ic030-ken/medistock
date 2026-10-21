/* Medistock - Suppliers tab */
let suppliers = [];

function stars(rating) {
    const value = Math.round(Number(rating || 0));
    let markup = '';
    for (let i = 1; i <= 5; i++) {
        markup += '<i class="fas ' + (i <= value ? 'fa-star' : 'fa-star-half-stroke') + '"></i>';
    }
    return '<span class="stars">' + markup + '</span> <small>' + Number(rating || 0).toFixed(1) + '</small>';
}

function renderSummary(summary) {
    summary = summary || {};
    document.getElementById('kpiSuppliers').textContent = App.number(summary.total_suppliers);
    document.getElementById('kpiActive').textContent = App.number(summary.active_suppliers);
    document.getElementById('kpiLinked').textContent = App.number(summary.linked_medicines);
    document.getElementById('kpiLead').textContent = Number(summary.avg_lead_time || 0).toFixed(1);

    document.getElementById('kpiSuppliersBar').style.width = '100%';
    document.getElementById('kpiActiveBar').style.width =
        summary.total_suppliers ? ((summary.active_suppliers / summary.total_suppliers) * 100) + '%' : '0%';
    document.getElementById('kpiLinkedBar').style.width = Math.min(100, (summary.linked_medicines || 0) * 6) + '%';
    document.getElementById('kpiLeadBar').style.width = Math.min(100, (summary.avg_lead_time || 0) * 8) + '%';

    document.getElementById('kpiSuppliersFoot').textContent = 'Registered pharmaceutical vendors';
    document.getElementById('kpiActiveFoot').textContent =
        (summary.total_suppliers - summary.active_suppliers) + ' paused or inactive';
    document.getElementById('kpiLinkedFoot').textContent = 'Catalogue items tied to a vendor';
    document.getElementById('kpiLeadFoot').textContent = 'Average delivery time in days';
}

function renderSuppliers() {
    const grid = document.getElementById('supplierGrid');

    if (!suppliers.length) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-truck-medical"></i>' +
            '<h3>No suppliers yet</h3><p>Add a pharmaceutical vendor to link medicines to their source.</p></div>';
        return;
    }

    grid.innerHTML = suppliers.map(function (supplier) {
        const admin = App.user && App.user.role === 'admin';
        const actions = admin
            ? '<button class="icon-btn" title="View medicines" onclick="viewSupplier(' + supplier.id + ')"><i class="fas fa-boxes-stacked"></i></button>' +
              '<button class="icon-btn" title="Edit" onclick="editSupplier(' + supplier.id + ')"><i class="fas fa-pen"></i></button>' +
              '<button class="icon-btn danger" title="Remove" onclick="deleteSupplier(' + supplier.id + ')"><i class="fas fa-trash"></i></button>'
            : '<button class="icon-btn" title="View medicines" onclick="viewSupplier(' + supplier.id + ')"><i class="fas fa-boxes-stacked"></i></button>';

        return '<article class="supplier-card">' +
            '<div class="supplier-head">' +
            '<div class="d-flex gap-3 align-items-center">' +
            '<span class="supplier-avatar"><i class="fas fa-building-columns"></i></span>' +
            '<div><h4 class="supplier-name">' + App.escape(supplier.name) + '</h4>' +
            '<p class="supplier-meta">' + App.escape(supplier.city || '—') + ' · ' + (supplier.lead_time_days || 0) + ' day lead time</p></div>' +
            '</div>' +
            '<div class="d-flex gap-1">' + actions + '</div>' +
            '</div>' +
            '<div class="supplier-stats">' +
            '<div class="supplier-stat"><strong>' + supplier.medicine_count + '</strong><span>Medicines</span></div>' +
            '<div class="supplier-stat"><strong>' + App.money(supplier.stock_value).replace('$', '$') + '</strong><span>Stock value</span></div>' +
            '<div class="supplier-stat"><strong>' + (supplier.is_active ? 'Yes' : 'No') + '</strong><span>Active</span></div>' +
            '</div>' +
            '<div class="supplier-contact">' +
            (supplier.contact_person ? '<span><i class="fas fa-user"></i>' + App.escape(supplier.contact_person) + '</span>' : '') +
            (supplier.email ? '<span><i class="fas fa-envelope"></i>' + App.escape(supplier.email) + '</span>' : '') +
            (supplier.phone ? '<span><i class="fas fa-phone"></i>' + App.escape(supplier.phone) + '</span>' : '') +
            '<span>' + stars(supplier.rating) + '</span>' +
            '</div>' +
            '</article>';
    }).join('');
}

function loadSuppliers() {
    return apiCall('/api/suppliers/', 'GET')
        .then(function (data) {
            suppliers = data.suppliers || [];
            renderSummary(data.summary);
            renderSuppliers();
        })
        .catch(function (error) {
            App.toast(error.message, 'error');
        });
}

function openSupplierModal(supplier) {
    document.getElementById('supplierForm').reset();
    document.getElementById('supplierId').value = supplier ? supplier.id : '';
    document.getElementById('supplierName').value = supplier ? supplier.name : '';
    document.getElementById('supplierContact').value = supplier ? (supplier.contact_person || '') : '';
    document.getElementById('supplierEmail').value = supplier ? (supplier.email || '') : '';
    document.getElementById('supplierPhone').value = supplier ? (supplier.phone || '') : '';
    document.getElementById('supplierCity').value = supplier ? (supplier.city || '') : '';
    document.getElementById('supplierLead').value = supplier ? (supplier.lead_time_days || 7) : 7;
    document.getElementById('supplierRating').value = supplier ? (supplier.rating || 4) : 4;
    document.getElementById('supplierModalTitle').textContent = supplier ? 'Edit supplier' : 'Add supplier';
    new bootstrap.Modal(document.getElementById('supplierModal')).show();
}

function editSupplier(id) {
    const supplier = suppliers.find(function (item) { return item.id === id; });
    if (supplier) openSupplierModal(supplier);
}

function saveSupplier() {
    const id = document.getElementById('supplierId').value;
    const payload = {
        name: document.getElementById('supplierName').value.trim(),
        contact_person: document.getElementById('supplierContact').value.trim(),
        email: document.getElementById('supplierEmail').value.trim(),
        phone: document.getElementById('supplierPhone').value.trim(),
        city: document.getElementById('supplierCity').value.trim(),
        lead_time_days: parseInt(document.getElementById('supplierLead').value, 10) || 0,
        rating: parseFloat(document.getElementById('supplierRating').value) || 0
    };

    if (!payload.name) {
        App.toast('Supplier name is required', 'error');
        return;
    }

    const request = id
        ? apiCall('/api/suppliers/' + id, 'PUT', payload)
        : apiCall('/api/suppliers/', 'POST', payload);

    request
        .then(function (data) {
            App.toast(data.message || 'Supplier saved', 'success');
            bootstrap.Modal.getInstance(document.getElementById('supplierModal')).hide();
            loadSuppliers();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function deleteSupplier(id) {
    const supplier = suppliers.find(function (item) { return item.id === id; });
    if (!supplier) return;
    if (!confirm('Remove supplier "' + supplier.name + '"? Linked medicines will be kept but unlinked.')) return;

    apiCall('/api/suppliers/' + id, 'DELETE')
        .then(function (data) {
            App.toast(data.message || 'Supplier removed', 'success');
            loadSuppliers();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function viewSupplier(id) {
    apiCall('/api/suppliers/' + id, 'GET')
        .then(function (data) {
            const supplier = data.supplier;
            const rows = (data.medicines || []).map(function (med) {
                return '<tr><td><span class="row-strong">' + App.escape(med.name) + '</span>' +
                    '<span class="row-sub">' + App.escape(med.generic_name || '') + '</span></td>' +
                    '<td>' + App.escape(med.batch_no || '—') + '</td>' +
                    '<td>' + med.quantity + '</td>' +
                    '<td>' + App.money(med.price) + '</td>' +
                    '<td>' + App.date(med.expiry_date) + '</td></tr>';
            }).join('');

            document.getElementById('supplierDetail').innerHTML =
                '<h5 class="mb-1">' + App.escape(supplier.name) + '</h5>' +
                '<p class="text-muted mb-3">' + App.escape(supplier.city || '') + ' · ' +
                App.escape(supplier.contact_person || 'No contact') + '</p>' +
                '<div class="table-responsive"><table class="table"><thead><tr>' +
                '<th>Medicine</th><th>Batch</th><th>Stock</th><th>Price</th><th>Expiry</th>' +
                '</tr></thead><tbody>' + (rows || '<tr><td colspan="5" class="text-center text-muted">No linked medicines</td></tr>') +
                '</tbody></table></div>';

            new bootstrap.Modal(document.getElementById('supplierDetailModal')).show();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function exportSuppliers() {
    const rows = [['Supplier', 'Contact', 'Email', 'Phone', 'City', 'Lead time', 'Rating', 'Medicines', 'Stock value']];
    suppliers.forEach(function (supplier) {
        rows.push([
            supplier.name, supplier.contact_person, supplier.email, supplier.phone, supplier.city,
            supplier.lead_time_days, supplier.rating, supplier.medicine_count, supplier.stock_value
        ]);
    });
    App.exportCsv('medistock-suppliers.csv', rows);
    App.toast('Supplier list exported', 'success');
}

document.addEventListener('DOMContentLoaded', function () {
    App.init().then(function () {
        loadSuppliers();

        const addBtn = document.getElementById('addSupplierBtn');
        if (addBtn) addBtn.addEventListener('click', function () { openSupplierModal(null); });

        document.getElementById('saveSupplierBtn').addEventListener('click', saveSupplier);
        document.getElementById('exportSuppliers').addEventListener('click', exportSuppliers);
    });
});
