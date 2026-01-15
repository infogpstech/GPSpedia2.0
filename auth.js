// GPSpedia Authentication Module
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
    // Comentario: El `setTimeout` ya no es necesario. `showApp` ahora gestiona la espera de datos.
    showApp(user);
}

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

        const newCatalogData = {
            ...catalogData,
            sortedCategories: sortedCategories
        };

        setState({
            catalogData: newCatalogData
        });
        // Comentario: La función ya no necesita devolver los datos. Su única responsabilidad es actualizar el estado global.

    } catch (error) {
        showGlobalError("Error al cargar los datos del catálogo. La funcionalidad puede ser limitada.");
        const defaultCatalogData = {
            cortes: [],
            tutoriales: [],
            relay: [],
            sortedCategories: []
        };

        setState({
            catalogData: defaultCatalogData
        });
    }
}


export async function checkSession() {
    const LOCK_KEY = 'session_validation_lock';
    const LOCK_TIMEOUT = 5000;

    const lock = localStorage.getItem(LOCK_KEY);
    const now = Date.now();

    if (lock && (now - parseInt(lock, 10)) < LOCK_TIMEOUT) {
        return;
    }

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
            // Comentario: La carga de datos y la visualización de la app ahora ocurren en paralelo.
            // `loadInitialData` actualiza el estado en segundo plano, mientras `handleLoginSuccess`
            // muestra la UI, que esperará a que los datos estén listos.
            loadInitialData();
            handleLoginSuccess(user);
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
            // Comentario: La lógica se simplifica. La carga de datos se inicia, y la UI se muestra inmediatamente.
            // La UI (`showApp`) es ahora responsable de esperar a que los datos se carguen antes de renderizar el contenido.
            loadInitialData();
            handleLoginSuccess(result.user);
        } else {
            throw new Error("Respuesta de login inválida.");
        }
    } catch (error) {
        showGlobalError(error.message || "Credenciales inválidas.");
    }
}

export function logout(reason = null) {
    localStorage.removeItem(SESSION_KEY);
    // localStorage.removeItem(SESSION_ID_KEY); // This key is not used in the new architecture
    showLoginScreen(reason);
}
