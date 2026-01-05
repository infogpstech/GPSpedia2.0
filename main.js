// --- SISTEMA DE DEPURACIÓN AVANZADO DEL FRONTEND ---

// La consola de depuración ahora se controla únicamente a través del modal de desarrollador
const isDebugMode = new URLSearchParams(window.location.search).has('debug'); // Se mantiene para debugLog, pero no para visibilidad
const debugConsole = document.getElementById('debug-console');

/**
 * Registra un mensaje en la consola de depuración del frontend.
 * @param {string} type - El tipo de log (p.ej., 'API_REQUEST', 'API_RESPONSE', 'ERROR', 'INFO').
 * @param {string} message - El mensaje principal a registrar.
 * @param {object} data - Un objeto con datos adicionales para mostrar.
 */
function debugLog(type, message, data) {
    if (!isDebugMode) return;

    const logEntry = document.createElement('div');
    logEntry.style.marginBottom = '10px';
    logEntry.style.borderBottom = '1px dashed #333';
    logEntry.style.paddingBottom = '10px';

    const timestamp = new Date().toLocaleTimeString();
    let color = '#00ff00'; // Verde por defecto
    if (type.includes('ERROR') || type.includes('FAIL')) {
        color = '#ff4136'; // Rojo para errores
    } else if (type.includes('REQUEST')) {
        color = '#7FDBFF'; // Azul claro para peticiones
    } else if (type.includes('RESPONSE')) {
        color = '#39CCCC'; // Turquesa para respuestas
    }

    let html = `<strong style="color: ${color};">[${type}]</strong> <span style="color: #aaa;">${timestamp}</span><br/>${message}`;

    if (data) {
        // Formatear el objeto de datos como un JSON bonito
        const jsonData = JSON.stringify(data, null, 2);
        html += `<pre style="background-color: rgba(0,0,0,0.3); padding: 5px; border-radius: 4px; margin-top: 5px; color: #fff; white-space: pre-wrap; word-wrap: break-word;">${jsonData}</pre>`;
    }

    logEntry.innerHTML = html;
    const debugLogDiv = document.getElementById('debug-log');
    debugLogDiv.appendChild(logEntry);
    debugLogDiv.scrollTop = debugLogDiv.scrollHeight; // Auto-scroll hacia abajo
}

// Lógica para hacer la consola arrastrable y redimensionable
const header = document.getElementById('debug-header');
const resizeHandle = document.getElementById('debug-resize-handle');
const closeButton = document.getElementById('debug-close');
const clearButton = document.getElementById('debug-clear');

let isDragging = false;
let isResizing = false;
let initialX, initialY, initialWidth, initialHeight;
let offsetX, offsetY;

header.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = debugConsole.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.body.style.userSelect = 'none'; // Evitar seleccionar texto mientras se arrastra
});

resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    initialHeight = debugConsole.offsetHeight;
    initialY = e.clientY;
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        debugConsole.style.left = `${e.clientX - offsetX}px`;
        debugConsole.style.top = `${e.clientY - offsetY}px`;
        // Eliminar bottom y right para que no interfieran con el posicionamiento
        debugConsole.style.bottom = 'auto';
        debugConsole.style.right = 'auto';
    }
    if (isResizing) {
        const newHeight = initialHeight - (e.clientY - initialY);
        debugConsole.style.height = `${newHeight}px`;
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    document.body.style.userSelect = 'auto';
});

closeButton.addEventListener('click', () => {
    debugConsole.style.display = 'none';
});

clearButton.addEventListener('click', () => {
    document.getElementById('debug-log').innerHTML = '';
});

// Sobrescribir window.onerror para capturar todos los errores de JS
window.onerror = function(message, source, lineno, colno, error) {
    debugLog('JAVASCRIPT_ERROR', `Error no capturado: ${message}`, {
        source: `${source}:${lineno}:${colno}`,
        stack: error ? error.stack : 'No disponible'
    });
    // Devuelve false para que el error también se muestre en la consola del navegador
    return false;
};


// --- LÓGICA DE DEPURACIÓN REMOTA (SE MANTIENE PERO AHORA TAMBIÉN LOGUEA LOCALMENTE) ---
function remoteLog(level, message, data = {}) {
    // Loguear en la nueva consola de depuración local
    debugLog(`REMOTE_${level}`, message, data);

    // Non-blocking call to the backend logger
    fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logFrontend', payload: { level, message, data } }),
        keepalive: true // Ensure the request is sent even if the page is closing
    }).catch(error => {
        debugLog('REMOTE_FAIL', 'Fallo al enviar log remoto', { error: error.message });
    });
}

// --- LÓGICA DE INDEXEDDB ---
// Note: IndexedDB logic is being kept for potential future offline capabilities,
// but the current implementation will prioritize fetching from the Apps Script backend.
const DB_NAME = 'gpsepedia-db';
const DB_VERSION = 1;
const STORES = ['cortes', 'tutoriales', 'relay'];
let db;

// --- LÓGICA DE DATOS Y API ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec";
const SESSION_KEY = 'gpsepedia_session';

// --- LÓGICA DE AUTENTICACIÓN Y SESIÓN ---

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    // Prevenir inyección de fórmulas de Excel escapando caracteres iniciales peligrosos
    let sanitized = input.trim();
    if (['=', '+', '-', '@', '\t', '\r'].includes(sanitized.charAt(0))) {
        sanitized = "'" + sanitized;
    }
    // La sanitización de SQL se eliminó para evitar la alteración de contraseñas
    // con caracteres especiales, que estaba causando fallos de autenticación.
    return sanitized;
}

const SESSION_ID_KEY = 'gpsepedia_session_id';
// La función postToAction ahora es reemplazada por routeAction del api-manager.js
async function postToAction(action, payload = {}) {
    debugLog('API_REQUEST', `Ejecutando acción: ${action}`, payload);

    try {
        // Usamos el nuevo enrutador
        const result = await routeAction(action, payload);
        debugLog('API_RESPONSE', `Respuesta recibida para: ${action}`, result);
        return result;
    } catch (error) {
        debugLog('API_ERROR', `Error en la acción: ${action}`, {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        let userMessage = `Error inesperado: ${error.message}`;
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            userMessage = "Fallo de conexión con el servidor. Por favor, verifica tu conexión a internet e inténtalo de nuevo. Si el problema persiste, contacta al administrador.";
        } else if (error.message.includes('JSON')) {
            userMessage = "La respuesta del servidor no es válida. Por favor, contacta al administrador.";
        } else if (error.message.includes('Credenciales inválidas')) {
            userMessage = "El usuario o la contraseña son incorrectos.";
        }

        const loginErrorElement = document.getElementById('login-error');
        if (loginErrorElement && loginErrorElement.offsetParent !== null) {
            // Solo muestra el error en el modal de login si está visible
            loginErrorElement.textContent = userMessage;
            loginErrorElement.style.display = 'block';
        } else {
            // Si no, usa el sistema de notificación global
            showGlobalError(userMessage);
        }

        throw error; // Re-lanzar el error
    }
}

let errorToastTimeout;
function showGlobalError(message) {
    const toast = document.getElementById('error-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.style.display = 'block';

    // Limpiar cualquier timeout anterior para resetear el timer
    if (errorToastTimeout) {
        clearTimeout(errorToastTimeout);
    }

    // Ocultar el toast después de 7 segundos
    errorToastTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, 7000);
}

async function checkSession() {
    remoteLog('INFO', 'checkSession started');
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (sessionData) {
        remoteLog('INFO', 'Session data found in localStorage.');
        try {
            const user = JSON.parse(sessionData);
            remoteLog('INFO', 'Attempting to validate session for user.', { userId: user.ID });
            const result = await postToAction('validateSession', { userId: user.ID, sessionToken: user.SessionToken });

            if (result.valid) {
                remoteLog('INFO', 'Session is valid. Initializing app.');
                await initializeAppData(user);
            } else {
                remoteLog('WARN', 'Session is invalid according to backend. Logging out.');
                logout("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
            }
        } catch (error) {
            remoteLog('ERROR', 'Error during session validation.', { error: error.message, stack: error.stack });
            showLoginHideApp();
        }
    } else {
        remoteLog('INFO', 'No session data found. Showing login.');
        showLoginHideApp();
    }
}

async function login(username, password) {
    try {
        const result = await postToAction('login', { username, password });
        // La respuesta de login ahora contiene el objeto 'user' completo, incluyendo el nuevo SessionToken.
        // Al guardar este objeto, estamos actualizando el token en localStorage automáticamente.
        localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
        await initializeAppData(result.user);
    } catch (error) {
        // El error ya se muestra en postToAction
    }
}

async function initializeAppData(user) {
    return new Promise(async (resolve, reject) => {
        hideLoginShowApp();
        document.getElementById('welcome-message').textContent = `Bienvenido, ${user.Nombre_Usuario}`;
        document.getElementById('welcome-message').style.display = 'block';

        showSkeletonLoader(document.getElementById('contenido'));

        try {
            const result = await postToAction('getCatalogData');
            datosOriginales = result.data.cortes || [];
            sortedCategoriesList = result.data.sortedCategories || []; // <-- NUEVA LÍNEA
            datosTutoriales = result.data.tutoriales || [];
            datosRelay = result.data.relay || [];
            datosLogos = result.data.logos || [];

            // Notification Logic
            const lastTimestampKey = 'lastKnownTimestamp';
            const lastKnownTimestamp = localStorage.getItem(lastTimestampKey);
            const latestItem = datosOriginales.reduce((latest, item) => {
                return (item.timestamp && item.timestamp > (latest.timestamp || 0)) ? item : latest;
            }, {});

            if (latestItem.timestamp) {
                if (!lastKnownTimestamp || latestItem.timestamp > lastKnownTimestamp) {
                    showNotificationToast(`¡Nuevo corte agregado para ${latestItem.marca} ${latestItem.modelo}!`);
                }
                localStorage.setItem(lastTimestampKey, latestItem.timestamp);
            }

            mostrarCategorias();
            resolve(); // Resolve the promise after content is rendered
        } catch (error) {
            document.getElementById('contenido').innerHTML = `<p style="color:red; text-align:center;">No se pudo cargar el catálogo. ${error.message}</p>`;
            reject(error); // Reject the promise on error
        }
    });
}

function logout(reason = null) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_ID_KEY);

    showLoginHideApp(reason);
}

