// ============================================================================
// GPSPEDIA-FEEDBACK SERVICE (REFACTORED WITH FIXED COLUMN MAP)
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
    FEEDBACKS: "Feedbacks"
};

// Mapa de columnas fijo para la hoja "Cortes", consistente con otros servicios.
const COLS_CORTES = {
    id: 1,
    categoria: 2,
    marca: 3,
    modelo: 4,
    anoGeneracion: 5,
    tipoDeEncendido: 6,
    colaborador: 7,
    util: 8,
    // ...el resto de las columnas no son necesarias para este servicio.
};

// Mapa de columnas para la hoja "Feedbacks" para asegurar una escritura robusta.
const COLS_FEEDBACKS = {
    id: 1,
    usuario: 2,
    idVehiculo: 3,
    problema: 4,
    respuesta: 5,
    seResolvio: 6,
    responde: 7
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
  try {
    const response = {
      status: 'success',
      message: 'GPSpedia FEEDBACK-SERVICE v1.1 is active.' // Version updated
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

    // Optimización: Solo obtener las columnas necesarias (ID y Util)
    // Se usa el mapa de columnas fijo COLS_CORTES.
    const range = sheet.getRange(2, COLS_CORTES.id, sheet.getLastRow() - 1, COLS_CORTES.util);
    const data = range.getValues();

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        // El ID está en la primera columna del rango (índice 0).
        if (row[COLS_CORTES.id - 1] == vehicleId) {
            const rowIndex = i + 2; // +2 para ajustar al índice de la hoja (1-based + cabecera)

            const utilCell = sheet.getRange(rowIndex, COLS_CORTES.util);
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

    // Construir la fila de forma robusta usando el mapa de columnas.
    const newRow = [];
    newRow[COLS_FEEDBACKS.id - 1] = ''; // ID es autogenerado o se deja vacío
    newRow[COLS_FEEDBACKS.usuario - 1] = userName;
    newRow[COLS_FEEDBACKS.idVehiculo - 1] = vehicleId;
    newRow[COLS_FEEDBACKS.problema - 1] = problemText;
    newRow[COLS_FEEDBACKS.respuesta - 1] = '';
    newRow[COLS_FEEDBACKS.seResolvio - 1] = '';
    newRow[COLS_FEEDBACKS.responde - 1] = '';

    feedbackSheet.appendRow(newRow);

    return { status: 'success', message: 'Problema reportado exitosamente.' };
}
