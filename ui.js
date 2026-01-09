// GPSpedia UI Module
// Responsibilities:
// - Render UI components based on state.
// - Contain all functions that directly manipulate the DOM.
// - Use document.createElement, not HTML strings.

import { getImageUrl, getFeedbackItems, replyToFeedback, markAsResolved } from './api.js';
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

    // Si hay una búsqueda activa, no mostrar las categorías principales
    if (document.getElementById("searchInput").value.trim()) return;

    const cont = document.getElementById("contenido");
    cont.innerHTML = ""; // Limpiar contenido existente

    // 1. Mostrar "Últimos Agregados" primero
    mostrarUltimosAgregados();

    // 2. Mostrar "Búsqueda por Categoría"
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

    // 3. Mostrar "Marcas de Vehículos"
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

    // 4. Mostrar "Marcas de Motocicletas"
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
    cont.innerHTML = ""; // Limpiar el contenido anterior

    // --- 1. Botón de Cerrar ---
    const headerDiv = document.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: flex-end; align-items: center; margin-bottom: 10px;";
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => document.getElementById("modalDetalle").classList.remove("visible");
    closeBtn.className = "info-close-btn";
    closeBtn.style.cssText = "position: static; font-size: 1.8em; padding: 0 10px;";
    headerDiv.appendChild(closeBtn);
    cont.appendChild(headerDiv);

    // --- 2. Encabezado Principal (Logo y Título) ---
    const titleContainer = document.createElement("div");
    titleContainer.style.cssText = "border-bottom: 3px solid #007bff; padding-bottom: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: flex-start; gap: 15px;";

    // --- REORDENADO PARA PONER EL LOGO PRIMERO ---
    const logoUrl = getLogoUrlForMarca(item.marca, item.categoria);
    if (logoUrl) {
        const logoImg = document.createElement("img");
        logoImg.src = getImageUrl(logoUrl);
        logoImg.alt = `Logo ${item.marca}`;
        logoImg.className = 'brand-logo-modal';
        logoImg.style.cssText = "height: 50px; width: auto; max-width: 150px; object-fit: contain; order: 1;"; // Logo primero
        titleContainer.appendChild(logoImg);
    }

    const title = document.createElement("h2");
    title.textContent = `${item.modelo}`; // Quitado ${item.marca} para no duplicar
    title.style.cssText = "color:#007bff; margin: 0; padding: 0; font-size: 1.8em; order: 2;"; // Título después
    titleContainer.appendChild(title);

    cont.appendChild(titleContainer);

    // --- 3. Sub-encabezado (Versión, Años, Categoría) ---
    // (Esta parte se mantiene igual)
    const subHeaderDiv = document.createElement('div');
    subHeaderDiv.style.marginBottom = '15px';
    const subHeaderText = document.createElement('p');
    subHeaderText.style.cssText = "margin: 0; padding: 0; color: #555; font-size: 1.1em;";
    const equipamiento = item.versionesAplicables || item.tipoEncendido || '';
    const yearRangeText = item.anoHasta ? `${item.anoDesde} - ${item.anoHasta}` : item.anoDesde;
    subHeaderText.innerHTML = `<strong>${equipamiento}</strong> | ${yearRangeText}`;
    if(item.categoria) {
         subHeaderText.innerHTML += `<br><span style="font-size: 0.9em; color: #777;">${item.categoria}</span>`;
    }
    subHeaderDiv.appendChild(subHeaderText);
    cont.appendChild(subHeaderDiv);


    // --- 4. Imagen del Vehículo ---
    if (item.imagenVehiculo) {
        const imgVehiculo = document.createElement("img");
        imgVehiculo.src = getImageUrl(item.imagenVehiculo);
        imgVehiculo.className = 'img-vehiculo-modal';
        cont.appendChild(imgVehiculo);
    }

    // --- 5. Nota Importante ---
    if (item.notaImportante) {
        const p = document.createElement("p");
        p.style.cssText = "color:#cc0000; font-weight: bold; background: #ffe0e0; padding: 10px; border-radius: 5px; border-left: 4px solid #cc0000; margin: 15px 0;";
        p.textContent = `⚠️ ${item.notaImportante}`;
        cont.appendChild(p);
    }

    // --- Lógica de Ordenamiento de Cortes ---
    const cortes = [];
    for (let i = 1; i <= 3; i++) {
        if (item[`tipoCorte${i}`]) {
            cortes.push({
                index: i,
                tipo: item[`tipoCorte${i}`],
                ubicacion: item[`ubicacionCorte${i}`],
                colorCable: item[`colorCableCorte${i}`],
                configRelay: item[`configRelay${i}`],
                img: item[`imgCorte${i}`],
                util: parseInt(item[`utilCorte${i}`] || 0),
                colaborador: item[`colaboradorCorte${i}`]
            });
        }
    }
    cortes.sort((a, b) => b.util - a.util);

    // --- 6. Renderizar Corte Recomendado (si existe) ---
    const recommendedCut = cortes.shift(); // Extrae el primer corte (el mejor)
    if (recommendedCut) {
        const recommendedSection = document.createElement('div');
        const title = document.createElement('h4');
        title.innerHTML = `Corte Recomendado <span style="font-weight:normal; color:#666;">(Votos: ${recommendedCut.util})</span>`;
        recommendedSection.appendChild(title);
        // Usar una función helper para no duplicar código
        renderCutContent(recommendedSection, recommendedCut, datosRelay);
        cont.appendChild(recommendedSection);
    }

    // --- 7. Contenedor para secciones desplegables ---
    const accordionContainer = document.createElement('div');
    cont.appendChild(accordionContainer);

    // --- 8. Renderizar el resto de las secciones en acordeones ---
    const otherSections = [
        ...cortes.map((corte, idx) => ({
            isCorte: true,
            title: `Corte Alternativo ${idx + 1} (Votos: ${corte.util})`,
            data: corte
        })),
        { title: 'Apertura', content: item.apertura, img: item.imgApertura, colaborador: item.colaboradorApertura },
        { title: 'Cables de Alimentación', content: item.cableAlimen, img: item.imgCableAlimen, colaborador: item.colaboradorAlimen },
        { title: 'Vídeo Guía de Desarme', videoUrl: item.Video }
    ];

    otherSections.forEach(sec => {
        const hasContent = sec.isCorte || sec.content || sec.img || sec.videoUrl;
        if (hasContent && sec.title) {
            createAccordionSection(accordionContainer, sec.title, sec, false, datosRelay); // Pasar datosRelay
        }
    });

    document.getElementById("modalDetalle").classList.add("visible");
}