function showLoginHideApp(reason = null) {
    // La lógica de visibilidad es crítica y debe ejecutarse sin interrupciones.
    try {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';

        const container = document.querySelector('.container');
        if (container) container.style.display = 'none';

        const footer = document.querySelector('.footer');
        if (footer) footer.style.display = 'none';

        const welcomeMsg = document.getElementById('welcome-message');
        if (welcomeMsg) welcomeMsg.style.display = 'none';

        const loginModal = document.getElementById('login-modal');
        if (loginModal) loginModal.style.display = 'flex';

        const loginError = document.getElementById('login-error');
        if (loginError) {
            if (reason) {
                loginError.textContent = reason;
                loginError.style.display = 'block';
            } else {
                loginError.style.display = 'none';
            }
        }

        const usernameInput = document.getElementById('username');
        if (usernameInput) usernameInput.value = '';

        const passwordInput = document.getElementById('password');
        if (passwordInput) passwordInput.value = '';

    } catch (e) {
        // Si incluso la lógica de visibilidad falla, loguear localmente.
        debugLog('CRITICAL_ERROR', 'Fallo al modificar la visibilidad de los elementos base.', { error: e.message, stack: e.stack });
    }

    // El logging es secundario y se aísla para que no interrumpa el renderizado.
    try {
        remoteLog('INFO', 'showLoginHideApp finalizado.', { reason });
    } catch (e) {
        // El fallo de remoteLog ya se captura internamente, no es necesario hacer nada aquí.
    }
}

function hideLoginShowApp() {
    remoteLog('INFO', 'hideLoginShowApp called');
    // Ocultar splash y login
    const splash = document.getElementById('splash-screen');
    splash.style.opacity = '0';
    setTimeout(() => {
        splash.style.display = 'none';
    }, 500); // Coincide con la transición de opacidad

    document.getElementById('login-modal').style.display = 'none';
    remoteLog('INFO', 'Login modal display style set to none.');

    // Mostrar contenido principal y footer
    document.querySelector('.container').style.display = 'block';
    const footer = document.querySelector('.footer');
    if (footer) footer.style.display = 'block';

    // Cargar nombre de usuario en el menú lateral
    const menuUsername = document.getElementById('menu-username');
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (menuUsername && session && session.Nombre_Usuario) {
        menuUsername.textContent = session.Nombre_Usuario;
    }

    // Show developer tools button if user has the role
    const devToolsBtn = document.getElementById('dev-tools-btn');
    const userRole = session ? session.Privilegios : '';

    if (devToolsBtn && userRole === 'Desarrollador') {
        devToolsBtn.style.display = 'flex';
    }

    // Show Inbox button for relevant roles
    const inboxBtn = document.getElementById('inbox-btn');
    if (inboxBtn && ['Desarrollador', 'Gefe', 'Supervisor'].includes(userRole)) {
        inboxBtn.style.display = 'flex';
    }
}


document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = sanitizeInput(document.getElementById('username').value);
    const password = document.getElementById('password').value; // Eliminado sanitizeInput
    login(username, password);
});

document.getElementById('forgot-password-link').addEventListener('click', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const message = encodeURIComponent(`Hola, necesito recuperar mi contraseña. Mi nombre de usuario es: ${username}`);
    const whatsappUrl = `https://wa.me/50488422786?text=${message}`;
    window.open(whatsappUrl, '_blank');
});

// Listener para detectar cambios de sesión en otras pestañas
window.addEventListener('storage', (event) => {
    if (event.key === 'session_update' || event.key === SESSION_ID_KEY) {
        checkSession();
    }
});

function showSkeletonLoader(container) {
    let skeletonHTML = '<div class="skeleton-grid">';
    for (let i = 0; i < 10; i++) { // Muestra 10 tarjetas esqueleto
        skeletonHTML += '<div class="skeleton-card"></div>';
    }
    skeletonHTML += '</div>';
    container.innerHTML = skeletonHTML;
}

// --- VARIABLES GLOBALES DE DATOS ---
let datosOriginales = [], sortedCategoriesList = [], datosFiltrados = [], datosTutoriales = [], datosRelay = [];
let estado = { nivel: "categorias", categoria: null, marca: null, modelo: null };
let appOpenedFromLink = false;

const backSvg = '<svg style="width:20px;height:20px;margin-right:5px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';

// --- Función para crear carruseles (Movida al ámbito global para evitar ReferenceError) ---
const crearCarrusel = (titulo, items, cardGenerator) => {
    const cont = document.getElementById("contenido"); // Asegurarse que el contenedor sea accesible
    if (!items || items.length === 0 || !cont) return;

    const section = document.createElement('div');
    const title = document.createElement('h4');
    title.textContent = titulo;
    title.style.marginTop = '40px';
    section.appendChild(title);

    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';
    const carouselTrack = document.createElement('div');
    carouselTrack.className = 'carousel-track';

    items.forEach(item => {
        const card = cardGenerator(item);
        carouselTrack.appendChild(card);
    });
    carouselContainer.appendChild(carouselTrack);

    // --- Lógica de Navegación Generalizada ---
    const getVisibleCards = () => {
        const containerWidth = carouselContainer.offsetWidth;
        const cardWidth = 140 + 20; // Ancho de la tarjeta + margen
        return Math.floor(containerWidth / cardWidth) || 1;
    };

    if (items.length > getVisibleCards()) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'carousel-btn prev';
        prevBtn.innerHTML = '&#10094;';
        carouselContainer.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'carousel-btn next';
        nextBtn.innerHTML = '&#10095;';
        carouselContainer.appendChild(nextBtn);

        const cardWidth = 140 + 20;

        const updateCarouselButtons = () => {
            const scrollLeft = carouselTrack.scrollLeft;
            const maxScrollLeft = carouselTrack.scrollWidth - carouselTrack.clientWidth;
            prevBtn.style.display = scrollLeft > 0 ? 'flex' : 'none';
            nextBtn.style.display = scrollLeft < maxScrollLeft - 1 ? 'flex' : 'none';
        };

        nextBtn.addEventListener('click', () => {
            carouselTrack.scrollBy({ left: cardWidth * getVisibleCards(), behavior: 'smooth' });
        });

        prevBtn.addEventListener('click', () => {
            carouselTrack.scrollBy({ left: -cardWidth * getVisibleCards(), behavior: 'smooth' });
        });

        carouselTrack.addEventListener('scroll', () => setTimeout(updateCarouselButtons, 150));
        window.addEventListener('resize', () => setTimeout(updateCarouselButtons, 150));
        setTimeout(updateCarouselButtons, 150); // Llamada inicial
    }

    section.appendChild(carouselContainer);
    cont.appendChild(section);
};

// La función syncAndFetchData ha sido eliminada. La carga de datos ahora se centraliza en initializeAppData.

function mostrarSeccion(seccion) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput.value !== '') {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.section-btn').forEach(b => b.classList.remove('active'));

    const containerId = `contenido${seccion === 'cortes' ? '' : '-' + seccion}`;
    const renderFunction = {
        cortes: mostrarCategorias,
        tutoriales: mostrarContenidoTutoriales,
        relay: mostrarContenidoRelay
    }[seccion];

    document.getElementById(containerId).style.display = 'block';
    document.getElementById(`btn-${seccion}`).classList.add('active');

    if (renderFunction) {
        renderFunction();
    }
}

function irAPaginaPrincipal() {
    mostrarSeccion('cortes');
}

