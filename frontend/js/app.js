/* Shared application-shell behaviour used by every signed-in page.
   Handles: off-canvas sidebar on mobile, active navigation state,
   topbar page title, the live clock and the tab switch.

   The tab switch is the important part: every page is a separate document,
   so the browser tears the old one down and paints the new one from
   scratch. Without help that shows up as a white flash and the numbers
   count up again on every tab. The helpers below fade the old page out,
   warm the cache for the page that is hovered and make sure no animation
   is replayed when a tab is opened for the second time. */
(function () {
    'use strict';

    var LEAVE_DELAY = 120;   // fade out before the browser swaps the document
    var prefetched = {};

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

        // A background tab throttles the timer, so the clock would show a
        // stale time when the user comes back to the tab.
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) tick();
        });
    }

    /* ------------------------------------------------------- tab switching */

    /* Only plain links to another page of this app are transitioned. */
    function isInternalLink(link) {
        if (!link || link.target === '_blank' || link.hasAttribute('download')) return false;
        if (link.protocol && link.protocol !== 'http:' && link.protocol !== 'https:') return false;
        if (link.host && link.host !== window.location.host) return false;

        var href = link.getAttribute('href');
        if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return false;

        return true;
    }

    function progressBar() {
        var bar = document.getElementById('appProgress');
        if (bar) return bar;

        bar = document.createElement('div');
        bar.id = 'appProgress';
        bar.className = 'app-progress';
        document.body.appendChild(bar);
        return bar;
    }

    /* Fade the current page out and move on - the swap looks deliberate
       instead of a blink. */
    function leaveTo(url) {
        document.documentElement.classList.add('is-leaving');
        progressBar().classList.add('is-running');

        setTimeout(function () {
            window.location.href = url;
        }, LEAVE_DELAY);

        // Safety net: if the browser refuses to navigate the page must not
        // stay invisible.
        setTimeout(function () {
            document.documentElement.classList.remove('is-leaving');
            progressBar().classList.remove('is-running');
        }, LEAVE_DELAY + 1500);
    }

    /* Warm the browser cache so the next tab opens without a delay. */
    function prefetch(url) {
        if (!url || prefetched[url]) return;
        prefetched[url] = true;

        try {
            var request = fetch(url, { credentials: 'same-origin' });
            if (request && request.catch) request.catch(function () { /* best effort */ });
        } catch (error) {
            /* prefetching is optional */
        }
    }

    function setupTabSwitch() {
        document.addEventListener('click', function (event) {
            if (event.defaultPrevented || event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            var link = event.target && event.target.closest
                ? event.target.closest('a[href]')
                : null;

            if (!link || !isInternalLink(link)) return;

            var url = link.href;
            if (!url || url === window.location.href) {
                event.preventDefault();
                return;
            }

            event.preventDefault();
            leaveTo(url);
        });

        // Warm the page that is about to be opened.
        document.addEventListener('mouseover', function (event) {
            var link = event.target && event.target.closest
                ? event.target.closest('a[href]')
                : null;
            if (!link || !isInternalLink(link)) return;
            prefetch(link.href);
        });

        document.addEventListener('focusin', function (event) {
            var link = event.target && event.target.closest
                ? event.target.closest('a[href]')
                : null;
            if (!link || !isInternalLink(link)) return;
            prefetch(link.href);
        });
    }

    /* Keep the numbers still while the tab is in the background: a throttled
       timer would leave a counter half way and it would jump as soon as the
       user comes back. */
    function setupSettle() {
        document.addEventListener('visibilitychange', function () {
            if (typeof App !== 'undefined' && App.settleNumbers) App.settleNumbers();
        });

        // The browser restored the page from its back/forward cache.
        window.addEventListener('pageshow', function (event) {
            if (!event.persisted) return;
            if (typeof App !== 'undefined' && App.settleNumbers) App.settleNumbers();
            startClockTick();
        });
    }

    function startClockTick() {
        var clock = document.getElementById('appClock');
        if (!clock) return;
        clock.textContent = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit'
        });
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

        setupTabSwitch();
        setupSettle();
    });
})();
