// ============================================================================
// GPSPEDIA-CATALOG SERVICE - v1.2 (Hierarchical Navigation)
// ============================================================================

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo";
let spreadsheet = null;

function getSpreadsheet() {
  if (spreadsheet === null) {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return spreadsheet;
}

const SHEET_NAMES = {
    CORTES: "Cortes",
    TUTORIALES: "Tutorial",
    RELAY: "Configuración del Relay"
};

// --- Columnas Clave para Navegación en 'Cortes' ---
// Estos nombres deben coincidir con los encabezados exactos en la hoja de cálculo
const COLS_CORTES = {
    CATEGORIA: "Categoria",
    MARCA: "Marca",
    MODELO: "Modelo",
    ANOS: "Año (generacion)",
    IMG_VEHICULO: "Imagen del vehiculo"
};


// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
  try {
    const response = {
      status: 'success',
      message: 'GPSpedia CATALOG-SERVICE v1.2 is active. Now with Hierarchical Navigation.'
    };
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorResponse = { status: 'error', message: 'Error en doGet.', details: { message: error.message } };
    return ContentService.createTextOutput(JSON.stringify(errorResponse)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
    let response;
    let request;
    try {
        request = JSON.parse(e.postData.contents);

        switch (request.action) {
            case 'search':
                response = handleSearch(request.payload);
                break;
            case 'getNavigationData':
                response = handleGetNavigationData(request.payload);
                break;
            // Mantener otras acciones si son necesarias, de lo contrario, se pueden eliminar.
            case 'getDropdownData':
                 response = handleGetDropdownData();
                 break;
            default:
                throw new Error(`Acción desconocida en Catalog Service: ${request.action}`);
        }
    } catch (error) {
        response = {
            status: 'error',
            message: 'Ocurrió un error inesperado en el servicio de catálogo.',
            details: { errorMessage: error.message }
        };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// MANEJADORES DE ACCIONES
// ============================================================================

function handleSearch(payload) {
    const { query } = payload;
    if (!query || query.trim().length < 2) {
        return { status: 'success', data: [] };
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift();

    const normalizedQuery = normalizeText(query);
    const searchTerms = normalizedQuery.split(' ').filter(Boolean);

    const results = allData.filter(row => {
        const rowText = row.join(' ').toLowerCase();
        const normalizedRowText = normalizeText(rowText);
        return searchTerms.every(term => normalizedRowText.includes(term));
    }).map(row => formatRowToJSON(row, headers));

    return { status: 'success', data: results };
}


function handleGetNavigationData(payload) {
    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift();

    // Mapear índices de columnas una sola vez
    const colIndexes = {
        categoria: headers.indexOf(COLS_CORTES.CATEGORIA),
        marca: headers.indexOf(COLS_CORTES.MARCA),
        modelo: headers.indexOf(COLS_CORTES.MODELO),
        anos: headers.indexOf(COLS_CORTES.ANOS),
        imgVehiculo: headers.indexOf(COLS_CORTES.IMG_VEHICULO)
    };

    const path = payload.path || [];
    let nivelActual;
    let dataFiltrada = allData;

    // Filtrar datos según la ruta (path)
    if (path.length > 0) dataFiltrada = dataFiltrada.filter(row => row[colIndexes.categoria] === path[0]);
    if (path.length > 1) dataFiltrada = dataFiltrada.filter(row => row[colIndexes.marca] === path[1]);
    if (path.length > 2) dataFiltrada = dataFiltrada.filter(row => row[colIndexes.modelo] === path[2]);

    // Determinar el nivel actual basado en la longitud de la ruta
    if (path.length === 0) nivelActual = 'categorias';
    else if (path.length === 1) nivelActual = 'marcas';
    else if (path.length === 2) nivelActual = 'modelos';
    else if (path.length === 3) nivelActual = 'versiones';
    else nivelActual = 'detalle';

    let responseData = { nivel: nivelActual };

    if (nivelActual === 'categorias') {
        responseData.siguienteNivel = 'marcas';
        responseData.data = getUniqueItems(allData, colIndexes.categoria, colIndexes.imgVehiculo);
    } else if (nivelActual === 'marcas') {
        responseData.siguienteNivel = 'modelos';
        responseData.data = getUniqueItems(dataFiltrada, colIndexes.marca, colIndexes.imgVehiculo);
    } else if (nivelActual === 'modelos') {
        responseData.siguienteNivel = 'versiones';
        responseData.data = getUniqueItems(dataFiltrada, colIndexes.modelo, colIndexes.imgVehiculo, colIndexes.anos);
    } else if (nivelActual === 'versiones') {
        // Comprobar si hay una única versión o varias
        if (dataFiltrada.length === 1) {
            responseData.esDetalle = true;
            responseData.data = formatRowToJSON(dataFiltrada[0], headers);
        } else {
            responseData.siguienteNivel = 'detalle';
            responseData.data = dataFiltrada.map(row => ({
                nombre: row[colIndexes.anos] || 'Versión Única',
                imagenUrl: createThumbnailUrl(row[colIndexes.imgVehiculo]),
                // Guardamos la fila completa para el siguiente paso
                fullData: formatRowToJSON(row, headers)
            }));
        }
    }

    return { status: 'success', ...responseData };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Obtiene una lista de items únicos de una columna, junto con una imagen de ejemplo.
 */
function getUniqueItems(data, colIndex, imgIndex, subLabelIndex = -1) {
    const unique = {};
    data.forEach(row => {
        const key = row[colIndex];
        if (key && !unique[key]) {
            unique[key] = {
                nombre: key,
                imagenUrl: createThumbnailUrl(row[imgIndex]),
                sublabel: subLabelIndex !== -1 ? row[subLabelIndex] : null
            };
        }
    });
    return Object.values(unique).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Convierte una fila de datos (array) a un objeto JSON usando los encabezados.
 */
function formatRowToJSON(row, headers) {
    const obj = {};
    headers.forEach((header, i) => {
        const camelHeader = camelCase(header);
        obj[camelHeader] = row[i];
    });
    return obj;
}


function createThumbnailUrl(driveUrl) {
    if (typeof driveUrl !== 'string' || driveUrl.trim() === '') return null;
    const regex = /drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/;
    const match = driveUrl.match(regex);
    if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}=s300`;
    }
    return driveUrl; // Devolver original si no es un enlace de Drive reconocible
}

function camelCase(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 ]/g, "").trim().split(' ')
        .map((word, index) => {
            if (!word) return '';
            const lowerWord = word.toLowerCase();
            return index === 0 ? lowerWord : lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
        }).join('');
}

function normalizeText(text) {
    if (typeof text !== 'string') {
        return '';
    }
    return text
        .normalize('NFD') // Normaliza a su forma descompuesta (ej. 'é' -> 'e' + '´')
        .replace(/[\u0300-\u036f]/g, '') // Elimina los diacríticos
        .toLowerCase();
}