function renderCutContent(container, cutData, datosRelay) {
    const contentP = document.createElement('p');
    contentP.innerHTML = `<strong>Ubicación:</strong> ${cutData.ubicacion || 'No especificada'}<br>
                        <strong>Color de Cable:</strong> ${cutData.colorCable || 'No especificado'}`;
    container.appendChild(contentP);

    // --- LÓGICA DE IMAGEN Y BOTONES (MODIFICADO) ---
    if (cutData.img) {
        const highResImgUrl = getImageUrl(cutData.img, 1000);

        // Contenedor principal para la imagen y el overlay
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container-with-feedback';

        // Imagen
        const img = document.createElement("img");
        img.src = highResImgUrl;
        img.className = 'img-corte image-with-container';
        img.onclick = () => {
            document.getElementById('lightboxImg').src = highResImgUrl;
            document.getElementById('lightbox').classList.add('visible');
        };
        imgContainer.appendChild(img);

        // Overlay de botones de feedback
        const feedbackOverlay = document.createElement('div');
        feedbackOverlay.className = 'feedback-overlay';

        const utilBtn = document.createElement('button');
        utilBtn.className = 'feedback-btn-overlay util-btn';
        utilBtn.innerHTML = '<i class="fa-solid fa-thumbs-up"></i>';
        utilBtn.title = 'Marcar como útil';
        // TODO: Agregar lógica de 'like'
        feedbackOverlay.appendChild(utilBtn);

        const reportBtn = document.createElement('button');
        reportBtn.className = 'feedback-btn-overlay report-btn';
        reportBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        reportBtn.title = 'Reportar un problema';
        // TODO: Agregar lógica de 'reporte'
        feedbackOverlay.appendChild(reportBtn);

        imgContainer.appendChild(feedbackOverlay);
        container.appendChild(imgContainer);
    }

    // --- CONFIGURACIÓN DE RELAY (REORDENADO) ---
    const relayContainer = document.createElement('p');
    const configRelay = cutData.configRelay;

    if (!configRelay || configRelay.toLowerCase() === 'sin relay') {
        relayContainer.innerHTML = `<strong>Configuración de Relay:</strong> Sin Relay`;
    } else {
        relayContainer.innerHTML = `<strong>Configuración de Relay: </strong>`;
        const relayButton = document.createElement('button');
        relayButton.textContent = configRelay;
        relayButton.className = 'btn-link';
        relayButton.onclick = () => {
            const relayInfo = datosRelay.find(r => r.configuracion === configRelay);
            if (relayInfo) {
                renderRelayInfoModal(relayInfo);
            } else {
                alert('No se encontraron detalles para esta configuración de relay.');
            }
        };
        relayContainer.appendChild(relayButton);
    }
    container.appendChild(relayContainer);

    // --- COLABORADOR (MODIFICADO) ---
    if (cutData.colaborador) {
        const colabP = document.createElement('p');
        // Se reduce el tamaño de la fuente
        colabP.style.cssText = "font-style: italic; color: #888; margin-top: 10px; text-align: left; font-size: 0.8em;";
        colabP.innerHTML = `Aportado por: <strong>${cutData.colaborador}</strong>`;
        container.appendChild(colabP);
    }
}

