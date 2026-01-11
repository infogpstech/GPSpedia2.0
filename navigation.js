// GPSpedia Navigation Module
// Responsibilities:
// - Manage the application's view state and navigation flow.
// - Handle user navigation actions (e.g., selecting a category or brand).
// - Update the navigation state and trigger UI rendering.
// - Handle search functionality and display results.

import { getState, setState } from './state.js';
import { mostrarCategorias, mostrarDetalleModal, getImageUrl } from './ui.js';

const backSvg = '<svg style="width:20px;height:20px;margin-right:5px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
let datosFiltrados = []; // State specific to search

export function getLogoUrlForMarca(marca, categoria) {
    const { catalogData } = getState();
    const { logos } = catalogData;

    if (!logos || !logos.length || !marca) {
        return null;
    }

    const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const normalizedMarca = normalize(marca);
    const normalizedCategoria = normalize(categoria);

    const potentialMatches = logos.filter(logo => {
        const normalizedLogoMarca = normalize(logo.nombreMarca);
        return normalizedLogoMarca.startsWith(normalizedMarca);
    });

    if (potentialMatches.length === 0) return null;
    if (potentialMatches.length === 1) return potentialMatches[0].urlLogo;

    let bestMatch = null;
    if (normalizedCategoria) {
        const catSynonyms = (normalizedCategoria === 'motos' || normalizedCategoria === 'motocicletas')
            ? ['motos', 'motocicletas']
            : [normalizedCategoria];

        for (const synonym of catSynonyms) {
            bestMatch = potentialMatches.find(logo => normalize(logo.nombreMarca).includes(synonym));
            if (bestMatch) break;
        }
    }

    if (!bestMatch) {
        bestMatch = potentialMatches.find(logo => normalize(logo.nombreMarca) === normalizedMarca);
    }

    if (!bestMatch) {
        bestMatch = potentialMatches.reduce((prev, current) =>
            (prev.nombreMarca.length < current.nombreMarca.length) ? prev : current
        );
    }

    return bestMatch ? bestMatch.urlLogo : (potentialMatches.length > 0 ? potentialMatches[0].urlLogo : null);
}


export function irAPaginaPrincipal() {
    setState({ navigationState: { level: 'categorias', categoria: null, marca: null, modelo: null } });
    mostrarCategorias();
}

