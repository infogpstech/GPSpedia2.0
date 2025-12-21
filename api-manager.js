// ============================================================================
// API MANAGER for GPSpedia Modular Architecture
// ============================================================================

const API_ENDPOINTS = {
    // URL del script original (monolítico). Se usará como fallback durante la migración.
    LEGACY: "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec",

    // URLs para los nuevos microservicios.
    // REEMPLAZA 'URL_DESPLEGADA_...' con la URL real de cada script después de desplegarlo.
    AUTH:     "https://script.google.com/macros/s/AKfycbw6aSDuWIO-c2_8JwaU9f4-KFPXAdHBO8P-e7Z45WAejBiIPENPSu11uXvaUD5wNl01/exec",      // GPSpedia-Auth
    CATALOG:  "https://script.google.com/macros/s/AKfycbwf4skhwvRVmF2tNR0ZTEq13pq_jXl_bmoZe4vRmoknKTd-f1hlt51IeT6hzv27Yv3U_Q/exec",   // GPSpedia-Catalog
    WRITE:    "https://script.google.com/macros/s/AKfycbxf2Ex-m1-0RJqFJfRFMvFafKurTsX77KnlHx5AEO-W97KR1bZOesGNOz4mYBONdVR5Gg/exec",     // GPSpedia-Write
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
    'checkVehicle': 'WRITE',

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
        // Aquí se puede agregar lógica para mostrar errores al usuario de forma unificada.
        // Por ahora, relanzamos el error para que sea manejado por quien llamó a la función.
        throw error;
    }
}
