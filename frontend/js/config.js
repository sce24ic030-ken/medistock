// Backend API URL
// Production (Render)  : https://medistock-api-zudg.onrender.com
// Local development    : http://<the host you are browsing on>:5000
//
// The deployed site talks to the live Render API, while a local copy of the
// frontend keeps talking to the local Flask server. Override it any time with
//   window.MEDISTOCK_API_URL = 'https://...'
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'];
const LIVE_API_ORIGIN = 'https://medistock-api-zudg.onrender.com';

// IMPORTANT: the local API URL keeps the hostname of the page.
// "localhost" and "127.0.0.1" are different sites as far as the browser is
// concerned, so a page opened on http://localhost:5500 talking to
// http://127.0.0.1:5000 silently loses the session cookie and the app keeps
// bouncing back to the login screen.
const API_BASE_URL = window.MEDISTOCK_API_URL
    || (LOCAL_HOSTS.indexOf(location.hostname) !== -1
        ? 'http://' + location.hostname + ':5000'
        // When the app is served by the API itself the requests stay on the
        // same origin, so the session cookie is a normal first-party cookie.
        : (location.origin === LIVE_API_ORIGIN ? '' : LIVE_API_ORIGIN));

/* The four roles and where each one lands after signing in. */
const MEDISTOCK_ROLES = {
    admin: {
        label: 'Administrator',
        home: 'dashboard.html',
        badge: 'fa-shield-halved'
    },
    pharmacist: {
        label: 'Pharmacist',
        home: 'pharmacist.html',
        badge: 'fa-user-graduate'
    },
    staff: {
        label: 'Counter Staff',
        home: 'staff.html',
        badge: 'fa-user-tie'
    },
    customer: {
        label: 'Customer',
        home: 'customer.html',
        badge: 'fa-user'
    }
};

/* Home page for a role (falls back to the admin console). */
function homeForRole(role) {
    const entry = MEDISTOCK_ROLES[role];
    return entry ? entry.home : MEDISTOCK_ROLES.admin.home;
}

/* Label for a role. */
function labelForRole(role) {
    const entry = MEDISTOCK_ROLES[role];
    return entry ? entry.label : 'User';
}

/* Which roles may open which page. Used for the page guards and for the
   "continue where you left off" redirect after signing in. */
const MEDISTOCK_PAGES = {
    'dashboard.html': ['admin'],
    'pharmacist.html': ['pharmacist'],
    'staff.html': ['staff'],
    'customer.html': ['customer'],
    'shop.html': ['customer'],
    'medicines.html': ['admin', 'pharmacist', 'staff'],
    'orders.html': ['admin', 'pharmacist', 'staff', 'customer'],
    'cart.html': ['admin', 'pharmacist', 'staff', 'customer'],
    'alerts.html': ['admin', 'pharmacist', 'staff'],
    'movements.html': ['admin', 'pharmacist', 'staff'],
    'suppliers.html': ['admin', 'pharmacist', 'staff'],
    'reports.html': ['admin', 'pharmacist'],
    'users.html': ['admin'],
    'feedback.html': ['admin', 'pharmacist', 'staff', 'customer'],
    'faqs.html': ['admin', 'pharmacist', 'staff', 'customer'],
    'profile.html': ['admin', 'pharmacist', 'staff', 'customer']
};

/* Roles allowed on a page (null when the page is open to everybody). */
function rolesForPage(page) {
    if (!page) return null;
    return MEDISTOCK_PAGES[String(page).toLowerCase()] || null;
}

/* Where a user should land after signing in. */
function landingPageFor(role, next) {
    if (next) {
        const allowed = rolesForPage(next);
        if (allowed && allowed.indexOf(role) !== -1) return next;
        if (!allowed) return next;
    }
    return homeForRole(role);
}

/* ---------------------------------------------------------------------------
   Session helpers
   ---------------------------------------------------------------------------
   The login lives in a session cookie. These helpers remember what just
   happened so the app can break the "login -> home -> login again" loop
   instead of bouncing the user between the two screens forever. */
const Session = {
    LOGIN_AT: 'smi.loginAt',
    REDIRECTS: 'smi.loginRedirects',

    /* Remember that a sign-in just succeeded. */
    mark: function (role) {
        try {
            sessionStorage.setItem(Session.LOGIN_AT, String(Date.now()));
            sessionStorage.removeItem(Session.REDIRECTS);
        } catch (error) {
            /* storage unavailable - ignore */
        }
    },

    /* True while the sign-in is still fresh (two minutes). */
    isFresh: function () {
        try {
            const at = parseInt(sessionStorage.getItem(Session.LOGIN_AT) || '0', 10);
            return at > 0 && (Date.now() - at) < 120000;
        } catch (error) {
            return false;
        }
    },

    /* Forget the markers - a page loaded and the session works. */
    clear: function () {
        try {
            sessionStorage.removeItem(Session.LOGIN_AT);
            sessionStorage.removeItem(Session.REDIRECTS);
        } catch (error) {
            /* storage unavailable - ignore */
        }
    },

    /* How often we sent the user back to the login screen in a row. */
    bumpRedirect: function () {
        try {
            const now = Date.now();
            const raw = sessionStorage.getItem(Session.REDIRECTS);
            let count = 0;
            let stamp = 0;

            if (raw) {
                const parsed = JSON.parse(raw);
                count = parsed.count || 0;
                stamp = parsed.at || 0;
            }

            // A redirect older than a minute is a brand new situation.
            if (now - stamp > 60000) count = 0;

            count += 1;
            sessionStorage.setItem(Session.REDIRECTS, JSON.stringify({ count: count, at: now }));
            return count;
        } catch (error) {
            return 1;
        }
    }
};

async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    };
    
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    
    let response;
    let result = {};

    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    } catch (error) {
        const networkError = new Error('Cannot reach the Medistock API. Is the backend running?');
        networkError.status = 0;
        throw networkError;
    }

    try {
        result = await response.json();
    } catch (error) {
        result = {};
    }
    
    if (!response.ok) {
        const apiError = new Error(result.error || 'Something went wrong');
        apiError.status = response.status;
        apiError.payload = result;
        throw apiError;
    }
    
    return result;
}
