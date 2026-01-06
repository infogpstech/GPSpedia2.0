// Versión del Componente: 5.1 (main.js)
// -- INICIALIZACIÓN Y MANEJO DEL DOM --
document.addEventListener('DOMContentLoaded', () => {
    // Inicialización principal de la aplicación
    initializeApp();
    // Configuración de los listeners de la interfaz de usuario
    setupEventListeners();
});

/**
 * @function initializeApp
 * @description Orquesta la inicialización de la aplicación. Valida la sesión del usuario,
 * carga los datos del catálogo y configura el modo de tema (claro/oscuro).
 */
async function initializeApp() {
    try {
        const user = await sessionManager.validateSession();
        if (user) {
            uiManager.showMainContent(user);
            await loadCatalogData();
            themeManager.applyTheme();
            notificationManager.checkForNotifications(user);
        } else {
            uiManager.showLogin();
        }
    } catch (error) {
        console.error('Error crítico durante la inicialización:', error);
        uiManager.showError('No se pudo iniciar la aplicación. Verifique su conexión.');
        uiManager.showLogin();
    } finally {
        uiManager.hideSplashScreen();
    }
}


/**
 * @function setupEventListeners
 * @description Configura todos los listeners de eventos para los elementos interactivos de la UI.
 * Se centraliza aquí para mejorar la organización del código.
 */
function setupEventListeners() {
    // --- Listeners de Modales y Overlays ---
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('modalDetalle').addEventListener('click', handleModalClick);
    document.querySelector('.lightbox').addEventListener('click', () => uiManager.hideLightbox());
    document.querySelectorAll('.info-modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                uiManager.hideInfoModal(modal.id);
            }
        });
    });
    document.querySelectorAll('.info-close-btn').forEach(btn => {
        btn.addEventListener('click', () => uiManager.hideInfoModal(btn.closest('.info-modal').id));
    });

    // --- Listeners de Búsqueda ---
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('focus', () => document.body.classList.add('search-active'));
    searchInput.addEventListener('blur', () => {
        if (!searchInput.value.trim()) {
            document.body.classList.remove('search-active');
        }
    });
    document.getElementById('clear-search-btn').addEventListener('click', clearSearch);


    // --- Listeners de Navegación y Menú ---
    document.getElementById('hamburger-btn').addEventListener('click', uiManager.toggleSideMenu);
    document.getElementById('menu-overlay').addEventListener('click', uiManager.toggleSideMenu);
    document.querySelectorAll('.section-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            uiManager.updateActiveSection(section);
            uiManager.renderContent(window.catalogData);
        });
    });

    // --- Listeners de Menú Lateral ---
    document.getElementById('logout-btn').addEventListener('click', sessionManager.logout);
    document.querySelectorAll('.footer-links a, .menu-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetModalId = e.currentTarget.dataset.modalTarget;
            if (targetModalId) {
                uiManager.showInfoModal(targetModalId);
                uiManager.closeSideMenu();
            }
        });
    });

    // --- Listeners de Tema y PWA ---
    const themeSwitch = document.getElementById('theme-switch');
    themeSwitch.addEventListener('change', () => {
        const isDarkMode = themeSwitch.checked;
        themeManager.setTheme(isDarkMode);
    });

    const installButton = document.getElementById('install-button');
    if (installButton) {
        installButton.addEventListener('click', pwaManager.promptInstall);
    }
    window.addEventListener('beforeinstallprompt', pwaManager.handleInstallPrompt);


    // --- Listener del Formulario de Contacto ---
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactFormSubmit);
    }

     // Listener para el Toast de Notificación
    document.getElementById('notification-toast').addEventListener('click', () => {
        uiManager.showInfoModal('inbox-modal'); // Asume que tienes un modal con este ID
    });
}


// -- MANEJADORES DE EVENTOS ESPECÍFICOS --

/**
 * @function handleLogin
 * @description Maneja el evento de envío del formulario de login.
 * @param {Event} event - El objeto del evento del formulario.
 */
