/* Medistock - Profile & settings tab */
const PREFS_KEY = 'medistock.prefs';

const DEFAULT_PREFS = {
    expiry: true,
    lowStock: true,
    dailySummary: true,
    sound: false
};

function loadPrefs() {
    try {
        const stored = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        return Object.assign({}, DEFAULT_PREFS, stored);
    } catch (error) {
        return Object.assign({}, DEFAULT_PREFS);
    }
}

function savePrefs(prefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function applyPrefs(prefs) {
    document.querySelectorAll('[data-pref]').forEach(function (input) {
        input.checked = !!prefs[input.getAttribute('data-pref')];
    });

    const enabled = Object.keys(prefs).filter(function (key) { return prefs[key]; }).length;
    document.getElementById('prefsChip').textContent = enabled + ' of ' + Object.keys(prefs).length + ' on';
}

function renderProfile(user) {
    const initials = (user.name || '?').split(' ').map(function (part) { return part[0]; }).slice(0, 2).join('').toUpperCase();
    const avatar = document.querySelector('.profile-avatar');
    if (avatar) avatar.textContent = initials;

    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileEmail').textContent = user.email;

    const roleLabels = { admin: 'Administrator', pharmacist: 'Pharmacist', customer: 'Customer' };
    document.getElementById('profileRole').textContent = roleLabels[user.role] || user.role;
    document.getElementById('profilePhone').textContent = user.phone || 'Not set';
    document.getElementById('profileSince').textContent = App.date(user.created_at);
    document.getElementById('profileLogin').textContent = user.last_login ? App.dateTime(user.last_login) : 'First session';

    document.getElementById('editName').value = user.name;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editPhone').value = user.phone || '';
}

function saveProfile() {
    const payload = {
        name: document.getElementById('editName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        phone: document.getElementById('editPhone').value.trim()
    };

    if (!payload.name || !payload.email) {
        App.toast('Name and email are required', 'error');
        return;
    }

    apiCall('/api/auth/profile', 'PUT', payload)
        .then(function (data) {
            App.toast(data.message || 'Profile updated', 'success');
            renderProfile(data.user);
            const nameEl = document.getElementById('userName');
            if (nameEl) nameEl.textContent = data.user.name;
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function savePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword) {
        App.toast('Fill in both password fields', 'error');
        return;
    }
    if (newPassword.length < 6) {
        App.toast('New password must be at least 6 characters', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        App.toast('The new passwords do not match', 'error');
        return;
    }

    apiCall('/api/auth/change-password', 'POST', {
        current_password: currentPassword,
        new_password: newPassword
    })
        .then(function (data) {
            App.toast(data.message || 'Password updated', 'success');
            document.getElementById('passwordForm').reset();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

document.addEventListener('DOMContentLoaded', function () {
    App.init().then(function (user) {
        if (!user) return;

        renderProfile(user);
        applyPrefs(loadPrefs());

        document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
        document.getElementById('savePasswordBtn').addEventListener('click', savePassword);
        document.getElementById('signOutBtn').addEventListener('click', App.logout);

        document.querySelectorAll('[data-pref]').forEach(function (input) {
            input.addEventListener('change', function () {
                const prefs = loadPrefs();
                prefs[input.getAttribute('data-pref')] = input.checked;
                savePrefs(prefs);
                applyPrefs(prefs);
                App.toast('Preferences saved', 'success');
            });
        });
    });
});
