// ============================================================================
// GPSPEDIA-FEEDBACK SERVICE (COMPATIBLE WITH DB V2.0)
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
    FEEDBACKS: "Feedbacks",
    CONTACTANOS: "Contactanos",
    ACTIVIDAD_USUARIO: "ActividadUsuario",
    SUGERENCIAS_ANO: "SugerenciasAño"
};

// Mapa de columnas para la hoja "Cortes" (v2.0)
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

// Mapa de columnas para la hoja "Feedbacks" (v2.0)
const COLS_FEEDBACKS = {
    ID: 1,
    Usuario: 2,
    ID_vehiculo: 3,
    Problema: 4,
    Respuesta: 5,
    "Se resolvio": 6,
    Responde: 7,
    "Reporte de util": 8
};

const COLS_CONTACTANOS = {
    Contacto_ID: 1,
    User_ID: 2,
    Asunto: 3,
    Mensaje: 4,
    Respuesta_mensaje: 5,
    ID_usuario_responde: 6
};

const COLS_ACTIVIDAD_USUARIO = {
    id: 1,
    timestamp: 2,
    idUsuario: 3,
    nombreUsuario: 4,
    tipoActividad: 5,
    idElementoAsociado: 6,
    detalle: 7
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) {
    if (e.parameter.debug === 'true') {
        const serviceState = {
            service: 'GPSpedia-Feedback',
            version: '1.2.1',
            spreadsheetId: SPREADSHEET_ID,
            sheetsAccessed: [SHEET_NAMES.CORTES, SHEET_NAMES.FEEDBACKS]
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Feedback-SERVICE v1.2.1 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    let response;
    try {
        const request = JSON.parse(e.postData.contents);
        const action = request.action;
        const payload = request.payload || {};

        switch (action) {
            case 'recordLike':
                response = handleRecordLike(payload);
                break;
            case 'reportProblem':
                response = handleReportProblem(payload);
                break;
            case 'assignCollaborator':
                response = handleAssignCollaborator(payload);
                break;
            case 'suggestYear':
                response = handleSuggestYear(payload);
                break;
            case 'sendContactForm':
                response = handleSendContactForm(payload);
                break;
            // --- INBOX ACTIONS ---
            case 'getFeedbackItems':
                response = handleGetFeedbackItems(payload);
                break;
            case 'replyToFeedback':
                response = handleReplyToFeedback(payload);
                break;
            case 'markAsResolved':
                response = handleMarkAsResolved(payload);
                break;
            default:
                throw new Error(`Acción desconocida en Feedback Service: ${action}`);
        }
        // CRITICAL FIX: Ensure all responses are TEXT to avoid CORS issues.
        return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.TEXT);
    } catch (error) {
        response = { status: 'error', message: error.message };
        // CRITICAL FIX: Ensure error responses are also TEXT.
        return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.TEXT);
    }
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================

function handleRecordLike(payload) {
    const { vehicleId, corteIndex, userId, userName } = payload;
    if (!vehicleId || !corteIndex || !userId || !userName) {
        throw new Error("Faltan datos para registrar el 'like' (vehicleId, corteIndex, userId, userName).");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    // Fetch all IDs from the 'id' column to find the row index
    const ids = sheet.getRange(2, COLS_CORTES.id, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == vehicleId);

    if (rowIndex === -1) {
        throw new Error("No se encontró el vehículo con el ID proporcionado.");
    }

    // rowIndex is 0-based, but sheet rows are 1-based and we have a header, so add 2
    const actualRow = rowIndex + 2;

    // Determine the correct column for the like count
    const utilColName = `utilCorte${corteIndex}`;
    const utilCol = COLS_CORTES[utilColName];

    if (!utilCol) {
        throw new Error(`Índice de corte inválido: ${corteIndex}`);
    }

    // Get the cell, read the value, increment, and write back
    const cell = sheet.getRange(actualRow, utilCol);
    let currentValue = cell.getValue();

    // Ensure the current value is a number, default to 0 if empty or not a number
    if (typeof currentValue !== 'number' || isNaN(currentValue)) {
        currentValue = 0;
    }

    cell.setValue(currentValue + 1);

    // Log this action
    logUserActivity(userId, userName, 'like', vehicleId, `Like en corte ${corteIndex}. Nuevo total: ${currentValue + 1}`);

    return { status: 'success', message: 'Like registrado correctamente.' };
}

function handleAssignCollaborator(payload) {
    const { vehicleId, corteIndex, userName } = payload;
    if (!vehicleId || !corteIndex || !userName) {
        throw new Error("Faltan datos para asignar colaborador.");
    }
    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();

    for (let i = 0; i < data.length; i++) {
        if (data[i][0] == vehicleId) {
            const rowIndex = i + 2;
            const colName = `colaboradorCorte${corteIndex}`;
            const col = COLS_CORTES[colName];
            if (!col) throw new Error("Índice de corte inválido.");

            sheet.getRange(rowIndex, col).setValue(userName);
            return { status: 'success', message: 'Colaborador asignado.' };
        }
    }
    throw new Error("Vehículo no encontrado.");
}

function handleSuggestYear(payload) {
    const { vehicleId, newYear, userId, userName } = payload;
    if (!vehicleId || !newYear || !userId || !userName) {
        throw new Error("Faltan datos para sugerir año (vehicleId, newYear, userId, userName).");
    }

    const year = parseInt(newYear, 10);
    if (isNaN(year) || year < 1980 || year > 2099) {
        throw new Error("El año proporcionado no es un número válido.");
    }

    const sugerenciasSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.SUGERENCIAS_ANO);
    if (!sugerenciasSheet) {
        // Attempt to create the sheet if it doesn't exist
        getSpreadsheet().insertSheet(SHEET_NAMES.SUGERENCIAS_ANO);
        sugerenciasSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.SUGERENCIAS_ANO);
        sugerenciasSheet.appendRow(['Timestamp', 'VehicleID', 'UserID', 'UserName', 'SuggestedYear']);
    }

    // 1. Registrar la sugerencia
    sugerenciasSheet.appendRow([new Date(), vehicleId, userId, userName, year]);
    logUserActivity(userId, userName, 'suggest_year', vehicleId, `Año sugerido: ${year}`);

    // 2. Contar votos ÚNICOS para esta combinación
    const allSuggestions = sugerenciasSheet.getDataRange().getValues().slice(1);
    const relevantSuggestions = allSuggestions.filter(row => row[1] == vehicleId && row[4] == year);
    const uniqueUserIds = new Set(relevantSuggestions.map(row => row[2]));
    const voteCount = uniqueUserIds.size;

    // 3. Si no se alcanzan los 3 votos, terminar
    if (voteCount < 3) {
        return { status: 'success', message: `Sugerencia para el año ${year} registrada. Se necesitan ${3 - voteCount} votos de usuarios diferentes para aplicar el cambio.` };
    }

    // 4. Si se alcanzan los 3 votos, proceder con la lógica de actualización
    const cortesSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const allCortesData = cortesSheet.getDataRange().getValues();
    allCortesData.shift(); // remove headers
    const vehicleRowIndex = allCortesData.findIndex(row => row[COLS_CORTES.id - 1] == vehicleId);

    if (vehicleRowIndex === -1) throw new Error("Vehículo no encontrado para actualizar.");

    const vehicleRow = allCortesData[vehicleRowIndex];
    const anoDesde = parseInt(vehicleRow[COLS_CORTES.anoDesde - 1], 10);
    const anoHasta = parseInt(vehicleRow[COLS_CORTES.anoHasta - 1] || anoDesde, 10);

    // Si el año ya está en el rango, no hacer nada
    if (year >= anoDesde && year <= anoHasta) {
        return { status: 'info', message: `El año ${year} ya está dentro del rango actual.` };
    }

    // 5. Lógica Anti-colisión
    const marca = vehicleRow[COLS_CORTES.marca - 1];
    const modelo = vehicleRow[COLS_CORTES.modelo - 1];
    const tipoEncendido = vehicleRow[COLS_CORTES.tipoEncendido - 1];

    for (const row of allCortesData) {
        if (row[COLS_CORTES.id - 1] == vehicleId) continue; // No comparar consigo mismo

        const otherMarca = row[COLS_CORTES.marca - 1];
        const otherModelo = row[COLS_CORTES.modelo - 1];
        const otherTipoEncendido = row[COLS_CORTES.tipoEncendido - 1];

        if (otherMarca === marca && otherModelo === modelo && otherTipoEncendido === tipoEncendido) {
            const otherAnoDesde = parseInt(row[COLS_CORTES.anoDesde - 1], 10);
            const otherAnoHasta = parseInt(row[COLS_CORTES.anoHasta - 1] || otherAnoDesde, 10);
            if (year >= otherAnoDesde && year <= otherAnoHasta) {
                logUserActivity(userId, userName, 'suggest_year_collision', vehicleId, `Año ${year} colisiona con rango de vehículo ID ${row[COLS_CORTES.id - 1]}`);
                return { status: 'warning', message: `La sugerencia para el año ${year} no se puede aplicar porque parece corresponder a una generación diferente del mismo modelo. Se requiere revisión manual.` };
            }
        }
    }

    // 6. Actualizar el rango
    let newAnoDesde = anoDesde;
    let newAnoHasta = anoHasta;
    let updated = false;

    if (year < anoDesde) {
        newAnoDesde = year;
        updated = true;
    }
    if (year > anoHasta) {
        newAnoHasta = year;
        updated = true;
    }

    if (updated) {
        cortesSheet.getRange(vehicleRowIndex + 2, COLS_CORTES.anoDesde).setValue(newAnoDesde);
        cortesSheet.getRange(vehicleRowIndex + 2, COLS_CORTES.anoHasta).setValue(newAnoHasta);
        logUserActivity(userId, userName, 'apply_year_suggestion', vehicleId, `Rango actualizado a ${newAnoDesde}-${newAnoHasta} basado en 3 votos únicos para el año ${year}.`);
        return { status: 'success', message: `¡Gracias! Con 3 votos confirmados, el rango de años se ha actualizado a ${newAnoDesde}-${newAnoHasta}.` };
    }

    return { status: 'info', message: 'No se realizaron cambios.' };
}

