/* Medistock - "My Pharmacy" home page (customer role).

   The customer console is deliberately warmer than the staff workspaces: it
   answers "what did I order, where is it and what can I buy today" instead of
   talking about stock compliance. The order rows carry a small tracker so the
   customer can follow an order without opening the orders page. */

(function () {
    'use strict';

    /* The four steps a customer sees on every order. */
    const ORDER_STEPS = ['Placed', 'Packed', 'Handed over', 'Completed'];

    /* How many steps are done and which one is the current one.
       - pending   : placed, waiting to be packed
       - packed    : packed, waiting to be handed over
       - completed : everything is done
       - cancelled : stopped after it was placed */
    const ORDER_TRACK_STATE = {
        pending: { done: 1, current: 1 },
        packed: { done: 2, current: 2 },
        completed: { done: 4, current: -1 },
        cancelled: { done: 1, current: -1 }
    };

    function kpiValue(key) {
        const kpis = (RolePage.data && RolePage.data.kpis) || [];
        const found = kpis.filter(function (kpi) { return kpi.key === key; })[0];
        return found ? found.display : '0';
    }

    /* Money KPIs carry their currency in the prefix. */
    function kpiMoney(key) {
        const kpis = (RolePage.data && RolePage.data.kpis) || [];
        const found = kpis.filter(function (kpi) { return kpi.key === key; })[0];
        if (!found) return App.money(0);
        return (found.prefix || '') + found.display + (found.suffix || '');
    }

    /* The four step tracker of a single order. */
    function renderOrderTrack(status) {
        const state = ORDER_TRACK_STATE[status] || { done: 0, current: 0 };

        const steps = ORDER_STEPS.map(function (label, index) {
            let cls = '';
            if (index < state.done) cls = 'done';
            else if (index === state.current) cls = 'current';

            return '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + App.escape(label) + '</span>';
        }).join('');

        const note = status === 'cancelled'
            ? '<small style="display:block;margin-top:6px;color:#c0392b;font-weight:700;">This order was cancelled.</small>'
            : '';

        return '<div class="order-track">' + steps + '</div>' + note;
    }

    /* The customer's own orders as queue rows with a tracker underneath. */
    function renderMyOrders(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const orders = (RolePage.data && RolePage.data.orders) || [];

        if (!orders.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i>' +
                '<h3>No orders yet</h3>' +
                '<p>Your first order will show up here with its live status.</p>' +
                '<a class="btn btn-primary" href="shop.html">Start shopping</a></div>';
            return;
        }

        container.innerHTML = orders.map(function (order) {
            const items = order.items || [];
            const units = items.reduce(function (sum, item) {
                return sum + (Number(item.quantity) || 0);
            }, 0);

            const chips = items.map(function (item) {
                const name = item.medicine ? item.medicine.name : 'Medicine #' + item.medicine_id;
                return '<span>' + App.escape(name) + ' x' + App.escape(item.quantity) + '</span>';
            }).join('');

            const status = order.status || 'pending';

            return '<div>' +
                '<div class="queue-card">' +
                '<div class="queue-card__id">#' + String(order.id).padStart(4, '0') +
                '<small>' + App.escape(status) + '</small></div>' +
                '<div class="queue-card__body">' +
                '<strong>' + items.length + ' medicine' + (items.length === 1 ? '' : 's') +
                ' · ' + units + ' unit' + (units === 1 ? '' : 's') + '</strong>' +
                '<small>' + App.dateTime(order.created_at) + '</small>' +
                '<div class="queue-card__items">' + chips + '</div>' +
                '</div>' +
                '<div class="queue-card__side">' +
                '<span class="queue-card__total">' + App.money(order.total_amount) + '</span>' +
                '<span class="badge ' + App.statusBadge(status) + '">' + App.escape(status) + '</span>' +
                '<a class="icon-btn" title="View order" href="orders.html"><i class="fas fa-eye"></i></a>' +
                '</div>' +
                '</div>' +
                renderOrderTrack(status) +
                '</div>';
        }).join('');
    }

    function renderMyPharmacy(data) {
        RolePage.renderGreeting({});
        RolePage.renderQuickActions('heroActions');
        RolePage.renderKpis('kpiGrid');

        /* Hero facts: the three numbers a customer checks first. */
        RolePage.renderHeroFacts('heroFacts', [
            { icon: 'fa-receipt', label: 'My orders', value: kpiValue('my_orders') },
            { icon: 'fa-indian-rupee-sign', label: 'Total spend', value: kpiMoney('spend') },
            { icon: 'fa-shopping-basket', label: 'Items in cart', value: kpiValue('cart') }
        ]);

        /* The customer's own orders with a tracker. */
        renderMyOrders('myOrders');

        /* Recommended medicines - the customer can add them to the cart. */
        RolePage.renderMedicines('featuredGrid', { canOrder: true });

        /* Availability per therapeutic area. */
        RolePage.renderCategoryChart('categoryChart', 'categoryTotal');
        const categoryChip = document.getElementById('categoryChip');
        const categories = (data.charts && data.charts.category) || [];
        if (categoryChip) categoryChip.textContent = categories.length + ' categories';
    }

    RolePage.onReload = function () {
        RolePage.load(renderMyPharmacy, ['customer']);
    };

    document.addEventListener('DOMContentLoaded', function () {
        RolePage.load(renderMyPharmacy, ['customer']);
    });
})();
