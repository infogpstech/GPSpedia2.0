// ============================================================================
// GPSPEDIA-CATALOG SERVICE
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
    TUTORIALES: "Tutoriales",
    RELAY: "Relay"
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
  try {
    const response = {
      status: 'success',
      message: 'GPSpedia CATALOG-SERVICE v1.0 is active.'
    };
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // Manejo de errores simplificado para doGet
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

function handleGetCatalogData() {
    const sheetsToFetch = {
        cortes: SHEET_NAMES.CORTES,
        tutoriales: SHEET_NAMES.TUTORIALES,
        relay: SHEET_NAMES.RELAY
    };
    const allData = {};

    for (const key in sheetsToFetch) {
        try {
            const sheet = getSpreadsheet().getSheetByName(sheetsToFetch[key]);
            if (sheet) {
                const data = sheet.getDataRange().getValues();
                const headers = data.shift().map(header => camelCase(header.trim()));
                allData[key] = data.map(row => {
                    const obj = {};
                    headers.forEach((header, i) => {
                        obj[header] = row[i];
                    });
                    return obj;
                });
            } else {
                allData[key] = [];
            }
        } catch (e) {
            Logger.log(`Error cargando la hoja ${sheetsToFetch[key]}: ${e.message}`);
            allData[key] = [];
        }
    }
    return { status: 'success', data: allData };
}

function handleGetDropdownData() {
    const cortesSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    if (!cortesSheet) throw new Error(`La hoja "${SHEET_NAMES.CORTES}" no fue encontrada.`);

    const getValues = (col) => {
        const rule = cortesSheet.getRange(2, col).getDataValidation();
        if (rule && rule.getCriteriaType() == SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
            return rule.getCriteriaValues()[0];
        }
        return [];
    };

    const COLS = getColumnMap(SHEET_NAMES.CORTES);
    return {
        status: 'success',
        dropdowns: {
            categoria: getValues(COLS.categoria),
            tipoDeEncendido: getValues(COLS.tipoDeEncendido),
            tipoDeCorte: getValues(COLS.tipoDeCorte)
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
    const headers = data.shift();
    const normalizedHeaders = headers.map(h => camelCase(h.trim()));
    const COLS = arrayToMap(normalizedHeaders);

    const paramMarca = marca.trim().toLowerCase();
    const paramModelo = modelo.trim().toLowerCase();
    const paramAnio = anio.trim();
    const paramTipoEncendido = tipoEncendido.trim().toLowerCase();

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const sheetMarca = (row[COLS.marca] || "").toString().trim().toLowerCase();
        const sheetModelo = (row[COLS.modelo] || "").toString().trim().toLowerCase();
        const sheetAnioRaw = (row[COLS.anoGeneracion] || "").toString();
        const sheetTipoEncendido = (row[COLS.tipoDeEncendido] || "").toString().trim().toLowerCase();

        if (sheetMarca === paramMarca && sheetModelo === paramModelo && isYearInRange(paramAnio, sheetAnioRaw) && sheetTipoEncendido === paramTipoEncendido) {
            const existingRowData = normalizedHeaders.reduce((obj, header, index) => {
                obj[header] = row[index];
                return obj;
            }, {});
            return { status: 'success', exists: true, data: existingRowData, rowIndex: i + 2 };
        }
    }
    return { status: 'success', exists: false };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

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

function getColumnMap(sheetName) {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error(`Hoja no encontrada: ${sheetName}`);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    return headers.reduce((map, header, i) => {
        map[camelCase(header)] = i + 1;
        return map;
    }, {});
}

function arrayToMap(arr) {
    return arr.reduce((obj, item, index) => {
        obj[item] = index;
        return obj;
    }, {});
}

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