async function handleLogin(event) {
    event.preventDefault();
    const username = sanitizeInput(document.getElementById('username').value.trim()).toLowerCase();
    const password = document.getElementById('password').value.trim(); // No sanitizar contraseñas

    if (!username || !password) {
        uiManager.showError("Por favor, ingrese usuario y contraseña.");
        return;
    }

    try {
        const response = await routeAction('login', { username, password });
        if (response && response.status === 'success') {
            sessionManager.saveSession(response.user);
            uiManager.showMainContent(response.user);
            await loadCatalogData();
            themeManager.applyTheme(); // Aplicar tema después de cargar contenido principal
        } else {
            uiManager.showError(response.message || "Usuario o contraseña incorrectos.");
        }
    } catch (error) {
        console.error('Error en el login:', error);
        uiManager.showError(error.message || "Error al intentar iniciar sesión. Intente de nuevo.");
    }
}


/**
 * @function handleSearch
 * @description Maneja la entrada en el campo de búsqueda, llamando al backend para obtener resultados.
 * Implementa un debouncer para evitar llamadas excesivas al API.
 */
let searchTimeout;
async function handleSearch(event) {
    const query = sanitizeInput(event.target.value.toLowerCase());
    document.querySelector('.search-container').classList.toggle('has-text', query.length > 0);

    // Limpiar el timeout anterior
    clearTimeout(searchTimeout);

    if (query.length > 2) {
        // Ocultar contenido principal y mostrar loader/spinner si se desea
        document.querySelectorAll('.carousel-container, .section-selector').forEach(c => c.style.display = 'none');
        document.querySelectorAll('h2').forEach(h => {
            if(h.id !== 'search-results-title') h.style.display = 'none';
        });

        // Configurar un nuevo timeout
        searchTimeout = setTimeout(async () => {
            try {
                const results = await apiManager.routeAction('search', { query });
                if (results) {
                    uiManager.renderSearchResults(results.results);
                } else {
                     uiManager.renderSearchResults([]);
                }
            } catch (error) {
                console.error('Error en la búsqueda:', error);
                uiManager.showError('Error al realizar la búsqueda.');
                uiManager.renderSearchResults([]);
            }
        }, 300); // Espera 300ms después de que el usuario deja de escribir
    } else {
        // Restaurar la vista normal si la búsqueda es corta
         document.querySelectorAll('.carousel-container, .section-selector, h2').forEach(el => el.style.display = '');
         uiManager.clearSearchResults();
         if(query.length === 0){
             document.body.classList.remove('search-active');
         }
    }
}

/**
 * @function clearSearch
 * @description Limpia el campo de búsqueda y restaura la vista del catálogo.
 */
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    document.querySelector('.search-container').classList.remove('has-text');
    document.body.classList.remove('search-active');
    // Simula un evento de input para que handleSearch restaure la vista
    searchInput.dispatchEvent(new Event('input'));
}


/**
 * @function handleContactFormSubmit
 * @description Maneja el envío del formulario de contacto.
 * @param {Event} e - El objeto del evento del formulario.
 */
async function handleContactFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const nombre = sanitizeInput(form.nombre.value);
    const email = sanitizeInput(form.email.value);
    const mensaje = sanitizeInput(form.mensaje.value);

    try {
        const response = await apiManager.routeAction('submitContactForm', { nombre, email, mensaje });
        if (response.status === 'success') {
            alert('Mensaje enviado con éxito.');
            form.reset();
            uiManager.hideInfoModal('contact-modal');
        } else {
            throw new Error(response.message || 'Error desconocido');
        }
    } catch (error) {
        console.error("Error al enviar formulario de contacto:", error);
        alert(`Error al enviar el mensaje: ${error.message}`);
    }
}


/**
 * @function handleModalClick
 * @description Cierra el modal de detalles si se hace clic fuera del contenido.
 * @param {Event} event - El objeto del evento de clic.
 */
function handleModalClick(event) {
    if (event.target === document.getElementById('modalDetalle')) {
        uiManager.hideDetailModal();
    }
}

/**
 * @function handleImageClick
 * @description Muestra una imagen en el lightbox cuando se hace clic.
 * @param {string} src - La URL de la imagen a mostrar.
 */
function handleImageClick(src) {
    if (src && src !== 'undefined' && src !== 'null') {
        uiManager.showLightbox(src);
    }
}


// -- LÓGICA DE DATOS Y ESTADO --

