/* Medistock - Orders tab

   Counter staff (admin, pharmacist, staff) work the full order register and
   move orders through the fulfilment states. A customer only ever sees their
   own orders, so the page is relabelled and the counter actions disappear. */
let orders = [];
let orderSummary = {};
let currentStatus = 'all';
let medicineCatalogue = [];

const COUNTER_ROLES = ['admin', 'pharmacist', 'staff'];

function setKpiLabel(valueId, text) {
    const value = document.getElementById(valueId);
    const card = value ? value.closest('.kpi-card') : null;
    const label = card ? card.querySelector('.kpi-label') : null;
    if (label) label.textContent = text;
}

function renderOrderSummary(summary) {
    orderSummary = summary || {};

    document.getElementById('kpiOrders').textContent = App.number(orderSummary.total_orders);
    document.getElementById('kpiRevenue').textContent = App.money(orderSummary.total_revenue);
    document.getElementById('kpiAvg').textContent = App.money(orderSummary.avg_order);
    document.getElementById('kpiUnits').textContent = App.number(orderSummary.units_sold);

    const total = Math.max(orderSummary.total_orders || 0, 1);
    document.getElementById('kpiOrdersBar').style.width = '100%';
    document.getElementById('kpiRevenueBar').style.width = '100%';
    document.getElementById('kpiAvgBar').style.width = Math.min(100, (orderSummary.avg_order / 60) * 100) + '%';
    document.getElementById('kpiUnitsBar').style.width = Math.min(100, (orderSummary.units_sold / 60) * 100) + '%';

    document.getElementById('kpiOrdersFoot').textContent =
        (orderSummary.completed || 0) + ' completed · ' + (orderSummary.pending || 0) + ' in progress';

    document.getElementById('kpiRevenueFoot').textContent =
        'Gross value of all recorded orders';

    document.getElementById('kpiAvgFoot').textContent =
        orderSummary.total_orders ? 'Across ' + orderSummary.total_orders + ' orders' : 'No orders yet';

    const pendingChip = document.getElementById('kpiPendingTrend');
    pendingChip.textContent = orderSummary.pending ? orderSummary.pending + ' open' : 'clear';
    pendingChip.className = 'kpi-trend ' + (orderSummary.pending ? 't-warn' : 't-good');

    document.getElementById('kpiUnitsFoot').textContent =
        (orderSummary.cancelled || 0) + ' cancelled orders excluded';
}

function renderOrders() {
    const tbody = document.getElementById('ordersTable');

    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">' +
            '<i class="fas fa-inbox fa-2x d-block mb-2"></i>No orders match this filter yet.</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(function (order) {
        const itemCount = (order.items || []).reduce(function (sum, item) {
            return sum + item.quantity;
        }, 0);

        const customer = order.customer
            ? '<span class="row-strong">' + App.escape(order.customer.name) + '</span>' +
              '<span class="row-sub">' + App.escape(order.customer.email) + '</span>'
            : '<span class="row-sub">Walk-in / staff</span>';

        const actions =
            '<button class="icon-btn" title="View details" onclick="viewOrder(' + order.id + ')"><i class="fas fa-eye"></i></button>';

        return '<tr>' +
            '<td><span class="row-strong">#ORD-' + String(order.id).padStart(4, '0') + '</span>' +
            '<span class="row-sub">' + (order.items || []).length + ' line item(s)</span></td>' +
            '<td>' + App.date(order.created_at) + '</td>' +
            '<td>' + customer + '</td>' +
            '<td>' + itemCount + ' unit(s)</td>' +
            '<td><strong>' + App.money(order.total_amount) + '</strong></td>' +
            '<td><span class="badge ' + App.statusBadge(order.status) + '">' + App.escape(order.status) + '</span></td>' +
            '<td>' + actions + '</td>' +
            '</tr>';
    }).join('');
}

function loadOrders() {
    const search = document.getElementById('orderSearch').value.trim();
    let url = '/api/orders/?';
    if (search) url += 'search=' + encodeURIComponent(search) + '&';
    if (currentStatus !== 'all') url += 'status=' + currentStatus;

    return apiCall(url, 'GET')
        .then(function (data) {
            orders = data.orders || [];
            renderOrderSummary(data.summary);
            renderOrders();
        })
        .catch(function (error) {
            App.toast(error.message, 'error');
            document.getElementById('ordersTable').innerHTML =
                '<tr><td colspan="7" class="text-center text-danger py-4">' + App.escape(error.message) + '</td></tr>';
        });
}