function mostrarContenidoTutoriales() {
    const cont = document.getElementById("contenido-tutoriales");
    cont.innerHTML = "<h4>Tutoriales</h4>";
    const grid = document.createElement("div"); grid.className = "grid";
    if (!datosTutoriales || datosTutoriales.length === 0) {
        cont.innerHTML += "<p>No hay tutoriales disponibles.</p>";
        return;
    }

    datosTutoriales.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarDetalleTutorial(item);

        const img = document.createElement("img");
        img.src = getImageUrl(item.Imagen);
        img.alt = item.Tema;
        card.appendChild(img);

        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = item.Tema;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarCategoriasPorMarca(marca) {
    estado = { nivel: "categoriasPorMarca", marca: marca };
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="irAPaginaPrincipal()">${backSvg} Volver</span><h4>Categorías para ${marca}</h4>`;

    const categoriasDeMarca = [...new Set(datosOriginales
        .filter(item => item.marca === marca)
        .map(item => item.categoria))]
        .filter(Boolean).sort();

    const grid = document.createElement("div");
    grid.className = "grid";
    categoriasDeMarca.forEach(cat => {
        const ejemplo = datosOriginales.find(item => item.categoria === cat && item.marca === marca && item.imagenVehiculo);
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarModelos(cat, marca); // Ahora sí se pasa la categoría
        const img = document.createElement("img");
        img.src = getImageUrl(ejemplo?.imagenVehiculo);
        img.alt = `Categoría ${cat}`;
        card.appendChild(img);
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = cat;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarContenidoRelay() {
    const cont = document.getElementById("contenido-relay");
    cont.innerHTML = "<h4>Configuración del Relay</h4>";
    const grid = document.createElement("div"); grid.className = "grid";
    if (!datosRelay || datosRelay.length === 0) {
        cont.innerHTML += "<p>No hay configuraciones de relay disponibles.</p>";
        return;
    }

    datosRelay.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarDetalleRelay(item);

        const img = document.createElement("img");
        img.src = getImageUrl(item.imagen);
        img.alt = item.configuracion;
        card.appendChild(img);

        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = item.configuracion;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function handleInModalEdit(itemId, fieldName, iconElement) {
    const label = iconElement.parentElement.querySelector('strong').textContent.replace(':', '');
    const newValue = prompt(`Editar valor para "${label}":`);
    if (newValue && newValue.trim() !== '') {
        const parentP = iconElement.parentElement;
        const contentSpan = parentP.querySelector('.field-value');
        contentSpan.textContent = newValue;
        contentSpan.classList.remove('empty-field');
        iconElement.style.color = '#ccc';
        iconElement.style.cursor = 'not-allowed';
        iconElement.onclick = null;
        // NOTE: Backend saving is intentionally skipped as per instructions.
        alert('Valor actualizado visualmente. El guardado en la base de datos no está implementado en este paso.');
    }
}

function crearElementoDetalle(label, value, itemId, fieldName) {
    const p = document.createElement("p");
    const hasValue = value && value.trim() !== '';
    const content = hasValue ? value.replace(/\n/g, '<br>') : 'No especificado';
    const contentClass = hasValue ? 'field-value' : 'field-value empty-field';
    const iconStyle = hasValue ? 'color: #ccc; cursor: not-allowed;' : 'color: #007bff; cursor: pointer;';
    const onClickAction = hasValue ? '' : `handleInModalEdit('${itemId}', '${fieldName}', this)`;

    p.innerHTML = `<strong>${label}:</strong> <span class="${contentClass}">${content}</span> <i class="fa-solid fa-pencil edit-icon" style="margin-left: 8px; font-size: 0.8em; ${iconStyle}" onclick="${onClickAction}"></i>`;
    return p;
}

function crearImagenDetalle(label, value, container, { extraClass = '', feedbackActions = null } = {}) {
    if (!value) return;

    const wrapper = document.createElement('div');
    const h = document.createElement("h4");
    h.textContent = label;
    wrapper.appendChild(h);

    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-container-with-feedback';

    const img = document.createElement("img");
    img.src = getImageUrl(value);
    img.alt = label;
    if (extraClass) img.classList.add(extraClass);
    img.onclick = () => mostrarLightbox(value);
    imgContainer.appendChild(img);

    if (feedbackActions) {
        const overlay = document.createElement('div');
        overlay.className = 'feedback-overlay';
        overlay.appendChild(feedbackActions.util);
        overlay.appendChild(feedbackActions.report);
        imgContainer.appendChild(overlay);
    }

    wrapper.appendChild(imgContainer);
    container.appendChild(wrapper);
}


function crearVideoDetalle(label, value, container) {
    if (!value) return;
    const videoId = extractYouTubeId(String(value).trim());
    if (!videoId) return;

    const h = document.createElement("h4");
    h.textContent = label;
    container.appendChild(h);

    const iframeContainer = document.createElement("div");
    iframeContainer.style.cssText = "position:relative; padding-bottom:56.25%; height:0; margin-bottom:20px;";
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${videoId}`;
    iframe.title = label;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.style.cssText = "border:none; position:absolute; top:0; left:0; width:100%; height:100%;";
    iframe.dataset.originalSrc = iframe.src;
    iframeContainer.appendChild(iframe);
    container.appendChild(iframeContainer);
}

const uiState = { isModalOpen: false, isSearchActive: false };

window.addEventListener('popstate', (event) => {
    const state = event.state || {};
    if (uiState.isModalOpen && !state.modal) {
        cerrarModalVisualmente();
    } else if (uiState.isSearchActive && !state.search) {
        uiState.isSearchActive = false;
        const searchInput = document.getElementById('searchInput');
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.blur();
        document.body.classList.remove('search-active');
    }
});

function pushState(state) {
    history.pushState(state, '');
}

function crearBotonCompartir(seccion, id, titulo) {
    const shareBtn = document.createElement("button");
    shareBtn.textContent = "Compartir";
    shareBtn.className = "shareBtn";
    shareBtn.style.cssText = "color:white; background:#007bff; border:none; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: background-color 0.3s;";
    const shareUrl = `${window.location.origin}${window.location.pathname}?seccion=${seccion}&id=${id}`;

    shareBtn.onclick = async () => {
        const shareData = { title: 'GPSpedia Detalle', text: `Mira este detalle: ${titulo}`, url: shareUrl };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareUrl);
                shareBtn.textContent = '¡Enlace Copiado!';
                setTimeout(() => { shareBtn.textContent = 'Compartir'; }, 2000);
            }
        } catch (err) {
            console.error('Error al compartir/copiar:', err);
            alert('No se pudo compartir o copiar el enlace.');
        }
    };
    return shareBtn;
}

function mostrarDetalleTutorial(item) {
    pushState({ modal: true, type: 'tutorial', id: item.id });
    uiState.isModalOpen = true;

    const cont = document.getElementById("detalleCompleto");
    cont.innerHTML = "";

    // Header
    const headerDiv = document.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Cerrar";
    closeBtn.onclick = () => cerrarModal();
    closeBtn.className = "backBtn";
    closeBtn.style.cssText = "color:white; background:#dc3545; border:none; margin:0;";
    headerDiv.appendChild(closeBtn);
    headerDiv.appendChild(crearBotonCompartir('tutoriales', item.id, item.tema));
    cont.appendChild(headerDiv);

    const title = document.createElement("h2");
    title.textContent = item.tema;
    title.style.cssText = "color:#007bff; border-bottom:3px solid #007bff; padding-bottom:10px;";
    cont.appendChild(title);

    const campos = [
        { label: "Cómo identificarlo", value: item.comoIdentificarlo, field: 'comoIdentificarlo' },
        { label: "Dónde encontrarlo", value: item.dondeEncontrarlo, field: 'dondeEncontrarlo' },
        { label: "Detalles", value: item.detalles, field: 'detalles' }
    ];
    campos.forEach(c => {
        cont.appendChild(crearElementoDetalle(c.label, c.value, item.id, c.field));
    });

    crearImagenDetalle("Imagen", item.Imagen, cont);
    crearVideoDetalle("Video Guía", item.Video, cont);
    document.getElementById("modalDetalle").classList.add("visible");
}

function mostrarDetalleRelay(item) {
    pushState({ modal: true, type: 'relay', id: item.id });
    uiState.isModalOpen = true;

    const cont = document.getElementById("detalleCompleto");
    cont.innerHTML = ""; // Limpiar contenido anterior

    // --- 1. Botones de Cerrar y Compartir ---
    const headerDiv = document.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"; // Reducido el margen
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Cerrar";
    closeBtn.onclick = () => cerrarModal();
    closeBtn.className = "backBtn";
    closeBtn.style.cssText = "color:white; background:#dc3545; border:none; margin:0;";
    headerDiv.appendChild(closeBtn);
    headerDiv.appendChild(crearBotonCompartir('relay', item.id, item.configuracion));
    cont.appendChild(headerDiv);

    const title = document.createElement("h2");
    title.textContent = `Detalle de: ${item.configuracion}`;
    title.style.cssText = "color:#007bff; border-bottom:3px solid #007bff; padding-bottom:10px;";
    cont.appendChild(title);

    const campos = [
        { label: "Función", value: item.funcion, field: 'funcion' },
        { label: "Vehículo donde se utiliza", value: item.vehiculoDondeSeUtiliza, field: 'vehiculoDondeSeUtiliza' },
        { label: "PIN 30 (entrada)", value: item.pin30Entrada, field: 'pin30Entrada' },
        { label: "PIN 85 (bobina +)", value: item.pin85Bobina, field: 'pin85BobinaPositivo' },
        { label: "PIN 86 (bobina - )", value: item.pin86Bobina, field: 'pin86bobinaNegativo' },
        { label: "PIN 87a (comun cerrado)", value: item.pin87aComunCerrado, field: 'pin87aComunCerrado' },
        { label: "PIN 87 (Comunmente Abierto)", value: item.pin87ComunmenteAbierto, field: 'pin87ComunmenteAbierto' },
        { label: "Observación", value: item.observacion, field: 'observacion' }
    ];
    campos.forEach(c => {
        cont.appendChild(crearElementoDetalle(c.label, c.value, item.id, c.field));
    });
    crearImagenDetalle("Diagrama", item.imagen, cont);
    const relayImg = cont.querySelector('img[alt="Imagen"]');
    if (relayImg) {
        relayImg.style.maxHeight = '250px';
    }
    document.getElementById("modalDetalle").classList.add("visible");
}

function getLogoUrlForMarca(marca, categoria) {
    if (!datosLogos || !datosLogos.length || !marca) {
        debugLog('LOGO_SEARCH_FAIL', 'Datos de logo o marca no disponibles.', { marca, categoria });
        return null;
    }

    const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

    const normalizedMarca = normalize(marca);
    const normalizedCategoria = normalize(categoria);

    // 1. Find all logos that could potentially match the brand name.
    const potentialMatches = datosLogos.filter(logo => {
        const normalizedLogoMarca = normalize(logo.nombreMarca);
        return normalizedLogoMarca.startsWith(normalizedMarca);
    });

    if (potentialMatches.length === 0) {
        debugLog('LOGO_SEARCH_FAIL', 'No se encontraron logos para la marca.', { marca: normalizedMarca });
        return null;
    }

    if (potentialMatches.length === 1) {
        return potentialMatches[0].urlLogo;
    }

    // 2. Multiple matches exist. Use category to find the best one.
    let bestMatch = null;

    // Look for a category-specific match first.
    if (normalizedCategoria) {
        // Handle synonyms for motorcycles to make matching more robust.
        const catSynonyms = (normalizedCategoria === 'motos' || normalizedCategoria === 'motocicletas')
            ? ['motos', 'motocicletas']
            : [normalizedCategoria];

        for (const synonym of catSynonyms) {
            bestMatch = potentialMatches.find(logo => normalize(logo.nombreMarca).includes(synonym));
            if (bestMatch) break; // Found a specific match, stop searching.
        }
    }

    // 3. If no category-specific match was found, find the "generic" or base logo.
    // The base logo is the one whose normalized name exactly matches the brand name.
    if (!bestMatch) {
        bestMatch = potentialMatches.find(logo => normalize(logo.nombreMarca) === normalizedMarca);
    }

    // As a final fallback, if we still don't have a clear winner (e.g., no exact base match),
    // find the shortest name, assuming it's the base one (e.g., "Honda" is shorter than "Honda Motocicletas").
    if (!bestMatch) {
         bestMatch = potentialMatches.reduce((prev, current) => {
            return (prev.nombreMarca.length < current.nombreMarca.length) ? prev : current;
        });
    }

    // Return the URL of the best match found, or null if something went wrong.
    if (bestMatch) {
        return bestMatch.urlLogo;
    } else {
        // This case should be rare, but as a last resort, return the first potential match.
        debugLog('LOGO_SEARCH_WARN', 'Múltiples logos encontrados pero no se pudo desambiguar. Devolviendo el primero.', { marca, categoria, matches: potentialMatches });
        return potentialMatches.length > 0 ? potentialMatches[0].urlLogo : null;
    }
}

