// GPSpedia Authentication Module | Version: 2.1.0
// FIX: Splash screen lento - Se invierte el flujo de carga
// Responsibilities:
// - Manage the entire user authentication lifecycle (login, logout, session validation).
// - Interact with the API module for backend communication.
// - Update the user state.

import { setState } from './state.js';
import { routeAction, fetchCatalogData, login as apiLogin, validateSession as apiValidateSession } from './api-config.js';
import { showLoginScreen, showApp, showGlobalError } from './ui.js';

const SESSION_KEY = 'gpsepedia_session';

function handleLoginSuccess(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setState({ currentUser: user });
    showApp(user); // ✅ Muestra la UI INMEDIATAMENTE
}

// ✅ NUEVA VERSIÓN: Carga asíncrona SIN bloquear la UI
async function loadInitialData() {
    try {
        const apiResponse = await fetchCatalogData();
        const catalogData = apiResponse.data;

        const categoryCounts = catalogData.cortes.reduce((acc, item) => {
            if (item.categoria) {
                acc[item.categoria] = (acc[item.categoria] || 0) + 1;
            }
            return acc;
        }, {});

        const sortedCategories = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);

        setState({
            catalogData: {
                ...catalogData,
                sortedCategories: sortedCategories
            }
        });

        // ✅ CRITICAL: La UI ya está visible, esto solo actualiza el contenido
        console.log('[AUTH] Catálogo cargado exitosamente');

    } catch (error) {
        showGlobalError("Error al cargar los datos del catálogo. La funcionalidad puede ser limitada.");
        // FIX: Set a default empty state to prevent fatal rendering errors
        setState({
            catalogData: {
                cortes: [],
                tutoriales: [],
                relay: [],
                logos: [],
                sortedCategories: []
            }
        });
    }
}


export async function checkSession() {
    const LOCK_KEY = 'session_validation_lock';
    const LOCK_TIMEOUT = 5000; // 5 segundos

    const lock = localStorage.getItem(LOCK_KEY);
    const now = Date.now();

    // Si existe un bloqueo y no ha expirado, esta pestaña no intentará validar.
    if (lock && (now - parseInt(lock, 10)) < LOCK_TIMEOUT) {
        return;
    }

    // Adquirir el bloqueo para esta pestaña.
    localStorage.setItem(LOCK_KEY, now.toString());

    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) {
        showLoginScreen();
        localStorage.removeItem(LOCK_KEY);
        return;
    }

    try {
        const user = JSON.parse(sessionData);
        const { valid } = await apiValidateSession(user.ID, user.SessionToken);

        if (valid) {
            // ✅ CRITICAL FIX: Invertir el orden - UI primero, datos después
            handleLoginSuccess(user);  // Muestra la app INMEDIATAMENTE
            loadInitialData();          // Carga en segundo plano (NO await)
        } else {
            logout("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
        }
    } catch (error) {
        showGlobalError(`Error de sesión: ${error.message}`);
        logout();
    } finally {
        localStorage.removeItem(LOCK_KEY);
    }
}

export async function login(username, password) {
    try {
        const result = await apiLogin(username, password);
        if (result && result.user) {
            // ✅ CRITICAL FIX: UI primero, datos después
            handleLoginSuccess(result.user);  // Muestra la app INMEDIATAMENTE
            loadInitialData();                 // Carga en segundo plano (NO await)
        } else {
            throw new Error("Respuesta de login inválida.");
        }
    } catch (error) {
        showGlobalError(error.message || "Credenciales inválidas.");
    }
}

export function logout(reason = null) {
    localStorage.removeItem(SESSION_KEY);
    showLoginScreen(reason);
}