function renderRelayInfoModal(relayInfo) {
    let modal = document.getElementById('relay-info-modal');
    if (modal) {
        modal.remove(); // Eliminar modal anterior si existe para evitar duplicados
    }

    modal = document.createElement('div');
    modal.id = 'relay-info-modal';
    modal.className = 'info-modal'; // Usar la misma clase que otros modales para consistencia
    modal.style.display = 'flex'; // Hacerlo visible

    const content = document.createElement('div');
    content.className = 'info-modal-content';

    const closeBtn = document.createElement('span');
    closeBtn.className = 'info-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.style.display = 'none';
    content.appendChild(closeBtn);

    const title = document.createElement('h3');
    title.textContent = relayInfo.configuracion;
    content.appendChild(title);

    const img = document.createElement('img');
    img.src = getImageUrl(relayInfo.imagen);
    img.style.width = '100%';
    content.appendChild(img);

    modal.appendChild(content);
    document.body.appendChild(modal);
}


// --- Inbox and Dev Tools Modal Logic ---

function setupModal(modalId, openFn) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const closeBtn = modal.querySelector('.info-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
    }
    return openFn;
}

export const openInbox = setupModal('inbox-modal', async () => {
    console.log("Inbox: Opening inbox modal...");
    const modal = document.getElementById('inbox-modal');
    modal.style.display = 'flex';
    const listContainer = document.getElementById('inbox-list');
    const detailContainer = document.getElementById('inbox-detail');
    listContainer.innerHTML = '<p>Cargando mensajes...</p>';
    detailContainer.innerHTML = '<p>Selecciona un item para ver los detalles.</p>';

    try {
        console.log("Inbox: Fetching feedback items...");
        const result = await getFeedbackItems();
        console.log("Inbox: API response received:", result);

        if (result.status === 'success' && result.data) {
            console.log("Inbox: API call successful. Data received:", result.data);
            if (Array.isArray(result.data)) {
                renderInboxList(result.data);
            } else {
                console.error("Inbox Error: result.data is not an array!", result.data);
                listContainer.innerHTML = `<p style="color:red;">Error: El formato de los datos es incorrecto.</p>`;
            }
        } else {
            console.error("Inbox Error: API call failed or data missing.", result);
            listContainer.innerHTML = `<p style="color:red;">Error: ${result.message || 'No se pudieron cargar los mensajes.'}</p>`;
        }
    } catch (error) {
        listContainer.innerHTML = `<p style="color:red;">Error de conexión al cargar mensajes.</p>`;
        console.error("Error fetching feedback items:", error);
    }
});

export const openDevTools = setupModal('dev-tools-modal', () => {
    document.getElementById('dev-tools-modal').style.display = 'flex';
    // Logic to move debug console if needed can be added here
});

function renderInboxList(items) {
    const listContainer = document.getElementById('inbox-list');
    listContainer.innerHTML = '';
    if (items.length === 0) {
        listContainer.innerHTML = '<p>No hay mensajes.</p>';
        return;
    }

    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inbox-item';
        if (item.isResolved) {
            itemDiv.classList.add('resolved');
        }
        if (item.reply) {
             itemDiv.classList.add('replied');
        }

        const iconClass = item.type === 'problem_report' ? 'fa-triangle-exclamation' : 'fa-envelope';
        const title = item.subject || `ID: ${item.id}`;

        itemDiv.innerHTML = `
            <i class="fa-solid ${iconClass}"></i>
            <div class="inbox-item-content">
                <strong>${title}</strong>
                <p>${item.content.substring(0, 50)}...</p>
            </div>
        `;
        itemDiv.addEventListener('click', () => {
            document.querySelectorAll('.inbox-item.active').forEach(el => el.classList.remove('active'));
            itemDiv.classList.add('active');
            renderInboxDetail(item);
        });
        listContainer.appendChild(itemDiv);
    });
}

