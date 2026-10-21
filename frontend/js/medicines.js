let allMedicines = [];
let currentUser = null;

async function init() {
    try {
        const user = await apiCall('/api/auth/me', 'GET');
        if (!user.user) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = user.user;
        document.getElementById('userName').textContent = user.user.name;
        if (user.user.role === 'admin') {
            document.getElementById('addBtn').style.display = 'block';
        } else {
            document.getElementById('addBtn').style.display = 'none';
        }
        
        await loadMedicines();
        loadCategories();
        loadCartCount();
    } catch (error) {
        window.location.href = 'index.html';
    }
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
        alert('Error loading medicines');
    }
}

function displayMedicines(medicines) {
    const tbody = document.getElementById('medicinesTable');
    tbody.innerHTML = '';
    
    if (medicines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No medicines found</td></tr>';
        return;
    }
    
    medicines.forEach(med => {
        let badgeClass = 'badge-success';
        if (med.alert === 'expired') badgeClass = 'badge-danger';
        else if (med.alert === 'warning' || med.alert === 'low_stock') badgeClass = 'badge-warning';
        
        let actions = '';
        if (currentUser && currentUser.role === 'admin') {
            actions = `
                <button class="btn btn-sm btn-info" onclick="editMedicine(${med.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteMedicine(${med.id}, '${med.name}')"><i class="fas fa-trash"></i></button>
            `;
        } else {
            actions = `<button class="btn btn-sm btn-success" onclick="addToCart(${med.id})"><i class="fas fa-cart-plus"></i> Add</button>`;
        }
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${med.name}</strong><br><small class="text-muted">${med.generic_name || ''}</small></td>
                <td>${med.category || '-'}</td>
                <td>${med.quantity}</td>
                <td>$${med.price.toFixed(2)}</td>
                <td>${med.expiry_date}</td>
                <td><span class="badge ${badgeClass}">${med.alert_text}</span></td>
                <td>${actions}</td>
            </tr>
        `;
    });
}

async function loadCategories() {
    try {
        const data = await apiCall('/api/medicines/categories', 'GET');
        const select = document.getElementById('categoryFilter');
        data.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat}">${cat}</option>`;
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
        alert('Medicine added successfully!');
        bootstrap.Modal.getInstance(document.getElementById('addMedicineModal')).hide();
        document.getElementById('addMedicineForm').reset();
        loadMedicines();
    } catch (error) {
        alert(error.message);
    }
}

function editMedicine(id) {
    const med = allMedicines.find(m => m.id === id);
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
        alert('Medicine updated successfully!');
        bootstrap.Modal.getInstance(document.getElementById('editMedicineModal')).hide();
        loadMedicines();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteMedicine(id, name) {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
        try {
            await apiCall(`/api/medicines/${id}`, 'DELETE');
            alert('Medicine deleted successfully!');
            loadMedicines();
        } catch (error) {
            alert(error.message);
        }
    }
}

async function addToCart(medicineId) {
    try {
        await apiCall('/api/cart/add', 'POST', {medicine_id: medicineId, quantity: 1});
        alert('Added to cart!');
        loadCartCount();
    } catch (error) {
        alert(error.message);
    }
}

async function loadCartCount() {
    try {
        const data = await apiCall('/api/cart/', 'GET');
        document.getElementById('cartCount').textContent = data.cart.length;
    } catch (error) {
        document.getElementById('cartCount').textContent = '0';
    }
}

async function logout() {
    try {
        await apiCall('/api/auth/logout', 'POST');
        window.location.href = 'index.html';
    } catch (error) {
        window.location.href = 'index.html';
    }
}

init();
