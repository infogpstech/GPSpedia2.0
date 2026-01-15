// GPSpedia Main Orchestration Module
// Responsibilities:
// - Import all feature modules.
// - Initialize the application and set up global event listeners.
// - Expose modules to the global window object for HTML compatibility.

// Importar la función `routeAction` desde el módulo de API unificado.
import { routeAction } from './api-config.js';
import * as auth from './auth.js';
import * as state from './state.js';
import * as ui from './ui.js';
import * as navigation from './navigation.js';
import './lightbox.js';

let deferredPrompt;

/**
 * Main function to initialize the application.
 */
async function initializeApp() {
    console.log("GPSpedia Modular Initializing...");

    // 1. Expose modules to the global scope for inline event handlers in HTML
    window.routeAction = routeAction; // Exponer la función central de API
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

    // --- LÓGICA DE ANIMACIÓN DE LA BARRA DE BÚSQUEDA ---
    // Añade la clase 'search-active' al body cuando el input gana el foco.
    searchInput.addEventListener('focus', () => {
        document.body.classList.add('search-active');
    });

    // Elimina la clase 'search-active' del body cuando el input pierde el foco.
    // Se utiliza un setTimeout para permitir que los eventos de clic en los resultados de búsqueda se registren
    // antes de que la UI se revierta a su estado normal.
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            document.body.classList.remove('search-active');
        }, 200); // 200ms de retardo
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
            ui.mostrarSeccion(section);
        });
    });

    // Inbox button listener
    const inboxBtn = document.getElementById('inbox-btn');
    if (inboxBtn) {
        inboxBtn.addEventListener('click', (e) => {
            e.preventDefault();
            ui.openInbox();
            ui.closeSideMenu();
        });
    }

    // Dev Tools button listener
    const devToolsBtn = document.getElementById('dev-tools-btn');
    if (devToolsBtn) {
        devToolsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            ui.openDevTools();
            ui.closeSideMenu();
        });
    }


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

    // 6. Dynamic viewport height handling for mobile keyboard
    const setVisualViewportHeight = () => {
        // Solo actuar si visualViewport es compatible.
        if (window.visualViewport) {
            const vh = window.visualViewport.height;
            document.documentElement.style.setProperty('--app-height', `${vh}px`);
        }
    };

    // La inicialización debe ocurrir después de que el DOM esté completamente cargado
    // para asegurar que `visualViewport` esté disponible.
    window.addEventListener('DOMContentLoaded', () => {
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', setVisualViewportHeight);
            // Establecer la altura inicial solo si visualViewport es compatible.
            setVisualViewportHeight();
        }
    });


    // 7. Start the application by checking the user's session
    await auth.checkSession();
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
