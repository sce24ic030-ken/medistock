/* Medistock - shared helpers for every signed-in page (toasts, formatting,
   session bootstrap, cart badge, role based visibility). */
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
            roleEl.textContent = user.role_label || labelForRole(user.role);
        }
    },

    /* Home page of the signed-in role (dashboard / workspace / counter / shop). */
    home: function (role) {
        return homeForRole(role || (App.user && App.user.role));
    },

    /* Hides everything the signed-in role may not use.

       Any element with data-roles="admin,pharmacist" stays visible for those
       roles only; the old data-admin-only attribute keeps working as well. */
    applyRole: function (role) {
        if (!role) return;

        document.querySelectorAll('[data-admin-only]').forEach(function (el) {
            el.style.display = 'none';
        });

        if (window.MEDISTOCK && window.MEDISTOCK.applyRoleVisibility) {
            window.MEDISTOCK.applyRoleVisibility(role);
        }
    },

    /* Loads the signed-in user, fills the sidebar and applies the role. */
    init: function (options) {
        const settings = options || {};

        return apiCall('/api/auth/me', 'GET')
            .then(function (data) {
                if (!data.user) {
                    App.handleSignedOut('session');
                    return null;
                }

                App.user = data.user;

                // The session works, so the "just signed in" markers can go.
                Session.clear();

                App.syncUser(data.user);
                App.applyRole(data.user.role);

                const logoutBtn = document.getElementById('appLogout');
                if (logoutBtn) logoutBtn.addEventListener('click', function (event) {
                    event.preventDefault();
                    App.logout();
                });

                App.loadCartCount();

                if (settings.adminOnly && data.user.role !== 'admin') {
                    App.renderAccessDenied(
                        'Administrator access required',
                        'This area is restricted to administrators. Sign in with an admin account to continue.',
                        'dashboard.html');
                    return null;
                }

                if (settings.roles && settings.roles.indexOf(data.user.role) === -1) {
                    const labels = settings.roles.map(labelForRole).join(' or ');
                    App.renderAccessDenied(
                        'This page is not part of your role',
                        'This page is available to: ' + labels + '. You are signed in as ' +
                        (data.user.role_label || labelForRole(data.user.role)) + '.',
                        App.home(data.user.role));
                    return null;
                }

                return data.user;
            })
            .catch(function (error) {
                // The session was lost (or the API is down) - send the user back
                // to the login screen with a reason instead of a blank page.
                App.handleSignedOut(error && error.status === 0 ? 'offline' : 'session');
                return null;
            });
    },

    /* The API does not know this browser any more.

       Normally that means "please sign in again". But when the user signed in
       a moment ago the real problem is that the session cookie was not
       stored, and redirecting again would only start the same loop - so the
       problem is explained on the page instead. */
    handleSignedOut: function (reason) {
        if (reason === 'offline') {
            App.redirectToLogin('offline');
            return;
        }

        const redirects = Session.bumpRedirect();

        if (Session.isFresh() || redirects >= 2) {
            App.renderSessionProblem();
            return;
        }

        App.redirectToLogin('session');
    },

    /* Explains why the app keeps returning to the login screen. */
    renderSessionProblem: function () {
        const content = document.querySelector('.app-content');
        if (!content) return;

        content.innerHTML =
            '<div class="empty-state">' +
            '<i class="fas fa-plug-circle-xmark"></i>' +
            '<h3>The session could not be kept</h3>' +
            '<p>Medistock signed you in, but the API did not store the session cookie, ' +
            'so every page sent you straight back to the login screen.</p>' +
            '<p class="mb-3">Open the app and the API on the same address ' +
            '(for example <code>http://127.0.0.1:5000</code>) and sign in again.</p>' +
            '<a class="btn btn-primary" href="index.html">Back to sign in</a>' +
            '</div>';
    },

    /* Send the user to the login page, remembering where they came from. */
    redirectToLogin: function (reason) {
        const next = window.location.pathname.split('/').pop() || '';
        const target = 'index.html?reason=' + encodeURIComponent(reason || '') +
            (next && next !== 'index.html' ? '&next=' + encodeURIComponent(next) : '');
        window.location.href = target;
    },

    renderAccessDenied: function (title, message, backTo) {
        const content = document.querySelector('.app-content');
        if (!content) return;

        content.innerHTML =
            '<div class="empty-state">' +
            '<i class="fas fa-lock"></i>' +
            '<h3>' + App.escape(title || 'Access denied') + '</h3>' +
            '<p>' + App.escape(message || 'You do not have access to this area.') + '</p>' +
            '<a class="btn btn-primary" href="' + (backTo || 'dashboard.html') + '">Back to my home page</a>' +
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
            .then(function () {
                Session.clear();
                window.location.href = 'index.html';
            });
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
    },

    /* Render a KPI card description coming from the API. */
    kpiHtml: function (kpi) {
        return '<article class="kpi-card ' + App.escape(kpi.tone || 'k-indigo') + '">' +
            '<div class="kpi-top">' +
            '<span class="kpi-icon"><i class="fas ' + App.escape(kpi.icon || 'fa-chart-line') + '"></i></span>' +
            '<span class="kpi-trend">' + App.escape(kpi.trend || '') + '</span>' +
            '</div>' +
            '<div class="kpi-value">' + App.escape(kpi.prefix || '') + App.escape(kpi.display) + App.escape(kpi.suffix || '') + '</div>' +
            '<div class="kpi-label">' + App.escape(kpi.label) + '</div>' +
            '<div class="kpi-bar"><span class="kpi-bar-fill" style="width:0"></span></div>' +
            '<div class="kpi-foot">' + App.escape(kpi.hint || '') + '</div>' +
            '</article>';
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
