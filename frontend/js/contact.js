async function init() {
    try {
        const user = await apiCall('/api/auth/me', 'GET');
        if (!user.user) {
            window.location.href = 'index.html';
            return;
        }
        document.getElementById('userName').textContent = user.user.name;
        document.getElementById('contactName').value = user.user.name;
        document.getElementById('contactEmail').value = user.user.email;
    } catch (error) {
        window.location.href = 'index.html';
    }
}

document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('contactAlert');
    
    try {
        const data = {
            name: document.getElementById('contactName').value,
            email: document.getElementById('contactEmail').value,
            subject: document.getElementById('contactSubject').value,
            message: document.getElementById('contactMessage').value
        };
        
        const result = await apiCall('/api/contact/', 'POST', data);
        alertBox.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
        document.getElementById('contactForm').reset();
        document.getElementById('contactName').value = JSON.parse(localStorage.getItem('user') || '{}').name || '';
        document.getElementById('contactEmail').value = JSON.parse(localStorage.getItem('user') || '{}').email || '';
        setTimeout(() => alertBox.innerHTML = '', 5000);
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
});

async function logout() {
    try {
        await apiCall('/api/auth/logout', 'POST');
        window.location.href = 'index.html';
    } catch (error) {
        window.location.href = 'index.html';
    }
}

init();
