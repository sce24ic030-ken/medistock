/* Medistock - shared sidebar for every signed-in page.

   The brand, the navigation and the user footer are rendered from here so the
   menu only has to be updated in one place when a tab is added. */
(function () {
    'use strict';

    window.MEDISTOCK = {
        name: 'Medistock',
        tagline: 'Smart Medicine Inventory Management System'
    };

    var GROUPS = [
        {
            label: 'Overview',
            items: [
                { href: 'dashboard.html', icon: 'fa-chart-line', text: 'Dashboard' },
                { href: 'medicines.html', icon: 'fa-capsules', text: 'Medicines' },
                { href: 'orders.html', icon: 'fa-receipt', text: 'Orders' },
                { href: 'cart.html', icon: 'fa-shopping-basket', text: 'Cart', badge: 'cartCount' }
            ]
        },
        {
            label: 'Inventory',
            items: [
                { href: 'alerts.html', icon: 'fa-bell', text: 'Smart Alerts' },
                { href: 'movements.html', icon: 'fa-right-left', text: 'Stock Ledger' },
                { href: 'suppliers.html', icon: 'fa-truck-medical', text: 'Suppliers' }
            ]
        },
        {
            label: 'Insights',
            items: [
                { href: 'reports.html', icon: 'fa-file-alt', text: 'Reports' },
                { href: 'feedback.html', icon: 'fa-comment-medical', text: 'Feedback' },
                { href: 'faqs.html', icon: 'fa-question-circle', text: 'FAQs & Contact' }
            ]
        },
        {
            label: 'Administration',
            items: [
                { href: 'users.html', icon: 'fa-users-cog', text: 'Users & Roles', adminOnly: true },
                { href: 'profile.html', icon: 'fa-user-gear', text: 'Profile' }
            ]
        }
    ];

    function currentFile() {
        var path = window.location.pathname.split('/').pop();
        return (path || 'dashboard.html').toLowerCase();
    }

    function renderBrand() {
        var sidebar = document.querySelector('.app-sidebar');
        if (!sidebar) return;

        var brand = sidebar.querySelector('.app-brand');
        if (!brand) {
            brand = document.createElement('a');
            sidebar.appendChild(brand);
        }

        brand.className = 'app-brand';
        brand.setAttribute('href', 'dashboard.html');
        brand.innerHTML =
            '<span class="app-brand-mark"><i class="fas fa-pills"></i></span>' +
            '<span class="app-brand-text">' + window.MEDISTOCK.name +
            '<small>Smart Medicine Inventory</small></span>';
    }

    function renderNav() {
        var sidebar = document.querySelector('.app-sidebar');
        if (!sidebar) return;

        var nav = sidebar.querySelector('.app-nav');
        if (!nav) {
            nav = document.createElement('nav');
            nav.className = 'app-nav';
            nav.setAttribute('aria-label', 'Main navigation');
            sidebar.appendChild(nav);
        }

        var current = currentFile();
        var html = '';

        GROUPS.forEach(function (group) {
            html += '<span class="app-nav-label">' + group.label + '</span>';
            group.items.forEach(function (item) {
                var active = item.href === current ? ' active' : '';
                var admin = item.adminOnly ? ' data-admin-only' : '';
                var badge = item.badge
                    ? '<span class="app-nav-badge" id="' + item.badge + '">0</span>'
                    : '';
                html += '<a class="app-nav-link' + active + '"' + admin + ' href="' + item.href + '">' +
                    '<i class="fas ' + item.icon + '"></i><span>' + item.text + '</span>' + badge +
                    '</a>';
            });
        });

        nav.innerHTML = html;
    }

    function renderFooter() {
        var sidebar = document.querySelector('.app-sidebar');
        if (!sidebar) return;

        var foot = sidebar.querySelector('.app-sidebar-foot');
        if (!foot) {
            foot = document.createElement('div');
            foot.className = 'app-sidebar-foot';
            sidebar.appendChild(foot);
        }

        foot.innerHTML =
            '<div class="app-user">' +
            '<span class="app-avatar"><i class="fas fa-user"></i></span>' +
            '<span class="app-user-meta"><strong id="userName">User</strong>' +
            '<small id="userRole">Signed in</small></span>' +
            '</div>' +
            '<a class="app-logout" href="#" id="appLogout" title="Log out" aria-label="Log out">' +
            '<i class="fas fa-sign-out-alt"></i></a>';
    }

    function render() {
        renderBrand();
        renderNav();
        renderFooter();
    }

    function boot() {
        // The sidebar exists in the markup, so render immediately (page scripts
        // that run right after this one expect the shell to be ready).
        if (document.querySelector('.app-sidebar')) {
            render();
            return;
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', render);
        } else {
            render();
        }
    }

    boot();
    window.MEDISTOCK.renderShell = render;
})();
