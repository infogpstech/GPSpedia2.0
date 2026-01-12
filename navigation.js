// GPSpedia Navigation Module
// Responsibilities:
// - Manage the application's view state and navigation flow.
// - Handle user navigation actions (e.g., selecting a category or brand).
// - Update the navigation state and trigger UI rendering calls.
// - Handle search functionality.

import { getState, setState } from './state.js';
import {
    mostrarCategorias,
    mostrarResultadosBusquedaMarca,
    showNoResultsMessage
} from './ui.js';

let datosFiltrados = [];

export function irAPaginaPrincipal() {
    setState({ navigationState: { level: 'categorias', categoria: null, marca: null, modelo: null } });
    mostrarCategorias();
}

export function getDatosFiltrados() {
    return datosFiltrados;
}

export function filtrarContenido(textoBusqueda) {
    const { catalogData } = getState();
    const { cortes } = catalogData;
    const busqueda = textoBusqueda.toLowerCase().trim();

    if (!busqueda) {
        datosFiltrados = [];
        irAPaginaPrincipal();
        return;
    }

    const palabrasBusqueda = busqueda.split(' ').filter(p => p);
    datosFiltrados = cortes.filter(item => {
        const itemTexto = `${item.categoria} ${item.marca} ${item.modelo} ${item.anoDesde} ${item.anoHasta} ${item.tipoEncendido} ${item.versionesAplicables}`.toLowerCase();
        return palabrasBusqueda.every(palabra => itemTexto.includes(palabra));
    });

    if (datosFiltrados.length > 0) {
        // Pass the filtered data to the UI function
        mostrarResultadosBusquedaMarca(busqueda, datosFiltrados);
    } else {
        showNoResultsMessage(textoBusqueda);
    }
    setState({ navigationState: { level: "busqueda" } });
}
