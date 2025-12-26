// GPSpedia Frontend Component | Version: 3.9.0
// ============================================================================
// API MANAGER for GPSpedia Modular Architecture
// ============================================================================

const API_ENDPOINTS = {
    // URL del script original (monolítico). Se usará como fallback durante la migración.
    LEGACY: "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec",

    // URLs para los nuevos microservicios.
    AUTH:     "https://script.google.com/macros/s/AKfycbwRmrXnXUZz3wAaWgox4kEco5BP_8mwBDU2lE-PQBWvotibDXrkUGISIbb-GxUU3pg/exec",
    CATALOG:  "https://script.google.com/macros/s/AKfycbwg_Gw3Jk5TAEF9A4PPzlgCOSuQHEOZlJ_48hcIpkRVPT1Z1w87CCsoBefpekvOrTaPpQ/exec",
    WRITE:    "https://script.google.com/macros/s/AKfycbwzAgwnmSxRfPRTWWpBDSq4Zja3EpRvrY0W0AT5r7ZFsVIIxIRsIIYVitCdmDaEfc-wfA/exec",
    USERS:    "https://script.google.com/macros/s/AKfycbwFDNNDPcnk4qnmyvbN5x_oGdS1kD7_kw7DHTKqdB87UeHCUO16EwmLPL8PITMzBc1p/exec",
    FEEDBACK: "https://script.google.com/macros/s/AKfycbwtEWodjUl5eE4JDw3lN2XANqe3gLIvPvCMyrFDqvX0QNE-2sh9pWEXMamNHfC_GG7R/exec"
};

// Mapeo de cada 'action' al servicio que le corresponde.
const ACTION_TO_SERVICE_MAP = {
    // Auth Service
    'login': 'AUTH',
    'validateSession': 'AUTH',

    // Catalog Service
    'getCatalogData': 'CATALOG',
    'getDropdownData': 'CATALOG',
    'checkVehicle': 'CATALOG',

    // Write Service
    'addCorte': 'WRITE',

    // Users Service
    'getUsers': 'USERS',
    'createUser': 'USERS',
    'updateUser': 'USERS',
    'deleteUser': 'USERS',
    'changePassword': 'USERS',

    // Feedback Service
    'recordLike': 'FEEDBACK',
    'reportProblem': 'FEEDBACK',

    // Legacy (acciones que aún no se han migrado o son de propósito general)
    'logFrontend': 'LEGACY'
};

/**
 * Función centralizada para realizar llamadas a los servicios de backend.
 * Dirige la solicitud al microservicio correcto basándose en la 'action'.
 * Si un servicio no tiene una URL desplegada, utiliza el endpoint LEGACY como fallback.
 * @param {string} action - La acción a ejecutar en el backend.
 * @param {object} payload - Los datos a enviar con la solicitud.
 * @returns {Promise<object>} - La respuesta JSON del servicio.
 */
async function routeAction(action, payload = {}) {
    const service = ACTION_TO_SERVICE_MAP[action];
    if (!service) {
        console.error(`Acción desconocida: '${action}'. No se puede enrutar a ningún servicio.`);
        throw new Error(`Acción no definida: ${action}`);
    }

    let targetUrl = API_ENDPOINTS[service];

    // Estrategia de fallback: si la URL del microservicio no está definida, usar LEGACY.
    if (!targetUrl || targetUrl.startsWith("URL_DESPLEGADA_")) {
        console.warn(`URL para el servicio '${service}' no configurada. Usando endpoint LEGACY.`);
        targetUrl = API_ENDPOINTS.LEGACY;
    }

    console.log(`Routing action '${action}' to service '${service}' at URL: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }, // Requerido por Apps Script para evitar preflight CORS
            body: JSON.stringify({ action, payload })
        });

        if (!response.ok) {
            throw new Error(`Error de red: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.status === 'error') {
            const errorMessage = result.details ? `${result.message}: ${result.details.errorMessage}` : result.message;
            console.error(`Error en la respuesta del servidor para la acción '${action}':`, result);
            throw new Error(errorMessage);
        }

        return result;

    } catch (error) {
        console.error(`Error crítico en routeAction para la acción '${action}':`, error);
        // Mostrar el error en la UI a través de la nueva función global
        if (typeof showGlobalError === 'function') {
            showGlobalError(`Error en la acción '${action}': ${error.message}`);
        }
        // Relanzar el error para que la lógica de la aplicación pueda manejarlo si es necesario.
        throw error;
    }
}
