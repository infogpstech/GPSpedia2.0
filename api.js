// GPSpedia API Module
// Responsibilities:
// - Centralize all fetch calls to the backend microservices.
// - Manage API endpoints and action routing.
// - Standardize error handling for network requests.

const API_ENDPOINTS = {
    LEGACY: "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec",
    AUTH:     "https://script.google.com/macros/s/AKfycbwoReCKliFdD_Ep8Ivq2WOLwxlMnfsxwKxlM3mgxGocTcmJ8cP5bEF7R6Z8iEui8ynU/exec",
    CATALOG:  "https://script.google.com/macros/s/AKfycbxI295Wu8KW9Zi_DzgZKr68js2IHyDXYgBRM-TRXk2jwBy5lBrlKHxH--I3cUpdUCS60Q/exec",
    WRITE:    "https://script.google.com/macros/s/AKfycbwx51C9UQPRis2hIExIT2d1lGoTFZdCFyzMVVvQseHg41pztX86H16n88D8npO5__o_cQ/exec",
    USERS:    "https://script.google.com/macros/s/AKfycbxh-kdkom9vq6cHTBe53EMzuIO7qcW6DJO-FkttQCn3ugPO935BQSWnB88qTkLQPNmn/exec",
    FEEDBACK: "https://script.google.com/macros/s/AKfycbxFd_uHND1B7qaiBm-aHck3FzcU7tCl-a3gUgOdDxoD25A6-jSCAN2ylXQG8-85ALsX/exec",
    UTILITIES: "https://script.google.com/macros/s/AKfycbzkGXk_kSm3rN7K5PM0RntiPAn7DlH78RkH66a2vuwZwU8KgwDufkOiPjXoUKzuHAgG/exec"
};

const ACTION_TO_SERVICE_MAP = {
    'login': 'AUTH',
    'validateSession': 'AUTH',
    'getNavigationData': 'CATALOG',
    'getCatalogData': 'CATALOG',
    'getDropdownData': 'CATALOG',
    'getSuggestion': 'WRITE',
    'checkVehicle': 'WRITE',
    'addCorte': 'WRITE',
    'addOrUpdateCut': 'WRITE',
    'addSupplementaryInfo': 'WRITE',
    'getUsers': 'USERS',
    'createUser': 'USERS',
    'updateUser': 'USERS',
    'deleteUser': 'USERS',
    'changePassword': 'USERS',
    'recordLike': 'FEEDBACK',
    'reportProblem': 'FEEDBACK',
    'sendContactForm': 'FEEDBACK',
    'suggestYear': 'FEEDBACK',
    'getFeedbackItems': 'FEEDBACK',
    'replyToFeedback': 'FEEDBACK',
    'markAsResolved': 'FEEDBACK',
    'migrateYearRanges': 'UTILITIES',
    'migrateTimestamps': 'UTILITIES',
    'logFrontend': 'LEGACY'
};

export async function routeAction(action, payload = {}, serviceOverride = null) {
    const service = serviceOverride || ACTION_TO_SERVICE_MAP[action];
    if (!service) {
        throw new Error(`Acción no definida: ${action}`);
    }

    let targetUrl = API_ENDPOINTS[service];
    if (!targetUrl) {
        targetUrl = API_ENDPOINTS.LEGACY;
    }

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, payload })
        });

        if (!response.ok) {
            throw new Error(`Error de red: ${response.status} ${response.statusText}`);
        }

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

export function getImageUrl(fileId, size = 280) {
    if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
        return "https://placehold.co/280x200/cccccc/333333?text=Sin+Imagen";
    }
    // Si el tamaño es un número, se asume que es el ancho (ej. sz=w1000)
    const sizeParam = typeof size === 'number' ? `w${size}` : size;
    return `https://drive.google.com/thumbnail?id=${fileId.trim()}&sz=${sizeParam}`;
}