function getImageUrl(fileId, size = 'default') {
    // Si no hay fileId, devolver la imagen de placeholder.
    if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
        return "https://placehold.co/280x200/cccccc/333333?text=Sin+Imagen";
    }

    // La lógica de parsing de URL se ha eliminado. La función ahora espera solo un fileId.
    // Simplemente construimos la URL del servicio de imágenes. El parámetro 'size' se reserva para futuras optimizaciones.
    return `${API_ENDPOINTS.IMAGE}?fileId=${fileId.trim()}`;
}

function mostrarLightbox(src) {
    const lightboxImg = document.getElementById("lightboxImg");
    lightboxImg.src = ""; // Limpiar imagen anterior para evitar parpadeos

    // Usar la función robusta 'getImageUrl' para obtener la URL base
    // y luego ajustar el tamaño para alta resolución.
    let finalUrl = getImageUrl(src);

    // Si la URL fue convertida a un thumbnail de Google, reemplazar 'sz=w1000' por 'sz=w2000' para mayor calidad.
    // Si no, usar la URL tal cual (para imágenes que no son de Drive).
    if (finalUrl.includes('drive.google.com/thumbnail')) {
        finalUrl = finalUrl.replace('sz=w1000', 'sz=w2000');
    }

    lightboxImg.src = finalUrl;
    document.getElementById("lightbox").classList.add("visible");
}

function cerrarModal() {
    cerrarModalVisualmente();
    if (history.state && history.state.modal) {
        history.back();
    }
    if (appOpenedFromLink) {
        appOpenedFromLink = false;
        history.pushState({}, '', window.location.pathname);
        checkSession();
    }
}

function cerrarModalVisualmente() {
    const modal = document.getElementById("modalDetalle");
    if (!modal.classList.contains("visible")) return;

    const detalleCont = document.getElementById("detalleCompleto");
    detalleCont.querySelectorAll('iframe').forEach(iframe => { if (iframe.src) iframe.src = ''; });
    modal.classList.remove("visible");
    uiState.isModalOpen = false;
}

function cerrarLightbox() { document.getElementById("lightbox").classList.remove("visible"); }

function extractYouTubeId(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function mostrarDetalleModal(item) {
    pushState({ modal: true, type: 'corte', id: item.id });
    uiState.isModalOpen = true;

    const cont = document.getElementById("detalleCompleto");
    cont.innerHTML = ""; // Limpiar contenido anterior

    // --- 1. Botones de Cerrar y Compartir ---
    const headerDiv = document.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Cerrar";
    closeBtn.onclick = () => cerrarModal();
    closeBtn.className = "backBtn";
    closeBtn.style.cssText = "color:white; background:#dc3545; border:none; margin:0;";
    headerDiv.appendChild(closeBtn);
    const yearRange = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;
    const titulo = `${item.marca} ${item.modelo} ${yearRange || ''}`;
    headerDiv.appendChild(crearBotonCompartir('cortes', item.id, titulo));
    cont.appendChild(headerDiv);

    // --- 2. Nuevo Encabezado Detallado ---
    const titleContainer = document.createElement("div");
    titleContainer.style.cssText = "border-bottom: 3px solid #007bff; padding-bottom: 8px; margin-bottom: 10px;"; // Reducido el padding y margen

    // 2.1 Título Principal (Nombre del Modelo y Logo)
    const mainHeaderDiv = document.createElement('div');
    mainHeaderDiv.style.cssText = "display: flex; justify-content: flex-start; align-items: center; gap: 15px;";

    const logoUrl = getLogoUrlForMarca(item.marca, item.categoria);
    if (logoUrl) {
        const logoImg = document.createElement("img");
        logoImg.src = getImageUrl(logoUrl);
        logoImg.style.cssText = "height: 40px; width: auto; max-width: 100px; object-fit: contain; background: transparent; border: none; box-shadow: none; flex-shrink: 0;";
        mainHeaderDiv.appendChild(logoImg);
    }

    const title = document.createElement("h2");
    title.textContent = item.modelo;
    title.style.cssText = "color:#007bff; margin: 0; padding: 0;";
    mainHeaderDiv.appendChild(title);

    titleContainer.appendChild(mainHeaderDiv);

    // 2.2 Sub-encabezados (Versión/Encendido, Años, Categoría)
    const subHeaderDiv = document.createElement('div');
    subHeaderDiv.style.marginTop = '10px';

    const subHeaderText = document.createElement('p');
    subHeaderText.style.cssText = "margin: 0; padding: 0; color: #555;";

    // Punto 2 y 3: Versión/Encendido y Rango de Años (letra más pequeña)
    const equipamiento = item.versionesAplicables || item.tipoEncendido || '';
    const yearRangeText = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;
    subHeaderText.innerHTML = `<span style="font-size: 0.9em;">${equipamiento} | ${yearRangeText}</span>`;

    // Punto 4: Categoría (letra aún más pequeña)
    if(item.categoria) {
         subHeaderText.innerHTML += `<br><span style="font-size: 0.8em; color: #777;">${item.categoria}</span>`;
    }

    subHeaderDiv.appendChild(subHeaderText);
    titleContainer.appendChild(subHeaderDiv);
    cont.appendChild(titleContainer);

    // --- 3. Nota Importante (si existe) ---
    if (item.notaImportante) {
        const p = document.createElement("p");
        p.innerHTML = `<strong style="color:red;">Nota Importante:</strong> <span style="color:#cc0000; font-weight: bold;">${item.notaImportante} ⚠️</span>`;
        cont.appendChild(p);
    }

    // --- 4. Imagen del Vehículo (si existe) ---
    crearImagenDetalle("Vehículo", item.imagenVehiculo, cont, { extraClass: 'img-vehiculo-modal' });


    // --- Lógica de Cortes Refactorizada ---
    const crearPanelCorte = (corteIndex, esRecomendado = false) => {
        const tipoCorte = item[`tipoCorte${corteIndex}`];
        if (!tipoCorte) return null;

        const panel = document.createElement("div");
        panel.className = esRecomendado ? "panel-recomendado" : "panel-desplegable";
        if(esRecomendado) {
            panel.style.cssText = "padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; background-color: #f9f9f9;";
        }


        // Descripción (Ubicación y Color de Cable)
        const ubicacion = item[`ubicacionCorte${corteIndex}`];
        const colorCable = item[`colorCableCorte${corteIndex}`];
        if (ubicacion || colorCable) {
            let descripcionHTML = '';
            if (ubicacion) descripcionHTML += `<strong>Ubicación:</strong> ${ubicacion}<br>`;
            if (colorCable) descripcionHTML += `<strong>Color(es) de Cable:</strong> ${colorCable}`;
            const p = document.createElement("p");
            p.innerHTML = descripcionHTML;
            panel.appendChild(p);
        }

        // Creación de botones de feedback
        const utilBtn = document.createElement("button");
        utilBtn.innerHTML = `<i class="fa-solid fa-thumbs-up"></i>`;
        utilBtn.title = `Marcar como útil (${item[`utilCorte${corteIndex}`] || 0})`;
        utilBtn.className = "feedback-btn-overlay util-btn";
        utilBtn.onclick = () => handleLike(item.id, corteIndex, utilBtn);

        const reportBtn = document.createElement("button");
        reportBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;
        reportBtn.title = "Reportar un problema";
        reportBtn.className = "feedback-btn-overlay report-btn";
        reportBtn.onclick = () => toggleReportSection(item.id, corteIndex);

        // Imagen del Corte con Overlays de Feedback
        crearImagenDetalle("Imagen del Corte", item[`imgCorte${corteIndex}`], panel, {
            extraClass: esRecomendado ? 'img-corte' : '',
            feedbackActions: { util: utilBtn, report: reportBtn }
        });

        // Link a Configuración de Relay (si existe) - ANTES del colaborador
        const configRelay = item[`configRelay${corteIndex}`];
        const relayMatch = datosRelay.find(r => r.configuracion === configRelay);
        if (configRelay && relayMatch) {
            const relayLink = document.createElement("a");
            relayLink.href = "#";
            relayLink.textContent = "Ver Configuración de Relay";
            relayLink.style.display = "block";
            relayLink.style.marginTop = "10px";
            relayLink.onclick = (e) => { e.preventDefault(); mostrarDetalleRelayAnidado(configRelay); };
            panel.appendChild(relayLink);
        }

        // Información del Colaborador (fuera del overlay, alineado a la izquierda)
        const collaboratorName = item[`colaboradorCorte${corteIndex}`];
        if (collaboratorName) {
            const collaboratorInfo = document.createElement('p');
            collaboratorInfo.style.cssText = 'text-align: left; font-size: 0.9em; color: #555; margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px;';
            collaboratorInfo.innerHTML = `Colaborador: <strong>${collaboratorName}</strong>`;
            panel.appendChild(collaboratorInfo);
        }

        // Sección de Reporte (oculta por defecto)
        const reportSection = document.createElement("div");
        reportSection.id = `report-section-${item.id}-${corteIndex}`;
        reportSection.style.display = 'none';
        reportSection.style.marginTop = '15px';
        reportSection.innerHTML = `<textarea id="report-input-${item.id}-${corteIndex}" placeholder="Describe el problema..." style="width:100%; min-height:60px;"></textarea><button id="submit-report-${item.id}-${corteIndex}" style="margin-top:5px;">Enviar</button>`;
        panel.appendChild(reportSection);

        return panel;
    };

    const allCortes = [];
    for (let i = 1; i <= 3; i++) {
        if (item[`tipoCorte${i}`]) {
            allCortes.push({
                corteIndex: i,
                tipoCorte: item[`tipoCorte${i}`],
                utilCount: parseInt(item[`utilCorte${i}`] || 0, 10)
            });
        }
    }
    allCortes.sort((a, b) => b.utilCount - a.utilCount);

    // --- 5. Corte Recomendado (si hay cortes) ---
    if (allCortes.length > 0) {
        const recomendado = allCortes[0];
        const tituloRecomendado = document.createElement("h4");
        tituloRecomendado.innerHTML = `<i class="fa-solid fa-star" style="color: #ffc107;"></i> Corte Recomendado: ${recomendado.tipoCorte}`;
        cont.appendChild(tituloRecomendado);
        const panelRecomendado = crearPanelCorte(recomendado.corteIndex, true);
        if (panelRecomendado) cont.appendChild(panelRecomendado);
    }

    // --- Contenedor para todas las secciones de acordeón ---
    const accordionContainer = document.createElement('div');
    cont.appendChild(accordionContainer);

    const createAccordionSection = (title, contentGenerator) => {
        const content = contentGenerator();
        if (!content) return; // No crear la sección si no hay contenido

        const btn = document.createElement("button");
        btn.className = "accordion-btn";
        btn.innerHTML = `${title} <svg class="accordion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        accordionContainer.appendChild(btn);
        accordionContainer.appendChild(content);
    };

    // --- 6. Otros Cortes (si hay más de 1) ---
    if (allCortes.length > 1) {
        const otrosCortes = allCortes.slice(1);
        const tituloOtros = document.createElement("h4");
        tituloOtros.textContent = "Otros Cortes Disponibles";
        tituloOtros.style.marginTop = '25px';
        accordionContainer.appendChild(tituloOtros);

        otrosCortes.forEach(corte => {
            const btn = document.createElement("button");
            btn.className = "accordion-btn";
            btn.innerHTML = `${corte.tipoCorte} <svg class="accordion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
            accordionContainer.appendChild(btn);
            const panel = crearPanelCorte(corte.corteIndex, false);
            if (panel) accordionContainer.appendChild(panel);
        });
    }

    // --- REORDENAMIENTO DE SECCIONES SEGÚN ESPECIFICACIÓN ---

    // --- 1. Detalles de Apertura ---
    createAccordionSection("Detalles de Apertura", () => {
        if (!item.apertura && !item.imgApertura) return null;
        const panel = document.createElement("div");
        panel.className = "panel-desplegable";
        if (item.apertura) panel.appendChild(crearElementoDetalle("Procedimiento", item.apertura));
        crearImagenDetalle("Imagen de Apertura", item.imgApertura, panel);
        return panel;
    });

    // --- 2. Cable de Alimentación ---
    createAccordionSection("Cable de Alimentación", () => {
        if (!item.cableAlimen && !item.imgCableAlimen) return null;
        const panel = document.createElement("div");
        panel.className = "panel-desplegable";
        if (item.cableAlimen) panel.appendChild(crearElementoDetalle("Ubicación y color", item.cableAlimen));
        crearImagenDetalle("Imagen de Alimentación", item.imgCableAlimen, panel);
        return panel;
    });

    // --- 3. Video Guía de Desarme ---
    createAccordionSection("Video Guía de Desarme", () => {
        if (!item.videoGuiaDesarmeUrl) return null;
        const panel = document.createElement("div");
        panel.className = "panel-desplegable";
        crearVideoDetalle(null, item.videoGuiaDesarmeUrl, panel);
        return panel;
    });

    // --- 4. Notas Personales (ELIMINADO) ---
    // La sección de notas personales ha sido eliminada según las especificaciones.

    document.getElementById("modalDetalle").classList.add("visible");
}

