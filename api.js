// GPSpedia API Module
// Responsibilities:
// - Centralize all fetch calls to the backend microservices.
// - Manage API endpoints and action routing.
// - Standardize error handling for network requests.

const API_ENDPOINTS = {
    LEGACY: "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec",
    AUTH:     "https://script.google.com/macros/s/AKfycbwl6yNrsE0vwmNzvDJcUpnSABqxVGS7XOPurAMfeHQsBGb5TiePKWDThM7_XCIqeK-7/exec",
    CATALOG:  "https://script.google.com/macros/s/AKfycbxigYNShdiAcbBEBCtTrKYYIh5UAJh9L5fMjY7U4VlCDHD5Vc2b8bO3U7xaCtDza5gyzw/exec",
    WRITE:    "https://script.google.com/macros/s/AKfycbwzJoDsnGCb00m8tpTPCL3FH8IaHcq4Zy9WNbVhSgSQMjoEZY03dqxH6-50kff5WLbK/exec",
    USERS:    "https://script.google.com/macros/s/AKfycbwi-W0LqFG-LnldnSLIZE4gmHjVqTXlY2mCKHUrewhuahW1Mfpw2x2El9T47IH1TvDk/exec",
    FEEDBACK: "https://script.google.com/macros/s/AKfycbwm5WBosW3FRbRhN7hPgP0QS2BuwxoRN0m2IZ8GMfpbfLHO5Xy6lmaK9ItHb_8wO-6n/exec",
    UTILITIES: "https://script.google.com/macros/s/AKfycbzkGXk_kSm3rN7K5PM0RntiPAn7DlH78RkH66a2vuwZwU8KgwDufkOiPjXoUKzuHAgG/exec",
    IMAGE: "https://script.google.com/macros/s/AKfycbxj1xdme6c1QRrzDYlJ96GIUJWgCM1NQbDXqseJ8VaLuo3cmuVjmMyjUxEcWnx1TA/exec"
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

export function getImageUrl(fileId) {
    if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
        return "https://placehold.co/280x200/cccccc/333333?text=Sin+Imagen";
    }
    const encodedFileId = encodeURIComponent(fileId.trim());
    return `${API_ENDPOINTS.IMAGE}?fileId=${encodedFileId}`;
}
