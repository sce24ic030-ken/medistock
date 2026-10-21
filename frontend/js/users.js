/* Medistock - Users & Roles tab (admin only) */
let users = [];

function renderSummary(summary) {
    summary = summary || {};
    const total = Math.max(summary.total_users || 0, 1);

    document.getElementById('kpiUsers').textContent = App.number(summary.total_users);
    document.getElementById('kpiAdmins').textContent = App.number(summary.admins);
    document.getElementById('kpiPharmacists').textContent = App.number(summary.pharmacists);
    document.getElementById('kpiCustomers').textContent = App.number(summary.customers);

    document.getElementById('kpiUsersBar').style.width = '100%';
    document.getElementById('kpiAdminsBar').style.width = ((summary.admins || 0) / total) * 100 + '%';
    document.getElementById('kpiPharmacistsBar').style.width = ((summary.pharmacists || 0) / total) * 100 + '%';
    document.getElementById('kpiCustomersBar').style.width = ((summary.customers || 0) / total) * 100 + '%';

    document.getElementById('kpiUsersFoot').textContent = 'Registered accounts';
    document.getElementById('kpiAdminsFoot').textContent = 'Can manage stock and users';
    document.getElementById('kpiPharmacistsFoot').textContent = 'Staff with counter access';

    const trend = document.getElementById('kpiInactiveTrend');
    trend.textContent = summary.inactive ? summary.inactive + ' inactive' : 'active';
    trend.className = 'kpi-trend ' + (summary.inactive ? 't-warn' : 't-good');

    document.getElementById('kpiCustomersFoot').textContent = (summary.inactive || 0) + ' deactivated account(s)';
}

function renderUsers() {
    const tbody = document.getElementById('usersTable');
    const search = document.getElementById('userSearch').value.trim().toLowerCase();

    const filtered = users.filter(function (user) {
        if (!search) return true;
        return (user.name || '').toLowerCase().indexOf(search) !== -1 ||
               (user.email || '').toLowerCase().indexOf(search) !== -1;
    });

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No users match your search.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(function (user) {
        const initials = (user.name || '?').split(' ').map(function (part) { return part[0]; }).slice(0, 2).join('').toUpperCase();
        const active = user.is_active !== false;

        const roleSelect = '<select class="form-select form-select-sm" style="max-width:150px;border-radius:10px;" ' +
            'onchange="changeRole(' + user.id + ', this.value)">' +
            ['admin', 'pharmacist', 'staff', 'customer'].map(function (role) {
                return '<option value="' + role + '"' + (user.role === role ? ' selected' : '') + '>' +
                    (labelForRole(role)) + '</option>';
            }).join('') + '</select>';

        const statusToggle = '<label class="switch" title="' + (active ? 'Deactivate' : 'Activate') + '">' +
            '<input type="checkbox"' + (active ? ' checked' : '') + ' onchange="toggleActive(' + user.id + ', this.checked)">' +
            '<span></span></label>';

        return '<tr>' +
            '<td><div class="d-flex align-items-center gap-2">' +
            '<span class="supplier-avatar" style="width:36px;height:36px;border-radius:11px;font-size:0.8rem;">' + App.escape(initials) + '</span>' +
            '<span><span class="row-strong">' + App.escape(user.name) + '</span>' +
            '<span class="row-sub">' + App.escape(user.email) + '</span></span></div></td>' +
            '<td>' + roleSelect + '</td>' +
            '<td>' + statusToggle + '</td>' +
            '<td>' + App.number(user.order_count) + '</td>' +
            '<td>' + App.money(user.spend) + '</td>' +
            '<td>' + (user.last_login ? App.dateTime(user.last_login) : '<span class="row-sub">Never</span>') + '</td>' +
            '</tr>';
    }).join('');
}

function loadUsers() {
    return apiCall('/api/users/', 'GET')
        .then(function (data) {
            users = data.users || [];
            renderSummary(data.summary);
            renderUsers();
        })
        .catch(function (error) {
            App.toast(error.message, 'error');
            document.getElementById('usersTable').innerHTML =
                '<tr><td colspan="6" class="text-center text-danger py-4">' + App.escape(error.message) + '</td></tr>';
        });
}

function changeRole(id, role) {
    apiCall('/api/users/' + id, 'PATCH', { role: role })
        .then(function () {
            App.toast('Role updated to ' + role, 'success');
            loadUsers();
        })
        .catch(function (error) {
            App.toast(error.message, 'error');
            loadUsers();
        });
}

function toggleActive(id, isActive) {
    apiCall('/api/users/' + id, 'PATCH', { is_active: isActive })
        .then(function () {
            App.toast(isActive ? 'Account activated' : 'Account deactivated', 'success');
            loadUsers();
        })
        .catch(function (error) {
            App.toast(error.message, 'error');
            loadUsers();
        });
}

function createUser() {
    const payload = {
        name: document.getElementById('newUserName').value.trim(),
        email: document.getElementById('newUserEmail').value.trim(),
        password: document.getElementById('newUserPassword').value,
        role: document.getElementById('newUserRole').value,
        phone: document.getElementById('newUserPhone').value.trim()
    };

    if (!payload.name || !payload.email || !payload.password) {
        App.toast('Name, email and password are required', 'error');
        return;
    }

    apiCall('/api/users/', 'POST', payload)
        .then(function (data) {
            App.toast(data.message || 'Account created', 'success');
            bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
            document.getElementById('userForm').reset();
            loadUsers();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function exportUsers() {
    const rows = [['Name', 'Email', 'Role', 'Active', 'Orders', 'Spend', 'Last login']];
    users.forEach(function (user) {
        rows.push([
            user.name, user.email, user.role,
            user.is_active === false ? 'No' : 'Yes',
            user.order_count, user.spend,
            user.last_login ? App.dateTime(user.last_login) : ''
        ]);
    });
    App.exportCsv('medistock-users.csv', rows);
    App.toast('User list exported', 'success');
}

document.addEventListener('DOMContentLoaded', function () {
    App.init({ roles: ['admin'] }).then(function (user) {
        if (!user) return;

        loadUsers();

        document.getElementById('userSearch').addEventListener('input', renderUsers);
        document.getElementById('addUserBtn').addEventListener('click', function () {
            new bootstrap.Modal(document.getElementById('userModal')).show();
        });
        document.getElementById('saveUserBtn').addEventListener('click', createUser);
        document.getElementById('exportUsers').addEventListener('click', exportUsers);
    });
});
