/* Medistock - shared helpers for every signed-in page (toasts, formatting,
   session bootstrap, cart badge). */
const App = {
    user: null,

    escape: function (value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    money: function (value) {
        const number = Number(value || 0);
        return '$' + number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    number: function (value) {
        return Number(value || 0).toLocaleString('en-US');
    },

    date: function (iso) {
        if (!iso) return '-';
        const date = new Date(iso);
        if (isNaN(date.getTime())) return String(iso).slice(0, 10);
        return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    dateTime: function (iso) {
        if (!iso) return '-';
        const date = new Date(iso);
        if (isNaN(date.getTime())) return String(iso);
        return date.toLocaleString('en-US', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    },

    daysUntil: function (iso) {
        if (!iso) return null;
        const target = new Date(iso + 'T00:00:00');
        if (isNaN(target.getTime())) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.round((target - today) / 86400000);
    },

    toast: function (message, type) {
        const stack = document.getElementById('toastStack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'toastStack';
            stack.className = 'toast-stack';
            document.body.appendChild(stack);
        }

        const toast = document.createElement('div');
        toast.className = 'app-toast ' + (type || 'info');

        const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
        toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i>' +
            '<span>' + App.escape(message) + '</span>';

        stack.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('show'); });

        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { toast.remove(); }, 320);
        }, 3600);
    },

    /* Fills the sidebar user block (name + role) for the signed-in user. */
    syncUser: function (user) {
        if (!user) return;

        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = user.name;

        const roleEl = document.getElementById('userRole');
        if (roleEl) {
            const labels = { admin: 'Administrator', pharmacist: 'Pharmacist', customer: 'Customer' };
            roleEl.textContent = labels[user.role] || user.role;
        }
    },

    /* Hides the admin-only navigation and buttons for every other role. */
    applyRole: function (role) {
        if (role === 'admin') return;

        document.querySelectorAll('[data-admin-only]').forEach(function (el) {
            el.style.display = 'none';
        });
    },

    /* Loads the signed-in user, fills the sidebar and hides admin-only UI. */
    init: function (options) {
        const settings = options || {};
        return apiCall('/api/auth/me', 'GET')
            .then(function (data) {
                if (!data.user) {
                    window.location.href = 'index.html';
                    return null;
                }

                App.user = data.user;

                App.syncUser(data.user);
                App.applyRole(data.user.role);

                const logoutBtn = document.getElementById('appLogout');
                if (logoutBtn) logoutBtn.addEventListener('click', function (event) {
                    event.preventDefault();
                    App.logout();
                });

                App.loadCartCount();

                if (settings.adminOnly && data.user.role !== 'admin') {
                    App.renderAccessDenied();
                    return null;
                }

                return data.user;
            })
            .catch(function () {
                window.location.href = 'index.html';
                return null;
            });
    },

    renderAccessDenied: function () {
        const content = document.querySelector('.app-content');
        if (!content) return;
        content.innerHTML =
            '<div class="empty-state">' +
            '<i class="fas fa-lock"></i>' +
            '<h3>Admin access required</h3>' +
            '<p>This area is restricted to administrators. Sign in with an admin account to continue.</p>' +
            '<a class="btn btn-primary" href="dashboard.html">Back to dashboard</a>' +
            '</div>';
    },

    loadCartCount: function () {
        const badge = document.getElementById('cartCount');
        if (!badge) return;
        apiCall('/api/cart/', 'GET')
            .then(function (data) {
                badge.textContent = (data.cart && data.cart.length) || 0;
            })
            .catch(function () { badge.textContent = '0'; });
    },

    logout: function () {
        apiCall('/api/auth/logout', 'POST')
            .catch(function () { /* ignore network errors */ })
            .then(function () { window.location.href = 'index.html'; });
    },

    exportCsv: function (filename, rows) {
        const csv = rows.map(function (row) {
            return row.map(function (cell) {
                const value = cell === null || cell === undefined ? '' : String(cell);
                return '"' + value.replace(/"/g, '""') + '"';
            }).join(',');
        }).join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    },

    statusBadge: function (status) {
        const map = {
            completed: 'badge-success',
            packed: 'badge-info',
            pending: 'badge-warning',
            cancelled: 'badge-danger',
            purchase: 'badge-info',
            sale: 'badge-success',
            adjustment: 'badge-warning',
            return: 'badge-info'
        };
        return map[status] || 'badge-info';
    }
};

/* Every signed-in page loads this file, so keep the sidebar user block in
   sync even on pages that do not use App.init(). */
document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.classList.contains('app-body')) return;
    if (!document.getElementById('userName')) return;

    apiCall('/api/auth/me', 'GET')
        .then(function (data) {
            if (!data || !data.user) return;
            App.user = App.user || data.user;
            App.syncUser(data.user);
            App.applyRole(data.user.role);
            App.loadCartCount();
        })
        .catch(function () { /* not signed in - the page script will redirect */ });
});
