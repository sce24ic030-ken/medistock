/* Shared behaviour for the auth pages (login / signup / admin / forgot password).
   Provides: password visibility toggle, submit loading state, alert rendering,
   a "remember me" helper backed by localStorage and the demo account chips.

   Everything the user typed or signed in with is kept, so nothing is lost
   when the page is reloaded, restored from the back/forward cache or when
   the tab is put in the background. */
(function () {
    'use strict';

    const REMEMBER_KEY = 'smi.rememberEmail';
    const EMAIL_KEY = 'smi.loginEmail';
    const ACCOUNT_KEY = 'smi.lastAccount';

    /* --------------------------------------------------------- storage --- */

    function readStorage(store, key) {
        try {
            return window[store].getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeStorage(store, key, value) {
        try {
            if (value === null || value === undefined) window[store].removeItem(key);
            else window[store].setItem(key, value);
        } catch (error) {
            /* storage unavailable - ignore */
        }
    }

    /* --------------------------------------------------- loading state --- */

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

    /* ------------------------------------------------------ messages ----- */

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

    /* The quiet info line under the form (demo accounts, last sign-in). */
    function showInfo(container, message) {
        if (!container) return;
        container.textContent = message || '';
        container.hidden = !message;
    }

    /* ------------------------------------------------- password toggle --- */

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

    /* ------------------------------------------------------ remember me --- */

    /* "Remember email" — keeps the address between visits (never the password).

       The typed address is also kept for the running session, so an
       accidental reload does not wipe the form. */
    function loadRememberedEmail() {
        const checkbox = document.getElementById('rememberEmail');
        const email = document.getElementById('email');
        if (!checkbox || !email) return;

        const remembered = readStorage('localStorage', REMEMBER_KEY);
        const session = readStorage('sessionStorage', EMAIL_KEY);

        if (remembered) {
            email.value = remembered;
            checkbox.checked = true;
        } else if (session) {
            email.value = session;
            checkbox.checked = false;
        }
    }

    function storeRememberedEmail() {
        const checkbox = document.getElementById('rememberEmail');
        const email = document.getElementById('email');
        if (!checkbox || !email) return;

        const value = email.value.trim();

        if (checkbox.checked) {
            writeStorage('localStorage', REMEMBER_KEY, value);
        } else {
            writeStorage('localStorage', REMEMBER_KEY, null);
        }

        // The session copy survives a reload of the page.
        writeStorage('sessionStorage', EMAIL_KEY, value);
    }

    /* Keep the session copy up to date while the user types. */
    function trackTypedEmail() {
        const email = document.getElementById('email');
        if (!email) return;

        email.addEventListener('input', function () {
            writeStorage('sessionStorage', EMAIL_KEY, email.value.trim());
        });
    }

    /* ------------------------------------------------- last signed in ---- */

    /* Remember the account that signed in last so the login screen can
       show it and fill it in with one click. */
    function rememberAccount(user) {
        if (!user || !user.email) return;

        writeStorage('localStorage', ACCOUNT_KEY, JSON.stringify({
            email: user.email,
            name: user.name || '',
            role: user.role || '',
            role_label: user.role_label || '',
            at: Date.now()
        }));
    }

    function lastAccount() {
        const raw = readStorage('localStorage', ACCOUNT_KEY);
        if (!raw) return null;

        try {
            const account = JSON.parse(raw);
            return account && account.email ? account : null;
        } catch (error) {
            return null;
        }
    }

    /* Show "last signed in as ..." on the login screen. */
    function renderLastAccount() {
        const holder = document.getElementById('lastAccount');
        if (!holder) return;

        const account = lastAccount();
        if (!account) {
            holder.hidden = true;
            return;
        }

        const label = account.role_label || (account.role ? account.role.charAt(0).toUpperCase() + account.role.slice(1) : 'User');
        holder.hidden = false;
        holder.innerHTML =
            '<i class="fas fa-user-check"></i>' +
            '<span>Last signed in as <strong>' + escapeHtml(label) + '</strong> · ' + escapeHtml(account.email) + '</span>' +
            '<button type="button" class="auth-info__action" data-use-email="' + escapeHtml(account.email) + '">Use again</button>';
    }

    /* ------------------------------------------------------ demo chips --- */

    /* Fill the form from a demo account chip. */
    function setupDemoAccounts() {
        document.querySelectorAll('[data-demo-email]').forEach(function (chip) {
            if (chip.dataset.bound === '1') return;
            chip.dataset.bound = '1';

            chip.addEventListener('click', function () {
                const emailInput = document.getElementById('email');
                const passwordInput = document.getElementById('password');
                const info = document.getElementById('loginInfo');

                if (emailInput) emailInput.value = chip.dataset.demoEmail || '';
                if (passwordInput && chip.dataset.demoPassword) {
                    passwordInput.value = chip.dataset.demoPassword;
                }

                writeStorage('sessionStorage', EMAIL_KEY, chip.dataset.demoEmail || '');
                writeStorage('localStorage', REMEMBER_KEY, chip.dataset.demoEmail || '');

                const checkbox = document.getElementById('rememberEmail');
                if (checkbox) checkbox.checked = true;

                const role = chip.dataset.demoRole || 'the account';
                const lands = chip.dataset.demoLands || '';
                showInfo(info, role + ' credentials filled in' + (lands ? ' — you land on ' + lands + '.' : '.') + ' Press Sign In to continue.');

                if (emailInput) emailInput.focus();
            });
        });
    }

    /* "Use again" button of the last signed-in account. */
    function setupUseAgain() {
        document.addEventListener('click', function (event) {
            const button = event.target && event.target.closest
                ? event.target.closest('[data-use-email]')
                : null;
            if (!button) return;

            const emailInput = document.getElementById('email');
            if (emailInput) {
                emailInput.value = button.dataset.useEmail || '';
                emailInput.focus();
            }

            writeStorage('sessionStorage', EMAIL_KEY, button.dataset.useEmail || '');
            writeStorage('localStorage', REMEMBER_KEY, button.dataset.useEmail || '');

            const checkbox = document.getElementById('rememberEmail');
            if (checkbox) checkbox.checked = true;

            showInfo(document.getElementById('loginInfo'), 'Email filled in — enter the password and press Sign In.');
        });
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* -------------------------------------------------- rotating word ---- */

    /* Cycle the rotating word in the brand panel headline.

       The timer is stopped while the tab is in the background and the
       words are put back into a clean state, so coming back to the tab
       never shows a word half faded out. */
    function setupRotatingWord() {
        const holder = document.getElementById('rotateWord');
        if (!holder) return;

        const words = Array.prototype.slice.call(holder.querySelectorAll('.word'));
        if (words.length < 2) return;

        let index = 0;
        let timer = null;

        function reset() {
            words.forEach(function (word, position) {
                word.classList.toggle('is-active', position === index);
                word.classList.remove('is-exit');
            });
        }

        function showNext() {
            const current = words[index];
            index = (index + 1) % words.length;
            const next = words[index];

            current.classList.remove('is-active');
            current.classList.add('is-exit');
            next.classList.add('is-active');

            setTimeout(function () {
                current.classList.remove('is-exit');
            }, 560);
        }

        function start() {
            if (timer) return;
            timer = setInterval(showNext, 2800);
        }

        function stop() {
            if (!timer) return;
            clearInterval(timer);
            timer = null;
        }

        document.addEventListener('visibilitychange', function () {
            stop();
            reset();
            if (!document.hidden) start();
        });

        window.addEventListener('pageshow', function () {
            reset();
            start();
        });

        start();
    }

    /* --------------------------------------------------------- counters --- */

    /* Count-up numbers in the brand panel stats.

       Uses a timer instead of requestAnimationFrame so the count still runs
       when the tab is not the foreground tab, and the final value is kept
       so a throttled timer can never leave the number half way. */
    function setupCounters() {
        document.querySelectorAll('[data-count]').forEach(function (element) {
            const target = parseFloat(element.dataset.count);
            if (isNaN(target)) return;

            const suffix = element.dataset.suffix || '';
            const duration = 1500;
            const started = Date.now();

            const finalText = Math.floor(target).toLocaleString('en-US') + suffix;
            element.dataset.finalValue = finalText;

            function tick() {
                const progress = Math.min((Date.now() - started) / duration, 1);

                if (document.hidden || progress >= 1) {
                    element.textContent = finalText;
                    return;
                }

                const eased = 1 - Math.pow(1 - progress, 3);
                element.textContent = Math.floor(target * eased).toLocaleString('en-US') + suffix;
                setTimeout(tick, 40);
            }

            tick();
        });
    }

    /* Finish every counter at once (tab hidden or restored from cache). */
    function settleCounters() {
        document.querySelectorAll('[data-count][data-final-value]').forEach(function (element) {
            element.textContent = element.dataset.finalValue;
        });
    }

    /* ------------------------------------------------------------ boot --- */

    document.addEventListener('DOMContentLoaded', function () {
        setupPasswordToggles();
        setupRotatingWord();
        setupCounters();
        loadRememberedEmail();
        trackTypedEmail();
        setupDemoAccounts();
        setupUseAgain();
        renderLastAccount();

        document.querySelectorAll('[data-auth-form]').forEach(function (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                storeRememberedEmail();
                setLoading(form, true);
            });
        });

        /* A background tab throttles the timers - settle the numbers so the
           login screen never shows a half finished count. */
        document.addEventListener('visibilitychange', function () {
            settleCounters();
        });

        window.addEventListener('pageshow', function () {
            settleCounters();
            renderLastAccount();
            loadRememberedEmail();
        });
    });

    window.AuthUI = {
        setLoading: setLoading,
        showMessage: showMessage,
        clearMessage: clearMessage,
        showInfo: showInfo,
        rememberAccount: rememberAccount,
        lastAccount: lastAccount,
        storeRememberedEmail: storeRememberedEmail,
        loadRememberedEmail: loadRememberedEmail,
        settleCounters: settleCounters
    };
})();