/**
 * @function loadCatalogData
 * @description Carga los datos iniciales del catálogo desde el backend.
 */
async function loadCatalogData() {
    uiManager.showSkeletonLoader();
    try {
        const data = await routeAction('getCatalogData');
        window.catalogData = data.data; // Almacenar datos globalmente para acceso rápido
        if (!data || !data.data || Object.keys(data.data).length === 0) {
            throw new Error("No se recibieron datos del catálogo.");
        }
        // Retraso mínimo para asegurar que el DOM se actualice antes de renderizar
        setTimeout(() => {
            uiManager.renderContent(data.data);
            uiManager.hideSkeletonLoader();
        }, 100);
    } catch (error) {
        console.error('Error al cargar el catálogo:', error);
        uiManager.showError("No se pudo cargar el catálogo. Inténtelo de nuevo más tarde.");
        uiManager.hideSkeletonLoader();
    }
}


// -- MÓDULOS DE GESTIÓN --

/**
 * @module sessionManager
 * @description Gestiona la sesión del usuario (login, logout, validación, almacenamiento).
 */
const sessionManager = {
    /**
     * Valida si existe una sesión activa en el cliente y en el servidor.
     * @returns {Object|null} El objeto del usuario si la sesión es válida, o null.
     */
    async validateSession() {
        const session = this.getSession();
        if (!session || !session.SessionToken) {
            return null;
        }
        try {
            const response = await apiManager.validateSession(session.SessionToken);
            if (response && response.valid) {
                return session; // La sesión local es válida en el servidor
            } else {
                this.clearSession(); // Limpia la sesión local si el servidor la invalida
                return null;
            }
        } catch (error) {
            console.error("Error de red al validar sesión, asumiendo offline.", error);
            // Si hay un error de red, asumimos que el usuario está offline
            // y permitimos el uso con la sesión local cacheada.
            return session;
        }
    },
    /**
     * Guarda la sesión del usuario en localStorage.
     * @param {Object} user - El objeto del usuario devuelto por el API.
     */
    saveSession(user) {
        if (user && user.SessionToken) {
            localStorage.setItem('userSession', JSON.stringify(user));
        } else {
            console.error("Intento de guardar sesión sin datos de usuario o token.");
        }
    },
    /**
     * Obtiene la sesión del usuario desde localStorage.
     * @returns {Object|null} El objeto del usuario o null si no existe.
     */
    getSession() {
        try {
            return JSON.parse(localStorage.getItem('userSession'));
        } catch (e) {
            return null;
        }
    },
    /**
     * Limpia la sesión del usuario de localStorage.
     */
    clearSession() {
        localStorage.removeItem('userSession');
    },
    /**
     * Cierra la sesión del usuario, limpia el estado y recarga la página.
     */
    logout() {
        this.clearSession();
        window.location.reload();
    }
};

/**
 * @module uiManager
 * @description Gestiona todas las manipulaciones del DOM y la interfaz de usuario.
 */
