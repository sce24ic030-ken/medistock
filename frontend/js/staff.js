/* Medistock - Counter desk (staff role).

   The counter desk is the working surface of the shop floor: pick and pack the
   orders that are waiting, hand over what is packed and keep the shelf under
   control. The page therefore leads with the shift counters and the pick &
   pack queue instead of the catalogue overview. */

/* Read one staff KPI by key (orders_today, pending, packed, ...). */
function counterKpi(key) {
    const kpis = (RolePage.data && RolePage.data.kpis) || [];
    const found = kpis.filter(function (kpi) { return kpi.key === key; })[0];
    return found ? found.display : '0';
}

/* The four counters a counter staff member works with during a shift. */
function renderShiftStrip() {
    const strip = document.getElementById('shiftStrip');
    if (!strip) return;

    const tiles = [
        { key: 'orders_today', icon: 'fa-receipt', label: 'Orders today', tone: 'blue' },
        { key: 'pending', icon: 'fa-box-open', label: 'To pack', tone: 'orange' },
        { key: 'packed', icon: 'fa-hand-holding', label: 'Packed', tone: 'green' },
        { key: 'units_issued', icon: 'fa-boxes-stacked', label: 'Units issued', tone: 'red' }
    ];

    strip.innerHTML = tiles.map(function (tile) {
        return '<article class="stat-card ' + tile.tone + '">' +
            '<span class="stat-icon"><i class="fas ' + tile.icon + '"></i></span>' +
            '<div class="stat-value">' + App.escape(counterKpi(tile.key)) + '</div>' +
            '<div class="stat-label">' + App.escape(tile.label) + '</div>' +
            '</article>';
    }).join('');
}

function renderCounterDesk(data) {
    RolePage.renderGreeting({});
    RolePage.renderQuickActions('heroActions');
    RolePage.renderKpis('kpiGrid');

    /* Hero facts: the three numbers a counter staff member checks first. */
    RolePage.renderHeroFacts('heroFacts', [
        { icon: 'fa-receipt', label: 'Orders today', value: counterKpi('orders_today') },
        { icon: 'fa-box-open', label: 'To pack', value: counterKpi('pending') },
        { icon: 'fa-hand-holding', label: 'Ready to hand over', value: counterKpi('packed') }
    ]);

    /* Shift strip. */
    renderShiftStrip();

    /* Pick and pack queue - the staff can move an order along. */
    RolePage.renderOrders('queueList', { canUpdate: true });
    const queueChip = document.getElementById('queueChip');
    if (queueChip) {
        const toPack = (data.orders || []).filter(function (order) {
            return order.status === 'pending';
        }).length;
        queueChip.textContent = toPack + ' to pack';
        queueChip.className = 'panel-chip ' + (toPack ? 'chip-warn' : 'chip-good');
    }

    /* Shelf alerts - a batch can be topped up straight from the list. */
    RolePage.renderAlerts('alertsList', { action: true });
    const alertChip = document.getElementById('alertChip');
    if (alertChip) {
        const count = (data.alerts || []).length;
        alertChip.textContent = count;
        alertChip.className = 'panel-chip ' + (count ? 'chip-danger' : 'chip-good');
    }

    /* Restock list. */
    RolePage.renderStock('stockList', { action: true });
    const stockChip = document.getElementById('stockChip');
    if (stockChip) stockChip.textContent = counterKpi('low') + ' low';

    /* Today's movements. */
    RolePage.renderMovements('movementList');
    const movementChip = document.getElementById('movementChip');
    if (movementChip) movementChip.textContent = (data.movements || []).length + ' today';
}

RolePage.onReload = function () {
    RolePage.load(renderCounterDesk, ['staff']);
};

document.addEventListener('DOMContentLoaded', function () {
    RolePage.load(renderCounterDesk, ['staff']);
});