function mostrarDetalleRelayAnidado(configRelay) {
    const relayData = datosRelay.find(r => r.configuracion === configRelay);
    if (!relayData) {
        alert("No se encontraron detalles para esta configuración de relay.");
        return;
    }

    // Crear un nuevo modal en lugar de reusar el existente
    const nestedModal = document.createElement('div');
    nestedModal.className = 'info-modal';
    nestedModal.style.display = 'flex';
    nestedModal.style.zIndex = '2200'; // Asegurar que esté por encima del modal de detalles

    const modalContent = document.createElement('div');
    modalContent.className = 'info-modal-content';

    const closeBtn = document.createElement('span');
    closeBtn.className = 'info-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => document.body.removeChild(nestedModal);

    modalContent.appendChild(closeBtn);

    const title = document.createElement("h3");
    title.textContent = `Configuración de Relay: ${relayData.configuracion}`;
    modalContent.appendChild(title);

    crearImagenDetalle("Diagrama", relayData.imagen, modalContent);
    const relayImg = modalContent.querySelector('img');
    if (relayImg) {
        relayImg.style.maxHeight = '250px';
    }

    nestedModal.appendChild(modalContent);
    document.body.appendChild(nestedModal);
}

function filtrarContenido(textoBusqueda) {
    const busqueda = textoBusqueda.toLowerCase().trim();
    if (!busqueda) {
        datosFiltrados = [];
        estado.nivel = "categorias";
        mostrarCategorias();
        return;
    }
    const palabrasBusqueda = busqueda.split(' ').filter(p => p);
    datosFiltrados = datosOriginales.filter(item => {
        const itemTexto = `${item.categoria} ${item.marca} ${item.modelo} ${item.anoDesde} ${item.anoHasta} ${item.tipoEncendido} ${item.versionesAplicables}`.toLowerCase();
        return palabrasBusqueda.every(palabra => itemTexto.includes(palabra));
    });

    if (datosFiltrados.length > 0) {
        mostrarResultadosBusquedaMarca(busqueda);
    } else {
        document.getElementById("contenido").innerHTML = `<p style="text-align:center; padding: 20px;">No se encontraron resultados para "${textoBusqueda}".</p>`;
    }
    estado.nivel = "busqueda";
}