function logUserActivity(userId, userName, activityType, associatedId, details) {
    try {
        const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.ACTIVIDAD_USUARIO);
        const newRow = [];
        newRow[COLS_ACTIVIDAD_USUARIO.id - 1] = ''; // Autogen ID
        newRow[COLS_ACTIVIDAD_USUARIO.timestamp - 1] = new Date().toISOString();
        newRow[COLS_ACTIVIDAD_USUARIO.idUsuario - 1] = userId;
        newRow[COLS_ACTIVIDAD_USUARIO.nombreUsuario - 1] = userName;
        newRow[COLS_ACTIVIDAD_USUARIO.tipoActividad - 1] = activityType;
        newRow[COLS_ACTIVIDAD_USUARIO.idElementoAsociado - 1] = associatedId;
        newRow[COLS_ACTIVIDAD_USUARIO.detalle - 1] = details;
        sheet.appendRow(newRow);
    } catch (e) {
        // Log error to main log sheet if activity logging fails
        Logger.log(`CRITICAL: Fallo al registrar actividad de usuario. Error: ${e.message}`);
    }
}

function handleRecordLike(payload) {
    const { vehicleId, corteIndex, userId, userName } = payload;
    if (!vehicleId || !corteIndex || !userId || !userName) {
        throw new Error("Faltan datos para registrar el 'like' (vehicleId, corteIndex, userId, userName).");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    // Fetch all IDs from the 'id' column to find the row index
    const ids = sheet.getRange(2, COLS_CORTES.id, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == vehicleId);

    if (rowIndex === -1) {
        throw new Error("No se encontró el vehículo con el ID proporcionado.");
    }

    // rowIndex is 0-based, but sheet rows are 1-based and we have a header, so add 2
    const actualRow = rowIndex + 2;

    // Determine the correct column for the like count
    const utilColName = `utilCorte${corteIndex}`;
    const utilCol = COLS_CORTES[utilColName];

    if (!utilCol) {
        throw new Error(`Índice de corte inválido: ${corteIndex}`);
    }

    // Get the cell, read the value, increment, and write back
    const cell = sheet.getRange(actualRow, utilCol);
    let currentValue = cell.getValue();

    // Ensure the current value is a number, default to 0 if empty or not a number
    if (typeof currentValue !== 'number' || isNaN(currentValue)) {
        currentValue = 0;
    }

    cell.setValue(currentValue + 1);

    // Log this action
    logUserActivity(userId, userName, 'like', vehicleId, `Like en corte ${corteIndex}. Nuevo total: ${currentValue + 1}`);

    return { status: 'success', message: 'Like registrado correctamente.' };
}

function handleReportProblem(payload) {
    const { vehicleId, problemText, userId, userName } = payload;
    if (!vehicleId || !problemText || !userId || !userName) {
        throw new Error("Faltan datos para reportar el problema.");
    }

    // ... (logic for adding problem to Feedbacks sheet) ...
    const feedbackSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const newRow = [];
    newRow[COLS_FEEDBACKS.ID - 1] = '';
    newRow[COLS_FEEDBACKS.Usuario - 1] = userName;
    newRow[COLS_FEEDBACKS.ID_vehiculo - 1] = vehicleId;
    newRow[COLS_FEEDBACKS.Problema - 1] = problemText;
    feedbackSheet.appendRow(newRow);


    logUserActivity(userId, userName, 'report_problem', vehicleId, problemText);
    return { status: 'success', message: 'Problema reportado.' };
}

function handleSendContactForm(payload) {
    const { name, email, message } = payload;
    if (!name || !email || !message) {
        throw new Error("Faltan datos para enviar el formulario de contacto.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CONTACTANOS);
    const newRow = [];
    newRow[COLS_CONTACTANOS.Contacto_ID - 1] = ''; // Autogen ID
    newRow[COLS_CONTACTANOS.User_ID - 1] = ''; // Asumiendo que no hay un usuario logueado.
    newRow[COLS_CONTACTANOS.Asunto - 1] = `Contacto de ${name}`;
    newRow[COLS_CONTACTANOS.Mensaje - 1] = `De: ${email}\n\n${message}`;
    sheet.appendRow(newRow);

    return { status: 'success', message: 'Formulario de contacto enviado.' };
}

// ============================================================================
// HANDLERS FOR INBOX SYSTEM
// ============================================================================

function handleGetFeedbackItems(payload) {
    const feedbackSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const contactSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CONTACTANOS);

    const feedbackData = feedbackSheet.getDataRange().getValues().slice(1).map(row => ({
        type: 'problem_report',
        id: row[COLS_FEEDBACKS.ID - 1],
        subject: `Reporte en Vehículo #${row[COLS_FEEDBACKS.ID_vehiculo - 1]}`,
        content: row[COLS_FEEDBACKS.Problema - 1],
        user: row[COLS_FEEDBACKS.Usuario - 1],
        vehicleId: row[COLS_FEEDBACKS.ID_vehiculo - 1],
        reply: row[COLS_FEEDBACKS.Respuesta - 1],
        isResolved: row[COLS_FEEDBACKS['Se resolvio'] - 1] === true,
        responder: row[COLS_FEEDBACKS.Responde - 1]
    }));

    const contactData = contactSheet.getDataRange().getValues().slice(1).map(row => ({
        type: 'contact_form',
        id: row[COLS_CONTACTANOS.Contacto_ID - 1],
        subject: row[COLS_CONTACTANOS.Asunto - 1],
        content: row[COLS_CONTACTANOS.Mensaje - 1],
        user: 'Formulario de Contacto',
        vehicleId: null,
        reply: row[COLS_CONTACTANOS.Respuesta_mensaje - 1],
        isResolved: null,
        responder: row[COLS_CONTACTANOS.ID_usuario_responde - 1]
    }));

    const unifiedData = [...feedbackData, ...contactData];
    return { status: 'success', data: unifiedData };
}

function handleReplyToFeedback(payload) {
    const { itemId, itemType, replyText, responderName } = payload;
    if (!itemId || !itemType || !replyText || !responderName) {
        throw new Error("Datos insuficientes para enviar la respuesta.");
    }

    if (itemType === 'problem_report') {
        const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
        const ids = sheet.getRange(2, COLS_FEEDBACKS.ID, sheet.getLastRow() -1, 1).getValues().flat();
        const rowIndex = ids.findIndex(id => id == itemId);
        if (rowIndex !== -1) {
            sheet.getRange(rowIndex + 2, COLS_FEEDBACKS.Respuesta).setValue(replyText);
            sheet.getRange(rowIndex + 2, COLS_FEEDBACKS.Responde).setValue(responderName);
        } else {
            throw new Error("No se encontró el reporte de problema.");
        }
    } else if (itemType === 'contact_form') {
        const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CONTACTANOS);
        const ids = sheet.getRange(2, COLS_CONTACTANOS.Contacto_ID, sheet.getLastRow() - 1, 1).getValues().flat();
        const rowIndex = ids.findIndex(id => id == itemId);
        if (rowIndex !== -1) {
            sheet.getRange(rowIndex + 2, COLS_CONTACTANOS.Respuesta_mensaje).setValue(replyText);
            sheet.getRange(rowIndex + 2, COLS_CONTACTANOS.ID_usuario_responde).setValue(responderName);
        } else {
            throw new Error("No se encontró el mensaje de contacto.");
        }
    }

    return { status: 'success', message: 'Respuesta enviada.' };
}

function handleMarkAsResolved(payload) {
    const { itemId } = payload;
    if (!itemId) throw new Error("ID del item es requerido.");

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const ids = sheet.getRange(2, COLS_FEEDBACKS.ID, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == itemId);

    if (rowIndex !== -1) {
        sheet.getRange(rowIndex + 2, COLS_FEEDBACKS['Se resolvio']).setValue(true);
    } else {
        throw new Error("No se encontró el reporte de problema para marcar como resuelto.");
    }

    return { status: 'success', message: 'Reporte marcado como resuelto.' };
}
