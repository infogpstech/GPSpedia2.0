// GPSpedia Frontend Component | Version: 2.0.1
// ============================================================================
// API MANAGER for GPSpedia Modular Architecture
// ============================================================================

const API_ENDPOINTS = {
    // URL del script original (monolítico). Se usará como fallback durante la migración.
    LEGACY: "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec",

    // URLs para los nuevos microservicios.
    // REEMPLAZA 'URL_DESPLEGADA_...' con la URL real de cada script después de desplegarlo.
    AUTH:     "https://script.google.com/macros/s/AKfycbyrrVxuX_N_QuiCxFgvTNVztdswGGThJ9SjWz_7vfCkooWZuvydeieMpsPWUEY1T9TH/exec",      // GPSpedia-Auth
    CATALOG:  "https://script.google.com/macros/s/AKfycbzuIroWYo3FjY_4enCFtb1xiyoAki-IlxsbNGv9u9Y2nhJ3hl-0MwpycrA-qJWjWX7H_w/exec",   // GPSpedia-Catalog
    WRITE:    "https://script.google.com/macros/s/AKfycbwKY0wwKdXOtkh4puywFjWPqIv6TM6WK7PErMyS8rKaU9UJqriIpKl4O7YR17LPcM3oNQ/exec",     // GPSpedia-Write
    USERS:    "https://script.google.com/macros/s/AKfycbwDDnsmFuDO06Bepc3tHGTlE6nGDVEYusz-yCa8chCF03xqD-cgXUJCw5Qc7J-RDj7k/exec",     // GPSpedia-Users
    FEEDBACK: "https://script.google.com/macros/s/AKfycbxwZHY912yhLHLS9qjiK4gNb-Jl5GQOSg_zAlHBUZx4ryb5Pc2UbRMtm7cLCn2ywgpL/exec"   // GPSpedia-Feedback
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
    // Loguear la solicitud en la consola de depuración si está activa
    if (typeof logToDebugConsole === 'function') {
        logToDebugConsole('REQUEST', `Action: ${action}`, { payload });
    }

    const service = ACTION_TO_SERVICE_MAP[action];
    if (!service) {
        const error = new Error(`Acción no definida: ${action}`);
        if (typeof logToDebugConsole === 'function') {
            logToDebugConsole('ERROR', `Acción desconocida: '${action}'`, { error: error.message });
        }
        console.error(`Acción desconocida: '${action}'. No se puede enrutar a ningún servicio.`);
        throw error;
    }

    let targetUrl = API_ENDPOINTS[service];

    if (!targetUrl || targetUrl.startsWith("URL_DESPLEGADA_")) {
        console.warn(`URL para el servicio '${service}' no configurada. Usando endpoint LEGACY.`);
        targetUrl = API_ENDPOINTS.LEGACY;
    }

    console.log(`Routing action '${action}' to service '${service}' at URL: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, payload })
        });

        if (!response.ok) {
            throw new Error(`Error de red: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.status === 'error') {
            const errorMessage = result.details ? `${result.message}: ${result.details.errorMessage}` : result.message;
            throw new Error(errorMessage);
        }

        // Loguear la respuesta exitosa
        if (typeof logToDebugConsole === 'function') {
            logToDebugConsole('RESPONSE', `Success: ${action}`, { result });
        }

        return result;

    } catch (error) {
        // Loguear el error antes de mostrarlo
        if (typeof logToDebugConsole === 'function') {
            logToDebugConsole('ERROR', `Critical Error in ${action}`, { message: error.message, stack: error.stack });
        }

        console.error(`Error crítico en routeAction para la acción '${action}':`, error);

        if (typeof showGlobalError === 'function') {
            showGlobalError(`Error en la acción '${action}': ${error.message}`);
        }

        throw error;
    }
}
