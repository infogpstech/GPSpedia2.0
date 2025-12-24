// ============================================================================
// GPSPEDIA-CATALOG SERVICE (REFACTORED WITH FIXED COLUMN MAP)
// ============================================================================
// COMPONENT VERSION: 1.1.0

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
    TUTORIALES: "Tutoriales",
    RELAY: "Relay"
};

// Mapa de columnas fijo para la hoja "Cortes" (v1.5)
const COLS_CORTES = {
    id: 1,
    categoria: 2,
    marca: 3,
    modelo: 4,
    anoGeneracion: 5,
    tipoDeEncendido: 6,
    colaborador: 7,
    util: 8,
    tipoDeCorte: 9,
    descripcionDelCorte: 10,
    imagenDelCorte: 11,
    tipoDeCorte2: 12,
    descripcionDelSegundoCorte: 13,
    imagenDeCorte2: 14,
    tipoDeCorte3: 15,
    descripcionDelCorte3: 16,
    imagenDelCorte3: 17,
    apertura: 18,
    imagenDeLaApertura: 19,
    cablesDeAlimentacion: 20,
    imagenDeLosCablesDeAlimentacion: 21,
    comoDesarmarLosPlasticos: 22,
    notaImportante: 23,
    timestamp: 24
};

// Mapa de columnas fijo para la hoja "Tutoriales"
const COLS_TUTORIALES = {
    id: 1,
    tema: 2,
    imagen: 3,
    comoIdentificarlo: 4,
    dondeEncontrarlo: 5,
    detalles: 6,
    video: 7
};

// Mapa de columnas fijo para la hoja "Relay"
const COLS_RELAY = {
    id: 1,
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
  try {
    const response = {
      status: 'success',
      message: 'GPSpedia CATALOG-SERVICE v1.1 is active.' // Version updated
    };
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorResponse = {
        status: 'error',
        message: 'Error en el servidor (doGet).',
        details: { message: error.message }
    };
    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
    let response;
    let request;
    try {
        request = JSON.parse(e.postData.contents);

        switch (request.action) {
            case 'getCatalogData':
                response = handleGetCatalogData();
                break;
            case 'getDropdownData':
                 response = handleGetDropdownData();
                 break;
            case 'checkVehicle':
                 response = handleCheckVehicle(request.payload);
                 break;
            default:
                throw new Error(`Acción desconocida en Catalog Service: ${request.action}`);
        }
    } catch (error) {
        Logger.log(`Error CRÍTICO en Catalog-Service doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error inesperado en el servicio de catálogo.',
            details: {
                errorMessage: error.message,
                errorStack: error.stack,
                requestAction: (request && request.action) ? request.action : 'N/A'
            }
        };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================

/**
 * Convierte una fila de datos (array) en un objeto usando un mapa de columnas.
 * @param {Array} row - La fila de datos de la hoja de cálculo.
 * @param {Object} colMap - El mapa de columnas (ej. COLS_CORTES).
 * @returns {Object} El objeto resultante.
 */
function mapRowToObject(row, colMap) {
    const obj = {};
    for (const key in colMap) {
        // El índice en el array es la posición de la columna - 1
        obj[key] = row[colMap[key] - 1];
    }
    return obj;
}

function handleGetCatalogData() {
    const allData = {};

    // Mapeo de claves de respuesta a hojas y mapas de columnas
    const sheetsToFetch = {
        cortes: { name: SHEET_NAMES.CORTES, map: COLS_CORTES },
        tutoriales: { name: SHEET_NAMES.TUTORIALES, map: COLS_TUTORIALES },
        relay: { name: SHEET_NAMES.RELAY, map: COLS_RELAY }
    };

    for (const key in sheetsToFetch) {
        try {
            const sheetInfo = sheetsToFetch[key];
            const sheet = getSpreadsheet().getSheetByName(sheetInfo.name);
            if (sheet) {
                const data = sheet.getDataRange().getValues();
                data.shift(); // Eliminar la fila de encabezado
                allData[key] = data.map(row => mapRowToObject(row, sheetInfo.map));
            } else {
                allData[key] = [];
            }
        } catch (e) {
            Logger.log(`Error cargando la hoja ${sheetsToFetch[key].name}: ${e.message}`);
            allData[key] = [];
        }
    }
    return { status: 'success', data: allData };
}

function handleGetDropdownData() {
    const cortesSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    if (!cortesSheet) throw new Error(`La hoja "${SHEET_NAMES.CORTES}" no fue encontrada.`);

    // Obtiene valores de validación de una columna específica
    const getValues = (colPosition) => {
        const rule = cortesSheet.getRange(2, colPosition).getDataValidation();
        if (rule && rule.getCriteriaType() == SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
            return rule.getCriteriaValues()[0];
        }
        return [];
    };

    // Usar las posiciones de columna fijas de COLS_CORTES
    return {
        status: 'success',
        dropdowns: {
            categoria: getValues(COLS_CORTES.categoria),
            tipoDeEncendido: getValues(COLS_CORTES.tipoDeEncendido),
            tipoDeCorte: getValues(COLS_CORTES.tipoDeCorte)
        }
    };
}

function handleCheckVehicle(payload) {
    const { marca, modelo, anio, tipoEncendido } = payload;
    if (!marca || !modelo || !anio || !tipoEncendido) {
        throw new Error("Parámetros de búsqueda incompletos.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getDataRange().getValues();
    data.shift(); // Eliminar encabezados

    const paramMarca = marca.trim().toLowerCase();
    const paramModelo = modelo.trim().toLowerCase();
    const paramAnio = anio.trim();
    const paramTipoEncendido = tipoEncendido.trim().toLowerCase();

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const sheetMarca = (row[COLS_CORTES.marca - 1] || "").toString().trim().toLowerCase();
        const sheetModelo = (row[COLS_CORTES.modelo - 1] || "").toString().trim().toLowerCase();
        const sheetAnioRaw = (row[COLS_CORTES.anoGeneracion - 1] || "").toString();
        const sheetTipoEncendido = (row[COLS_CORTES.tipoDeEncendido - 1] || "").toString().trim().toLowerCase();

        if (sheetMarca === paramMarca && sheetModelo === paramModelo && isYearInRange(paramAnio, sheetAnioRaw) && sheetTipoEncendido === paramTipoEncendido) {
            const existingRowData = mapRowToObject(row, COLS_CORTES);
            return { status: 'success', exists: true, data: existingRowData, rowIndex: i + 2 };
        }
    }
    return { status: 'success', exists: false };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function isYearInRange(inputYear, sheetYearValue) {
    const year = parseInt(inputYear.trim(), 10);
    if (isNaN(year)) return false;
    const cleanedSheetYear = sheetYearValue.toString().trim();
    if (cleanedSheetYear.includes('-')) {
        const parts = cleanedSheetYear.split('-').map(p => parseInt(p.trim(), 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return year >= parts[0] && year <= parts[1];
        }
    }
    return year === parseInt(cleanedSheetYear, 10);
}