function mostrarResultadosBusquedaMarca(busquedaTexto) {
    const cont = document.getElementById("contenido");
    if (datosFiltrados.length === 1) {
        mostrarDetalleModal(datosFiltrados[0]);
        const yearRange = datosFiltrados[0].anoHasta ? `${datosFiltrados[0].anoDesde} - ${datosFiltrados[0].anoHasta}` : datosFiltrados[0].anoDesde;
        cont.innerHTML = `<h4>Resultado Exacto Encontrado</h4><p>Abriendo detalle de ${datosFiltrados[0].modelo} ${yearRange || ''}.</p>`;
        return;
    }
    cont.innerHTML = `<h4>Resultados de búsqueda para: "${busquedaTexto}"</h4>`;
    const marcasUnicas = [...new Set(datosFiltrados.map(item => item.marca))].sort();

    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
    grid.style.gap = "30px";

    marcasUnicas.forEach(marca => {
        const logoUrl = getLogoUrlForMarca(marca, null);
        const card = document.createElement("div");
        card.className = "card brand-logo-item"; // Usar el estilo de logo
        card.onclick = () => mostrarResultadosBusquedaModelo(busquedaTexto, marca);

        const img = document.createElement("img");
        img.src = getImageUrl(logoUrl);
        img.alt = `Marca ${marca}`;
        img.loading = "lazy";
        card.appendChild(img);

        // Opcional: Agregar un texto sutil debajo del logo si se desea
        const brandName = document.createElement('p');
        brandName.textContent = marca;
        brandName.style.textAlign = 'center';
        brandName.style.marginTop = '8px';
        brandName.style.fontWeight = 'bold';
        brandName.style.fontSize = '0.9em';
        card.appendChild(brandName);

        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarResultadosBusquedaModelo(busquedaTexto, marcaFiltro) {
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="mostrarResultadosBusquedaMarca('${busquedaTexto}')">${backSvg} Volver a Marcas</span>
                      <h4>Modelos de ${marcaFiltro} (Búsqueda: "${busquedaTexto}")</h4>`;
    const modelosFiltrados = datosFiltrados.filter(item => item.marca === marcaFiltro);
    const modelosUnicos = [...new Map(modelosFiltrados.map(item => [item.modelo, item])).values()].sort((a,b) => a.modelo.localeCompare(b.modelo));

    const grid = document.createElement("div"); grid.className = "grid";
    modelosUnicos.forEach(ejemplo => {
        const versiones = modelosFiltrados.filter(item => item.modelo === ejemplo.modelo);
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => (versiones.length === 1) ? mostrarDetalleModal(ejemplo) : mostrarResultadosBusquedaVersion(busquedaTexto, marcaFiltro, ejemplo.modelo);
        const img = document.createElement("img"); img.src = getImageUrl(ejemplo.imagenVehiculo); img.alt = `Modelo ${ejemplo.modelo}`; card.appendChild(img);
        const overlay = document.createElement("div"); overlay.className = "overlay";
        if (versiones.length === 1) {
            const yearRange = ejemplo.anoHasta ? `${ejemplo.anoDesde} - ${ejemplo.anoHasta}` : ejemplo.anoDesde;
            overlay.innerHTML = `<div>${ejemplo.modelo}</div><div style="font-size:0.8em; opacity:0.8; font-weight:normal;">${yearRange || ''} ${ejemplo.tipoEncendido || ''}</div>`;
        } else {
            overlay.innerHTML = `<div>${ejemplo.modelo}</div><div style="font-size:0.8em; opacity:0.8; font-weight:normal;">(${versiones.length} cortes)</div>`;
        }
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarResultadosBusquedaVersion(busquedaTexto, marcaFiltro, modeloFiltro) {
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="mostrarResultadosBusquedaModelo('${busquedaTexto}', '${marcaFiltro}')">${backSvg} Volver a Modelos (${modeloFiltro})</span>
                      <h4>Cortes/Años de ${modeloFiltro}</h4>`;
    const versiones = datosFiltrados.filter(item => item.marca === marcaFiltro && item.modelo === modeloFiltro);
    const grid = document.createElement("div"); grid.className = "grid";
    versiones.forEach(item => {
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => mostrarDetalleModal(item);
        const img = document.createElement("img"); img.src = getImageUrl(item.imagenVehiculo); img.alt = `Corte ${item.anoDesde}`; card.appendChild(img);
        const overlay = document.createElement("div"); overlay.className = "overlay";
        const yearRange = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;
        overlay.innerHTML = `<div style="font-weight:bold;">${yearRange || modeloFiltro}</div><div style="font-size:0.8em; opacity:0.8;">${item.tipoEncendido || ''}</div>`;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarCategorias() {
    if (document.getElementById("searchInput").value.trim()) return;
    estado = { nivel: "categorias", categoria: null };
    const cont = document.getElementById("contenido");
    cont.innerHTML = ""; // Limpiar contenido

    // 1. Mostrar "Últimos Agregados"
    mostrarUltimosAgregados();

    // --- ORDEN CORRECTO DE RENDERIZADO ---
    // 1. Carrusel de Categorías
    const categorias = sortedCategoriesList;
    crearCarrusel('Búsqueda por Categoría', categorias, cat => {
        const ejemplo = datosOriginales.find(item => item.categoria === cat && item.imagenVehiculo);
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarMarcas(cat);
        const img = document.createElement("img");
        img.src = getImageUrl(ejemplo?.imagenVehiculo);
        img.alt = `Categoría ${cat}`;
        card.appendChild(img);
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = cat;
        card.appendChild(overlay);
        return card;
    });

    // 2. Carrusel de Marcas de Vehículos (Excluyendo Motocicletas)
    const marcasVehiculos = [...new Set(datosOriginales
        .filter(item => item.categoria && !['motocicletas', 'motos'].includes(item.categoria.toLowerCase()))
        .map(item => item.marca))]
        .filter(Boolean).sort();

    crearCarrusel('Marcas de Vehículos', marcasVehiculos, marca => {
        const logoUrl = getLogoUrlForMarca(marca, null);
        const card = document.createElement("div");
        card.className = "card brand-logo-item";
        card.onclick = () => mostrarCategoriasPorMarca(marca);
        const img = document.createElement("img");
        img.src = getImageUrl(logoUrl);
        img.alt = `Marca ${marca}`;
        card.appendChild(img);
        return card;
    });

    // 3. Carrusel de Marcas de Motocicletas
    const marcasMotos = [...new Set(datosOriginales
        .filter(item => item.categoria && ['motocicletas', 'motos'].includes(item.categoria.toLowerCase()))
        .map(item => item.marca))]
        .filter(Boolean).sort();

    crearCarrusel('Marcas de Motocicletas', marcasMotos, marca => {
        const logoUrl = getLogoUrlForMarca(marca, 'Motocicletas');
        const card = document.createElement("div");
        card.className = "card brand-logo-item";
        card.onclick = () => mostrarModelos('Motocicletas', marca);
        const img = document.createElement("img");
        img.src = getImageUrl(logoUrl);
        img.alt = `Marca ${marca}`;
        card.appendChild(img);
        return card;
    });
}

function mostrarUltimosAgregados() {
    if (!datosOriginales || datosOriginales.length === 0) return;

    const ultimosCortes = [...datosOriginales]
        .sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
            const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
            if (dateB - dateA !== 0) return dateB - dateA;
            return b.id - a.id;
        })
        .slice(0, 6);

    if (ultimosCortes.length === 0) return;

    crearCarrusel('Últimos Agregados', ultimosCortes, item => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.animation = 'none';
        card.style.opacity = '1';
        card.onclick = () => mostrarDetalleModal(item);

        const img = document.createElement("img");
        img.src = getImageUrl(item.imagenVehiculo);
        img.alt = `${item.marca} ${item.modelo}`;
        img.loading = "lazy";
        card.appendChild(img);

        const overlay = document.createElement("div");
        overlay.className = "overlay";
        const yearRange = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;
        overlay.innerHTML = `<div>${item.marca}</div><div style="font-size:0.8em; opacity:0.8;">${item.modelo} ${yearRange || ''}</div>`;
        card.appendChild(overlay);
        return card;
    });
}

function mostrarMarcas(categoria) {
    estado = { nivel: "marcas", categoria: categoria };
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="irAPaginaPrincipal()">${backSvg} Volver</span><h4>Marcas de ${categoria}</h4>`;
    const itemsInCategory = datosOriginales.filter(item => item.categoria === categoria);
    const marcas = [...new Set(itemsInCategory.map(item => item.marca))].filter(m => m).sort();

    // Adjust grid for logos to be more spacious
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
    grid.style.gap = "30px";

    marcas.forEach(m => {
        const logoUrl = getLogoUrlForMarca(m, categoria);
        const logoContainer = document.createElement("div");
        logoContainer.className = "card brand-logo-item"; // Apply new style
        logoContainer.onclick = () => mostrarModelos(categoria, m);

        const img = document.createElement("img");
        img.src = getImageUrl(logoUrl) || 'https://placehold.co/120x80/cccccc/333333?text=Sin+Logo';
        img.alt = `Marca ${m}`;
        img.loading = "lazy";

        logoContainer.appendChild(img);
        grid.appendChild(logoContainer);
    });
    cont.appendChild(grid);
}

function mostrarVersionesEquipamiento(categoria, marca) {
    estado = { nivel: "versionesEquipamiento", categoria, marca };
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="mostrarMarcas('${categoria}')">${backSvg} Volver</span><h4>Versiones de Equipamiento para ${marca}</h4>`;

    const vehiculosDeMarca = datosOriginales.filter(item => item.categoria === categoria && item.marca === marca);
    const versiones = [...new Set(vehiculosDeMarca.map(item => item.versionesAplicables).filter(v => v))];

    const grid = document.createElement("div");
    grid.className = "grid";

    versiones.forEach(version => {
        const ejemplo = vehiculosDeMarca.find(item => item.versionesAplicables === version && item.imagenVehiculo);
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarModelos(categoria, marca, version); // Pasamos la versión para filtrar

        const img = document.createElement("img");
        img.src = getImageUrl(ejemplo?.imagenVehiculo);
        img.alt = `Versión ${version}`;
        card.appendChild(img);

        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = version;
        card.appendChild(overlay);
        grid.appendChild(card);
    });

    cont.appendChild(grid);
}


function mostrarModelos(categoria, marca, versionEquipamiento = null) {
    estado = { nivel: "modelos", categoria, marca, versionEquipamiento };
    const cont = document.getElementById("contenido");
    const backAction = versionEquipamiento ? `mostrarVersionesEquipamiento('${categoria}', '${marca}')` : `mostrarMarcas('${categoria}')`;
    cont.innerHTML = `<span class="backBtn" onclick="${backAction}">${backSvg} Volver</span><h4>Modelos de ${marca} ${versionEquipamiento || ''}</h4>`;

    let modelosFiltrados = datosOriginales.filter(item => item.categoria === categoria && item.marca === marca);
    if (versionEquipamiento) {
        modelosFiltrados = modelosFiltrados.filter(item => item.versionesAplicables === versionEquipamiento);
    }

    const modelosUnicos = [...new Map(modelosFiltrados.map(item => [item.modelo, item])).values()].sort((a,b) => a.modelo.localeCompare(b.modelo));

    if (modelosUnicos.length === 1) {
        mostrarTiposEncendido(categoria, marca, versionEquipamiento, modelosUnicos[0].modelo);
        return;
    }

    const grid = document.createElement("div"); grid.className = "grid";
    modelosUnicos.forEach(ejemplo => {
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => mostrarTiposEncendido(categoria, marca, versionEquipamiento, ejemplo.modelo);
        const img = document.createElement("img"); img.src = getImageUrl(ejemplo.imagenVehiculo); img.alt = `Modelo ${ejemplo.modelo}`; card.appendChild(img);
        const overlay = document.createElement("div"); overlay.className = "overlay";
        overlay.innerHTML = `<div>${ejemplo.modelo}</div>`;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarTiposEncendido(categoria, marca, versionEquipamiento, modelo) {
     estado = { nivel: "tiposEncendido", categoria, marca, versionEquipamiento, modelo };
    const cont = document.getElementById("contenido");
    const backAction = `mostrarModelos('${categoria}', '${marca}', ${versionEquipamiento ? `'${versionEquipamiento}'` : null})`;
    cont.innerHTML = `<span class="backBtn" onclick="${backAction}">${backSvg} Volver</span><h4>Tipos de Encendido para ${modelo}</h4>`;

    let vehiculos = datosOriginales.filter(item =>
        item.categoria === categoria &&
        item.marca === marca &&
        item.modelo === modelo &&
        (!versionEquipamiento || item.versionesAplicables === versionEquipamiento)
    );

    const tiposEncendido = [...new Set(vehiculos.map(v => v.tipoEncendido).filter(Boolean))];

    if (tiposEncendido.length === 1) {
        mostrarVersiones(vehiculos, categoria, marca, modelo);
        return;
    }

    const grid = document.createElement("div"); grid.className = "grid";
    tiposEncendido.forEach(tipo => {
        const ejemplo = vehiculos.find(v => v.tipoEncendido === tipo);
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => mostrarVersiones(vehiculos.filter(v => v.tipoEncendido === tipo), categoria, marca, modelo);

        const img = document.createElement("img");
        img.src = getImageUrl(ejemplo.imagenVehiculo);
        img.alt = tipo;
        card.appendChild(img);

        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = tipo;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarVersiones(filas, categoria, marca, modelo) {
    estado = { nivel: "versiones", categoria, marca, modelo };
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="mostrarModelos('${categoria}','${marca}')">${backSvg} Volver</span><h4>Cortes/Años de ${modelo}</h4>`;
    const grid = document.createElement("div"); grid.className = "grid";
    filas.forEach(item => {
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => mostrarDetalleModal(item);
        const img = document.createElement("img"); img.src = getImageUrl(item.imagenVehiculo); img.alt = `Corte ${item.anoDesde}`; card.appendChild(img);
        const overlay = document.createElement("div"); overlay.className = "overlay";
        const yearRange = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;
        overlay.innerHTML = `<div style="font-weight:bold;">${yearRange || modelo}</div><div style="font-size:0.8em;">${item.tipoEncendido || ''}</div>`;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

// --- LÓGICA DE NOTIFICACIONES ---
function showNotificationToast(message, duration = 5000) {
    const toast = document.getElementById('notification-toast');
    toast.textContent = message;
    toast.style.display = 'block';
    toast.onclick = () => toast.style.display = 'none';

    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// --- INICIALIZACIÓN Y LÓGICA DE PWA ---
let deferredPrompt;
const installButton = document.getElementById('install-button');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenir que el navegador muestre el aviso de instalación por defecto
    e.preventDefault();
    // Guardar el evento para poder mostrarlo más tarde
    deferredPrompt = e;
    console.log('`beforeinstallprompt` event was fired. App is installable.');

    // Lógica para mostrar el botón de instalación
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (!isStandalone) {
        if (isIOS) {
            // En iOS no se dispara 'beforeinstallprompt', manejaremos un botón personalizado.
            installButton.style.display = 'none';
        } else {
            // Para otros dispositivos (Android, Desktop), mostrar el botón.
            installButton.style.display = 'block';
        }
    }
});

installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
        // Mostrar el aviso de instalación
        deferredPrompt.prompt();

        // Esperar a que el usuario responda al aviso
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // Ya no necesitamos el evento, lo reseteamos
        deferredPrompt = null;

        // Ocultar el botón
        installButton.style.display = 'none';
    }
});


// --- REGISTRO DEL SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then(registration => {
            console.log('ServiceWorker registrado con éxito:', registration.scope);
        }).catch(err => {
            console.log('Fallo en el registro de ServiceWorker:', err);
        });
    });
}

// --- INICIALIZACIÓN DE LA APLICACIÓN ---
async function handleSharedLink(seccion, id) {
    appOpenedFromLink = true;

    let data, header, item, mostrarDetalleFn;

    // 1. Determinar qué datos buscar y qué función de modal usar
    const seccionMap = {
        'cortes': { range: RANGE_CORTES, dataSetter: (vals) => datosOriginales = vals, dataRef: () => datosOriginales, modalFn: mostrarDetalleModal },
        'tutoriales': { range: RANGE_TUTORIALES, dataSetter: (vals) => datosTutoriales = vals, dataRef: () => datosTutoriales, modalFn: mostrarDetalleTutorial },
        'relay': { range: RANGE_RELAY, dataSetter: (vals) => datosRelay = vals, dataRef: () => datosRelay, modalFn: mostrarDetalleRelay }
    };

    if (!seccionMap[seccion]) {
        checkSession(); // Sección no válida, proceder con el inicio normal
        return;
    }

    const { range, dataSetter, dataRef, modalFn } = seccionMap[seccion];

    // 2. Intentar cargar los datos de la sección y encontrar el ítem
    await syncAndFetchData(seccion, range, dataSetter, () => {}, 'contenido');
    data = dataRef();

    if (data && data.length > 1) {
        header = data[0];
        item = data.slice(1).find(fila => fila[header.indexOf("ID")] === id);
    }

    // 3. Solo si el ítem es válido, se muestra el modal y se oculta el resto
    if (item) {
        // Ocultar splash y login AHORA que sabemos que tenemos contenido para mostrar
        const splash = document.getElementById('splash-screen');
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 500);
        document.getElementById('login-modal').style.display = 'none';

        // Ocultar el contenedor principal para que solo se vea el modal
        document.querySelector('.container').style.display = 'none';

        mostrarDetalleFn = modalFn;
        mostrarDetalleFn(item, header);

        // Limpiar la URL para que un refresh no vuelva a abrir el modal
        history.replaceState({}, document.title, window.location.pathname);
    } else {
        // 4. Si el ítem no se encuentra, proceder al flujo de inicio de sesión normal
        checkSession();
    }
}


async function inicializarApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const seccion = urlParams.get('seccion');
    const id = urlParams.get('id');

    if (seccion && id) {
        await handleSharedLink(seccion, id);
    } else {
        checkSession();     // Luego, comprueba si hay una sesión activa
    }

    // Lógica para el botón de instalación de iOS
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (!isStandalone && isIOS) {
        // Crear y mostrar un botón/mensaje específico para iOS
        const iosInstallMessage = document.createElement('div');
        iosInstallMessage.id = 'ios-install-message';
        iosInstallMessage.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #007bff;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            text-align: center;
            z-index: 1002;
            font-size: 0.9em;
            width: 90%;
            max-width: 400px;
        `;
        iosInstallMessage.innerHTML = `
            Para instalar, pulsa el botón de Compartir
            <svg style="width:20px; vertical-align:middle;" viewBox="0 0 24 24"><path fill="currentColor" d="M17,14V17A1,1 0 0,1 16,18H8A1,1 0 0,1 7,17V14H5V17A3,3 0 0,0 8,20H16A3,3 0 0,0 19,17V14H17M12,4L7,9H10V15H14V9H17L12,4Z" /></svg>
            y luego "Añadir a pantalla de inicio".
            <button onclick="this.parentElement.style.display='none'" style="background:none; border:none; color:white; font-size:1.2em; position:absolute; top:5px; right:10px;">&times;</button>
        `;
        document.body.appendChild(iosInstallMessage);
    }
}

// Ocultar el splash screen después de un tiempo para asegurar que no se quede atascado
window.addEventListener('load', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        const session = localStorage.getItem(SESSION_KEY);
        // Si no hay sesión, el splash se ocultará cuando se muestre el login.
        // Si hay sesión, el splash se ocultará cuando se muestre la app.
        // Este es un fallback por si algo falla.
        if (!session) {
             const splash = document.getElementById('splash-screen');
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }
    }, 3000); // 3 segundos de tiempo de espera máximo
});


inicializarApp();

// Event listener para el acordeón
document.getElementById('detalleCompleto').addEventListener('click', function(e) {
    const clickedBtn = e.target.closest('.accordion-btn');
    if (!clickedBtn) return;

    const panel = clickedBtn.nextElementSibling;
    const isActive = clickedBtn.classList.contains('active');

    // Cerrar todos los paneles y pausar videos
    this.querySelectorAll('.accordion-btn').forEach(btn => {
        const currentPanel = btn.nextElementSibling;
        const iframe = currentPanel.querySelector('iframe');

        if (btn !== clickedBtn || isActive) {
            btn.classList.remove('active');
            currentPanel.style.maxHeight = null;
            if (iframe) {
                iframe.src = ''; // Detiene el video
            }
        }
    });

    // Abrir el panel clickeado si no estaba ya activo
    if (!isActive) {
        clickedBtn.classList.add('active');
        panel.style.maxHeight = panel.scrollHeight + "px";
        const iframe = panel.querySelector('iframe');
        if (iframe && iframe.dataset.originalSrc) {
            iframe.src = iframe.dataset.originalSrc; // Restaura el video
        }
    }
});

const searchContainer = document.querySelector('.search-container');
const clearSearchBtn = document.getElementById('clear-search-btn');

if (searchInput && searchContainer && clearSearchBtn) {
    searchInput.addEventListener('focus', () => {
        if (!uiState.isSearchActive) {
            // Solo empuja el estado si el campo está vacío. Si ya hay texto, no crees un nuevo estado.
            if(searchInput.value.trim() === '') {
                pushState({ search: true });
            }
            uiState.isSearchActive = true;
        }
        document.body.classList.add('search-active');
    });

    searchInput.addEventListener('blur', () => {
        if (uiState.isSearchActive) {
            // No hacemos history.back() al desenfocar para permitir hacer clic en los resultados.
            // La UI se revierte visualmente, pero el estado del historial permanece.
            setTimeout(() => {
                 document.body.classList.remove('search-active');
            }, 200);
        }
    });

    searchInput.addEventListener('input', () => {
        // Muestra u oculta el botón de limpiar basado en si hay texto
        if (searchInput.value.length > 0) {
            searchContainer.classList.add('has-text');
        } else {
            searchContainer.classList.remove('has-text');
        }
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        // Dispara el evento 'input' para que la lógica de filtrado se ejecute
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        // Mantiene el foco en el input para una nueva búsqueda
        searchInput.focus();
    });
}

// --- LÓGICA DEL MENÚ HAMBURGUESA ---
const hamburgerBtn = document.getElementById('hamburger-btn');
const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');
const menuUsername = document.getElementById('menu-username');
const sideMenuLogoutBtn = document.getElementById('side-menu-logout-button');

function openSideMenu() {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (session && session.Nombre_Usuario) {
        menuUsername.textContent = session.Nombre_Usuario;
    }
    sideMenu.classList.add('open');
    menuOverlay.classList.add('open');
}

function closeSideMenu() {
    sideMenu.classList.remove('open');
    menuOverlay.classList.remove('open');
}

hamburgerBtn.addEventListener('click', openSideMenu);
menuOverlay.addEventListener('click', closeSideMenu);
sideMenuLogoutBtn.addEventListener('click', () => {
    closeSideMenu();
    logout();
});

// Cerrar menú al hacer clic en un enlace (para navegación en la misma página)
document.querySelectorAll('#side-menu .menu-link').forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href === '#') { // Es un enlace de la misma página (ej. 'Cortes')
            e.preventDefault();
            const section = link.id.replace('menu-', '');
            mostrarSeccion(section);
            closeSideMenu();
        }
        // Para enlaces a otras páginas, el menú se cerrará automáticamente en la carga de la nueva página.
    });
});

