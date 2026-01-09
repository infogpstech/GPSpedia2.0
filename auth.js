// GPSpedia Authentication Module
// Responsibilities:
// - Manage the entire user authentication lifecycle (login, logout, session validation).
// - Interact with the API module for backend communication.
// - Update the user state.

import { setState } from './state.js';
import { routeAction, fetchCatalogData, login as apiLogin, validateSession as apiValidateSession } from './api.js';
import { showLoginScreen, showApp, showGlobalError } from './ui.js';

const SESSION_KEY = 'gpsepedia_session';

function handleLoginSuccess(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setState({ currentUser: user });
    showApp(user); // Muestra la UI principal inmediatamente
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

        setState({
            catalogData: {
                ...catalogData,
                sortedCategories: sortedCategories
            }
        });

        // La UI ya está visible, esto solo refrescará el contenido si es necesario
        // (asumiendo que las funciones de renderizado usan el estado actualizado)

    } catch (error) {
        showGlobalError("Error al cargar los datos del catálogo. La funcionalidad puede ser limitada.");
        // NO se llama a showLoginScreen()
    }
}


export async function checkSession() {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) {
        showLoginScreen();
        return;
    }

    try {
        const user = JSON.parse(sessionData);
        const { valid } = await apiValidateSession(user.ID, user.SessionToken);
        if (valid) {
            handleLoginSuccess(user);
            await loadInitialData(); // Carga los datos después de mostrar la UI
        } else {
            logout("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
        }
    } catch (error) {
        showGlobalError(`Error de sesión: ${error.message}`);
        logout();
    }
}

export async function login(username, password) {
    try {
        const result = await apiLogin(username, password);
        if (result && result.user) {
            handleLoginSuccess(result.user);
            await loadInitialData(); // Carga los datos después de mostrar la UI
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
