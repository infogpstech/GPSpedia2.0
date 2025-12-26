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
    ACTIVIDAD_USUARIO: "ActividadUsuario"
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
    const serviceState = {
        service: 'GPSpedia-Feedback',
        componentVersion: '2.3.0',
        spreadsheetId: SPREADSHEET_ID,
        sheets: {
            cortes: SHEET_NAMES.CORTES,
            feedbacks: SHEET_NAMES.FEEDBACKS,
            contactanos: SHEET_NAMES.CONTACTANOS,
            actividadUsuario: SHEET_NAMES.ACTIVIDAD_USUARIO
        }
    };

    if (e.parameter.debug === 'true') {
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: `${serviceState.service} v${serviceState.componentVersion} is active.`
    })).setMimeType(ContentService.MimeType.JSON);
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
            case 'getReportedProblems':
                response = handleGetReportedProblems(payload);
                break;
            case 'replyToProblem':
                response = handleReplyToProblem(payload);
                break;
            case 'markProblemAsResolved':
                response = handleMarkProblemAsResolved(payload);
                break;
            default:
                throw new Error(`Acción desconocida en Feedback Service: ${action}`);
        }
        return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        response = { status: 'error', message: error.message };
        return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================

function handleRecordLike(payload) {
    const { vehicleId, corteIndex, userName } = payload;
    if (!vehicleId || !corteIndex || !userName) {
        throw new Error("Faltan datos para registrar el 'like'.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getRange(2, COLS_CORTES.id, sheet.getLastRow() - 1, 1).getValues();

    for (let i = 0; i < data.length; i++) {
        if (data[i][0] == vehicleId) {
            const rowIndex = i + 2;
            const utilColName = `utilCorte${corteIndex}`;
            const utilCol = COLS_CORTES[utilColName];

            if (!utilCol) throw new Error("Índice de corte inválido.");

            const cell = sheet.getRange(rowIndex, utilCol);
            let currentValue = cell.getValue();
            if (typeof currentValue !== 'number') currentValue = 0;

            cell.setValue(currentValue + 1);

            return { status: 'success', message: 'Like registrado.' };
        }
    }
    throw new Error("No se encontró el vehículo con el ID proporcionado.");
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
    const { vehicleId, suggestedYear, userId, userName } = payload;
    if (!vehicleId || !suggestedYear || !userId || !userName) {
        throw new Error("Faltan datos para sugerir el año (vehicleId, suggestedYear, userId, userName).");
    }

    const year = parseInt(suggestedYear, 10);
    if (isNaN(year)) {
        throw new Error("El año proporcionado no es un número válido.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift(); // Guardar encabezados para referencia si es necesario

    // Encontrar el vehículo objetivo por su ID
    let targetRow = null;
    let targetRowIndex = -1;
    for (let i = 0; i < allData.length; i++) {
        if (allData[i][COLS_CORTES.id - 1] == vehicleId) {
            targetRow = allData[i];
            targetRowIndex = i;
            break;
        }
    }

    if (!targetRow) {
        throw new Error("Vehículo no encontrado.");
    }

    const anoDesde = parseInt(targetRow[COLS_CORTES.anoDesde - 1], 10);
    const anoHasta = parseInt(targetRow[COLS_CORTES.anoHasta - 1], 10);

    // 1. Verificar si el año ya está en el rango.
    if (year >= anoDesde && year <= anoHasta) {
        return { status: 'info', message: 'El año sugerido ya está dentro del rango existente.' };
    }

    const targetMarca = targetRow[COLS_CORTES.marca - 1];
    const targetModelo = targetRow[COLS_CORTES.modelo - 1];
    const targetTipoEncendido = targetRow[COLS_CORTES.tipoEncendido - 1];

    // 2. Lógica de Anti-colisión de Generaciones
    for (let i = 0; i < allData.length; i++) {
        // No comparar el vehículo consigo mismo.
        if (i === targetRowIndex) continue;

        const currentRow = allData[i];
        const currentMarca = currentRow[COLS_CORTES.marca - 1];
        const currentModelo = currentRow[COLS_CORTES.modelo - 1];
        const currentTipoEncendido = currentRow[COLS_CORTES.tipoEncendido - 1];

        // Verificar si es un vehículo de la misma generación/modelo
        if (currentMarca === targetMarca && currentModelo === targetModelo && currentTipoEncendido === targetTipoEncendido) {
            const currentAnoDesde = parseInt(currentRow[COLS_CORTES.anoDesde - 1], 10);
            const currentAnoHasta = parseInt(currentRow[COLS_CORTES.anoHasta - 1], 10);
            // Si el año sugerido cae dentro del rango de OTRA generación, es una colisión.
            if (year >= currentAnoDesde && year <= currentAnoHasta) {
                 throw new Error(`Conflicto de generaciones: El año ${year} ya pertenece a otro registro existente para este modelo.`);
            }
        }
    }

    // 3. Actualización del Rango
    let newAnoDesde = anoDesde;
    let newAnoHasta = anoHasta;
    let updated = false;

    if (year < anoDesde) {
        newAnoDesde = year;
        updated = true;
    } else if (year > anoHasta) {
        newAnoHasta = year;
        updated = true;
    }

    if (updated) {
        const rangeToUpdate = sheet.getRange(targetRowIndex + 2, COLS_CORTES.anoDesde, 1, 2);
        rangeToUpdate.setValues([[newAnoDesde, newAnoHasta]]);

        // Actualizar el timestamp
        sheet.getRange(targetRowIndex + 2, COLS_CORTES.timestamp).setValue(new Date().toLocaleDateString('es-ES'));

        logUserActivity(userId, userName, 'suggest_year', vehicleId, `Año sugerido: ${year}. Rango actualizado a ${newAnoDesde}-${newAnoHasta}.`);
        return { status: 'success', message: `Rango de años actualizado a ${newAnoDesde}-${newAnoHasta}.` };
    } else {
        // Este caso no debería ocurrir si la lógica inicial es correcta, pero es un buen fallback.
        return { status: 'info', message: 'No se requirió ninguna actualización.' };
    }
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
    const { userId, userName, subject, message } = payload;
    if (!userName || !subject || !message) {
        throw new Error("Faltan datos para enviar el formulario de contacto (userName, subject, message).");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CONTACTANOS);
    const newRow = [];
    newRow[COLS_CONTACTANOS.Contacto_ID - 1] = ''; // Autogen ID
    newRow[COLS_CONTACTANOS.User_ID - 1] = userId || ''; // El ID puede ser opcional si no está logueado
    newRow[COLS_CONTACTANOS.Asunto - 1] = subject;
    newRow[COLS_CONTACTANOS.Mensaje - 1] = `Enviado por: ${userName}\n\n${message}`;
    sheet.appendRow(newRow);

    // Opcional: Registrar esta acción
    if (userId) {
      logUserActivity(userId, userName, 'send_contact_form', '', `Asunto: ${subject}`);
    }

    return { status: 'success', message: 'Mensaje de contacto enviado correctamente.' };
}

// ============================================================================
// HANDLERS PARA EL INBOX DE FEEDBACK
// ============================================================================
function handleGetReportedProblems(payload) {
    const { userRole } = payload;
    if (userRole !== 'Supervisor' && userRole !== 'Jefe' && userRole !== 'Desarrollador') {
        throw new Error("Acceso no autorizado. Se requiere rol de Supervisor o superior.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const problems = data.map(row => {
        let obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i];
        });
        return obj;
    }).filter(p => !p["Se resolvio"]); // Filtrar solo los no resueltos

    return { status: 'success', data: problems };
}

function handleReplyToProblem(payload) {
    const { problemId, replyText, supervisorName } = payload;
     if (!problemId || !replyText || !supervisorName) {
        throw new Error("Faltan datos para responder al problema.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const ids = sheet.getRange(2, COLS_FEEDBACKS.ID, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == problemId);

    if (rowIndex === -1) {
        throw new Error("No se encontró el reporte con el ID proporcionado.");
    }
    const row = rowIndex + 2;

    sheet.getRange(row, COLS_FEEDBACKS.Respuesta).setValue(replyText);
    sheet.getRange(row, COLS_FEEDBACKS.Responde).setValue(supervisorName);

    return { status: 'success', message: 'Respuesta enviada correctamente.' };
}

function handleMarkProblemAsResolved(payload) {
    const { problemId } = payload;
    if (!problemId) {
        throw new Error("Se requiere el ID del problema.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const ids = sheet.getRange(2, COLS_FEEDBACKS.ID, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == problemId);

    if (rowIndex === -1) {
        throw new Error("No se encontró el reporte con el ID proporcionado.");
    }
    const row = rowIndex + 2;

    sheet.getRange(row, COLS_FEEDBACKS["Se resolvio"]).setValue(true);

    return { status: 'success', message: 'El problema ha sido marcado como resuelto.' };
}
