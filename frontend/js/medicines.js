/* Medistock - Catalogue tab.

   The catalogue is the working surface of the pharmacy team:
     - admins manage the full catalogue (add, edit, remove)
     - pharmacists maintain the catalogue and can also sell over the counter
     - counter staff have a read-only view and use it to sell at the counter
*/
let allMedicines = [];
let currentUser = null;

const CATALOGUE_EDITORS = ['admin', 'pharmacist'];

async function init() {
    const user = await App.init({ roles: ['admin', 'pharmacist', 'staff'] });
    if (!user) return;

    currentUser = user;

    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.style.display = CATALOGUE_EDITORS.indexOf(user.role) !== -1 ? '' : 'none';
    }

    await loadMedicines();
    loadCategories();
    App.loadCartCount();
}

async function loadMedicines(search = '', category = '') {
    try {
        let url = '/api/medicines/?';
        if (search) url += `search=${encodeURIComponent(search)}&`;
        if (category) url += `category=${encodeURIComponent(category)}`;

        const data = await apiCall(url, 'GET');
        allMedicines = data.medicines;
        displayMedicines(allMedicines);
    } catch (error) {
        App.toast(error.message, 'error');
    }
}

function displayMedicines(medicines) {
    const tbody = document.getElementById('medicinesTable');
    tbody.innerHTML = '';

    if (medicines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">' +
            '<i class="fas fa-inbox fa-2x d-block mb-2"></i>No medicines found</td></tr>';
        return;
    }

    const role = currentUser ? currentUser.role : '';
    const canEdit = CATALOGUE_EDITORS.indexOf(role) !== -1;
    const isAdmin = role === 'admin';

    medicines.forEach(med => {
        let badgeClass = 'badge-success';
        if (med.alert === 'expired') badgeClass = 'badge-danger';
        else if (med.alert === 'warning' || med.alert === 'low_stock') badgeClass = 'badge-warning';

        let actions = '';
        if (isAdmin) {
            actions =
                '<button class="btn btn-sm btn-info" title="Edit" onclick="editMedicine(' + med.id + ')"><i class="fas fa-edit"></i></button> ' +
                '<button class="btn btn-sm btn-danger" title="Delete" onclick="deleteMedicine(' + med.id + ', \'' +
                App.escape(med.name).replace(/'/g, "\\'") + '\')"><i class="fas fa-trash"></i></button>';
        } else if (canEdit) {
            actions =
                '<button class="btn btn-sm btn-info" title="Edit" onclick="editMedicine(' + med.id + ')"><i class="fas fa-edit"></i></button> ' +
                '<button class="btn btn-sm btn-success" title="Sell over the counter" onclick="addToCart(' + med.id + ')">' +
                '<i class="fas fa-cart-plus"></i></button>';
        } else {
            actions = '<button class="btn btn-sm btn-success" title="Sell over the counter" onclick="addToCart(' + med.id + ')">' +
                '<i class="fas fa-cart-plus"></i> Sell</button>';
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>${App.escape(med.name)}</strong><br><small class="text-muted">${App.escape(med.generic_name || '')}</small></td>
                <td>${App.escape(med.category || '-')}</td>
                <td>${med.quantity}</td>
                <td>${App.money(med.price)}</td>
                <td>${App.escape(med.expiry_date || '-')}</td>
                <td><span class="badge ${badgeClass}">${App.escape(med.alert_text || '')}</span></td>
                <td>${actions}</td>
            </tr>
        `;
    });
}

async function loadCategories() {
    try {
        const data = await apiCall('/api/medicines/categories', 'GET');
        const select = document.getElementById('categoryFilter');
        select.innerHTML = '<option value="">All categories</option>';
        (data.categories || []).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
    }
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    const category = document.getElementById('categoryFilter').value;
    loadMedicines(e.target.value, category);
});

document.getElementById('categoryFilter').addEventListener('change', (e) => {
    const search = document.getElementById('searchInput').value;
    loadMedicines(search, e.target.value);
});

async function addMedicine() {
    try {
        const data = {
            name: document.getElementById('medName').value,
            generic_name: document.getElementById('medGeneric').value,
            category: document.getElementById('medCategory').value,
            quantity: document.getElementById('medQuantity').value,
            price: document.getElementById('medPrice').value,
            expiry_date: document.getElementById('medExpiry').value
        };

        await apiCall('/api/medicines/', 'POST', data);
        App.toast('Medicine added to the catalogue', 'success');
        bootstrap.Modal.getInstance(document.getElementById('addMedicineModal')).hide();
        document.getElementById('addMedicineForm').reset();
        loadMedicines();
    } catch (error) {
        App.toast(error.message, 'error');
    }
}

function editMedicine(id) {
    const med = allMedicines.find(m => m.id === id);
    if (!med) return;

    document.getElementById('editMedId').value = med.id;
    document.getElementById('editMedName').value = med.name;
    document.getElementById('editMedGeneric').value = med.generic_name || '';
    document.getElementById('editMedCategory').value = med.category || '';
    document.getElementById('editMedQuantity').value = med.quantity;
    document.getElementById('editMedPrice').value = med.price;
    document.getElementById('editMedExpiry').value = med.expiry_date;
    new bootstrap.Modal(document.getElementById('editMedicineModal')).show();
}

async function updateMedicine() {
    try {
        const id = document.getElementById('editMedId').value;
        const data = {
            name: document.getElementById('editMedName').value,
            generic_name: document.getElementById('editMedGeneric').value,
            category: document.getElementById('editMedCategory').value,
            quantity: document.getElementById('editMedQuantity').value,
            price: document.getElementById('editMedPrice').value,
            expiry_date: document.getElementById('editMedExpiry').value
        };

        await apiCall(`/api/medicines/${id}`, 'PUT', data);
        App.toast('Catalogue updated', 'success');
        bootstrap.Modal.getInstance(document.getElementById('editMedicineModal')).hide();
        loadMedicines();
    } catch (error) {
        App.toast(error.message, 'error');
    }
}

async function deleteMedicine(id, name) {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
        await apiCall(`/api/medicines/${id}`, 'DELETE');
        App.toast('Medicine deleted', 'success');
        loadMedicines();
    } catch (error) {
        App.toast(error.message, 'error');
    }
}

async function addToCart(medicineId) {
    try {
        await apiCall('/api/cart/add', 'POST', { medicine_id: medicineId, quantity: 1 });
        App.toast('Added to the cart', 'success');
        App.loadCartCount();
    } catch (error) {
        App.toast(error.message, 'error');
    }
}

init();