async function handleLike(vehicleId, corteIndex, buttonElement) {
    const user = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!user || !user.ID || !user.Nombre_Usuario) {
        alert("Debes iniciar sesión para usar esta función.");
        return;
    }

    // Disable button to prevent multiple clicks
    buttonElement.disabled = true;
    buttonElement.style.cursor = 'default';

    // Optimistic UI update based on the title attribute and CSS class
    const originalTitle = buttonElement.title;
    const currentCountMatch = originalTitle.match(/\((\d+)\)/);
    const currentCount = currentCountMatch ? parseInt(currentCountMatch[1], 10) : 0;
    buttonElement.title = `Marcar como útil (${currentCount + 1})`;
    buttonElement.classList.add('liked');

    try {
        await postToAction('recordLike', {
            vehicleId: vehicleId,
            corteIndex: corteIndex,
            userId: user.ID,
            userName: user.Nombre_Usuario
        });

        // After successful like, prompt for year suggestion
        const suggestedYearRaw = prompt("¡Gracias por tu feedback! ¿Este corte también aplica para otro año? Si es así, ingrésalo aquí (ej: 2023). Si no, cancela.");

        if (suggestedYearRaw && suggestedYearRaw.trim() !== "") {
            const year = parseInt(suggestedYearRaw.trim(), 10);
            if (!isNaN(year) && year > 1980 && year < 2050) {
                try {
                    const result = await postToAction('suggestYear', {
                        vehicleId: vehicleId,
                        newYear: year, // Corrected parameter name
                        userId: user.ID, // Pass userId as required by backend
                        userName: user.Nombre_Usuario
                    });
                    alert(result.message || "Sugerencia enviada. ¡Gracias por tu colaboración!");
                } catch (error) {
                    // Error is handled globally by postToAction, no extra alert needed.
                }
            } else {
                alert("Por favor, ingresa un año válido (ej: 2023).");
            }
        }
    } catch (error) {
        // Revert UI on error
        buttonElement.title = originalTitle;
        buttonElement.classList.remove('liked');
        // The error message is shown globally by postToAction.
    } finally {
        // Re-enable the button after operation is complete
        buttonElement.disabled = false;
        buttonElement.style.cursor = 'pointer';
    }
}


