let stockData = [];

async function init() {
    const user = await App.init({ roles: ['admin', 'pharmacist'] });
    if (!user) return;

    loadAllReports();
}

async function loadAllReports() {
    await loadStockReport();
    await loadLowStockReport();
    await loadExpiringReport();
    await loadExpiredReport();
    await loadActivityReport();
}

async function loadStockReport() {
    try {
        const data = await apiCall('/api/reports/stock', 'GET');
        stockData = data.report;
        const tbody = document.getElementById('stockReportTable');
        tbody.innerHTML = '';
        
        data.report.forEach(item => {
            let badgeClass = 'badge-success';
            if (item.status === 'Expired') badgeClass = 'badge-danger';
            else if (item.status === 'Expiring Soon' || item.status === 'Low Stock') badgeClass = 'badge-warning';
            
            tbody.innerHTML += `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.name}</td>
                    <td>${item.category || '-'}</td>
                    <td>${item.quantity}</td>
                    <td>$${item.price.toFixed(2)}</td>
                    <td>$${item.total_value.toFixed(2)}</td>
                    <td>${item.expiry_date}</td>
                    <td><span class="badge ${badgeClass}">${item.status}</span></td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

async function loadLowStockReport() {
    try {
        const data = await apiCall('/api/reports/low-stock', 'GET');
        const tbody = document.getElementById('lowStockTable');
        tbody.innerHTML = '';
        if (data.medicines.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No low stock items</td></tr>';
            return;
        }
        data.medicines.forEach(med => {
            tbody.innerHTML += `
                <tr>
                    <td>${med.name}</td>
                    <td>${med.category || '-'}</td>
                    <td class="text-danger"><strong>${med.quantity}</strong></td>
                    <td>$${med.price.toFixed(2)}</td>
                    <td>${med.expiry_date}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

async function loadExpiringReport() {
    try {
        const data = await apiCall('/api/reports/expiring', 'GET');
        const tbody = document.getElementById('expiringTable');
        tbody.innerHTML = '';
        if (data.medicines.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No medicines expiring soon</td></tr>';
            return;
        }
        data.medicines.forEach(med => {
            tbody.innerHTML += `
                <tr>
                    <td>${med.name}</td>
                    <td>${med.category || '-'}</td>
                    <td>${med.quantity}</td>
                    <td>$${med.price.toFixed(2)}</td>
                    <td>${med.expiry_date}</td>
                    <td class="text-warning"><strong>${med.days_to_expire} days</strong></td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

async function loadExpiredReport() {
    try {
        const data = await apiCall('/api/reports/expired', 'GET');
        const tbody = document.getElementById('expiredTable');
        tbody.innerHTML = '';
        if (data.medicines.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No expired medicines</td></tr>';
            return;
        }
        data.medicines.forEach(med => {
            tbody.innerHTML += `
                <tr>
                    <td>${med.name}</td>
                    <td>${med.category || '-'}</td>
                    <td>${med.quantity}</td>
                    <td>$${med.price.toFixed(2)}</td>
                    <td>${med.expiry_date}</td>
                    <td class="text-danger"><strong>${med.days_expired} days ago</strong></td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

async function loadActivityReport() {
    try {
        const data = await apiCall('/api/reports/activity', 'GET');
        const tbody = document.getElementById('activityTable');
        tbody.innerHTML = '';
        if (data.activities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No activities</td></tr>';
            return;
        }
        data.activities.forEach(act => {
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(act.created_at).toLocaleString()}</td>
                    <td>${act.user ? act.user.name : 'System'}</td>
                    <td><strong>${act.action}</strong></td>
                    <td>${act.details || '-'}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

function exportCSV() {
    if (stockData.length === 0) {
        alert('No data to export');
        return;
    }
    let csv = 'ID,Name,Category,Quantity,Price,Total Value,Expiry Date,Status\n';
    stockData.forEach(item => {
        csv += `${item.id},"${item.name}","${item.category || ''}",${item.quantity},${item.price},${item.total_value},${item.expiry_date},${item.status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicine_stock_report.csv';
    a.click();
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
