// GPSpedia Main Orchestration Module
// Responsibilities:
// - Import all feature modules.
// - Initialize the application and set up global event listeners.
// - Expose modules to the global window object for HTML compatibility.

import * as api from './api.js';
import * as auth from './auth.js';
import * as state from './state.js';
import * as ui from './ui.js';
import * as navigation from './navigation.js';

let deferredPrompt;

/**
 * Main function to initialize the application.
 */
async function initializeApp() {
    console.log("GPSpedia Modular Initializing...");

    // 1. Expose modules to the global scope for inline event handlers in HTML
    window.api = api;
    window.auth = auth;
    window.state = state;
    window.ui = ui;
    window.navigation = navigation;

    // 2. Setup primary event listeners
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        auth.login(username, password);
    });

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
        navigation.filtrarContenido(searchInput.value);
    });

    // Hamburger menu listeners
    document.getElementById('hamburger-btn').addEventListener('click', ui.openSideMenu);
    document.getElementById('menu-overlay').addEventListener('click', ui.closeSideMenu);
    document.getElementById('side-menu-logout-button').addEventListener('click', () => {
        ui.closeSideMenu();
        auth.logout();
    });

    // General section buttons
    document.querySelectorAll('.section-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.id.replace('btn-', '');
            // This is a placeholder for a more robust section handling logic
            console.log(`Switching to section: ${section}`);
        });
    });


    // 3. PWA installation prompt handler
    const installButton = document.getElementById('install-button');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installButton) {
            installButton.style.display = 'block';
        }
    });

    if (installButton) {
        installButton.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
                installButton.style.display = 'none';
            }
        });
    }


    // 4. Register the service worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => console.log('Service Worker registered.', reg))
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }

    // 5. Start the application by checking the user's session
    await auth.checkSession();
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
