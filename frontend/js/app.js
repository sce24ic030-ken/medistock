/* Shared application-shell behaviour used by every signed-in page.
   Handles: off-canvas sidebar on mobile, active navigation state,
   topbar page title and the live clock. */
(function () {
    'use strict';

    function setSidebarState(open) {
        var sidebar = document.getElementById('appSidebar');
        var scrim = document.getElementById('appScrim');
        if (sidebar) sidebar.classList.toggle('is-open', open);
        if (scrim) scrim.classList.toggle('is-visible', open);
    }

    function markActiveLink() {
        var current = (window.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
        var links = Array.prototype.slice.call(document.querySelectorAll('.app-nav-link'));
        if (!links.length) return;

        var match = links.filter(function (link) {
            return (link.getAttribute('href') || '').toLowerCase() === current;
        });

        if (!match.length) return;

        links.forEach(function (link) { link.classList.remove('active'); });
        match.forEach(function (link) { link.classList.add('active'); });
    }

    function applyPageMeta() {
        var title = document.body.getAttribute('data-page-title');
        var subtitle = document.body.getAttribute('data-page-sub');
        var titleEl = document.getElementById('appPageTitle');
        var subtitleEl = document.getElementById('appPageSub');

        if (title && titleEl) titleEl.textContent = title;
        if (subtitle && subtitleEl) subtitleEl.textContent = subtitle;
    }

    function startClock() {
        var clock = document.getElementById('appClock');
        if (!clock) return;

        function tick() {
            clock.textContent = new Date().toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            });
        }

        tick();
        setInterval(tick, 1000);
    }

    document.addEventListener('DOMContentLoaded', function () {
        var burger = document.getElementById('appBurger');
        var scrim = document.getElementById('appScrim');

        if (burger) {
            burger.addEventListener('click', function () {
                var sidebar = document.getElementById('appSidebar');
                setSidebarState(!sidebar || !sidebar.classList.contains('is-open'));
            });
        }

        if (scrim) scrim.addEventListener('click', function () { setSidebarState(false); });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') setSidebarState(false);
        });

        document.querySelectorAll('.app-nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                if (window.innerWidth < 992) setSidebarState(false);
            });
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth >= 992) setSidebarState(false);
        });

        markActiveLink();
        applyPageMeta();
        startClock();
    });
})();
