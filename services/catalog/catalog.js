// ============================================================================
// GPSPEDIA-CATALOG SERVICE
// ============================================================================

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo";
let spreadsheet = null;

// Función para obtener la instancia del Spreadsheet, optimizada para no abrirlo múltiples veces.
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

// ============================================================================
// MAPEO DE COLUMNAS FIJO (HARDCODED)
// ============================================================================
// Mapeo para la hoja "Cortes". Basado en la estructura final proporcionada por el usuario.
const COLS_CORTES = {
    id: 0,
    categoria: 1,
    imagenDelVehiculo: 2,
    marca: 3,
    modelo: 4,
    tipoDeEncendido: 5,
    anoGeneracion: 6,
    tipoDeCorte: 7,
    descripcionDelCorte: 8,
    imagenDelCorte: 9,
    descripcionDelSegundoCorte: 10,
    tipoDeCorte2: 11,
    imagenDeCorte2: 12,
    apertura: 13,
    imagenDeLaApertura: 14,
    notaImportante: 15,
    cablesDeAlimentacion: 16,
    imagenDeLosCablesDeAlimentacion: 17,
    comoDesarmarLosPlasticos: 18,
    colaborador: 19,
    tipoDeCorte3: 20,
    descripcionDelCorte3: 21,
    imagenDelCorte3: 22,
    util: 23
};
const HEADERS_CORTES = Object.keys(COLS_CORTES);

// Mapeo para la hoja "Tutorial".
const COLS_TUTORIALES = {
    id: 0,
    tema: 1,
    imagen: 2,
    comoIdentificarlo: 3,
    dondeEncontrarlo: 4,
    detalles: 5,
    video: 6
};
const HEADERS_TUTORIALES = Object.keys(COLS_TUTORIALES);

// Mapeo para la hoja "Configuración del Relay".
const COLS_RELAY = {
    id: 0,
    configuracion: 1,
    funcion: 2,
    vehiculoDondeSeUtiliza: 3,
    pin30Entrada: 4,
    pin85BobinaPositivo: 5,
    pin86BobinaNegativo: 6,
    pin87aComunCerrado: 7,
    pin87ComunmenteAbierto: 8,
    imagen: 9,
    observacion: 10
};
const HEADERS_RELAY = Object.keys(COLS_RELAY);


// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
  try {
    const response = {
      status: 'success',
      message: 'GPSpedia CATALOG-SERVICE v1.1 is active.' // Versión actualizada para reflejar el cambio.
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
    const sheetConfig = {
        cortes: { name: SHEET_NAMES.CORTES, headers: HEADERS_CORTES, columnMap: COLS_CORTES },
        tutoriales: { name: SHEET_NAMES.TUTORIALES, headers: HEADERS_TUTORIALES, columnMap: COLS_TUTORIALES },
        relay: { name: SHEET_NAMES.RELAY, headers: HEADERS_RELAY, columnMap: COLS_RELAY }
    };
    const allData = {};

    for (const key in sheetConfig) {
        try {
            const config = sheetConfig[key];
            const sheet = getSpreadsheet().getSheetByName(config.name);
            if (sheet) {
                const data = sheet.getDataRange().getValues();
                data.shift(); // Eliminar la fila de encabezados del spreadsheet

                const mappedData = data.map(row => {
                    const obj = {};
                    config.headers.forEach(header => {
                        const colIndex = config.columnMap[header];
                        obj[header] = row[colIndex];
                    });
                    return obj;
                });

                // Se invierte el array para las secciones "tutoriales" y "relay" para mostrar los más nuevos primero.
                if (key === 'tutoriales' || key === 'relay') {
                    mappedData.reverse();
                }
                allData[key] = mappedData;

            } else {
                allData[key] = [];
            }
        } catch (e) {
            Logger.log(`Error cargando la hoja ${sheetConfig[key].name}: ${e.message}`);
            allData[key] = [];
        }
    }
    return { status: 'success', data: allData };
}

function handleGetDropdownData() {
    const cortesSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    if (!cortesSheet) throw new Error(`La hoja "${SHEET_NAMES.CORTES}" no fue encontrada.`);

    // getValues requiere un índice de columna 1-based. Se usan valores fijos.
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
            // Se utilizan los índices de columna (1-based) fijos correspondientes a la estructura de la hoja.
            categoria: getValues(COLS_CORTES.categoria + 1), // Col B
            tipoDeEncendido: getValues(COLS_CORTES.tipoDeEncendido + 1), // Col F
            tipoDeCorte: getValues(COLS_CORTES.tipoDeCorte + 1) // Col J
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
        // Acceso a datos usando el mapa de columnas fijo COLS_CORTES (0-based)
        const sheetMarca = (row[COLS_CORTES.marca] || "").toString().trim().toLowerCase();
        const sheetModelo = (row[COLS_CORTES.modelo] || "").toString().trim().toLowerCase();
        const sheetAnioRaw = (row[COLS_CORTES.anoGeneracion] || "").toString();
        const sheetTipoEncendido = (row[COLS_CORTES.tipoDeEncendido] || "").toString().trim().toLowerCase();

        if (sheetMarca === paramMarca && sheetModelo === paramModelo && isYearInRange(paramAnio, sheetAnioRaw) && sheetTipoEncendido === paramTipoEncendido) {
            const existingRowData = HEADERS_CORTES.reduce((obj, header) => {
                const colIndex = COLS_CORTES[header];
                obj[header] = row[colIndex];
                return obj;
            }, {});
            return { status: 'success', exists: true, data: existingRowData, rowIndex: i + 2 }; // i + 2 para obtener el número de fila correcto en la hoja
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
