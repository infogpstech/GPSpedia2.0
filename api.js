// GPSpedia API Module
// Responsibilities:
// - Centralize all fetch calls to the backend microservices.
// - Manage API endpoints and action routing.
// - Standardize error handling for network requests.

const API_ENDPOINTS = {
    LEGACY: "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec",
    AUTH:     "https://script.google.com/macros/s/AKfycbz5pShcFTft6Xz8EiBpEmqMbes611ROqkcoxJ1hwvwvh3JBZfdqm3zklTwuXqBTSN35/exec",
    CATALOG:  "https://script.google.com/macros/s/AKfycbxMcwKh7xjYDHElHzZgNzwfhAvg6nPiSgAfDc3zErNc37CRd0DGLsRIF5O3Fj2eUAM/exec",
    WRITE:    "https://script.google.com/macros/s/AKfycbwtfAsH0UytR23ZP0fRm1mH0V8ZT_EUdAMvWXUY8bfnITZTBNVhnuS4my6MMWJVj3KONw/exec",
    USERS:    "https://script.google.com/macros/s/AKfycbzOxB-rC35E9vN0v08kPnATfgnJ2Va9rDtRvl1JKeBay8hnLB9Xpn-z5bQ8ylaskxjY/exec",
    FEEDBACK: "https://script.google.com/macros/s/AKfycbwBvtcf_jayP2Lxdk3PQUz3szRNFePzr9WQ5QbGSiDqgM92v2ugr4BmP7DJhYXgRmq7/exec",
    UTILITIES: "https://script.google.com/macros/s/AKfycbzkGXk_kSm3rN7K5PM0RntiPAn7DlH78RkH66a2vuwZwU8KgwDufkOiPjXoUKzuHAgG/exec",
    IMAGE: "https://script.google.com/macros/s/AKfycbwFzPvx7URRA2cGfXxXsV4HUsPgF27ur8EdkdFAP1Ix_hYjNVi5nnIDtzLJ_Xd2jdIH/exec"
};

const ACTION_TO_SERVICE_MAP = {
    'login': 'AUTH',
    'validateSession': 'AUTH',
    'getNavigationData': 'CATALOG',
    'getCatalogData': 'CATALOG',
    'getDropdownData': 'CATALOG',
    'checkVehicle': 'CATALOG',
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

export function getImageUrl(fileId) {
    if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
        return "https://placehold.co/280x200/cccccc/333333?text=Sin+Imagen";
    }
    const encodedFileId = encodeURIComponent(fileId.trim());
    return `${API_ENDPOINTS.IMAGE}?fileId=${encodedFileId}`;
}