function viewOrder(id) {
    apiCall('/api/orders/' + id, 'GET')
        .then(function (data) {
            const order = data.order;
            const rows = (order.items || []).map(function (item) {
                const name = item.medicine ? item.medicine.name : 'Medicine #' + item.medicine_id;
                return '<tr><td>' + App.escape(name) + '</td>' +
                    '<td>' + item.quantity + '</td>' +
                    '<td>' + App.money(item.price_at_purchase) + '</td>' +
                    '<td class="text-end">' + App.money(item.price_at_purchase * item.quantity) + '</td></tr>';
            }).join('');

            const customer = order.customer ? order.customer.name : 'Walk-in customer';

            document.getElementById('orderDetail').innerHTML =
                '<div class="d-flex justify-content-between align-items-center mb-3">' +
                '<div><h5 class="mb-0">Order #ORD-' + String(order.id).padStart(4, '0') + '</h5>' +
                '<small class="text-muted">' + App.dateTime(order.created_at) + ' · ' + App.escape(customer) + '</small></div>' +
                '<span class="badge ' + App.statusBadge(order.status) + '">' + App.escape(order.status) + '</span>' +
                '</div>' +
                '<div class="table-responsive"><table class="table"><thead><tr>' +
                '<th>Medicine</th><th>Qty</th><th>Unit price</th><th class="text-end">Amount</th>' +
                '</tr></thead><tbody>' + (rows || '<tr><td colspan="4" class="text-center text-muted">No items</td></tr>') +
                '</tbody></table></div>' +
                '<div class="d-flex justify-content-end mt-2"><div class="text-end">' +
                '<small class="text-muted d-block">Order total</small>' +
                '<strong style="font-size:1.25rem;color:var(--brand-ink)">' + App.money(order.total_amount) + '</strong>' +
                '</div></div>' +
                (App.user && ['admin', 'pharmacist', 'staff'].indexOf(App.user.role) !== -1
                    ? '<hr><small class="text-muted d-block mb-2">Update fulfilment status</small>' +
                      '<div class="d-flex gap-2 flex-wrap">' +
                      ['pending', 'packed', 'completed', 'cancelled'].map(function (status) {
                          return '<button class="chip-filter' + (status === order.status ? ' active' : '') +
                              '" onclick="setOrderStatus(' + order.id + ",'" + status + "')'>" + status + '</button>';
                      }).join('') +
                      '</div>'
                    : '');

            new bootstrap.Modal(document.getElementById('orderModal')).show();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function setOrderStatus(id, status) {
    apiCall('/api/orders/' + id, 'PATCH', { status: status })
        .then(function () {
            App.toast('Order marked as ' + status, 'success');
            bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide();
            loadOrders();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function loadMedicinesForOrder() {
    return apiCall('/api/medicines/', 'GET')
        .then(function (data) {
            medicineCatalogue = data.medicines || [];
            const select = document.getElementById('orderMedicine');
            select.innerHTML = medicineCatalogue.map(function (med) {
                return '<option value="' + med.id + '">' + App.escape(med.name) +
                    ' — ' + med.quantity + ' in stock — ' + App.money(med.price) + '</option>';
            }).join('');
        });
}

function createOrder() {
    const medicineId = document.getElementById('orderMedicine').value;
    const quantity = parseInt(document.getElementById('orderQty').value, 10);
    const status = document.getElementById('orderStatus').value;

    if (!medicineId || !quantity || quantity < 1) {
        App.toast('Choose a medicine and a valid quantity', 'error');
        return;
    }

    apiCall('/api/orders/', 'POST', {
        items: [{ medicine_id: parseInt(medicineId, 10), quantity: quantity }],
        status: status
    })
        .then(function (data) {
            App.toast('Order #' + data.order.id + ' recorded', 'success');
            bootstrap.Modal.getInstance(document.getElementById('newOrderModal')).hide();
            loadOrders();
        })
        .catch(function (error) { App.toast(error.message, 'error'); });
}

function exportOrders() {
    const rows = [['Order', 'Date', 'Customer', 'Items', 'Total', 'Status']];
    orders.forEach(function (order) {
        const units = (order.items || []).reduce(function (sum, item) { return sum + item.quantity; }, 0);
        rows.push([
            'ORD-' + String(order.id).padStart(4, '0'),
            App.date(order.created_at),
            order.customer ? order.customer.name : 'Walk-in',
            units,
            order.total_amount,
            order.status
        ]);
    });
    App.exportCsv('medistock-orders.csv', rows);
    App.toast('Order register exported', 'success');
}

document.addEventListener('DOMContentLoaded', function () {
    App.init().then(function (user) {
        if (!user) return;

        const isCustomer = user.role === 'customer';

        if (isCustomer) {
            document.body.setAttribute('data-page-title', 'My Orders');
            document.body.setAttribute('data-page-sub', 'Every purchase you made, order by order');
            setKpiLabel('kpiOrders', 'My Orders');
            setKpiLabel('kpiRevenue', 'Total Spend');
            setKpiLabel('kpiAvg', 'Average Spend');
            setKpiLabel('kpiUnits', 'Items Bought');
        }

        loadOrders();
        if (!isCustomer) loadMedicinesForOrder();

        document.getElementById('orderSearch').addEventListener('input', function (event) {
            clearTimeout(window.__orderSearchTimer);
            window.__orderSearchTimer = setTimeout(loadOrders, 250);
        });

        document.querySelectorAll('.chip-filter[data-status]').forEach(function (chip) {
            chip.addEventListener('click', function () {
                document.querySelectorAll('.chip-filter[data-status]').forEach(function (other) {
                    other.classList.remove('active');
                });
                chip.classList.add('active');
                currentStatus = chip.getAttribute('data-status');
                loadOrders();
            });
        });

        const newOrderBtn = document.getElementById('newOrderBtn');
        if (newOrderBtn) {
            newOrderBtn.addEventListener('click', function () {
                new bootstrap.Modal(document.getElementById('newOrderModal')).show();
            });
        }

        document.getElementById('createOrderBtn').addEventListener('click', createOrder);
        document.getElementById('exportOrders').addEventListener('click', exportOrders);
    });
});
