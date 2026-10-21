async function init() {
    try {
        const user = await apiCall('/api/auth/me', 'GET');
        if (!user.user) {
            window.location.href = 'index.html';
            return;
        }
        document.getElementById('userName').textContent = user.user.name;
        loadCart();
        loadCartCount();
    } catch (error) {
        window.location.href = 'index.html';
    }
}

async function loadCart() {
    try {
        const data = await apiCall('/api/cart/', 'GET');
        const cartItemsDiv = document.getElementById('cartItems');
        cartItemsDiv.innerHTML = '';
        
        if (data.cart.length === 0) {
            cartItemsDiv.innerHTML = '<p class="text-center text-muted">Your cart is empty</p>';
            document.getElementById('subtotal').textContent = '$0.00';
            document.getElementById('total').textContent = '$0.00';
            return;
        }
        
        data.cart.forEach(item => {
            cartItemsDiv.innerHTML += `
                <div class="card mb-2">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-5">
                                <h6 class="mb-0">${item.medicine.name}</h6>
                                <small class="text-muted">$${item.medicine.price.toFixed(2)} each</small>
                            </div>
                            <div class="col-md-3">
                                <div class="input-group">
                                    <button class="btn btn-sm btn-outline-secondary" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                                    <input type="text" class="form-control form-control-sm text-center" value="${item.quantity}" readonly>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                                </div>
                            </div>
                            <div class="col-md-2 text-center">
                                <strong>$${(item.medicine.price * item.quantity).toFixed(2)}</strong>
                            </div>
                            <div class="col-md-2 text-end">
                                <button class="btn btn-sm btn-danger" onclick="removeItem(${item.id})"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('subtotal').textContent = '$' + data.total.toFixed(2);
        document.getElementById('total').textContent = '$' + data.total.toFixed(2);
        loadCartCount();
    } catch (error) {
        alert(error.message);
    }
}

async function updateQuantity(itemId, quantity) {
    try {
        await apiCall(`/api/cart/update/${itemId}`, 'PUT', {quantity});
        loadCart();
    } catch (error) {
        alert(error.message);
    }
}

async function removeItem(itemId) {
    try {
        await apiCall(`/api/cart/remove/${itemId}`, 'DELETE');
        loadCart();
    } catch (error) {
        alert(error.message);
    }
}

async function checkout() {
    if (confirm('Confirm your order?')) {
        try {
            const result = await apiCall('/api/cart/checkout', 'POST');
            alert(result.message + ' Order #' + result.order_id);
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert(error.message);
        }
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
