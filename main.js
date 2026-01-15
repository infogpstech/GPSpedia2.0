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

    // --- LÓGICA DE ANIMACIÓN DE LA BARRA DE BÚSQUEDA Y TECLADO MÓVIL ---
    const contenido = document.querySelector('.container');
    const umbralTeclado = 0.8; // Si el viewport es menos del 80% del alto, el teclado está abierto

    const handleViewportChange = () => {
        const alturaVisible = window.visualViewport.height;
        const alturaBarra = document.body.classList.contains('search-active') ? 55 : 0;
        const alturaDisponible = alturaVisible - alturaBarra;

        // Tarea 5: Detección de teclado
        if (window.visualViewport.height / window.innerHeight < umbralTeclado) {
            document.body.classList.add('keyboard-open');
        } else {
            document.body.classList.remove('keyboard-open');
        }

        // Tarea 4: Cálculo de altura y mínimo de seguridad
        const nuevaAltura = Math.max(alturaDisponible, 100);
        contenido.style.maxHeight = `${nuevaAltura}px`;
        contenido.scrollTop = 0; // Tarea 5: Forzar scroll al inicio
    };

    // Tarea 6: Limpieza de listeners y estilos
    const cleanupSearchListeners = () => {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
        document.body.classList.remove('search-active', 'keyboard-open');
        contenido.style.maxHeight = ''; // Limpiar estilo inline
    };

    searchInput.addEventListener('focus', () => {
        document.body.classList.add('search-active');
        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
        // Llamada inicial para ajustar el layout
        handleViewportChange();
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            // Solo limpiar si el foco no ha vuelto al input (ej. al cambiar de pestaña)
            if (document.activeElement !== searchInput) {
                cleanupSearchListeners();
            }
        }, 200); // Retardo para permitir clics en resultados
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

    // 5. Start the application by checking the user's session
    await auth.checkSession();
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
