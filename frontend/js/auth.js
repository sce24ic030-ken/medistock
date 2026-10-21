async function checkAuth() {
    try {
        const user = await apiCall('/api/auth/me', 'GET');
        return user.user;
    } catch (error) {
        return null;
    }
}

async function logout() {
    try {
        await apiCall('/api/auth/logout', 'POST');
    } catch (error) {
        // Ignore errors
    }
    window.location.href = 'index.html';
}

function showAlert(elementId, message, type = 'danger') {
    const alertBox = document.getElementById(elementId);
    if (alertBox) {
        alertBox.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;
        setTimeout(() => {
            alertBox.innerHTML = '';
        }, 5000);
    }
}