const uiManager = {
    // --- Gestión de Visibilidad de Componentes Principales ---
    showLogin() {
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    },
    showMainContent(user) {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        this.updateWelcomeMessage(user.Nombre_Usuario);
    },
    hideSplashScreen() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 500);
        }
    },

    // --- Gestión de Contenido Dinámico (Catálogo y Búsqueda) ---
    renderContent(data) {
        const activeSection = document.querySelector('.section-btn.active').dataset.section;

        // Limpiar contenedores existentes
        this.clearContainer('ultimos-agregados-carousel');
        this.clearContainer('categorias-carousel');
        this.clearContainer('marcas-vehiculos-carousel');
        this.clearContainer('marcas-motos-carousel');
        this.clearSearchResults(); // Limpia resultados de búsqueda si los hubiera

        // Renderizar carruseles
        this.renderCarousel('ultimos-agregados-carousel', data.latest, this.createVehicleCard);
        this.renderCarousel('categorias-carousel', data.categories, this.createCategoryCard);
        this.renderCarousel('marcas-vehiculos-carousel', data.brands.vehiculos, this.createBrandLogo);
        this.renderCarousel('marcas-motos-carousel', data.brands.motos, this.createBrandLogo);

        // Ocultar todas las secciones y mostrar solo la activa
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        const sectionToShow = document.getElementById(`${activeSection}-section`);
        if (sectionToShow) {
            sectionToShow.style.display = 'block';
        }

    },
    renderSearchResults(results) {
        const container = document.getElementById('search-results');
        container.innerHTML = ''; // Limpiar resultados anteriores
         // Crear y añadir el título de resultados si no existe
        let title = document.getElementById('search-results-title');
        if (!title) {
            title = document.createElement('h2');
            title.id = 'search-results-title';
            container.before(title); // Insertar antes del contenedor de resultados
        }

        if (results.length > 0) {
            title.textContent = 'Resultados de la Búsqueda';
            const grid = document.createElement('div');
            grid.className = 'grid';
            results.forEach(item => grid.appendChild(this.createVehicleCard(item)));
            container.appendChild(grid);
        } else {
            title.textContent = '';
            container.innerHTML = '<p>No se encontraron resultados.</p>';
        }
    },
    clearSearchResults() {
         const container = document.getElementById('search-results');
         const title = document.getElementById('search-results-title');
         container.innerHTML = '';
         if(title) title.textContent = '';
    },
    clearContainer(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            const track = container.querySelector('.carousel-track');
            if(track) track.innerHTML = '';
            else container.innerHTML = '';
        }
    },


    // --- Constructores de Elementos HTML ---
     createVehicleCard(item) {
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => this.showDetailModal(item);

        const imageUrl = item.imagenPrincipal || 'icon-pwa-192x192.png';

        card.innerHTML = `
            <img src="${imageUrl}" alt="${item.marca} ${item.modelo}" loading="lazy" onerror="this.onerror=null;this.src='icon-pwa-192x192.png';">
            <div class="overlay">${item.marca} ${item.modelo} (${item.anoDesde}-${item.anoHasta || '...'})</div>
        `;
        return card;
    },
    createCategoryCard(category) {
        const card = document.createElement('div');
        card.className = 'card';
        // Aquí podrías tener una lógica para navegar a una vista de categoría
        // card.onclick = () => navigateToCategory(category.nombre);

        const imageUrl = category.imagen || 'icon-pwa-192x192.png';

        card.innerHTML = `
            <img src="${imageUrl}" alt="${category.nombre}" loading="lazy" onerror="this.onerror=null;this.src='icon-pwa-192x192.png';">
            <div class="overlay">${category.nombre}</div>
        `;
        return card;
    },
    createBrandLogo(brand) {
        const card = document.createElement('div');
        card.className = 'card brand-logo-item'; // Clase especial para logos
        // card.onclick = () => navigateToBrand(brand.nombre);

        card.innerHTML = `
            <img src="${brand.logoUrl}" alt="${brand.nombre}" loading="lazy" onerror="this.onerror=null;this.src='icon-pwa-192x192.png';">
        `;
        return card;
    },


    // --- Gestión de Modales ---
    showDetailModal(item) {
        const modalContent = document.getElementById('detalleCompleto');
        // Limpia el contenido anterior para evitar duplicados de listeners
        modalContent.innerHTML = '';

        // Contenido HTML dinámico
        let contentHTML = `
            <div style="text-align: center;">
                <img src="${item.logoMarca || ''}" alt="Logo ${item.marca}" style="max-height: 50px; float: right;" onerror="this.style.display='none'">
                <h2>${item.marca} ${item.modelo}</h2>
                <p><strong>Años:</strong> ${item.anoDesde} - ${item.anoHasta || 'Presente'}</p>
                <p><strong>Tipo de Encendido:</strong> ${item.tipoEncendido}</p>
                 <div class="image-container-with-feedback">
                    <img src="${item.imagenPrincipal}" class="img-vehiculo-modal" alt="Imagen Vehículo" onclick="handleImageClick('${item.imagenPrincipal}')">
                 </div>
            </div>`;

        // Añadir secciones de cortes (los datos ya vienen ordenados desde el backend)
        if (item.cortes && item.cortes.length > 0) {
            // El primer corte es el recomendado
            const recomendado = item.cortes[0];
            contentHTML += this.createAccordionSection('Corte Recomendado', this.createCutContent(recomendado), true); // Abierto por defecto

            // Otros cortes (si existen)
            const otrosCortes = item.cortes.slice(1);
            otrosCortes.forEach((corte, index) => {
                contentHTML += this.createAccordionSection(`Corte Alternativo ${index + 1}`, this.createCutContent(corte));
            });
        }


        modalContent.innerHTML = contentHTML;
        document.getElementById('modalDetalle').classList.add('visible');

        // Re-asociar listeners a los nuevos elementos
        this.setupAccordionListeners();
    },

    createCutContent(corte) {
        if (!corte) return '<p>No hay información disponible.</p>';
        return `
            <p><strong>Tipo:</strong> ${corte.tipo || 'No especificado'}</p>
            <p><strong>Ubicación:</strong> ${corte.ubicacion || 'No especificada'}</p>
            <p><strong>Colaborador:</strong> ${corte.colaborador || 'Anónimo'}</p>
            <div class="image-container-with-feedback">
                <img src="${corte.imagen}" class="img-corte" alt="Imagen Corte" onclick="handleImageClick('${corte.imagen}')">
                <div class="feedback-overlay">
                    <button class="feedback-btn-overlay util-btn ${corte.liked ? 'liked' : ''}" data-id="${corte.id}" title="Marcar como útil">
                        <i class="fas fa-thumbs-up"></i>
                    </button>
                    <button class="feedback-btn-overlay report-btn" data-id="${corte.id}" title="Reportar problema">
                        <i class="fas fa-exclamation-triangle"></i>
                    </button>
                </div>
            </div>
        `;
    },

    createAccordionSection(title, content, isOpen = false) {
        return `
            <button class="accordion-btn ${isOpen ? 'active' : ''}">
                ${title}
                <svg class="accordion-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </button>
            <div class="panel-desplegable" style="${isOpen ? 'max-height: 500px;' : ''}">
                ${content}
            </div>
        `;
    },

    hideDetailModal() {
        document.getElementById('modalDetalle').classList.remove('visible');
    },
    showLightbox(src) {
        const lightbox = document.querySelector('.lightbox');
        lightbox.querySelector('img').src = src;
        lightbox.classList.add('visible');
    },
    hideLightbox() {
        document.querySelector('.lightbox').classList.remove('visible');
    },
    showInfoModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    },
    hideInfoModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    },

    // --- Gestión de UI Auxiliar (Loaders, Mensajes, etc.) ---
    showSkeletonLoader() {
        const containers = ['ultimos-agregados-carousel', 'categorias-carousel', 'marcas-vehiculos-carousel', 'marcas-motos-carousel'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                const track = container.querySelector('.carousel-track');
                if(track) {
                    track.innerHTML = ''; // Limpiar antes de añadir skeletons
                    for (let i = 0; i < 6; i++) {
                        track.innerHTML += '<div class="skeleton-card"></div>';
                    }
                }
            }
        });
    },

    hideSkeletonLoader() {
       // El renderizado de contenido real reemplazará los skeletons
    },
    showError(message) {
        const toast = document.getElementById('error-toast');
        toast.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    },
    updateWelcomeMessage(name) {
        document.getElementById('welcome-message').textContent = `Hola, ${name}`;
    },
    toggleSideMenu() {
        document.getElementById('side-menu').classList.toggle('open');
        document.getElementById('menu-overlay').classList.toggle('open');
    },
     closeSideMenu() {
        document.getElementById('side-menu').classList.remove('open');
        document.getElementById('menu-overlay').classList.remove('open');
    },
    updateActiveSection(section) {
        document.querySelectorAll('.section-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });
    },

    // --- Carrusel ---
    renderCarousel(containerId, items, cardCreator) {
        const container = document.getElementById(containerId);
        if (!container || !items || items.length === 0) {
            if(container) container.parentElement.style.display = 'none';
            return;
        }

        container.parentElement.style.display = 'block';
        const track = container.querySelector('.carousel-track');
        track.innerHTML = '';
        items.forEach(item => track.appendChild(cardCreator.call(this, item)));

        this.setupCarouselControls(container);
    },
    setupCarouselControls(container) {
        const track = container.querySelector('.carousel-track');
        const prevBtn = container.querySelector('.carousel-btn.prev');
        const nextBtn = container.querySelector('.carousel-btn.next');

        const updateButtons = () => {
            const scrollLeft = track.scrollLeft;
            const scrollWidth = track.scrollWidth;
            const width = track.clientWidth;
            if (prevBtn) prevBtn.style.display = scrollLeft > 0 ? 'flex' : 'none';
            if (nextBtn) nextBtn.style.display = scrollWidth - scrollLeft > width + 5 ? 'flex' : 'none'; // +5 de margen
        };

        if (prevBtn) {
            prevBtn.onclick = () => {
                track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
            };
        }
        track.addEventListener('scroll', updateButtons);
        // Pequeño retraso para asegurar que el DOM esté listo
        setTimeout(updateButtons, 100);
    },

    // --- Acordeón ---
    setupAccordionListeners() {
        document.querySelectorAll('.accordion-btn').forEach(button => {
            button.addEventListener('click', () => {
                button.classList.toggle('active');
                const panel = button.nextElementSibling;
                if (panel.style.maxHeight) {
                    panel.style.maxHeight = null;
                } else {
                    // Cierra otros paneles abiertos antes de abrir el actual
                    document.querySelectorAll('.panel-desplegable').forEach(p => p.style.maxHeight = null);
                    document.querySelectorAll('.accordion-btn').forEach(b => b.classList.remove('active'));

                    // Abre el panel actual
                    button.classList.add('active');
                    panel.style.maxHeight = panel.scrollHeight + "px";
                }
            });
        });
    }
};

