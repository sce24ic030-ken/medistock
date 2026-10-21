/* Medistock - Pharmacy workspace (pharmacist role).

   The pharmacist owns the catalogue, the expiry compliance and the
   dispensing queue, so this page leads with the expiry watchlist and the
   orders that still have to be handed over. */

function kpiValue(key) {
    const kpis = (RolePage.data && RolePage.data.kpis) || [];
    const found = kpis.filter(function (kpi) { return kpi.key === key; })[0];
    return found ? found.display : '0';
}

function renderWorkspace(data) {
    RolePage.renderGreeting({});
    RolePage.renderQuickActions('heroActions');
    RolePage.renderKpis('kpiGrid');

    /* Hero facts: the three numbers a pharmacist checks first. */
    RolePage.renderHeroFacts('heroFacts', [
        { icon: 'fa-pill', label: 'Dispensed (30d)', value: kpiValue('dispensed') },
        { icon: 'fa-box-open', label: 'Awaiting fulfilment', value: kpiValue('pending') },
        { icon: 'fa-truck-medical', label: 'Suppliers', value: kpiValue('suppliers') }
    ]);

    /* Expiry watchlist. */
    RolePage.renderStock('expiryList');
    const expiryChip = document.getElementById('expiryChip');
    if (expiryChip) expiryChip.textContent = kpiValue('expiring') + ' batches';

    /* Category mix. */
    RolePage.renderCategoryChart('categoryChart', 'categoryTotal');
    const categoryChip = document.getElementById('categoryChip');
    const categories = (data.charts && data.charts.category) || [];
    if (categoryChip) categoryChip.textContent = categories.length + ' categories';

    /* Fulfilment queue - the pharmacist can move an order along. */
    RolePage.renderOrders('queueList', { canUpdate: true });

    /* Alerts and activity. */
    RolePage.renderAlerts('alertsList', { action: true });
    const alertChip = document.getElementById('alertChip');
    if (alertChip) {
        const count = (data.alerts || []).length;
        alertChip.textContent = count;
        alertChip.className = 'panel-chip ' + (count ? 'chip-danger' : 'chip-good');
    }

    RolePage.renderActivity('activityList', { limit: 10 });
}

RolePage.onReload = function () {
    RolePage.load(renderWorkspace, ['pharmacist']);
};

document.addEventListener('DOMContentLoaded', function () {
    RolePage.load(renderWorkspace, ['pharmacist']);
});
