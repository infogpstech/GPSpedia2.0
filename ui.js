// GPSpedia UI Module
// Responsibilities:
// - Render UI components based on state.
// - Contain all functions that directly manipulate the DOM.
// - Use document.createElement, not HTML strings.

import { getImageUrl } from './api.js';
import { getState } from './state.js';
import { mostrarMarcas, mostrarCategoriasPorMarca, mostrarModelos, getLogoUrlForMarca } from './navigation.js';

function crearCarrusel(titulo, items, cardGenerator) {
    const cont = document.getElementById("contenido");
    if (!items || items.length === 0 || !cont) return;

    const section = document.createElement('div');
    const title = document.createElement('h4');
    title.textContent = titulo;
    title.style.marginTop = '40px';
    section.appendChild(title);

    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';
    const carouselTrack = document.createElement('div');
    carouselTrack.className = 'carousel-track';

    items.forEach(item => {
        const card = cardGenerator(item);
        carouselTrack.appendChild(card);
    });
    carouselContainer.appendChild(carouselTrack);

    const getVisibleCards = () => {
        const containerWidth = carouselContainer.offsetWidth;
        const cardWidth = 140 + 20; // Ancho de la tarjeta + margen
        return Math.floor(containerWidth / cardWidth) || 1;
    };

    if (items.length > getVisibleCards()) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'carousel-btn prev';
        prevBtn.innerHTML = '&#10094;';
        carouselContainer.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'carousel-btn next';
        nextBtn.innerHTML = '&#10095;';
        carouselContainer.appendChild(nextBtn);

        const cardWidth = 140 + 20;

        const updateCarouselButtons = () => {
            const scrollLeft = carouselTrack.scrollLeft;
            const maxScrollLeft = carouselTrack.scrollWidth - carouselTrack.clientWidth;
            prevBtn.style.display = scrollLeft > 0 ? 'flex' : 'none';
            nextBtn.style.display = scrollLeft < maxScrollLeft - 1 ? 'flex' : 'none';
        };

        nextBtn.addEventListener('click', () => {
            carouselTrack.scrollBy({ left: cardWidth * getVisibleCards(), behavior: 'smooth' });
        });

        prevBtn.addEventListener('click', () => {
            carouselTrack.scrollBy({ left: -cardWidth * getVisibleCards(), behavior: 'smooth' });
        });

        carouselTrack.addEventListener('scroll', () => setTimeout(updateCarouselButtons, 150));
        window.addEventListener('resize', () => setTimeout(updateCarouselButtons, 150));
        setTimeout(updateCarouselButtons, 150);
    }

    section.appendChild(carouselContainer);
    cont.appendChild(section);
}

export function mostrarCategorias() {
    const { catalogData } = getState();
    const { cortes, sortedCategories } = catalogData;

    if (document.getElementById("searchInput").value.trim()) return;

    const cont = document.getElementById("contenido");
    cont.innerHTML = ""; // Limpiar contenido

    mostrarUltimosAgregados();

    const categorias = sortedCategories;
    crearCarrusel('Búsqueda por Categoría', categorias, cat => {
        const ejemplo = cortes.find(item => item.categoria === cat && item.imagenVehiculo);
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarMarcas(cat);
        const img = document.createElement("img");
        img.src = getImageUrl(ejemplo?.imagenVehiculo);
        img.alt = `Categoría ${cat}`;
        card.appendChild(img);
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = cat;
        card.appendChild(overlay);
        return card;
    });

    const marcasVehiculos = [...new Set(cortes
        .filter(item => item.categoria && !['motocicletas', 'motos'].includes(item.categoria.toLowerCase()))
        .map(item => item.marca))]
        .filter(Boolean).sort();

    crearCarrusel('Marcas de Vehículos', marcasVehiculos, marca => {
        const logoUrl = getLogoUrlForMarca(marca, null);
        const card = document.createElement("div");
        card.className = "card brand-logo-item";
        card.onclick = () => mostrarCategoriasPorMarca(marca);
        const img = document.createElement("img");
        img.src = getImageUrl(logoUrl);
        img.alt = `Marca ${marca}`;
        card.appendChild(img);
        return card;
    });

    const marcasMotos = [...new Set(cortes
        .filter(item => item.categoria && ['motocicletas', 'motos'].includes(item.categoria.toLowerCase()))
        .map(item => item.marca))]
        .filter(Boolean).sort();

    crearCarrusel('Marcas de Motocicletas', marcasMotos, marca => {
        const logoUrl = getLogoUrlForMarca(marca, 'Motocicletas');
        const card = document.createElement("div");
        card.className = "card brand-logo-item";
        card.onclick = () => mostrarModelos('Motocicletas', marca);
        const img = document.createElement("img");
        img.src = getImageUrl(logoUrl);
        img.alt = `Marca ${marca}`;
        card.appendChild(img);
        return card;
    });
}

