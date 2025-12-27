// GPSpedia Frontend Component | Version: 4.2.0
// ============================================================================
// API MANAGER for GPSpedia Modular Architecture
// ============================================================================

const API_ENDPOINTS = {
    // URL del script original (monolítico). Se usará como fallback durante la migración.
    LEGACY: "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec",

    // URLs para los nuevos microservicios.
    AUTH:     "https://script.google.com/macros/s/AKfycbwKDOxRLLoJ1N_4MsRzgPdwYWb9ncJK8R9lkhzdNb-2b22owI5RpdO4_Kj30aEwn0KF/exec",
    CATALOG:  "https://script.google.com/macros/s/AKfycby2l0_ZPekAudHSmmUEZ6JpbA0YYOpMcAhdl6PMxidgJhdpwjdSOFJAhxu5l3d_BU0A/exec",
    WRITE:    "https://script.google.com/macros/s/AKfycbyPu7p1erNGcxDCk4xWNPThvYdHeq3A80gdxvEgQpjnQ-LR6fQUAkS7913w7E5I8LOHNw/exec",
    USERS:    "https://script.google.com/macros/s/AKfycbywTo3Asul37tLML29tmtNwVpFbHabXOfC7sw4c5KagURIXzaZoiKrbr2XAIkv-7n-T/exec",
    FEEDBACK: "https://script.google.com/macros/s/AKfycbwRE0PB9e-6bVbSv2hcU4hXLUotRosPfv7pnTzAsa6-GOfY_ScY1keB1uSXN6JtaQp_/exec",
    UTILITIES: "https://script.google.com/macros/s/AKfycbx5FbjINZ-vFO2h1q5LJpc9LN0YBuLM1Y5GcSmFXYKVcAnc-uYp80H7aa45S94XINyu/exec"
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
    'getNavigationData': 'CATALOG',

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
    'sendContactForm': 'FEEDBACK',
    'suggestYear': 'FEEDBACK',
    'getReportedProblems': 'FEEDBACK',
    'replyToProblem': 'FEEDBACK',
    'resolveProblem': 'FEEDBACK',

    // Utilities Service
    'migrateYearRanges': 'UTILITIES',
    'migrateTimestamps': 'UTILITIES',

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
