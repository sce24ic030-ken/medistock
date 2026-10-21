/* Medistock - customer facing shop.

   The shop is a real shelf, not the staff catalogue: the customer searches,
   filters by category, adds medicines to the basket and checks out. The
   basket panel on the right mirrors what cart.js does on the cart page, so a
   customer can finish the order without leaving this page. */

(function () {
    'use strict';

    const Shop = {
        state: {
            search: '',
            category: '',
            medicines: [],
            cart: []
        },

        searchTimer: null,

        /* ---------------------------------------------------------- helpers */

        /* The medicine list endpoint of the shop. Only what a customer may
           actually buy is returned (in stock and not expired). */
        medicinesUrl: function () {
            const query = [];
            if (this.state.search) query.push('search=' + encodeURIComponent(this.state.search));
            if (this.state.category) query.push('category=' + encodeURIComponent(this.state.category));
            query.push('available_only=1');
            return '/api/medicines/?' + query.join('&');
        },

        /* The API answers with a flat list of category names, but a list of
           objects is accepted as well. */
        normaliseCategories: function (payload) {
            const list = (payload && payload.categories) || [];
            return list.map(function (item) {
                if (typeof item === 'string') return item;
                if (item && item.category) return item.category;
                if (item && item.name) return item.name;
                return '';
            }).filter(Boolean);
        },

        /* ------------------------------------------------------- rendering */

        renderCategoryChips: function (categories) {
            const container = document.getElementById('categoryChips');
            if (!container) return;

            const chips = [{ value: '', label: 'All medicines' }].concat(
                categories.map(function (name) { return { value: name, label: name }; })
            );

            container.innerHTML = chips.map(function (chip) {
                const active = Shop.state.category === chip.value;
                return '<button type="button" class="chip-filter' + (active ? ' active' : '') +
                    '" data-category="' + App.escape(chip.value) + '">' +
                    App.escape(chip.label) + '</button>';
            }).join('');
        },

        /* One product tile of the shelf. */
        medicineCard: function (medicine) {
            const available = Number(medicine.quantity) > 0;
            const days = App.daysUntil(medicine.expiry_date);

            let expiry = 'No expiry date';
            if (medicine.expiry_date) {
                expiry = 'Expires ' + App.date(medicine.expiry_date);
                if (days !== null) {
                    expiry += days < 0
                        ? ' (' + Math.abs(days) + ' days ago)'
                        : ' (in ' + days + ' days)';
                }
            }

            const badge = available
                ? '<span class="badge badge-success">' + App.escape(medicine.quantity) + ' in stock</span>'
                : '<span class="badge badge-danger">unavailable</span>';

            const action = available
                ? '<button class="btn btn-primary" type="button" onclick="Shop.addToCart(' +
                  App.escape(medicine.id) + ')"><i class="fas fa-cart-plus"></i> Add to cart</button>'
                : '<button class="btn btn-secondary" type="button" disabled>Out of stock</button>';

            return '<article class="shop-card">' +
                '<div class="shop-card__top">' +
                '<span class="shop-card__icon"><i class="fas fa-capsules"></i></span>' +
                badge +
                '</div>' +
                '<h4>' + App.escape(medicine.name) + '</h4>' +
                '<p>' + App.escape(medicine.generic_name || medicine.category || 'Medicine') + '</p>' +
                '<div class="shop-card__meta"><span>' + App.escape(medicine.category || 'Uncategorised') + '</span>' +
                '<span class="shop-card__price">' + App.money(medicine.price) + '</span></div>' +
                '<small style="font-size:0.72rem;color:var(--brand-muted);">' +
                '<i class="fas fa-calendar-day"></i> ' + App.escape(expiry) + '</small>' +
                '<div class="shop-card__actions">' + action + '</div>' +
                '</article>';
        },

        renderMedicines: function () {
            const container = document.getElementById('shopGrid');
            if (!container) return;

            const medicines = Shop.state.medicines || [];

            if (!medicines.length) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-store"></i>' +
                    '<h3>No medicine found</h3>' +
                    '<p>Nothing matches that search. Try another name or clear the filters.</p>' +
                    '</div>';
            } else {
                container.innerHTML = '<div class="shop-grid">' + medicines.map(function (medicine) {
                    return Shop.medicineCard(medicine);
                }).join('') + '</div>';
            }

            const count = document.getElementById('shopCount');
            if (count) {
                count.textContent = medicines.length + (medicines.length === 1 ? ' medicine' : ' medicines');
            }
        },

        renderCart: function () {
            const container = document.getElementById('cartItems');
            if (!container) return;

            const cart = Shop.state.cart || [];

            if (!cart.length) {
                container.innerHTML = '<div class="empty-state" style="padding:18px 12px;">' +
                    '<i class="fas fa-shopping-basket"></i>' +
                    '<p style="margin:0;">Your basket is empty.</p></div>';
            } else {
                container.innerHTML = '<div class="stack-list">' + cart.map(function (item) {
                    const medicine = item.medicine || {};
                    const price = Number(medicine.price) || 0;
                    const quantity = Number(item.quantity) || 0;

                    return '<div class="stack-row">' +
                        '<span class="stack-row__icon"><i class="fas fa-capsules"></i></span>' +
                        '<div class="stack-row__body"><strong>' + App.escape(medicine.name || 'Medicine') + '</strong>' +
                        '<small>' + App.money(price) + ' each · qty ' + App.escape(quantity) + '</small></div>' +
                        '<span class="stack-row__value">' + App.money(price * quantity) + '</span>' +
                        '</div>';
                }).join('') + '</div>';
            }

            const itemsCount = document.getElementById('cartItemsCount');
            if (itemsCount) itemsCount.textContent = cart.length;

            const total = document.getElementById('cartTotal');
            if (total) total.textContent = App.money(Shop.cartTotal());

            const checkout = document.getElementById('checkoutBtn');
            if (checkout) checkout.disabled = !cart.length;
        },

        cartTotal: function () {
            return (this.state.cart || []).reduce(function (sum, item) {
                const medicine = item.medicine || {};
                const price = Number(medicine.price) || 0;
                return sum + price * (Number(item.quantity) || 0);
            }, 0);
        },

        /* ----------------------------------------------------------- loading */

        loadCategories: function () {
            return apiCall('/api/medicines/categories', 'GET')
                .then(function (data) {
                    Shop.categories = Shop.normaliseCategories(data);
                    Shop.renderCategoryChips(Shop.categories);
                })
                .catch(function (error) {
                    App.toast(error.message, 'error');
                });
        },

        loadMedicines: function () {
            return apiCall(Shop.medicinesUrl(), 'GET')
                .then(function (data) {
                    Shop.state.medicines = (data && data.medicines) || [];
                    Shop.renderMedicines();
                })
                .catch(function (error) {
                    App.toast(error.message, 'error');
                });
        },

        loadCart: function () {
            return apiCall('/api/cart/', 'GET')
                .then(function (data) {
                    Shop.state.cart = (data && data.cart) || [];
                    Shop.renderCart();
                })
                .catch(function (error) {
                    App.toast(error.message, 'error');
                });
        },

        /* ----------------------------------------------------------- actions */

        addToCart: function (medicineId) {
            return apiCall('/api/cart/add', 'POST', { medicine_id: medicineId, quantity: 1 })
                .then(function () {
                    App.toast('Added to your cart', 'success');
                    App.loadCartCount();
                    Shop.loadCart();
                })
                .catch(function (error) {
                    App.toast(error.message, 'error');
                });
        },

        /* Same call as cart.js - the backend creates the order, clears the
           cart and returns the new order id. */
        checkout: function () {
            if (!Shop.state.cart.length) {
                App.toast('Your basket is empty', 'info');
                return;
            }

            if (!confirm('Confirm your order?')) return;

            return apiCall('/api/cart/checkout', 'POST')
                .then(function (result) {
                    App.toast((result && result.message ? result.message : 'Order placed successfully') +
                        ' · Order #' + (result && result.order_id), 'success');
                    App.loadCartCount();
                    Shop.loadCart();
                    window.location.href = 'customer.html';
                })
                .catch(function (error) {
                    App.toast(error.message, 'error');
                });
        },

        setCategory: function (category) {
            Shop.state.category = category || '';
            Shop.renderCategoryChips(Shop.categories || []);
            Shop.loadMedicines();
        },

        setSearch: function (value) {
            Shop.state.search = (value || '').trim();
            Shop.loadMedicines();
        },

        /* ---------------------------------------------------------- listeners */

        listen: function () {
            const search = document.getElementById('shopSearch');
            if (search) {
                search.addEventListener('input', function () {
                    clearTimeout(Shop.searchTimer);
                    Shop.searchTimer = setTimeout(function () {
                        Shop.setSearch(search.value);
                    }, 300);
                });
            }

            const clear = document.getElementById('clearSearch');
            if (clear) {
                clear.addEventListener('click', function () {
                    if (search) search.value = '';
                    Shop.setSearch('');
                });
            }

            const chips = document.getElementById('categoryChips');
            if (chips) {
                chips.addEventListener('click', function (event) {
                    const button = event.target.closest('.chip-filter');
                    if (!button) return;
                    Shop.setCategory(button.getAttribute('data-category') || '');
                });
            }
        },

        /* --------------------------------------------------------------- boot */

        start: function () {
            Shop.listen();

            return Shop.loadCategories()
                .then(function () {
                    return Shop.loadMedicines();
                })
                .then(function () {
                    return Shop.loadCart();
                });
        }
    };

    window.Shop = Shop;

    document.addEventListener('DOMContentLoaded', function () {
        App.init({ roles: ['customer'] })
            .then(function (user) {
                if (!user) {
                    /* App.init already sent a signed-out visitor to the login
                       screen. A signed-in user of another role belongs on the
                       home page of that role (customer.html for a customer). */
                    if (App.user) window.location.href = App.home(App.user.role);
                    return null;
                }
                return Shop.start();
            });
    });
})();