function toggleReportSection(vehicleId, corteIndex) {
    const reportSection = document.getElementById(`report-section-${vehicleId}-${corteIndex}`);
    const submitBtn = document.getElementById(`submit-report-${vehicleId}-${corteIndex}`);

    if (reportSection.style.display === 'none') {
        reportSection.style.display = 'block';
        submitBtn.onclick = () => handleReportSubmit(vehicleId, corteIndex);
    } else {
        reportSection.style.display = 'none';
    }
}

async function handleReportSubmit(vehicleId, corteIndex) {
    const user = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!user || !user.Nombre_Usuario) {
        alert("Debes iniciar sesión para reportar un problema.");
        return;
    }

    const reportInput = document.getElementById(`report-input-${vehicleId}-${corteIndex}`);
    const problemText = reportInput.value.trim();

    if (!problemText) {
        alert("Por favor, describe el problema.");
        return;
    }

    try {
        await postToAction('reportProblem', {
            vehicleId: vehicleId,
            corteIndex: corteIndex,
            problemText: problemText,
            userId: user.ID,
            userName: user.Nombre_Usuario
        });
        alert("Gracias por tu reporte. Lo revisaremos pronto.");
        reportInput.value = '';
        toggleReportSection(vehicleId, corteIndex);
    } catch (error) {
        // Error is handled by postToAction
    }
}

// --- LÓGICA PARA MODALES DE INFORMACIÓN ---
function setupInfoModals() {
    const modals = document.querySelectorAll('.info-modal');
    const closeButtons = document.querySelectorAll('.info-close-btn');

    const openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    };

    const closeModal = () => {
        modals.forEach(modal => modal.style.display = 'none');
    };

    // Footer link listeners
    document.getElementById('footer-about-link').addEventListener('click', (e) => {
        e.preventDefault();
        openModal('about-us-modal');
    });
    document.getElementById('footer-contact-link').addEventListener('click', (e) => {
        e.preventDefault();
        openModal('contact-modal');
    });
    document.getElementById('footer-faq-link').addEventListener('click', (e) => {
        e.preventDefault();
        openModal('faq-modal');
    });

    // Inbox Modal
    const inboxBtn = document.getElementById('inbox-btn');
    if (inboxBtn) {
        inboxBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('inbox-modal');
            loadInboxItems();
            closeSideMenu();
        });
    }

    // Developer tools modal
    const devToolsBtn = document.getElementById('dev-tools-btn');
    if (devToolsBtn) {
        devToolsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const devModal = document.getElementById('dev-tools-modal');
            const debugConsole = document.getElementById('debug-console');
            const devConsoleContainer = document.getElementById('dev-console-container');

            // Move debug console into the modal
            if (debugConsole && devConsoleContainer) {
                devConsoleContainer.appendChild(debugConsole);
                debugConsole.style.position = 'relative';
                debugConsole.style.width = '100%';
                debugConsole.style.height = '100%';
                debugConsole.style.bottom = 'auto';
                debugConsole.style.right = 'auto';
                debugConsole.style.display = 'flex'; // Asegura que la consola sea visible dentro del modal
            }

            openModal('dev-tools-modal');
            closeSideMenu();
        });
    }


    // Close button listeners
    closeButtons.forEach(btn => btn.addEventListener('click', closeModal));

    // Close on outside click
    window.addEventListener('click', (event) => {
        modals.forEach(modal => {
            if (event.target === modal) {
                closeModal();
            }
        });
    });

    // Accordion for FAQ
    document.querySelectorAll('#faq-modal .accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const isActive = content.style.maxHeight;
            // Close all others first for a cleaner accordion experience
            document.querySelectorAll('#faq-modal .accordion-content').forEach(c => c.style.maxHeight = null);
            // Open the clicked one if it wasn't already open
            if (!isActive) {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    });

    // Contact form submission
    document.getElementById('contact-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('contact-name').value;
        const email = document.getElementById('contact-email').value;
        const message = document.getElementById('contact-message').value;

        try {
            const response = await routeAction('sendContactForm', { name, email, message });
            if (response.status === 'success') {
                alert('¡Gracias por tu mensaje! Nos pondremos en contacto contigo pronto.');
                closeModal();
                document.getElementById('contact-form').reset();
            } else {
                throw new Error(response.message || 'Error desconocido');
            }
        } catch (error) {
             alert(`Error al enviar el mensaje: ${error.message}`);
        }
    });
}
// --- INBOX LOGIC ---
let inboxItems = [];

async function loadInboxItems() {
    const listContainer = document.getElementById('inbox-list');
    listContainer.innerHTML = '<p>Cargando mensajes...</p>';

    try {
        const result = await routeAction('getFeedbackItems', {}, 'FEEDBACK');
        inboxItems = result.data; // La respuesta ahora es un array unificado

        // Ordenar: no resueltos primero, luego por ID descendente
        inboxItems.sort((a, b) => {
            const aResolved = a.isResolved === true;
            const bResolved = b.isResolved === true;
            if (aResolved !== bResolved) {
                return aResolved ? 1 : -1;
            }
            return b.id - a.id;
        });

        renderInboxList();
    } catch (error) {
        listContainer.innerHTML = `<p style="color: red;">Error al cargar mensajes: ${error.message}</p>`;
    }
}

function renderInboxList() {
    const listContainer = document.getElementById('inbox-list');
    listContainer.innerHTML = '';

    if (inboxItems.length === 0) {
        listContainer.innerHTML = '<p>No hay mensajes.</p>';
        return;
    }

    inboxItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; border-radius: 5px;';
        if (item.isResolved) {
            itemDiv.style.opacity = '0.6';
        }

        const typeLabel = item.type === 'problem_report' ? 'Reporte' : 'Contacto';

        itemDiv.innerHTML = `
            <strong>${typeLabel} #${item.id}</strong><br>
            <small>${item.subject}</small>
        `;
        itemDiv.onclick = () => renderInboxDetail(item.id, item.type);
        listContainer.appendChild(itemDiv);
    });
}

function renderInboxDetail(itemId, itemType) {
    const detailContainer = document.getElementById('inbox-detail');
    const item = inboxItems.find(i => i.id == itemId && i.type === itemType);

    if (!item) {
        detailContainer.innerHTML = '<p>Selecciona un item para ver los detalles.</p>';
        return;
    }

    const typeLabel = item.type === 'problem_report' ? 'Reporte de Problema' : 'Formulario de Contacto';
    let content = `<h3>${item.subject}</h3>`;

    content += `<p><strong>De:</strong> ${item.user} | <strong>Tipo:</strong> ${typeLabel}</p>`;
    if (item.vehicleId) {
        content += `<p><strong>ID Vehículo:</strong> ${item.vehicleId}</p>`;
    }
    content += `<div style="background: #f1f1f1; padding: 10px; border-radius: 5px; margin-top: 10px;"><p>${item.content.replace(/\n/g, '<br>')}</p></div>`;

    content += `
        <hr>
        <h4>Responder</h4>
        <textarea id="reply-textarea" style="width: 100%; height: 100px; margin-bottom: 10px;" placeholder="Escribe tu respuesta...">${item.reply || ''}</textarea>
        <button id="reply-btn" class="btn btn-primary">Enviar Respuesta</button>
    `;

    if(item.type === 'problem_report' && !item.isResolved) {
        content += `<button id="resolve-btn" class="btn btn-success" style="margin-left: 10px;">Marcar como Resuelto</button>`;
    }

    detailContainer.innerHTML = content;

    document.getElementById('reply-btn').onclick = async () => {
        const replyText = document.getElementById('reply-textarea').value;
        const session = JSON.parse(localStorage.getItem(SESSION_KEY));
        await routeAction('replyToFeedback', { itemId, itemType, replyText, responderName: session.Nombre_Usuario }, 'FEEDBACK');
        alert('Respuesta enviada.');
        loadInboxItems(); // Refresh
    };

    if(document.getElementById('resolve-btn')) {
        document.getElementById('resolve-btn').onclick = async () => {
            await routeAction('markAsResolved', { itemId }, 'FEEDBACK');
            alert('Marcado como resuelto.');
            loadInboxItems(); // Refresh
        };
    }
}


// Llamar a la configuración de los modales de info cuando se inicializa la app.
document.addEventListener('DOMContentLoaded', () => {
    setupInfoModals();

        // --- LÓGICA DE MODO OSCURO ---
        const darkModeToggle = document.getElementById('dark-mode-toggle');

        const enableDarkMode = () => {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            darkModeToggle.checked = true;
        };

        const disableDarkMode = () => {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            darkModeToggle.checked = false;
        };

        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                enableDarkMode();
            } else {
                disableDarkMode();
            }
        });

        // Aplicar el tema al cargar la página
        const preferredTheme = localStorage.getItem('theme');
        if (preferredTheme === 'dark') {
            enableDarkMode();
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && preferredTheme !== 'light') {
             // Si el usuario no ha elegido, pero su sistema lo prefiere, activarlo
            enableDarkMode();
        }

    const migrateYearsBtn = document.getElementById('run-migrate-years');
    const migrateTimestampsBtn = document.getElementById('run-migrate-timestamps');
    const statusDiv = document.getElementById('migration-status');
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));

    const runMigration = async (action, btn) => {
        if (!confirm(`¿Estás seguro de que quieres ejecutar la acción '${action}'? Esta operación puede modificar una gran cantidad de datos y no se puede deshacer.`)) {
            return;
        }

        btn.disabled = true;
        statusDiv.style.display = 'block';
        statusDiv.textContent = `Ejecutando ${action}...`;
        statusDiv.style.backgroundColor = '#e2e3e5';

        try {
            // CORRECCIÓN: Enviar el objeto de sesión completo en el payload.
            const result = await routeAction(action, { session: session }, 'UTILITIES');
            statusDiv.textContent = `Éxito: ${result.message}`;
            statusDiv.style.backgroundColor = '#d4edda';
        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.style.backgroundColor = '#f8d7da';
        } finally {
            btn.disabled = false;
        }
    };

    if(migrateYearsBtn) {
        migrateYearsBtn.addEventListener('click', () => runMigration('migrateYearRanges', migrateYearsBtn));
    }
    if(migrateTimestampsBtn) {
        migrateTimestampsBtn.addEventListener('click', () => runMigration('migrateTimestamps', migrateTimestampsBtn));
    }
});