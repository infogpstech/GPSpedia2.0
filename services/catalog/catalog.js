// ============================================================================
// GPSPEDIA-CATALOG SERVICE | Version: 1.1.0
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

// --- MAPEO DE COLUMNAS ESTÁTICO ---
// Refactorización para eliminar el mapeo dinámico y aumentar la robustez.
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

const COLS_TUTORIALES = {
    id: 1,
    tema: 2,
    imagen: 3,
    comoIdentificarlo: 4,
    dondeEncontrarlo: 5,
    detalles: 6,
    video: 7
};

const COLS_RELAY = {
    id: 1,
    configuracion: 2,
    funcion: 3,
    vehiculoDondeSeUtiliza: 4,
    pin30Entrada: 5,
    pin85Bobina: 6,
    pin86Bobina: 7,
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
      message: 'GPSpedia CATALOG-SERVICE v1.1.0 is active.'
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
        cortes: { name: SHEET_NAMES.CORTES, cols: COLS_CORTES },
        tutoriales: { name: SHEET_NAMES.TUTORIALES, cols: COLS_TUTORIALES },
        relay: { name: SHEET_NAMES.RELAY, cols: COLS_RELAY }
    };
    const allData = {};
    const colMaps = {
        cortes: Object.keys(COLS_CORTES),
        tutoriales: Object.keys(COLS_TUTORIALES),
        relay: Object.keys(COLS_RELAY)
    };

    for (const key in sheetsToFetch) {
        try {
            const sheet = getSpreadsheet().getSheetByName(sheetsToFetch[key].name);
            if (sheet) {
                const data = sheet.getDataRange().getValues();
                data.shift(); // Remove headers
                const headers = colMaps[key];
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
            Logger.log(`Error cargando la hoja ${sheetsToFetch[key].name}: ${e.message}`);
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
    data.shift();

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
            const existingRowData = {};
            for (const key in COLS_CORTES) {
                existingRowData[key] = row[COLS_CORTES[key] - 1];
            }
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