function renderInboxDetail(item) {
    const detailContainer = document.getElementById('inbox-detail');
    const { currentUser } = getState();
    const userName = currentUser ? currentUser.Nombre_Usuario : 'Usuario';

    detailContainer.innerHTML = `
        <h3>${item.subject}</h3>
        <p><strong>De:</strong> ${item.user}</p>
        ${item.vehicleId ? `<p><strong>ID Vehículo:</strong> ${item.vehicleId}</p>` : ''}
        <div class="inbox-message-content">
            <pre>${item.content}</pre>
        </div>
        ${item.reply ? `
            <div class="inbox-reply-content">
                <strong>Respuesta de ${item.responder || 'Admin'}:</strong>
                <pre>${item.reply}</pre>
            </div>` : ''
        }
        <div class="inbox-actions">
            <textarea id="inbox-reply-textarea" placeholder="Escribe tu respuesta aquí..."></textarea>
            <button id="inbox-reply-btn">Enviar Respuesta</button>
            ${item.type === 'problem_report' && !item.isResolved ?
                `<button id="inbox-resolve-btn" class="resolve-btn">Marcar como Resuelto</button>` : ''
            }
        </div>
    `;

    const replyBtn = document.getElementById('inbox-reply-btn');
    replyBtn.addEventListener('click', async () => {
        const replyText = document.getElementById('inbox-reply-textarea').value;
        if (!replyText.trim()) {
            showGlobalError("La respuesta no puede estar vacía.");
            return;
        }
        try {
            await replyToFeedback(item.id, item.type, replyText, userName);
            // Refresh inbox to show changes
            openInbox();
        } catch (error) {
            showGlobalError(`Error al enviar respuesta: ${error.message}`);
        }
    });

    const resolveBtn = document.getElementById('inbox-resolve-btn');
    if (resolveBtn) {
        resolveBtn.addEventListener('click', async () => {
             try {
                await markAsResolved(item.id);
                openInbox(); // Refresh
            } catch (error) {
                showGlobalError(`Error al resolver: ${error.message}`);
            }
        });
    }
}

function createAccordionSection(container, title, sec, isOpen = false, datosRelay = []) {
    const btn = document.createElement("button");
    btn.className = "accordion-btn";
    btn.innerHTML = `${title} <span class="accordion-arrow">▼</span>`;

    const panel = document.createElement("div");
    panel.className = "panel-desplegable";

    // --- Lógica Refactorizada ---
    if (sec.isCorte) {
        // Si es un corte, reutilizar la lógica de renderizado de cortes
        renderCutContent(panel, sec.data, datosRelay);
    } else {
        // Lógica anterior para otras secciones
        if (sec.content) {
            const contentP = document.createElement('p');
            contentP.innerHTML = sec.content;
            panel.appendChild(contentP);
        }

        if (sec.img) {
            const highResImgUrl = getImageUrl(sec.img, 1000);
            const imgContainer = document.createElement('div');
            imgContainer.className = 'image-container-with-feedback';
            const img = document.createElement("img");
            img.src = highResImgUrl;
            img.className = 'img-corte image-with-container';
            img.onclick = () => {
                document.getElementById('lightboxImg').src = highResImgUrl;
                document.getElementById('lightbox').classList.add('visible');
            };
            imgContainer.appendChild(img);
            panel.appendChild(imgContainer);
        }
    }

    if (sec.colaborador) {
        const colabDiv = document.createElement('div');
        const colabP = document.createElement('p');
        colabP.style.cssText = "font-style: italic; color: #888; margin-top: 10px; text-align: left;";
        colabP.innerHTML = `Aportado por: <strong>${sec.colaborador}</strong>`;
        colabDiv.appendChild(colabP);
        panel.appendChild(colabDiv);
    }

    if (sec.videoUrl) {
        const videoLink = document.createElement('a');
        videoLink.href = sec.videoUrl;
        videoLink.target = '_blank';
        videoLink.textContent = 'Ver Video Guía en YouTube';
        videoLink.style.cssText = "display: block; margin-top: 10px; color: #007bff; font-weight: bold;";
        panel.appendChild(videoLink);
    }

    container.appendChild(btn);
    container.appendChild(panel);

    if (isOpen) {
        btn.classList.add("active");
        panel.style.maxHeight = panel.scrollHeight + "px";
    }

    btn.addEventListener("click", function() {
        this.classList.toggle("active");
        if (panel.style.maxHeight) {
            panel.style.maxHeight = null;
        } else {
            panel.style.maxHeight = panel.scrollHeight + "px";
        }
    });
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

// --- Section Rendering Logic ---

export function mostrarSeccion(sectionName) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    document.querySelectorAll('.section-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const sectionId = sectionName === 'cortes' ? 'contenido' : `contenido-${sectionName}`;
    const sectionElement = document.getElementById(sectionId);
    const buttonElement = document.getElementById(`btn-${sectionName}`);

    if (sectionElement) sectionElement.style.display = 'block';
    if (buttonElement) buttonElement.classList.add('active');

    switch (sectionName) {
        case 'cortes':
            mostrarCategorias();
            break;
        case 'tutoriales':
            mostrarTutorialesGrid();
            break;
        case 'relay':
            mostrarRelayGrid();
            break;
    }
}

function mostrarTutorialesGrid() {
    const { catalogData } = getState();
    const { tutoriales } = catalogData;
    const cont = document.getElementById('contenido-tutoriales');
    cont.innerHTML = '<h4>Tutoriales</h4>';

    const grid = document.createElement('div');
    grid.className = 'grid';
    tutoriales.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarDetalleTutorialModal(item);
        const img = document.createElement("img");
        img.src = getImageUrl(item.Imagen);
        img.alt = item.Tema;
        card.appendChild(img);
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.textContent = item.Tema;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarRelayGrid() {
    const { catalogData } = getState();
    const { relay } = catalogData;
    const cont = document.getElementById('contenido-relay');
    cont.innerHTML = '<h4>Configuraciones de Relay</h4>';

    const grid = document.createElement('div');
    grid.className = 'grid';
    relay.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => mostrarDetalleRelayModal(item);
        const img = document.createElement("img");
        img.src = getImageUrl(item.imagen);
        img.alt = item.configuracion;
        card.appendChild(img);
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.textContent = item.configuracion;
        card.appendChild(overlay);
        grid.appendChild(card);
    });
    cont.appendChild(grid);
}

