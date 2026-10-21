let selectedRating = 0;

async function init() {
    const user = await App.init();
    if (!user) return;

    document.getElementById('fbName').value = user.name;
    document.getElementById('fbEmail').value = user.email;
    loadFeedback();
    setupStars();
}

function setupStars() {
    const stars = document.querySelectorAll('#starRating i');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.getAttribute('data-rating'));
            document.getElementById('rating').value = selectedRating;
            stars.forEach((s, idx) => {
                if (idx < selectedRating) {
                    s.classList.remove('far');
                    s.classList.add('fas');
                } else {
                    s.classList.remove('fas');
                    s.classList.add('far');
                }
            });
        });
    });
}

document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('alertBox');
    
    if (selectedRating === 0) {
        alertBox.innerHTML = '<div class="alert alert-danger">Please select a rating</div>';
        return;
    }
    
    try {
        const data = {
            name: document.getElementById('fbName').value,
            email: document.getElementById('fbEmail').value,
            rating: selectedRating,
            comment: document.getElementById('fbComment').value
        };
        
        await apiCall('/api/feedback/', 'POST', data);
        alertBox.innerHTML = '<div class="alert alert-success">Thank you for your feedback!</div>';
        document.getElementById('feedbackForm').reset();
        selectedRating = 0;
        document.querySelectorAll('#starRating i').forEach(s => {
            s.classList.remove('fas');
            s.classList.add('far');
        });
        loadFeedback();
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
});

async function loadFeedback() {
    try {
        const data = await apiCall('/api/feedback/', 'GET');
        const list = document.getElementById('feedbackList');
        list.innerHTML = '';
        
        if (data.feedback.length === 0) {
            list.innerHTML = '<p class="text-muted text-center">No feedback yet</p>';
            return;
        }
        
        data.feedback.slice(0, 10).forEach(fb => {
            let stars = '';
            for (let i = 0; i < fb.rating; i++) stars += '<i class="fas fa-star text-warning"></i>';
            for (let i = fb.rating; i < 5; i++) stars += '<i class="far fa-star text-warning"></i>';
            
            list.innerHTML += `
                <div class="mb-3 pb-3 border-bottom">
                    <div class="d-flex justify-content-between">
                        <strong>${fb.name}</strong>
                        <small class="text-muted">${new Date(fb.created_at).toLocaleDateString()}</small>
                    </div>
                    <div class="mb-1">${stars}</div>
                    <p class="mb-0 text-muted">${fb.comment}</p>
                </div>
            `;
        });
    } catch (error) {
        console.error(error);
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
