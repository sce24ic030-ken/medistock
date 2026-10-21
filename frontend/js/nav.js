/* Medistock - shared sidebar for every signed-in page.

   The brand, the navigation and the user footer are rendered from here so the
   menu only has to be updated in one place when a tab is added.

   Every navigation entry declares the roles that may see it ("roles"). The
   sidebar renders all of them and hides the ones that do not belong to the
   signed-in user, which means each role ends up with its own menu. */
(function () {
    'use strict';

    var ALL = ['admin', 'pharmacist', 'staff', 'customer'];
    var COUNTER = ['admin', 'pharmacist', 'staff'];
    var MANAGEMENT = ['admin', 'pharmacist'];

    window.MEDISTOCK = window.MEDISTOCK || {};
    window.MEDISTOCK.name = 'Medistock';
    window.MEDISTOCK.tagline = 'Smart Medicine Inventory Management System';

    var GROUPS = [
        {
            label: 'Overview',
            items: [
                { href: 'dashboard.html', icon: 'fa-chart-line', text: 'Dashboard', roles: ['admin'], home: true },
                { href: 'pharmacist.html', icon: 'fa-user-graduate', text: 'Workspace', roles: ['pharmacist'], home: true },
                { href: 'staff.html', icon: 'fa-user-tie', text: 'Counter desk', roles: ['staff'], home: true },
                { href: 'customer.html', icon: 'fa-house', text: 'Home', roles: ['customer'], home: true },
                { href: 'medicines.html', icon: 'fa-capsules', text: 'Medicines', roles: COUNTER },
                { href: 'shop.html', icon: 'fa-store', text: 'Shop medicines', roles: ['customer'] },
                { href: 'orders.html', icon: 'fa-receipt', text: 'Orders', roles: COUNTER },
                { href: 'orders.html', icon: 'fa-receipt', text: 'My orders', roles: ['customer'] },
                { href: 'cart.html', icon: 'fa-shopping-basket', text: 'Cart', badge: 'cartCount', roles: ALL }
            ]
        },
        {
            label: 'Inventory',
            items: [
                { href: 'alerts.html', icon: 'fa-bell', text: 'Smart Alerts', roles: COUNTER },
                { href: 'movements.html', icon: 'fa-right-left', text: 'Stock Ledger', roles: COUNTER },
                { href: 'suppliers.html', icon: 'fa-truck-medical', text: 'Suppliers', roles: COUNTER }
            ]
        },
        {
            label: 'Insights',
            items: [
                { href: 'reports.html', icon: 'fa-file-alt', text: 'Reports', roles: MANAGEMENT },
                { href: 'feedback.html', icon: 'fa-comment-medical', text: 'Feedback', roles: ALL },
                { href: 'faqs.html', icon: 'fa-question-circle', text: 'FAQs & Contact', roles: ALL }
            ]
        },
        {
            label: 'Administration',
            items: [
                { href: 'users.html', icon: 'fa-users-cog', text: 'Users & Roles', roles: ['admin'] },
                { href: 'profile.html', icon: 'fa-user-gear', text: 'Profile', roles: ALL }
            ]
        }
    ];

    function currentFile() {
        var path = window.location.pathname.split('/').pop();
        return (path || 'dashboard.html').toLowerCase();
    }

    /* Which link is the home page of a role? */
    function homeLinkFor(role) {
        for (var g = 0; g < GROUPS.length; g++) {
            for (var i = 0; i < GROUPS[g].items.length; i++) {
                var item = GROUPS[g].items[i];
                if (item.home && item.roles.indexOf(role) !== -1) return item.href;
            }
        }
        return 'dashboard.html';
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
        brand.setAttribute('href', window.MEDISTOCK.homeForRole
            ? window.MEDISTOCK.homeForRole()
            : 'dashboard.html');
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
            var links = '';

            group.items.forEach(function (item) {
                var active = item.href === current ? ' active' : '';
                var roles = item.roles || ALL;
                var badge = item.badge
                    ? '<span class="app-nav-badge" id="' + item.badge + '">0</span>'
                    : '';
                links += '<a class="app-nav-link' + active + '" data-roles="' + roles.join(',') + '" href="' + item.href + '">' +
                    '<i class="fas ' + item.icon + '"></i><span>' + item.text + '</span>' + badge +
                    '</a>';
            });

            html += '<div class="app-nav-group"><span class="app-nav-label">' + group.label + '</span>' + links + '</div>';
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

    /* Hide everything the signed-in role may not use.

       Works on any element carrying a data-roles attribute, so a page can
       also hide a button with data-roles="admin" the same way. */
    function applyRoleVisibility(role) {
        if (!role) return;

        // The brand always points at the home page of the signed-in role.
        var brand = document.querySelector('.app-brand');
        if (brand) brand.setAttribute('href', homeLinkFor(role));

        document.querySelectorAll('[data-roles]').forEach(function (el) {
            var roles = (el.getAttribute('data-roles') || '')
                .split(',')
                .map(function (value) { return value.trim(); })
                .filter(Boolean);

            var allowed = roles.length === 0 || roles.indexOf(role) !== -1;
            el.style.display = allowed ? '' : 'none';
        });

        // A group whose links are all hidden loses its label as well.
        document.querySelectorAll('.app-nav-group').forEach(function (group) {
            var visible = group.querySelectorAll('.app-nav-link:not([style*="display: none"])');
            var hidden = group.querySelectorAll('.app-nav-link[style*="display: none"]');
            group.style.display = (visible.length === 0 && hidden.length > 0) ? 'none' : '';
        });
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
        } else if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', render);
        } else {
            render();
        }
    }

    boot();
    window.MEDISTOCK.renderShell = render;
    window.MEDISTOCK.applyRoleVisibility = applyRoleVisibility;
    window.MEDISTOCK.homeLinkFor = homeLinkFor;
    window.MEDISTOCK.homeForRole = homeForRole;
    window.MEDISTOCK.labelForRole = labelForRole;
})();
