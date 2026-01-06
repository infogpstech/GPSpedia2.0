// GPSpedia State Management Module
// Responsibilities:
// - Act as the single source of truth for all application data.
// - Provide getter and setter functions to manage state mutations.

let state = {
    currentUser: null,
    catalogData: {
        cortes: [],
        tutoriales: [],
        relay: [],
        logos: [],
        sortedCategories: []
    },
    navigationState: {
        level: 'categorias',
        categoria: null,
        marca: null,
        modelo: null
    },
    uiState: {
        isModalOpen: false,
        isSearchActive: false
    }
};

export function getState() {
    return { ...state };
}

export function setState(newState) {
    state = { ...state, ...newState };
}
