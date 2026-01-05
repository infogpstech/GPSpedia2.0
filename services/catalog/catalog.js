// ============================================================================
// GPSPEDIA-CATALOG SERVICE (COMPATIBLE WITH DB V2.0)
// ============================================================================
// COMPONENT VERSION: 2.3.0

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs"; // <-- ACTUALIZADO A DB V2.0
let spreadsheet = null;

function getSpreadsheet() {
  if (spreadsheet === null) {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return spreadsheet;
}

const SHEET_NAMES = {
    CORTES: "Cortes",
    LOGOS_MARCA: "LogosMarca",
    TUTORIALES: "Tutorial",
    RELAY: "Relay"
};

// Mapas de columnas actualizados al esquema v2.0
const COLS_CORTES = {
    id: 1, categoria: 2, marca: 3, modelo: 4, versionesAplicables: 5, anoDesde: 6, anoHasta: 7, tipoEncendido: 8,
    imagenVehiculo: 9, videoGuiaDesarmeUrl: 10, contadorBusqueda: 11, tipoCorte1: 12, ubicacionCorte1: 13,
    colorCableCorte1: 14, configRelay1: 15, imgCorte1: 16, utilCorte1: 17, colaboradorCorte1: 18,
    tipoCorte2: 19, ubicacionCorte2: 20, colorCableCorte2: 21, configRelay2: 22, imgCorte2: 23,
    utilCorte2: 24, colaboradorCorte2: 25, tipoCorte3: 26, ubicacionCorte3: 27, colorCableCorte3: 28,
    configRelay3: 29, imgCorte3: 30, utilCorte3: 31, colaboradorCorte3: 32,
    apertura: 33, imgApertura: 34, cableAlimen: 35, imgCableAlimen: 36,
    timestamp: 37, notaImportante: 38
};

const COLS_LOGOS_MARCA = {
    id: 1,
    nombreMarca: 2,
    urlLogo: 3,
    fabricanteNombre: 4
};

const COLS_TUTORIALES = {
    ID: 1,
    Tema: 2,
    Imagen: 3,
    comoIdentificarlo: 4,
    dondeEncontrarlo: 5,
    Detalles: 6,
    Video: 7
};

const COLS_RELAY = {
    ID: 1,
    configuracion: 2,
    funcion: 3,
    vehiculoDondeSeUtiliza: 4,
    pin30Entrada: 5,
    pin85BobinaPositivo: 6,
    pin86bobinaNegativo: 7,
    pin87aComunCerrado: 8,
    pin87ComunmenteAbierto: 9,
    imagen: 10,
    observacion: 11
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) {
    if (e.parameter.debug === 'true') {
        const cache = CacheService.getScriptCache();
        const cacheKey = 'catalog_data_v2';
        const cachedData = cache.get(cacheKey);

        const serviceState = {
            service: 'GPSpedia-Catalog',
            version: '2.3.0',
            spreadsheetId: SPREADSHEET_ID,
            sheetsAccessed: [SHEET_NAMES.CORTES, SHEET_NAMES.TUTORIALES, SHEET_NAMES.RELAY, SHEET_NAMES.LOGOS_MARCA],
            cacheStatus: {
                isCached: cachedData !== null,
                cacheKey: cacheKey
            }
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Catalog-SERVICE v2.3.0 is active.' // <-- CORREGIDO
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload || {};
    let result;

    switch (action) {
      case 'getCatalogData':
        result = handleGetCatalogData();
        break;
      case 'getDropdownData':
        result = handleGetDropdownData();
        break;
      case 'checkVehicle':
        result = handleCheckVehicle(payload);
        break;
      case 'getSuggestion':
        result = handleGetSuggestion(payload);
        break;
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    const errorResponse = {
      status: 'error',
      message: 'Se ha producido un error en el servidor.',
      details: {
        errorMessage: error.message,
        stack: error.stack
      }
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================

// Definir qué campos de cada mapa de columnas contienen IDs de imagen.
const IMAGE_FIELDS_CORTES = new Set(['imagenVehiculo', 'imgCorte1', 'imgCorte2', 'imgCorte3', 'imgApertura', 'imgCableAlimen']);
const IMAGE_FIELDS_LOGOS = new Set(['urlLogo']);
const IMAGE_FIELDS_TUTORIALES = new Set(['Imagen']);
// Nota: Se asume que el campo 'imagen' en Relay también es un fileId y se normaliza.
const IMAGE_FIELDS_RELAY = new Set(['imagen']);

/**
 * Convierte una fila de hoja de cálculo (array) en un objeto utilizando un mapa de columnas.
 * @param {Array} row - La fila de datos.
 * @param {object} colMap - El objeto que mapea nombres de clave a índices de columna (basado en 1).
 * @param {Set<string>} imageFields - Un Set con los nombres de las claves que deben ser normalizadas como IDs de imagen.
 * @returns {object|null} - El objeto mapeado o null si la fila está vacía.
 */
function mapRowToObject(row, colMap, imageFields = new Set()) {
  if (!row || row.length === 0) {
    return null;
  }
  const obj = {};
  for (const key in colMap) {
    const colIndex = colMap[key] - 1;
    let value = row[colIndex] !== undefined && row[colIndex] !== '' ? row[colIndex] : null;

    // Si el campo es un campo de imagen, normalizar y validar su valor.
    if (imageFields.has(key)) {
      value = normalizeAndValidateImageId(value);
    }

    obj[key] = value;
  }
  return obj;
}

function handleGetCatalogData() {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'catalog_data_v2'; // Use a versioned key
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        // Si los datos están en caché, los devolvemos directamente.
        const parsedData = JSON.parse(cachedData);
        return { status: 'success', data: parsedData, source: 'cache' };
    }

    // Si no están en caché, procedemos a leer de la hoja de cálculo.
    const allData = {};

    // Fetch Cortes
    const cortesSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    let cortesData = [];
    const categoryCounts = {};

    if (cortesSheet) {
        const data = cortesSheet.getDataRange().getValues();
        data.shift();
        cortesData = data
          .filter(row => row && row[0])
          .map(row => {
            const vehicle = mapRowToObject(row, COLS_CORTES, IMAGE_FIELDS_CORTES);
            if (!vehicle) return null;

            // Contar vehículos por categoría
            if (vehicle.categoria) {
                categoryCounts[vehicle.categoria] = (categoryCounts[vehicle.categoria] || 0) + 1;
            }

            // Se elimina la conversión de URLs. El backend ahora envía solo los IDs.

            const cortes = [
                { index: 1, util: parseInt(vehicle.utilCorte1, 10) || 0 },
                { index: 2, util: parseInt(vehicle.utilCorte2, 10) || 0 },
                { index: 3, util: parseInt(vehicle.utilCorte3, 10) || 0 }
            ].sort((a, b) => b.util - a.util);

            const orderedVehicle = { ...vehicle };
            const tempCortes = {};

            for (let i = 1; i <= 3; i++) {
                tempCortes[i] = {
                    tipo: vehicle[`tipoCorte${i}`],
                    ubicacion: vehicle[`ubicacionCorte${i}`],
                    color: vehicle[`colorCableCorte${i}`],
                    config: vehicle[`configRelay${i}`],
                    img: vehicle[`imgCorte${i}`],
                    util: vehicle[`utilCorte${i}`],
                    colaborador: vehicle[`colaboradorCorte${i}`]
                };
            }

            cortes.forEach((corte, i) => {
                const newIndex = i + 1;
                const oldIndex = corte.index;
                orderedVehicle[`tipoCorte${newIndex}`] = tempCortes[oldIndex].tipo;
                orderedVehicle[`ubicacionCorte${newIndex}`] = tempCortes[oldIndex].ubicacion;
                orderedVehicle[`colorCableCorte${newIndex}`] = tempCortes[oldIndex].color;
                orderedVehicle[`configRelay${newIndex}`] = tempCortes[oldIndex].config;
                orderedVehicle[`imgCorte${newIndex}`] = tempCortes[oldIndex].img;
                orderedVehicle[`utilCorte${newIndex}`] = tempCortes[oldIndex].util;
                orderedVehicle[`colaboradorCorte${newIndex}`] = tempCortes[oldIndex].colaborador;
            });

            return orderedVehicle;
        }).filter(Boolean);
    }
    allData.cortes = cortesData;
    allData.categoryCounts = categoryCounts;

    // Crear y añadir la lista de categorías ordenada por popularidad
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);
    allData.sortedCategories = sortedCategories;

    // Fetch Logos
    const logosSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.LOGOS_MARCA);
    let logosData = [];
    if (logosSheet) {
        const data = logosSheet.getDataRange().getValues();
        data.shift();
        logosData = data.map(row => mapRowToObject(row, COLS_LOGOS_MARCA, IMAGE_FIELDS_LOGOS));
    }
    allData.logos = logosData;

    // Fetch Tutoriales
    const tutorialesSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.TUTORIALES);
    let tutorialesData = [];
    if (tutorialesSheet) {
        const data = tutorialesSheet.getDataRange().getValues();
        data.shift();
        tutorialesData = data.map(row => mapRowToObject(row, COLS_TUTORIALES, IMAGE_FIELDS_TUTORIALES));
    }
    allData.tutoriales = tutorialesData;

    // Fetch Relay
    const relaySheet = getSpreadsheet().getSheetByName(SHEET_NAMES.RELAY);
    let relayData = [];
    if (relaySheet) {
        const data = relaySheet.getDataRange().getValues();
        data.shift();
        relayData = data.map(row => mapRowToObject(row, COLS_RELAY, IMAGE_FIELDS_RELAY));
    }
    allData.relay = relayData;

    // Guardar los datos en caché por 1 hora (3600 segundos)
    cache.put(cacheKey, JSON.stringify(allData), 3600);

    return { status: 'success', data: allData, source: 'spreadsheet' };
}

function handleGetDropdownData() {
    try {
        const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
        if (!sheet) {
            throw new Error(`Sheet "${SHEET_NAMES.CORTES}" not found.`);
        }

        // Obtener la regla de validación de la columna "Categoría"
        const categoriaRule = sheet.getRange(2, COLS_CORTES.categoria).getDataValidation();
        const categorias = categoriaRule ? categoriaRule.getCriteriaValues()[0].flat().filter(String).sort() : [];

        const data = sheet.getDataRange().getValues();
        data.shift(); // Remove headers

        // Helper function to get unique, sorted values from a column index
        const getUniqueSortedValues = (colIndex) => {
            const values = new Set();
            data.forEach(row => {
                if (row[colIndex] && row[colIndex].toString().trim()) {
                    values.add(row[colIndex].toString().trim());
                }
            });
            return Array.from(values).sort((a, b) => a.localeCompare(b));
        };

        const marcas = getUniqueSortedValues(COLS_CORTES.marca - 1);
        const tiposCorte = getUniqueSortedValues(COLS_CORTES.tipoCorte1 -1);
        const tiposEncendido = getUniqueSortedValues(COLS_CORTES.tipoEncendido - 1);
        const configRelay = getUniqueSortedValues(COLS_CORTES.configRelay1 -1);


        const dropdownData = {
            categoria: categorias,
            marca: marcas,
            tipoDeCorte: tiposCorte,
            tipoDeEncendido: tiposEncendido,
            configRelay: configRelay
        };

        return { status: 'success', dropdowns: dropdownData };

    } catch (error) {
        return {
            status: 'error',
            message: 'Failed to get dropdown data.',
            details: { errorMessage: error.message }
        };
    }
}

function handleCheckVehicle(payload) {
    const { marca, modelo, anoDesde, tipoEncendido } = payload;
    if (!marca || !modelo || !anoDesde || !tipoEncendido) {
        throw new Error("Parámetros de búsqueda incompletos.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    if (!sheet) {
        return { status: 'success', matches: [] }; // Si no hay hoja, no hay coincidencias
    }
    const data = sheet.getDataRange().getValues();
    data.shift(); // Quitar encabezados

    const paramMarca = marca.trim().toLowerCase();
    const paramModelo = modelo.trim().toLowerCase();
    const paramAnio = parseInt(anoDesde.trim(), 10);
    const paramTipoEncendido = tipoEncendido.trim().toLowerCase();

    const matches = [];

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue; // Omitir filas vacías

        const sheetMarca = (row[COLS_CORTES.marca - 1] || "").toString().trim().toLowerCase();
        const sheetModelo = (row[COLS_CORTES.modelo - 1] || "").toString().trim().toLowerCase();
        const sheetVersiones = (row[COLS_CORTES.versionesAplicables - 1] || "").toString().toLowerCase();
        const sheetTipoEncendido = (row[COLS_CORTES.tipoEncendido - 1] || "").toString().trim().toLowerCase();
        const sheetAnoDesde = row[COLS_CORTES.anoDesde - 1];
        const sheetAnoHasta = row[COLS_CORTES.anoHasta - 1];

        // Búsqueda flexible para marca y modelo
        const marcaMatch = sheetMarca.includes(paramMarca) || paramMarca.includes(sheetMarca);
        const modeloMatch = sheetModelo.includes(paramModelo) || paramModelo.includes(sheetModelo) || sheetVersiones.includes(paramModelo);

        // Búsqueda exacta para año y tipo de encendido
        const anioMatch = isYearInRangeV2(paramAnio, sheetAnoDesde, sheetAnoHasta);
        const tipoEncendidoMatch = sheetTipoEncendido === paramTipoEncendido;

        if (marcaMatch && modeloMatch && anioMatch && tipoEncendidoMatch) {
            const matchData = mapRowToObject(row, COLS_CORTES, IMAGE_FIELDS_CORTES);
            matches.push(matchData);
        }
    }

    return { status: 'success', matches: matches };
}

// ============================================================================
// MANEJADOR DE SUGERENCIAS (PARA "QUIZÁS QUISISTE DECIR...")
// ============================================================================
function handleGetSuggestion(payload) {
    const { term, field } = payload;
    if (!term || !field) {
        throw new Error("El término y el campo son requeridos para obtener una sugerencia.");
    }

    let columnIndex;
    if (field.toLowerCase() === 'marca') {
        columnIndex = COLS_CORTES.marca - 1;
    } else if (field.toLowerCase() === 'modelo') {
        columnIndex = COLS_CORTES.modelo - 1;
    } else {
        throw new Error(`El campo '${field}' no es válido para sugerencias.`);
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    if (!sheet) return { status: 'success', suggestion: null };

    const data = sheet.getDataRange().getValues();
    data.shift();

    const uniqueValues = Array.from(new Set(data.map(row => row[columnIndex]).filter(String)));

    let bestMatch = null;
    let minDistance = Infinity;
    const searchTerm = term.toLowerCase();

    for (const value of uniqueValues) {
        const valueLower = value.toLowerCase();
        if (valueLower === searchTerm) {
            // Es una coincidencia exacta, no se necesita sugerencia.
            return { status: 'success', suggestion: null };
        }

        const distance = levenshteinDistance(searchTerm, valueLower);

        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = value;
        }
    }

    // Umbral: solo sugerir si la distancia es razonablemente pequeña (ej. <= 3)
    // y el término no es un substring de la sugerencia (ej. "Chev" y "Chevrolet")
    if (minDistance <= 3 && bestMatch.toLowerCase().indexOf(searchTerm) === -1) {
        return { status: 'success', suggestion: bestMatch };
    }

    return { status: 'success', suggestion: null };
}


// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Normaliza y valida un valor que se espera sea un ID de imagen de Google Drive.
 * Puede manejar un fileId limpio o una URL completa, extrayendo el ID.
 * Devuelve null si el valor es inválido.
 * @param {string} value - El valor de la celda de la hoja de cálculo.
 * @returns {string|null} - El fileId limpio o null.
 */
function normalizeAndValidateImageId(value) {
    if (!value || typeof value !== 'string' || value.trim() === '') {
        return null;
    }

    const trimmedValue = value.trim();

    // Expresión regular para extraer el ID de varias URLs de Google Drive.
    const idMatch = trimmedValue.match(/file\/d\/([a-zA-Z0-9_-]+)|id=([a-zA-Z0-9_-]+)|\/d\/([a-zA-Z0-9_-]+)/);

    if (idMatch) {
        // Si es una URL, se extrae el ID. El ID válido es el primer grupo de captura no nulo.
        const fileId = idMatch[1] || idMatch[2] || idMatch[3];
        // Una validación simple para un fileId (longitud razonable, sin caracteres extraños).
        if (fileId && fileId.length > 20) {
            return fileId;
        }
    } else if (trimmedValue.length > 20 && !trimmedValue.includes('/') && !trimmedValue.includes(':')) {
        // Si no es una URL pero tiene la longitud de un ID y no contiene caracteres de URL,
        // se asume que ya es un fileId limpio.
        return trimmedValue;
    }

    // Si no coincide con ninguno de los formatos esperados, se considera inválido.
    // Opcional: Registrar el valor inválido para depuración.
    // console.log(`ID de imagen inválido o no normalizable detectado: ${value}`);
    return null;
}

function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) {
        matrix[0][i] = i;
    }
    for (let j = 0; j <= b.length; j++) {
        matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,          // deletion
                matrix[j - 1][i] + 1,          // insertion
                matrix[j - 1][i - 1] + cost    // substitution
            );
        }
    }

    return matrix[b.length][a.length];
}


function isYearInRangeV2(inputYear, anoDesde, anoHasta) {
    if (isNaN(inputYear)) return false;
    const desde = anoDesde ? parseInt(anoDesde, 10) : inputYear;
    const hasta = anoHasta ? parseInt(anoHasta, 10) : desde; // Si no hay 'hasta', el rango es solo un año.
    return inputYear >= desde && inputYear <= hasta;
}