export function mostrarMarcas(categoria) {
    const { catalogData } = getState();
    const { cortes } = catalogData;

    setState({ navigationState: { level: "marcas", categoria: categoria } });
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="window.navigation.irAPaginaPrincipal()">${backSvg} Volver</span><h4>Marcas de ${categoria}</h4>`;
    const itemsInCategory = cortes.filter(item => item.categoria === categoria);
    const marcas = [...new Set(itemsInCategory.map(item => item.marca))].filter(m => m).sort();

    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
    grid.style.gap = "30px";

    marcas.forEach(m => {
        const logoUrl = getLogoUrlForMarca(m, categoria);
        const logoContainer = document.createElement("div");
        logoContainer.className = "card brand-logo-item";
        logoContainer.onclick = () => mostrarModelos(categoria, m);

        const img = document.createElement("img");
        img.src = getImageUrl(logoUrl) || 'https://placehold.co/120x80/cccccc/333333?text=Sin+Logo';
        img.alt = `Marca ${m}`;
        img.loading = "lazy";

        logoContainer.appendChild(img);
        grid.appendChild(logoContainer);
    });
    cont.appendChild(grid);
}

export function mostrarCategoriasPorMarca(marca) {
    const { catalogData } = getState();
    const { cortes } = catalogData;

    setState({ navigationState: { nivel: "categoriasPorMarca", marca: marca } });
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="window.navigation.irAPaginaPrincipal()">${backSvg} Volver</span><h4>Categorías para ${marca}</h4>`;

    const categoriasDeMarca = [...new Set(cortes
        .filter(item => item.marca === marca)
        .map(item => item.categoria))]
        .filter(Boolean).sort();

    const grid = document.createElement("div");
    grid.className = "grid";
    categoriasDeMarca.forEach(cat => {
        const ejemplo = cortes.find(item => item.categoria === cat && item.marca === marca && item.imagenVehiculo);
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarModelos(cat, marca);
        const img = document.createElement("img");
        img.src = getImageUrl(ejemplo?.imagenVehiculo);
        img.alt = `Categoría ${cat}`;
        card.appendChild(img);
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = cat;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

export function mostrarModelos(categoria, marca, versionEquipamiento = null) {
    const { catalogData } = getState();
    const { cortes } = catalogData;

    setState({ navigationState: { level: "modelos", categoria, marca, versionEquipamiento } });
    const cont = document.getElementById("contenido");
    const backAction = versionEquipamiento ? `window.navigation.mostrarVersionesEquipamiento('${categoria}', '${marca}')` : `window.navigation.mostrarMarcas('${categoria}')`;
    cont.innerHTML = `<span class="backBtn" onclick="${backAction}">${backSvg} Volver</span><h4>Modelos de ${marca} ${versionEquipamiento || ''}</h4>`;

    let modelosFiltrados = cortes.filter(item => item.categoria === categoria && item.marca === marca);
    if (versionEquipamiento) {
        modelosFiltrados = modelosFiltrados.filter(item => item.versionesAplicables === versionEquipamiento);
    }

    const modelosUnicos = [...new Map(modelosFiltrados.map(item => [item.modelo, item])).values()].sort((a,b) => a.modelo.localeCompare(b.modelo));

    if (modelosUnicos.length === 1 && !versionEquipamiento) {
        mostrarTiposEncendido(categoria, marca, versionEquipamiento, modelosUnicos[0].modelo);
        return;
    }

    const grid = document.createElement("div"); grid.className = "grid";
    modelosUnicos.forEach(ejemplo => {
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => mostrarTiposEncendido(categoria, marca, versionEquipamiento, ejemplo.modelo);
        const img = document.createElement("img"); img.src = getImageUrl(ejemplo.imagenVehiculo); img.alt = `Modelo ${ejemplo.modelo}`; card.appendChild(img);
        const overlay = document.createElement("div"); overlay.className = "overlay";
        overlay.innerHTML = `<div>${ejemplo.modelo}</div>`;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

export function mostrarTiposEncendido(categoria, marca, versionEquipamiento, modelo) {
     const { catalogData } = getState();
    const { cortes } = catalogData;
    setState({ navigationState: { level: "tiposEncendido", categoria, marca, versionEquipamiento, modelo } });
    const cont = document.getElementById("contenido");
    const backAction = `window.navigation.mostrarModelos('${categoria}', '${marca}', ${versionEquipamiento ? `'${versionEquipamiento}'` : 'null'})`;
    cont.innerHTML = `<span class="backBtn" onclick="${backAction}">${backSvg} Volver</span><h4>Tipos de Encendido para ${modelo}</h4>`;

    let vehiculos = cortes.filter(item =>
        item.categoria === categoria &&
        item.marca === marca &&
        item.modelo === modelo &&
        (!versionEquipamiento || item.versionesAplicables === versionEquipamiento)
    );

    const tiposEncendido = [...new Set(vehiculos.map(v => v.tipoEncendido).filter(Boolean))];

    if (tiposEncendido.length === 1) {
        mostrarVersiones(vehiculos, categoria, marca, modelo);
        return;
    }

    const grid = document.createElement("div"); grid.className = "grid";
    tiposEncendido.forEach(tipo => {
        const ejemplo = vehiculos.find(v => v.tipoEncendido === tipo);
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => mostrarVersiones(vehiculos.filter(v => v.tipoEncendido === tipo), categoria, marca, modelo);

        const img = document.createElement("img");
        img.src = getImageUrl(ejemplo.imagenVehiculo);
        img.alt = tipo;
        card.appendChild(img);

        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = tipo;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

export function mostrarVersiones(filas, categoria, marca, modelo) {
    setState({ navigationState: { level: "versiones", categoria, marca, modelo } });
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="window.navigation.mostrarModelos('${categoria}','${marca}')">${backSvg} Volver</span><h4>Cortes/Años de ${modelo}</h4>`;
    const grid = document.createElement("div"); grid.className = "grid";
    filas.forEach(item => {
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => mostrarDetalleModal(item);
        const img = document.createElement("img"); img.src = getImageUrl(item.imagenVehiculo); img.alt = `Corte ${item.anoDesde}`; card.appendChild(img);
        const overlay = document.createElement("div"); overlay.className = "overlay";
        const yearRange = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;
        overlay.innerHTML = `<div style="font-weight:bold;">${yearRange || modelo}</div><div style="font-size:0.8em;">${item.tipoEncendido || ''}</div>`;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}


// --- SEARCH LOGIC ---

function mostrarResultadosBusquedaMarca(busquedaTexto) {
    const cont = document.getElementById("contenido");
    if (datosFiltrados.length === 1) {
        mostrarDetalleModal(datosFiltrados[0]);
        const yearRange = datosFiltrados[0].anoHasta ? `${datosFiltrados[0].anoDesde} - ${datosFiltrados[0].anoHasta}` : datosFiltrados[0].anoDesde;
        cont.innerHTML = `<h4>Resultado Exacto Encontrado</h4><p>Abriendo detalle de ${datosFiltrados[0].modelo} ${yearRange || ''}.</p>`;
        return;
    }
    cont.innerHTML = `<h4>Resultados de búsqueda para: "${busquedaTexto}"</h4>`;
    const marcasUnicas = [...new Set(datosFiltrados.map(item => item.marca))].sort();

    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
    grid.style.gap = "30px";

    marcasUnicas.forEach(marca => {
        const logoUrl = getLogoUrlForMarca(marca, null);
        const card = document.createElement("div");
        card.className = "card brand-logo-item";
        card.onclick = () => mostrarResultadosBusquedaModelo(busquedaTexto, marca);

        const img = document.createElement("img");
        img.src = getImageUrl(logoUrl);
        img.alt = `Marca ${marca}`;
        img.loading = "lazy";
        card.appendChild(img);

        const brandName = document.createElement('p');
        brandName.textContent = marca;
        brandName.style.textAlign = 'center';
        brandName.style.marginTop = '8px';
        brandName.style.fontWeight = 'bold';
        brandName.style.fontSize = '0.9em';
        card.appendChild(brandName);

        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarResultadosBusquedaModelo(busquedaTexto, marcaFiltro) {
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="window.navigation.mostrarResultadosBusquedaMarca('${busquedaTexto}')">${backSvg} Volver a Marcas</span>
                      <h4>Modelos de ${marcaFiltro} (Búsqueda: "${busquedaTexto}")</h4>`;
    const modelosFiltrados = datosFiltrados.filter(item => item.marca === marcaFiltro);
    const modelosUnicos = [...new Map(modelosFiltrados.map(item => [item.modelo, item])).values()].sort((a,b) => a.modelo.localeCompare(b.modelo));

    const grid = document.createElement("div"); grid.className = "grid";
    modelosUnicos.forEach(ejemplo => {
        const versiones = modelosFiltrados.filter(item => item.modelo === ejemplo.modelo);
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => (versiones.length === 1) ? mostrarDetalleModal(ejemplo) : mostrarResultadosBusquedaVersion(busquedaTexto, marcaFiltro, ejemplo.modelo);
        const img = document.createElement("img"); img.src = getImageUrl(ejemplo.imagenVehiculo); img.alt = `Modelo ${ejemplo.modelo}`; card.appendChild(img);
        const overlay = document.createElement("div"); overlay.className = "overlay";
        if (versiones.length === 1) {
            const yearRange = ejemplo.anoHasta ? `${ejemplo.anoDesde} - ${ejemplo.anoHasta}` : ejemplo.anoDesde;
            overlay.innerHTML = `<div>${ejemplo.modelo}</div><div style="font-size:0.8em; opacity:0.8; font-weight:normal;">${yearRange || ''} ${ejemplo.tipoEncendido || ''}</div>`;
        } else {
            overlay.innerHTML = `<div>${ejemplo.modelo}</div><div style="font-size:0.8em; opacity:0.8; font-weight:normal;">(${versiones.length} cortes)</div>`;
        }
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarResultadosBusquedaVersion(busquedaTexto, marcaFiltro, modeloFiltro) {
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="window.navigation.mostrarResultadosBusquedaModelo('${busquedaTexto}', '${marcaFiltro}')">${backSvg} Volver a Modelos (${modeloFiltro})</span>
                      <h4>Cortes/Años de ${modeloFiltro}</h4>`;
    const versiones = datosFiltrados.filter(item => item.marca === marcaFiltro && item.modelo === modeloFiltro);
    const grid = document.createElement("div"); grid.className = "grid";
    versiones.forEach(item => {
        const card = document.createElement("div"); card.className = "card";
        card.onclick = () => mostrarDetalleModal(item);
        const img = document.createElement("img"); img.src = getImageUrl(item.imagenVehiculo); img.alt = `Corte ${item.anoDesde}`; card.appendChild(img);
        const overlay = document.createElement("div"); overlay.className = "overlay";
        const yearRange = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;
        overlay.innerHTML = `<div style="font-weight:bold;">${yearRange || modeloFiltro}</div><div style="font-size:0.8em; opacity:0.8;">${item.tipoEncendido || ''}</div>`;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
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
        mostrarResultadosBusquedaMarca(busqueda);
    } else {
        document.getElementById("contenido").innerHTML = `<p style="text-align:center; padding: 20px;">No se encontraron resultados para "${textoBusqueda}".</p>`;
    }
    setState({ navigationState: { level: "busqueda" } });
}

export function mostrarVersionesEquipamiento(categoria, marca) {
    const { catalogData } = getState();
    const { cortes } = catalogData;

    setState({ navigationState: { level: "versionesEquipamiento", categoria, marca } });
    const cont = document.getElementById("contenido");
    cont.innerHTML = `<span class="backBtn" onclick="window.navigation.mostrarMarcas('${categoria}')">${backSvg} Volver</span><h4>Versiones de Equipamiento para ${marca}</h4>`;

    const vehiculosDeMarca = cortes.filter(item => item.categoria === categoria && item.marca === marca);
    const versiones = [...new Set(vehiculosDeMarca.map(item => item.versionesAplicables).filter(v => v))];

    const grid = document.createElement("div");
    grid.className = "grid";

    versiones.forEach(version => {
        const ejemplo = vehiculosDeMarca.find(item => item.versionesAplicables === version && item.imagenVehiculo);
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarModelos(categoria, marca, version); // Pasamos la versión para filtrar

        const img = document.createElement("img");
        img.src = getImageUrl(ejemplo?.imagenVehiculo);
        img.alt = `Versión ${version}`;
        card.appendChild(img);

        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = version;
        card.appendChild(overlay);
        grid.appendChild(card);
    });

    cont.appendChild(grid);
}