/**
 * @module themeManager
 * @description Gestiona el tema de la aplicación (claro/oscuro).
 */
const themeManager = {
    applyTheme() {
        const isDarkMode = localStorage.getItem('theme') === 'dark';
        document.body.classList.toggle('dark-mode', isDarkMode);
        document.getElementById('theme-switch').checked = isDarkMode;
    },
    setTheme(isDarkMode) {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        this.applyTheme();
    }
};


/**
 * @module notificationManager
 * @description Gestiona la obtención y visualización de notificaciones.
 */
const notificationManager = {
    async checkForNotifications(user) {
        try {
            const notifications = await apiManager.routeAction('getNotifications', { userId: user.id });
            if (notifications && notifications.length > 0) {
                this.showNotificationToast(notifications.length);
                this.populateInbox(notifications);
            }
        } catch (error) {
            console.error("Error al obtener notificaciones:", error);
        }
    },
    showNotificationToast(count) {
        const toast = document.getElementById('notification-toast');
        toast.textContent = `Tienes ${count} notificaciones nuevas 🔔`;
        toast.style.display = 'block';
    },
    populateInbox(notifications) {
        const container = document.getElementById('inbox-container');
        if (!container) return;

        let inboxHTML = '<h3>Bandeja de Entrada</h3>';
        if (notifications.length === 0) {
            inboxHTML += '<p>No tienes mensajes nuevos.</p>';
        } else {
            notifications.forEach(msg => {
                inboxHTML += `
                    <div class="inbox-message">
                        <h4>${msg.subject}</h4>
                        <p>${msg.content}</p>
                        <small>De: ${msg.sender} - ${new Date(msg.timestamp).toLocaleString()}</small>
                    </div>
                `;
            });
        }
        container.innerHTML = inboxHTML;
    }
};


/**
 * @module pwaManager
 * @description Gestiona la lógica del Progressive Web App (instalación).
 */
const pwaManager = {
    deferredPrompt: null,
    handleInstallPrompt(e) {
        e.preventDefault();
        this.deferredPrompt = e;
        const installButton = document.getElementById('install-button');
        if (installButton) {
            installButton.style.display = 'block';
        }
    },
    promptInstall() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('Usuario aceptó la instalación');
                } else {
                    console.log('Usuario rechazó la instalación');
                }
                this.deferredPrompt = null;
                const installButton = document.getElementById('install-button');
                if(installButton) installButton.style.display = 'none';
            });
        }
    }
};


// -- UTILIDADES --

/**
 * @function sanitizeInput
 * @description Limpia una cadena de entrada para prevenir XSS básico.
 * @param {string} str - La cadena a sanitizar.
 * @returns {string} La cadena sanitizada.
 */
function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}
