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

    // --- LÓGICA DE BÚSQUEDA MÓVIL Y TECLADO VIRTUAL ---

    const contenido = document.getElementById('contenido');

    // Función que se ejecuta cuando el visualViewport cambia (ej. al abrir/cerrar teclado).
    const handleViewportChange = () => {
        if (!document.body.classList.contains('search-active')) return;

        // La altura del viewport visible.
        const viewportHeight = window.visualViewport.height;

        // Altura de la barra de búsqueda fija + un margen.
        const searchBarOffset = 80; // Aprox 65px de padding + 15px de margen.

        // Se establece la altura máxima del contenedor de resultados.
        contenido.style.maxHeight = `${viewportHeight - searchBarOffset}px`;

        // Se detecta si el teclado está abierto comparando la altura del viewport
        // con la altura total de la ventana. Un umbral de 200px es seguro.
        const isKeyboardOpen = window.innerHeight - viewportHeight > 200;
        document.body.classList.toggle('keyboard-open', isKeyboardOpen);
    };

    // Al enfocar el input de búsqueda, se activa el modo búsqueda y se escucha por cambios en el viewport.
    searchInput.addEventListener('focus', () => {
        document.body.classList.add('search-active');
        // Se añade el listener solo cuando es necesario.
        window.visualViewport.addEventListener('resize', handleViewportChange);
        // Se llama una vez para establecer el estado inicial.
        handleViewportChange();
    });

    // Al perder el foco, se desactiva el modo búsqueda y se limpia todo.
    searchInput.addEventListener('blur', () => {
        // Se usa un retardo para permitir clics en los resultados.
        setTimeout(() => {
            document.body.classList.remove('search-active');
            document.body.classList.remove('keyboard-open');

            // Se limpia el listener y los estilos inline para restaurar el layout.
            window.visualViewport.removeEventListener('resize', handleViewportChange);
            contenido.style.maxHeight = '';
        }, 200);
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