function mostrarDetalleTutorialModal(item) {
    const cont = document.getElementById("detalleCompleto");
    cont.innerHTML = "";

    const headerDiv = document.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;";
    const title = document.createElement("h2");
    title.textContent = item.Tema;
    title.style.color = "#007bff";
    headerDiv.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Cerrar";
    closeBtn.onclick = () => document.getElementById("modalDetalle").classList.remove("visible");
    closeBtn.className = "backBtn";
    closeBtn.style.cssText = "color:white; background:#dc3545; border:none; margin:0;";
    headerDiv.appendChild(closeBtn);
    cont.appendChild(headerDiv);

    if (item.Video) {
        const videoContainer = document.createElement('div');
        const videoUrl = item.Video.replace("watch?v=", "embed/");
        videoContainer.innerHTML = `<iframe width="100%" height="315" src="${videoUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius: 8px;"></iframe>`;
        cont.appendChild(videoContainer);
    }
    if (item.comoIdentificarlo) cont.innerHTML += `<p><strong>Cómo Identificarlo:</strong> ${item.comoIdentificarlo}</p>`;
    if (item.dondeEncontrarlo) cont.innerHTML += `<p><strong>Dónde Encontrarlo:</strong> ${item.dondeEncontrarlo}</p>`;
    if (item.Detalles) cont.innerHTML += `<p><strong>Detalles:</strong> ${item.Detalles}</p>`;

    document.getElementById("modalDetalle").classList.add("visible");
}

function mostrarDetalleRelayModal(item) {
    const cont = document.getElementById("detalleCompleto");
    cont.innerHTML = "";

    const headerDiv = document.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;";
    const title = document.createElement("h2");
    title.textContent = item.configuracion;
    title.style.color = "#007bff";
    headerDiv.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Cerrar";
    closeBtn.onclick = () => document.getElementById("modalDetalle").classList.remove("visible");
    closeBtn.className = "backBtn";
    closeBtn.style.cssText = "color:white; background:#dc3545; border:none; margin:0;";
    headerDiv.appendChild(closeBtn);
    cont.appendChild(headerDiv);

    if (item.imagen) {
        const img = document.createElement("img");
        img.src = getImageUrl(item.imagen);
        img.style.width = "100%";
        img.style.borderRadius = "8px";
        cont.appendChild(img);
    }
    if (item.funcion) cont.innerHTML += `<p><strong>Función:</strong> ${item.funcion}</p>`;
    if (item.vehiculoDondeSeUtiliza) cont.innerHTML += `<p><strong>Vehículos Comunes:</strong> ${item.vehiculoDondeSeUtiliza}</p>`;
    if (item.observacion) cont.innerHTML += `<p><strong>Observación:</strong> ${item.observacion}</p>`;

    document.getElementById("modalDetalle").classList.add("visible");
}
