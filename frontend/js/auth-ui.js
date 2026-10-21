/* Shared behaviour for the auth pages (login / signup / admin / forgot password).
   Provides: password visibility toggle, submit loading state, alert rendering
   and an optional "remember email" helper backed by localStorage. */
(function () {
    'use strict';

    const REMEMBER_KEY = 'smi.rememberEmail';

    /* Toggle the loading state of a form's submit button. */
    function setLoading(form, loading) {
        if (!form) return;
        const button = form.querySelector('[type="submit"]');
        if (!button) return;

        button.classList.toggle('is-loading', loading);
        button.disabled = loading;

        const label = button.querySelector('.btn-label');
        if (!label) return;

        if (loading) {
            if (!button.dataset.originalLabel) {
                button.dataset.originalLabel = label.textContent;
            }
            label.textContent = button.dataset.loadingText || 'Please wait...';
        } else if (button.dataset.originalLabel) {
            label.textContent = button.dataset.originalLabel;
        }
    }

    /* Render a message inside an alert container without using innerHTML. */
    function showMessage(container, message, type) {
        if (!container) return;
        container.innerHTML = '';
        const alert = document.createElement('div');
        alert.className = 'alert alert-' + (type || 'danger') + ' auth-alert';
        alert.textContent = message;
        container.appendChild(alert);
    }

    function clearMessage(container) {
        if (container) container.innerHTML = '';
    }

    /* Show / hide password fields. */
    function setupPasswordToggles() {
        document.querySelectorAll('[data-toggle-password]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';

            button.addEventListener('click', function () {
                const input = document.getElementById(button.dataset.togglePassword);
                if (!input) return;

                const reveal = input.type === 'password';
                input.type = reveal ? 'text' : 'password';

                const icon = button.querySelector('i');
                if (icon) {
                    icon.className = reveal ? 'fas fa-eye-slash' : 'fas fa-eye';
                }
                button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
                input.focus();
            });
        });
    }

    /* "Remember email" — keeps the address between visits (never the password). */
    function loadRememberedEmail() {
        const checkbox = document.getElementById('rememberEmail');
        const email = document.getElementById('email');
        if (!checkbox || !email) return;

        try {
            const saved = localStorage.getItem(REMEMBER_KEY);
            if (saved) {
                email.value = saved;
                checkbox.checked = true;
            }
        } catch (error) {
            /* storage unavailable — ignore */
        }
    }

    function storeRememberedEmail() {
        const checkbox = document.getElementById('rememberEmail');
        const email = document.getElementById('email');
        if (!checkbox || !email) return;

        try {
            if (checkbox.checked) {
                localStorage.setItem(REMEMBER_KEY, email.value.trim());
            } else {
                localStorage.removeItem(REMEMBER_KEY);
            }
        } catch (error) {
            /* storage unavailable — ignore */
        }
    }

    /* Cycle the rotating word in the brand panel headline. */
    function setupRotatingWord() {
        const holder = document.getElementById('rotateWord');
        if (!holder) return;

        const words = Array.from(holder.querySelectorAll('.word'));
        if (words.length < 2) return;

        let index = 0;
        setInterval(function () {
            const current = words[index];
            index = (index + 1) % words.length;
            const next = words[index];

            current.classList.remove('is-active');
            current.classList.add('is-exit');
            next.classList.add('is-active');

            setTimeout(function () {
                current.classList.remove('is-exit');
            }, 560);
        }, 2800);
    }

    /* Count-up numbers in the brand panel stats.
       Uses a timer instead of requestAnimationFrame so the count still runs
       when the tab is not the foreground tab. */
    function setupCounters() {
        document.querySelectorAll('[data-count]').forEach(function (element) {
            const target = parseFloat(element.dataset.count);
            const suffix = element.dataset.suffix || '';
            const duration = 1500;
            const started = Date.now();

            function tick() {
                const progress = Math.min((Date.now() - started) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                element.textContent = Math.floor(target * eased).toLocaleString() + suffix;
                if (progress < 1) setTimeout(tick, 40);
            }

            tick();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        setupPasswordToggles();
        setupRotatingWord();
        setupCounters();
        loadRememberedEmail();

        document.querySelectorAll('[data-auth-form]').forEach(function (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                storeRememberedEmail();
                setLoading(form, true);
            });
        });
    });

    window.AuthUI = {
        setLoading: setLoading,
        showMessage: showMessage,
        clearMessage: clearMessage
    };
})();
