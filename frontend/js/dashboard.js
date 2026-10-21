/* Creative dashboard — live inventory overview for Smart Medicine Inventory. */

let categoryChart = null;
let expiryChart = null;

const CATEGORY_COLORS = [
    '#4d57e9', '#00b894', '#7a4bf0', '#f39c12', '#e74c3c',
    '#2b2a72', '#00cec9', '#ef7d28', '#4b7bec', '#a29bfe'
];

const ACTIVITY_ICONS = [
    { match: /login/i, icon: 'fa-right-to-bracket', tone: 't-teal' },
    { match: /logout/i, icon: 'fa-right-from-bracket', tone: 't-teal' },
    { match: /registration|signup/i, icon: 'fa-user-plus', tone: 't-teal' },
    { match: /added|create/i, icon: 'fa-plus-circle', tone: '' },
    { match: /updated|edit/i, icon: 'fa-pen', tone: '' },
    { match: /deleted|removed/i, icon: 'fa-trash', tone: 't-amber' },
    { match: /order|checkout/i, icon: 'fa-cart-shopping', tone: 't-teal' },
    { match: /password/i, icon: 'fa-key', tone: 't-amber' },
    { match: /stock/i, icon: 'fa-boxes-stacked', tone: '' },
    { match: /startup/i, icon: 'fa-power-off', tone: '' }
];

function activityStyle(action) {
    const text = action || '';
    for (let i = 0; i < ACTIVITY_ICONS.length; i++) {
        if (ACTIVITY_ICONS[i].match.test(text)) return ACTIVITY_ICONS[i];
    }
    return { icon: 'fa-circle-info', tone: '' };
}

/* ---------------------------------------------------------------- helpers */

function animateNumber(element, target, options) {
    if (!element) return;

    const opts = options || {};
    const decimals = opts.decimals || 0;
    const prefix = opts.prefix || '';
    const suffix = opts.suffix || '';
    const duration = opts.duration || 1100;

    function format(value) {
        return prefix + value.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }) + suffix;
    }

    // Timer based rather than requestAnimationFrame: rAF is paused in background
    // tabs, which would leave the counters stuck at zero.
    const started = performance.now();

    const timer = setInterval(function () {
        const progress = Math.min((performance.now() - started) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = format(target * eased);
        if (progress >= 1) {
            element.textContent = format(target);
            clearInterval(timer);
        }
    }, 16);
}

