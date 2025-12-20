// ============================================================================
// GPSPEDIA-FEEDBACK SERVICE
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
    FEEDBACKS: "Feedbacks"
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
  try {
    const response = {
      status: 'success',
      message: 'GPSpedia FEEDBACK-SERVICE v1.0 is active.'
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
            case 'recordLike':
                response = handleRecordLike(request.payload);
                break;
            case 'reportProblem':
                response = handleReportProblem(request.payload);
                break;
            default:
                throw new Error(`Acción desconocida en Feedback Service: ${request.action}`);
        }
    } catch (error) {
        Logger.log(`Error CRÍTICO en Feedback-Service doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error inesperado en el servicio de feedback.',
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

function handleRecordLike(payload) {
    const { vehicleId, userName } = payload;
    if (!vehicleId || !userName) throw new Error("Falta el ID del vehículo o el nombre de usuario.");

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const COLS = getColumnMap(SHEET_NAMES.CORTES);

    // Optimización: Solo obtener las columnas necesarias (ID y Util)
    const range = sheet.getRange(2, COLS.id, sheet.getLastRow() - 1, COLS.util - COLS.id + 1);
    const data = range.getValues();

    for (let i = 0; i < data.length; i++) {
        // El ID del vehículo está en la primera columna del rango (índice 0)
        if (data[i][0] == vehicleId) {
            const rowIndex = i + 2; // +2 para ajustar al índice de la hoja (1-based + cabecera)
            const utilCellIndex = COLS.util - COLS.id; // Índice de la columna 'Util' dentro del rango

            const utilCell = sheet.getRange(rowIndex, COLS.util);
            const currentLikes = utilCell.getValue().toString().trim();
            const usersWhoLiked = currentLikes ? currentLikes.split(',').map(u => u.trim()) : [];

            if (!usersWhoLiked.includes(userName)) {
                usersWhoLiked.push(userName);
                utilCell.setValue(usersWhoLiked.join(', '));
                return { status: 'success', message: 'Like registrado.' };
            } else {
                return { status: 'success', message: 'El usuario ya ha dado like.' };
            }
        }
    }
    throw new Error("No se encontró el vehículo con el ID proporcionado.");
}


function handleReportProblem(payload) {
    const { vehicleId, userName, problemText } = payload;
    if (!vehicleId || !userName || !problemText) {
        throw new Error("Faltan datos para registrar el problema.");
    }

    const feedbackSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    if (!feedbackSheet) throw new Error(`La hoja "${SHEET_NAMES.FEEDBACKS}" no existe.`);

    feedbackSheet.appendRow(['', userName, vehicleId, problemText, '', '', '']);

    return { status: 'success', message: 'Problema reportado exitosamente.' };
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
