// GPSpedia Unified API Module | Version: 2.0.0
// ============================================================================
// ÚNICA FUENTE DE VERDAD PARA LA CONFIGURACIÓN Y LÓGICA DE LA API
// ============================================================================

// 1. CONFIGURACIÓN
export const API_ENDPOINTS = {
    LEGACY: "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec",
    AUTH:     "https://script.google.com/macros/s/AKfycbwATstMSSnuYZMeGEjI7Q5cznO6kA8rqLo7zNZLmu_f29qwcyt4Fucn5VIBdB9tMoRg/exec",
    CATALOG:  "https://script.google.com/macros/s/AKfycbxenVjZe9C8-0RiYKLxpGfQtobRzydBke44IM4NdNNjh5VRdlB91Ce9dWvQ2xnDFXk0/exec",
    WRITE:    "https://script.google.com/macros/s/AKfycbyzP3RwEAqxJN8xzrqxjlsChx4xDgRuvpW-ygWM9teMHM0hWl0DDx91gR3TTR832BWakQ/exec",
    USERS:    "https://script.google.com/macros/s/AKfycbwMOfQDAykWJ-m7wOIuxINeqxd88mieYeK6D6YoWFMGfK1j4XMsM7PWiOXBYi8D-N4T2w/exec",
    FEEDBACK: "https://script.google.com/macros/s/AKfycbzWdXSF_J2snWC43_wW9SxOGtVvQ9U_jKreNrXSt-RZhnoD9zYHwkXYHeM2OZpsB-4/exec",
    UTILITIES: "https://script.google.com/macros/s/AKfycbzkGXk_kSm3rN7K5PM0RntiPAn7DlH78RkH66a2vuwZwU8KgwDufkOiPjXoUKzuHAgG/exec"
};

export const ACTION_TO_SERVICE_MAP = {
    'login': 'AUTH', 'validateSession': 'AUTH',
    'getNavigationData': 'CATALOG', 'getCatalogData': 'CATALOG', 'getDropdownData': 'CATALOG',
    'getSuggestion': 'WRITE', 'checkVehicle': 'WRITE', 'addCorte': 'WRITE', 'addOrUpdateCut': 'WRITE', 'addSupplementaryInfo': 'WRITE',
    'getUsers': 'USERS', 'createUser': 'USERS', 'updateUser': 'USERS', 'deleteUser': 'USERS', 'changePassword': 'USERS',
    'recordLike': 'FEEDBACK', 'reportProblem': 'FEEDBACK', 'sendContactForm': 'FEEDBACK', 'suggestYear': 'FEEDBACK',
    'getFeedbackItems': 'FEEDBACK', 'replyToFeedback': 'FEEDBACK', 'markAsResolved': 'FEEDBACK',
    'migrateYearRanges': 'UTILITIES', 'migrateTimestamps': 'UTILITIES',
    'logFrontend': 'LEGACY'
};

// 2. LÓGICA DE RUTEO CENTRAL
export async function routeAction(action, payload = {}, serviceOverride = null) {
    const service = serviceOverride || ACTION_TO_SERVICE_MAP[action];
    if (!service) throw new Error(`Acción no definida: ${action}`);

    let targetUrl = API_ENDPOINTS[service];
    if (!targetUrl) targetUrl = API_ENDPOINTS.LEGACY;

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, payload })
        });

        if (!response.ok) throw new Error(`Error de red: ${response.status} ${response.statusText}`);

        const text = await response.text();
        const result = JSON.parse(text);

        if (result.status === 'error') {
            const errorMessage = result.details ? `${result.message}: ${result.details.errorMessage}` : result.message;
            throw new Error(errorMessage);
        }
        return result;
    } catch (error) {
        throw error;
    }
}

// 3. FUNCIONES DE CONVENIENCIA (HELPERS)
export async function login(username, password) {
    return await routeAction('login', { username, password });
}

export async function validateSession(userId, sessionToken) {
    return await routeAction('validateSession', { userId, sessionToken });
}

export async function fetchCatalogData() {
    return await routeAction('getCatalogData');
}

export async function getFeedbackItems() {
    return await routeAction('getFeedbackItems');
}

export async function replyToFeedback(itemId, itemType, replyText, responderName) {
    return await routeAction('replyToFeedback', { itemId, itemType, replyText, responderName });
}

export async function markAsResolved(itemId) {
    return await routeAction('markAsResolved', { itemId });
}
