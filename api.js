// GPSpedia API Module | Version Refactorizada
// Responsabilidades:
// - Centralize all fetch calls to the backend microservices.
// - Manage API endpoints and action routing by importing from a central config.
// - Standardize error handling for network requests.

// Importar la configuración desde el módulo central. Única fuente de verdad.
import { API_ENDPOINTS, ACTION_TO_SERVICE_MAP } from './api-config.js';

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