function setBar(id, percent) {
    const bar = document.getElementById(id);
    if (!bar) return;
    const value = Math.max(0, Math.min(100, percent || 0));
    bar.style.width = value + '%';
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function showNotice(message) {
    const holder = document.getElementById('apiNotice');
    if (!holder) return;
    holder.innerHTML = '';

    const notice = document.createElement('div');
    notice.className = 'dash-notice';
    notice.innerHTML = '<i class="fas fa-plug-circle-exclamation"></i><span></span>';
    notice.querySelector('span').textContent = message;
    holder.appendChild(notice);
}

function clearNotice() {
    const holder = document.getElementById('apiNotice');
    if (holder) holder.innerHTML = '';
}

/* ------------------------------------------------------------------ load */

async function loadDashboard() {
    try {
        const user = await apiCall('/api/auth/me', 'GET');
        if (!user.user) {
            window.location.href = 'index.html';
            return;
        }
        applyUser(user.user);

        const data = await apiCall('/api/dashboard/stats', 'GET');
        let alerts = [];
        try {
            const alertData = await apiCall('/api/dashboard/alerts', 'GET');
            alerts = alertData.alerts || [];
        } catch (alertError) {
            alerts = [];
        }

        renderDashboard(data, alerts);
        loadCartCount();
        clearNotice();
    } catch (error) {
        console.error(error);
        if (error && error.message && error.message.includes('401')) {
            window.location.href = 'index.html';
            return;
        }
        showNotice('Live API unreachable — start the backend (python app.py) to load real data. Showing the last known layout.');
    }
}

function applyUser(user) {
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = user.name || 'User';

    const roleEl = document.querySelector('.app-user-meta small');
    if (roleEl) {
        const labels = { admin: 'Administrator', pharmacist: 'Pharmacist', customer: 'Customer' };
        roleEl.textContent = labels[user.role] || user.role;
    }

    const hero = document.getElementById('heroName');
    if (hero) hero.textContent = (user.name || 'User').split(' ')[0];
}

/* --------------------------------------------------------------- render */

function renderDashboard(data, alerts) {
    const stats = data.stats || {};
    const total = stats.total_medicines || 0;
    const units = stats.total_stock_units || 0;
    const value = stats.total_stock_value || 0;
    const low = stats.low_stock || 0;
    const expiring = stats.expiring_soon || 0;
    const expired = stats.expired || 0;

    animateNumber(document.getElementById('heroUsers'), stats.total_users || 0);
    animateNumber(document.getElementById('heroOrders'), stats.total_orders || 0);
    animateNumber(document.getElementById('heroValue'), value, { prefix: '$', decimals: 2 });

    animateNumber(document.getElementById('totalMedicines'), total);
    animateNumber(document.getElementById('totalStockUnits'), units);
    animateNumber(document.getElementById('stockValue'), value, { prefix: '$', decimals: 2 });
    animateNumber(document.getElementById('lowStock'), low);
    animateNumber(document.getElementById('expiringSoon'), expiring);
    animateNumber(document.getElementById('expiredCount'), expired);

    const health = computeHealth(total, units, value, alerts, stats);
    renderHealth(health, total, units, value);
    renderAlerts(alerts, expired, expiring, low);
    renderActivities(data.recent_activities || []);
    renderCharts(data);
}

function computeHealth(total, units, value, alerts, stats) {
    const medicineMap = {};

    (alerts || []).forEach(function (alert) {
        const medicine = alert.medicine || {};
        const key = medicine.id !== undefined ? medicine.id : medicine.name;
        if (!medicineMap[key]) {
            medicineMap[key] = {
                types: {},
                quantity: medicine.quantity || 0,
                price: medicine.price || 0
            };
        }
        medicineMap[key].types[alert.type] = true;
    });

    const counts = { healthy: 0, low: 0, expiring: 0, expired: 0 };
    const segments = { healthy: 0, low: 0, expiring: 0, expired: 0 };
    let unhealthyUnits = 0;
    let unhealthyValue = 0;
    let flagged = 0;

    Object.keys(medicineMap).forEach(function (key) {
        const entry = medicineMap[key];
        const types = entry.types;

        const isExpired = !!types.expired;
        const isExpiring = !!types.expiring;
        const isLow = !!types.low_stock;

        // independent counters — a medicine can trigger more than one alert
        if (isLow) counts.low += 1;
        if (isExpiring) counts.expiring += 1;
        if (isExpired) counts.expired += 1;

        // exclusive segment for the stacked bar — worst status first
        if (isExpired) segments.expired += 1;
        else if (isExpiring) segments.expiring += 1;
        else if (isLow) segments.low += 1;

        flagged += 1;
        unhealthyUnits += entry.quantity;
        unhealthyValue += entry.quantity * entry.price;
    });

    if (!flagged) {
        counts.low = stats.low_stock || 0;
        counts.expiring = stats.expiring_soon || 0;
        counts.expired = stats.expired || 0;
        segments.low = counts.low;
        segments.expiring = counts.expiring;
        segments.expired = counts.expired;
        flagged = counts.low + counts.expiring + counts.expired;
    }

    segments.healthy = Math.max(0, total - flagged);
    counts.healthy = segments.healthy;

    return {
        groups: counts,
        segments: segments,
        healthyUnits: Math.max(0, units - unhealthyUnits),
        healthyValue: Math.max(0, value - unhealthyValue)
    };
}

function renderHealth(health, total, units, value) {
    const groups = health.groups;
    const safeTotal = total || 1;

    setText('healthPct', Math.round((groups.healthy / safeTotal) * 100) + '%');
    setText('legendHealthy', groups.healthy);
    setText('legendLow', groups.low);
    setText('legendExpiring', groups.expiring);
    setText('legendExpired', groups.expired);

    setBar('segHealthy', (health.segments.healthy / safeTotal) * 100);
    setBar('segLow', (health.segments.low / safeTotal) * 100);
    setBar('segExpiring', (health.segments.expiring / safeTotal) * 100);
    setBar('segExpired', (health.segments.expired / safeTotal) * 100);

    setBar('kpiMedBar', (groups.healthy / safeTotal) * 100);
    setText('kpiMedFoot', groups.healthy + ' healthy of ' + total + ' SKUs');

    setBar('kpiUnitsBar', units ? (health.healthyUnits / units) * 100 : 0);
    setText('kpiUnitsFoot', health.healthyUnits.toLocaleString('en-US') + ' of ' + units.toLocaleString('en-US') + ' units healthy');

    setBar('kpiValueBar', value ? (health.healthyValue / value) * 100 : 0);
    setText('kpiValueFoot', '$' + health.healthyValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' healthy value');

    const low = document.getElementById('kpiLowTrend');
    if (low) {
        const lowCount = groups.low;
        low.textContent = lowCount > 0 ? 'action' : 'clear';
        low.className = 'kpi-trend ' + (lowCount > 0 ? 't-warn' : 't-good');
    }
    setBar('kpiLowBar', (groups.low / safeTotal) * 100);
    setText('kpiLowFoot', groups.low + ' of ' + total + ' SKUs below 10 units');

    setBar('kpiExpBar', (groups.expiring / safeTotal) * 100);
    setText('kpiExpFoot', groups.expiring + ' of ' + total + ' SKUs within 30 days');

    const dead = document.getElementById('kpiExpTrend');
    if (dead) {
        dead.textContent = groups.expired > 0 ? 'critical' : 'clear';
        dead.className = 'kpi-trend ' + (groups.expired > 0 ? 't-bad' : 't-good');
    }
    setBar('kpiDeadBar', (groups.expired / safeTotal) * 100);
    setText('kpiDeadFoot', groups.expired + ' of ' + total + ' SKUs expired');
}

function renderAlerts(alerts, expired, expiring, low) {
    const panel = document.getElementById('alertsPanel');
    if (!panel) return;

    panel.innerHTML = '';

    const chip = document.getElementById('alertChip');
    if (chip) {
        chip.textContent = (alerts || []).length;
        chip.className = 'panel-chip ' + ((alerts || []).length ? 'chip-danger' : 'chip-good');
    }

    if (!alerts || alerts.length === 0) {
        panel.innerHTML = '<div class="empty-state"><i class="fas fa-shield-alt" style="color:#00b894"></i>' +
            '<strong style="display:block;color:#1f2340">All systems good</strong>' +
            'No low stock, expiring or expired medicines right now.</div>';
        return;
    }

    const order = { danger: 0, warning: 1 };
    const sorted = alerts.slice().sort(function (a, b) {
        return (order[a.severity] !== undefined ? order[a.severity] : 2) -
            (order[b.severity] !== undefined ? order[b.severity] : 2);
    });

    sorted.slice(0, 12).forEach(function (alert) {
        const medicine = alert.medicine || {};
        const row = document.createElement('div');
        row.className = 'alert-row alert-' + (alert.severity === 'danger' ? 'danger' : 'warning');

        const icon = document.createElement('i');
        icon.className = 'fas ' + (alert.type === 'expired' ? 'fa-skull-crossbones' :
            alert.type === 'expiring' ? 'fa-hourglass-half' : 'fa-arrow-trend-down');

        const body = document.createElement('div');

        const title = document.createElement('strong');
        title.textContent = medicine.name || 'Medicine';

        const detail = document.createElement('small');
        if (alert.type === 'expired') {
            detail.textContent = 'Expired on ' + formatDate(medicine.expiry_date) + ' · ' + medicine.quantity + ' units left';
        } else if (alert.type === 'expiring') {
            detail.textContent = 'Expires ' + formatDate(medicine.expiry_date) + ' · ' + medicine.quantity + ' units left';
        } else {
            detail.textContent = 'Only ' + medicine.quantity + ' units left · reorder soon';
        }

        body.appendChild(title);
        body.appendChild(detail);
        row.appendChild(icon);
        row.appendChild(body);
        panel.appendChild(row);
    });

    if (alerts.length > 12) {
        const more = document.createElement('div');
        more.className = 'empty-state';
        more.style.padding = '10px 12px';
        more.textContent = '+ ' + (alerts.length - 12) + ' more alerts';
        panel.appendChild(more);
    }
}

function renderActivities(activities) {
    const list = document.getElementById('activitiesList');
    if (!list) return;

    list.innerHTML = '';

    if (!activities.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i>No activity recorded yet.</div>';
        return;
    }

    const timeline = document.createElement('div');
    timeline.className = 'timeline';

    activities.forEach(function (activity) {
        const style = activityStyle(activity.action);
        const item = document.createElement('div');
        item.className = 'timeline-item ' + style.tone;

        const dot = document.createElement('span');
        dot.className = 'timeline-dot';

        const strong = document.createElement('strong');
        strong.textContent = activity.action || 'Activity';

        const time = document.createElement('time');
        time.textContent = formatDateTime(activity.created_at);

        const detail = document.createElement('small');
        detail.textContent = activity.details || '';

        item.appendChild(dot);
        item.appendChild(strong);
        item.appendChild(time);
        item.appendChild(detail);
        timeline.appendChild(item);
    });

    list.appendChild(timeline);
}

function renderCharts(data) {
    const categoryData = data.category_data || [];
    const canvas = document.getElementById('categoryChart');

    if (canvas) {
        const context = canvas.getContext('2d');
        if (categoryChart) categoryChart.destroy();

        const labels = categoryData.length ? categoryData.map(function (row) { return row.category; }) : ['No data'];
        const values = categoryData.length ? categoryData.map(function (row) { return row.count; }) : [1];

        categoryChart = new Chart(context, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: categoryData.length
                        ? categoryData.map(function (row, index) { return CATEGORY_COLORS[index % CATEGORY_COLORS.length]; })
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
                            padding: 14,
                            color: '#6b7280',
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const sum = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                                const share = sum ? Math.round((ctx.parsed / sum) * 100) : 0;
                                return ' ' + ctx.label + ': ' + ctx.parsed + ' units (' + share + '%)';
                            }
                        }
                    }
                }
            }
        });
    }

    const totalUnits = (data.category_data || []).reduce(function (sum, row) { return sum + row.count; }, 0);
    setText('categoryTotal', totalUnits.toLocaleString('en-US'));
    setText('categoryChip', (data.category_data || []).length + ' categories');

    const timelineCanvas = document.getElementById('expiryChart');
    if (timelineCanvas) {
        const timelineContext = timelineCanvas.getContext('2d');
        if (expiryChart) expiryChart.destroy();

        const timeline = data.expiry_timeline || [];
        const fill = timelineContext.createLinearGradient(0, 0, 0, 300);
        fill.addColorStop(0, 'rgba(243, 156, 18, 0.38)');
        fill.addColorStop(1, 'rgba(243, 156, 18, 0.02)');

        expiryChart = new Chart(timelineContext, {
            type: 'line',
            data: {
                labels: timeline.map(function (row) { return row.label; }),
                datasets: [{
                    label: 'Batches expiring',
                    data: timeline.map(function (row) { return row.count; }),
                    backgroundColor: fill,
                    borderColor: '#f39c12',
                    borderWidth: 3,
                    tension: 0.42,
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#f39c12',
                    pointBorderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) { return ' ' + ctx.parsed.y + ' batch(es) expiring'; }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0, color: '#9aa0b4' },
                        grid: { color: 'rgba(31,35,64,0.06)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9aa0b4' }
                    }
                },
                animation: { duration: 1400 }
            }
        });

        const upcoming = timeline.reduce(function (sum, row) { return sum + row.count; }, 0);
        setText('expiryChip', upcoming + ' batches in 90 days');
    }
}

/* --------------------------------------------------------------- format */

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* --------------------------------------------------------------- extras */

async function loadCartCount() {
    const badge = document.getElementById('cartCount');
    if (!badge) return;
    try {
        const data = await apiCall('/api/cart/', 'GET');
        badge.textContent = data.cart.length;
    } catch (error) {
        badge.textContent = '0';
    }
}

async function logout() {
    try {
        await apiCall('/api/auth/logout', 'POST');
    } catch (error) {
        /* ignore — the local session is dropped either way */
    }
    window.location.href = 'index.html';
}

/* Auto refresh every 30 seconds */
setInterval(loadDashboard, 30000);

loadDashboard();