export function mostrarDetalleModal(item) {
    const { catalogData } = getState();
    const { relay: datosRelay } = catalogData;

    const cont = document.getElementById("detalleCompleto");
    cont.innerHTML = "";

    const headerDiv = document.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Cerrar";
    closeBtn.onclick = () => cerrarModal();
    closeBtn.className = "backBtn";
    closeBtn.style.cssText = "color:white; background:#dc3545; border:none; margin:0;";
    headerDiv.appendChild(closeBtn);
    cont.appendChild(headerDiv);

    const titleContainer = document.createElement("div");
    titleContainer.style.cssText = "border-bottom: 3px solid #007bff; padding-bottom: 8px; margin-bottom: 10px;";

    const mainHeaderDiv = document.createElement('div');
    mainHeaderDiv.style.cssText = "display: flex; justify-content: flex-start; align-items: center; gap: 15px;";

    const title = document.createElement("h2");
    title.textContent = item.modelo;
    title.style.cssText = "color:#007bff; margin: 0; padding: 0;";
    mainHeaderDiv.appendChild(title);

    titleContainer.appendChild(mainHeaderDiv);

    const subHeaderDiv = document.createElement('div');
    subHeaderDiv.style.marginTop = '10px';

    const subHeaderText = document.createElement('p');
    subHeaderText.style.cssText = "margin: 0; padding: 0; color: #555;";

    const equipamiento = item.versionesAplicables || item.tipoEncendido || '';
    const yearRangeText = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;
    subHeaderText.innerHTML = `<span style="font-size: 0.9em;">${equipamiento} | ${yearRangeText}</span>`;

    if(item.categoria) {
         subHeaderText.innerHTML += `<br><span style="font-size: 0.8em; color: #777;">${item.categoria}</span>`;
    }

    subHeaderDiv.appendChild(subHeaderText);
    titleContainer.appendChild(subHeaderDiv);
    cont.appendChild(titleContainer);

    if (item.notaImportante) {
        const p = document.createElement("p");
        p.innerHTML = `<strong style="color:red;">Nota Importante:</strong> <span style="color:#cc0000; font-weight: bold;">${item.notaImportante} ⚠️</span>`;
        cont.appendChild(p);
    }
    document.getElementById("modalDetalle").classList.add("visible");
}

function mostrarUltimosAgregados() {
    const { catalogData } = getState();
    const { cortes } = catalogData;

    if (!cortes || cortes.length === 0) return;

    const ultimosCortes = [...cortes]
        .sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
            const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
            if (dateB - dateA !== 0) return dateB - dateA;
            return b.id - a.id;
        })
        .slice(0, 6);

    if (ultimosCortes.length === 0) return;

    crearCarrusel('Últimos Agregados', ultimosCortes, item => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.animation = 'none';
        card.style.opacity = '1';
        card.onclick = () => mostrarDetalleModal(item);

        const img = document.createElement("img");
        img.src = getImageUrl(item.imagenVehiculo);
        img.alt = `${item.marca} ${item.modelo}`;
        img.loading = "lazy";
        card.appendChild(img);

        const overlay = document.createElement("div");
        overlay.className = "overlay";
        const yearRange = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;

        const marcaDiv = document.createElement('div');
        marcaDiv.textContent = item.marca;
        overlay.appendChild(marcaDiv);

        const modeloDiv = document.createElement('div');
        modeloDiv.style.cssText = "font-size:0.8em; opacity:0.8;";
        modeloDiv.textContent = `${item.modelo} ${yearRange || ''}`;
        overlay.appendChild(modeloDiv);

        card.appendChild(overlay);
        return card;
    });
}

export function showLoginScreen(reason = null) {
    document.getElementById('splash-screen').style.display = 'none';
    document.querySelector('.container').style.display = 'none';
    document.querySelector('.footer').style.display = 'none';
    document.getElementById('welcome-message').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';

    const loginError = document.getElementById('login-error');
    if (reason) {
        loginError.textContent = reason;
        loginError.style.display = 'block';
    } else {
        loginError.style.display = 'none';
    }

    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

export function showApp(user) {
    const splash = document.getElementById('splash-screen');
    splash.style.opacity = '0';
    setTimeout(() => {
        splash.style.display = 'none';
    }, 500);

    document.getElementById('login-modal').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
    document.querySelector('.footer').style.display = 'block';

    if (user && user.Nombre_Usuario) {
        document.getElementById('menu-username').textContent = user.Nombre_Usuario;
    }

    const devToolsBtn = document.getElementById('dev-tools-btn');
    const userRole = user ? user.Privilegios : '';
    if (devToolsBtn && userRole === 'Desarrollador') {
        devToolsBtn.style.display = 'flex';
    }

    const inboxBtn = document.getElementById('inbox-btn');
    if (inboxBtn && ['Desarrollador', 'Gefe', 'Supervisor'].includes(userRole)) {
        inboxBtn.style.display = 'flex';
    }

    mostrarCategorias();
}

export function showGlobalError(message) {
    const toast = document.getElementById('error-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 7000);
}

export function openSideMenu() {
    const { currentUser } = getState();
    if (currentUser && currentUser.Nombre_Usuario) {
        document.getElementById('menu-username').textContent = currentUser.Nombre_Usuario;
    }
    document.getElementById('side-menu').classList.add('open');
    document.getElementById('menu-overlay').classList.add('open');
}

export function closeSideMenu() {
    document.getElementById('side-menu').classList.remove('open');
    document.getElementById('menu-overlay').classList.remove('open');
}
