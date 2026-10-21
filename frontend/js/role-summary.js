/* Medistock - shared renderer for the role workspaces.

   Every role page (pharmacist / staff / customer) loads the same role
   summary from the API and renders it with its own markup. The helpers below
   cover the blocks those pages share: greeting, KPI grid, quick actions,
   alert list, order queue, stock list, activity timeline and the movements
   ledger. */
const RolePage = {
    data: null,
    chart: null,

    /* Load the role summary and hand it to the page renderer. */
    load: function (page, roles) {
        return App.init({ roles: roles })
            .then(function (user) {
                if (!user) return null;

                RolePage.user = user;
                RolePage.setRoleChip(user);

                return apiCall('/api/dashboard/summary', 'GET')
                    .then(function (data) {
                        RolePage.data = data;
                        if (typeof page === 'function') page(data, user);
                        // When switching back to a backgrounded tab the counters
                        // can freeze mid-animation; settle them when visible.
                        if (document.hidden) RolePage.settleCounters();
                        else RolePage.bindVisibilityGuard();
                        return data;
                    });
            })
            .catch(function (error) {
                App.toast(error.message, 'error');
                const content = document.querySelector('.app-content');
                if (content) {
                    content.insertAdjacentHTML('afterbegin',
                        '<div class="role-note"><i class="fas fa-plug-circle-exclamation"></i>' +
                        '<div><strong>Live data unavailable.</strong><br>' + App.escape(error.message) +
                        '</div></div>');
                }
                return null;
            });
    },

    setRoleChip: function (user) {
        const chip = document.getElementById('roleChip');
        if (!chip) return;

        const entry = MEDISTOCK_ROLES[user.role] || { label: user.role, badge: 'fa-user' };
        chip.innerHTML = '<i class="fas ' + entry.badge + '"></i><span>' +
            App.escape(user.role_label || entry.label) + '</span>';
    },

    /* Greeting block of the role hero. */
    renderGreeting: function (options) {
        const opts = options || {};
        const data = RolePage.data || {};
        const greeting = data.greeting || {};

        const eyebrow = document.getElementById(opts.eyebrowId || 'heroEyebrow');
        if (eyebrow) eyebrow.textContent = greeting.eyebrow || '';

        const title = document.getElementById(opts.titleId || 'heroTitle');
        if (title) title.textContent = greeting.title || 'Welcome';

        const sub = document.getElementById(opts.subId || 'heroSub');
        if (sub) sub.textContent = greeting.subtitle || '';
    },

    /* KPI grid. `keys` optionally limits the cards to a subset. */
    renderKpis: function (containerId, keys) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const data = RolePage.data || {};
        let kpis = data.kpis || [];

        if (keys && keys.length) {
            kpis = keys.map(function (key) {
                return kpis.filter(function (kpi) { return kpi.key === key; })[0];
            }).filter(Boolean);
        }

        container.innerHTML = kpis.map(function (kpi) { return App.kpiHtml(kpi); }).join('');
        RolePage.animateKpis(container);
    },

    /* Count the KPI numbers up once they are in the DOM.

       The count-up only plays the first time the page is opened in this
       session. Switching back to the tab shows the final numbers straight
       away instead of replaying the animation - that replay is what made
       the workspace flicker every time a tab was opened. */
    animateKpis: function (container) {
        const animate = App.firstVisit();
        const cards = container.querySelectorAll('.kpi-card');

        cards.forEach(function (card, index) {
            const valueEl = card.querySelector('.kpi-value');
            const barEl = card.querySelector('.kpi-bar-fill');

            setTimeout(function () {
                if (barEl) barEl.style.width = '100%';
                if (!valueEl) return;

                const raw = valueEl.textContent.trim();
                const match = raw.match(/^([^0-9-]*)(-?[\d,.]+)(.*)$/);
                if (!match) return;

                const prefix = match[1];
                const number = parseFloat(match[2].replace(/,/g, ''));
                const suffix = match[3];
                if (isNaN(number)) return;

                const decimals = (match[2].split('.')[1] || '').length;

                // App.countUp keeps the final value, so the number can be
                // settled instantly when the tab is hidden.
                App.countUp(valueEl, {
                    value: number,
                    prefix: prefix,
                    suffix: suffix,
                    decimals: decimals,
                    duration: 900,
                    animate: animate
                });
            }, index * 60);
        });
    },

    /* A background tab throttles the animation timers, so a count-up can be
       left half way. When the tab is hidden the number jumps straight to its
       final value - no flicker when the user comes back. */
    settleCounters: function () {
        if (typeof App !== 'undefined' && App.settleNumbers) App.settleNumbers();
    },

    bindVisibilityGuard: function () {
        if (RolePage._visibilityBound) return;
        RolePage._visibilityBound = true;
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) RolePage.settleCounters();
        });
    },

    /* Quick action buttons of the hero. */
    renderQuickActions: function (containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const actions = (RolePage.data.quick_actions || []);
        container.innerHTML = actions.map(function (action) {
            return '<a class="btn-soft' + (action.solid ? ' btn-soft-solid' : '') + '" href="' +
                App.escape(action.href) + '"><i class="fas ' + App.escape(action.icon) + '"></i> ' +
                App.escape(action.label) + '</a>';
        }).join('');
    },

    /* Hero facts (the small cards on the right of the hero). */
    renderHeroFacts: function (containerId, facts) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = facts.map(function (fact) {
            return '<div class="role-hero__fact">' +
                '<i class="fas ' + App.escape(fact.icon) + '"></i>' +
                '<div><span>' + App.escape(fact.label) + '</span>' +
                '<strong>' + App.escape(fact.value) + '</strong></div>' +
                '</div>';
        }).join('');
    },

    /* Smart alerts list. */
    renderAlerts: function (containerId, options) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const opts = options || {};
        const alerts = (RolePage.data.alerts || []).slice(0, opts.limit || 8);

        if (!alerts.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-circle-check"></i>' +
                '<h3>Nothing needs attention</h3><p>No low stock, expiring or expired batches right now.</p></div>';
            return;
        }

        const icons = { expired: 'fa-skull-crossbones', expiring: 'fa-hourglass-half', low_stock: 'fa-arrow-trend-down' };

        container.innerHTML = alerts.map(function (alert) {
            const medicine = alert.medicine || {};
            const days = App.daysUntil(medicine.expiry_date);
            const details = [];

            if (medicine.expiry_date) {
                details.push('Expires ' + App.date(medicine.expiry_date) +
                    (days !== null ? (days < 0 ? ' (' + Math.abs(days) + ' days ago)' : ' (in ' + days + ' days)') : ''));
            }
            details.push(medicine.quantity + ' units on hand');
            if (medicine.batch_no) details.push('Batch ' + medicine.batch_no);

            const action = opts.action
                ? '<button class="btn-ghost" style="padding:0.35rem 0.7rem;font-size:0.75rem;" onclick="RolePage.restock(' +
                  medicine.id + ', 25)"><i class="fas fa-plus"></i> Restock 25</button>'
                : '';

            return '<div class="alert-center-item">' +
                '<span class="alert-center-icon ' + (alert.severity === 'danger' ? 'alert-danger' : 'alert-warning') + '">' +
                '<i class="fas ' + (icons[alert.type] || 'fa-circle-info') + '"></i></span>' +
                '<div class="alert-center-body"><strong>' + App.escape(medicine.name || 'Medicine') + '</strong>' +
                '<small>' + App.escape(details.join(' · ')) + '</small></div>' +
                '<div class="alert-center-actions">' + action + '</div>' +
                '</div>';
        }).join('');
    },

    /* Order queue. `opts.customer` shows who the order belongs to. */
    renderOrders: function (containerId, options) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const opts = options || {};
        const orders = (RolePage.data.orders || []).slice(0, opts.limit || 8);

        if (!orders.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-circle-check"></i>' +
                '<h3>Queue is clear</h3><p>No order is waiting to be picked, packed or handed over.</p></div>';
            return;
        }

        container.innerHTML = orders.map(function (order) {
            const items = (order.items || []).map(function (item) {
                const name = item.medicine ? item.medicine.name : 'Medicine #' + item.medicine_id;
                return '<span>' + App.escape(name) + ' x' + item.quantity + '</span>';
            }).join('');

            const customer = order.customer ? order.customer.name : 'Walk-in customer';
            const canUpdate = opts.canUpdate;

            const buttons = canUpdate
                ? '<div class="d-flex gap-2 flex-wrap">' +
                  ['pending', 'packed', 'completed'].map(function (status) {
                      return '<button class="chip-filter' + (status === order.status ? ' active' : '') +
                          '" onclick="RolePage.setStatus(' + order.id + ",'" + status + "')'>" + status + '</button>';
                  }).join('') +
                  '</div>'
                : '<a class="icon-btn" title="View order" href="orders.html"><i class="fas fa-eye"></i></a>';

            return '<div class="queue-card">' +
                '<div class="queue-card__id">#' + String(order.id).padStart(4, '0') + '<small>' + App.escape(order.status) + '</small></div>' +
                '<div class="queue-card__body">' +
                '<strong>' + App.escape(customer) + '</strong>' +
                '<small>' + App.dateTime(order.created_at) + ' · ' + (order.items || []).length + ' line item(s)</small>' +
                '<div class="queue-card__items">' + items + '</div>' +
                '</div>' +
                '<div class="queue-card__side">' +
                '<span class="queue-card__total">' + App.money(order.total_amount) + '</span>' +
                buttons +
                '</div>' +
                '</div>';
        }).join('');
    },

    /* Stock list (low stock / expiring). */
    renderStock: function (containerId, options) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const opts = options || {};
        const stock = (RolePage.data.stock || []).slice(0, opts.limit || 8);

        if (!stock.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-circle-check"></i>' +
                '<h3>Stock looks healthy</h3><p>Nothing is below the reorder level right now.</p></div>';
            return;
        }

        container.innerHTML = '<div class="stack-list">' + stock.map(function (medicine) {
            const days = App.daysUntil(medicine.expiry_date);
            const badge = days !== null && days < 0
                ? '<span class="badge badge-danger">expired</span>'
                : (days !== null && days <= 30 ? '<span class="badge badge-warning">' + days + 'd left</span>' : '');

            const action = opts.action
                ? '<button class="icon-btn" title="Restock 25" onclick="RolePage.restock(' + medicine.id + ', 25)">' +
                  '<i class="fas fa-plus"></i></button>'
                : '';

            return '<div class="stack-row">' +
                '<span class="stack-row__icon"><i class="fas fa-capsules"></i></span>' +
                '<div class="stack-row__body"><strong>' + App.escape(medicine.name) + '</strong>' +
                '<small>' + App.escape(medicine.category || 'Uncategorised') +
                (medicine.batch_no ? ' · Batch ' + App.escape(medicine.batch_no) : '') + '</small></div>' +
                '<span class="stack-row__value">' + medicine.quantity + ' units ' + badge + '</span>' +
                action +
                '</div>';
        }).join('') + '</div>';
    },

    /* Activity timeline. */
    renderActivity: function (containerId, options) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const opts = options || {};
        const activity = (RolePage.data.activity || []).slice(0, opts.limit || 10);

        if (!activity.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i>No activity recorded yet.</div>';
            return;
        }

        container.innerHTML = '<div class="timeline">' + activity.map(function (item) {
            return '<div class="timeline-item">' +
                '<span class="timeline-dot"></span>' +
                '<strong>' + App.escape(item.action || 'Activity') + '</strong>' +
                '<time>' + App.dateTime(item.created_at) + '</time>' +
                '<small>' + App.escape(item.details || '') + '</small>' +
                '</div>';
        }).join('') + '</div>';
    },

    /* Today's stock movements. */
    renderMovements: function (containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const movements = RolePage.data.movements || [];

        if (!movements.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-right-left"></i>' +
                '<h3>No movement yet today</h3><p>Stock receipts and issues will show up here.</p></div>';
            return;
        }

        const icons = {
            purchase: 'fa-cart-plus', sale: 'fa-cart-minus',
            adjustment: 'fa-sliders', return: 'fa-rotate-left', expiry: 'fa-trash'
        };

        container.innerHTML = '<div class="stack-list">' + movements.map(function (movement) {
            const inbound = movement.change >= 0;
            const medicine = movement.medicine ? movement.medicine.name : 'Medicine #' + movement.medicine_id;

            return '<div class="stack-row">' +
                '<span class="stack-row__icon"><i class="fas ' + (icons[movement.reason] || 'fa-circle') + '"></i></span>' +
                '<div class="stack-row__body"><strong>' + App.escape(medicine) + '</strong>' +
                '<small>' + App.escape(movement.reason || '') +
                (movement.note ? ' · ' + App.escape(movement.note) : '') + ' · ' + App.dateTime(movement.created_at) + '</small></div>' +
                '<span class="stack-row__value ' + (inbound ? 'money-pos' : 'money-neg') + '">' +
                (inbound ? '+' : '') + movement.change + ' (' + movement.balance_after + ' left)</span>' +
                '</div>';
        }).join('') + '</div>';
    },

    /* Medicine cards (customer facing). */
    renderMedicines: function (containerId, options) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const opts = options || {};
        const medicines = (RolePage.data.medicines || []).slice(0, opts.limit || 8);

        if (!medicines.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-store"></i>' +
                '<h3>Nothing to show</h3><p>Have a look at the shop for the full catalogue.</p></div>';
            return;
        }

        container.innerHTML = '<div class="shop-grid">' + medicines.map(function (medicine) {
            const available = medicine.quantity > 0;
            const action = opts.canOrder && available
                ? '<button class="btn btn-primary" onclick="RolePage.addToCart(' + medicine.id + ')">' +
                  '<i class="fas fa-cart-plus"></i> Add</button>'
                : '<button class="btn btn-secondary" disabled>Out of stock</button>';

            return '<article class="shop-card">' +
                '<div class="shop-card__top">' +
                '<span class="shop-card__icon"><i class="fas fa-capsules"></i></span>' +
                '<span class="badge ' + (available ? 'badge-success' : 'badge-danger') + '">' +
                (available ? medicine.quantity + ' in stock' : 'unavailable') + '</span>' +
                '</div>' +
                '<h4>' + App.escape(medicine.name) + '</h4>' +
                '<p>' + App.escape(medicine.generic_name || medicine.category || 'Medicine') + '</p>' +
                '<div class="shop-card__meta"><span>' + App.escape(medicine.category || '—') + '</span>' +
                '<span class="shop-card__price">' + App.money(medicine.price) + '</span></div>' +
                '<div class="shop-card__actions">' + action + '</div>' +
                '</article>';
        }).join('') + '</div>';
    },

    /* Doughnut chart of the category mix. */
    renderCategoryChart: function (canvasId, centerId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;

        const rows = (RolePage.data.charts && RolePage.data.charts.category) || [];
        const colors = ['#4d57e9', '#00b894', '#7a4bf0', '#f39c12', '#e74c3c',
            '#2b2a72', '#00cec9', '#ef7d28', '#4b7bec', '#a29bfe'];

        if (RolePage.chart) {
            RolePage.chart.destroy();
            RolePage.chart = null;
        }

        RolePage.chart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: rows.length ? rows.map(function (row) { return row.category; }) : ['No data'],
                datasets: [{
                    data: rows.length ? rows.map(function (row) { return row.count; }) : [1],
                    backgroundColor: rows.length
                        ? rows.map(function (row, index) { return colors[index % colors.length]; })
                        : ['#e8ebf7'],
                    borderWidth: 0,
                    hoverOffset: 12,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            padding: 12,
                            color: '#6b7280',
                            font: { size: 11 }
                        }
                    }
                }
            }
        });

        const center = document.getElementById(centerId);
        if (center) {
            const total = rows.reduce(function (sum, row) { return sum + row.count; }, 0);
            center.textContent = total.toLocaleString('en-US');
        }
    },

    /* Actions shared by the role pages. */
    setStatus: function (orderId, status) {
        return apiCall('/api/orders/' + orderId, 'PATCH', { status: status })
            .then(function () {
                App.toast('Order marked as ' + status, 'success');
                RolePage.reload();
            })
            .catch(function (error) { App.toast(error.message, 'error'); });
    },

    restock: function (medicineId, amount) {
        return apiCall('/api/movements/', 'POST', {
            medicine_id: medicineId,
            change: amount,
            reason: 'purchase',
            reference: 'QUICK-RESTOCK',
            note: 'Quick restock from the role workspace'
        })
            .then(function () {
                App.toast('Added ' + amount + ' units to stock', 'success');
                RolePage.reload();
            })
            .catch(function (error) { App.toast(error.message, 'error'); });
    },

    addToCart: function (medicineId) {
        return apiCall('/api/cart/add', 'POST', { medicine_id: medicineId, quantity: 1 })
            .then(function () {
                App.toast('Added to your cart', 'success');
                App.loadCartCount();
                RolePage.reload();
            })
            .catch(function (error) { App.toast(error.message, 'error'); });
    },

    /* Re-render the page with fresh data. */
    reload: function () {
        if (typeof RolePage.onReload === 'function') RolePage.onReload();
        else RolePage.load(RolePage.render);
    }
};
