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
    NOTIFICACIONES: "Notificaciones"
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

// Mapa de columnas para la hoja "Feedbacks" (v2.0) - ACTUALIZADO
const COLS_FEEDBACKS = {
    ID: 1,
    ID_Usuario: 2, // <-- NUEVO
    Usuario: 3,
    ID_vehiculo: 4,
    Problema: 5,
    Respuesta: 6,
    "Se resolvio": 7,
    Responde: 8,
    "Reporte de util": 9
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

const COLS_NOTIFICACIONES = {
    ID: 1,
    ID_Usuario: 2,
    Mensaje: 3,
    Leido: 4,
    Timestamp: 5
};


// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) {
    if (e.parameter.debug === 'true') {
        const serviceState = {
            service: 'GPSpedia-Feedback',
            version: '2.3.0', // <-- ACTUALIZADO
            spreadsheetId: SPREADSHEET_ID,
            sheetsAccessed: [
                SHEET_NAMES.CORTES,
                SHEET_NAMES.FEEDBACKS,
                SHEET_NAMES.CONTACTANOS,
                SHEET_NAMES.ACTIVIDAD_USUARIO,
                SHEET_NAMES.NOTIFICACIONES
            ]
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Feedback-SERVICE v2.3.0 is active.'
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
            // --- Acciones de Feedback General ---
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
            case 'getComments':
                response = handleGetComments(payload);
                break;

            // --- Acciones de Bandeja de Entrada (Supervisor/Jefe) ---
            case 'getReportedProblems':
                 response = handleGetReportedProblems(payload);
                 break;
            case 'replyToProblem':
                 response = handleReplyToProblem(payload);
                 break;
            case 'resolveProblem':
                 response = handleResolveProblem(payload);
                 break;
            case 'deleteProblem':
                 response = handleDeleteProblem(payload);
                 break;

            // --- Acciones de Notificaciones (Usuario) ---
            case 'getUnreadNotifications':
                response = handleGetUnreadNotifications(payload);
                break;
            case 'markNotificationsAsRead':
                response = handleMarkNotificationsAsRead(payload);
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

function logUserActivity(userId, userName, activityType, associatedId, details) {
    try {
        const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.ACTIVIDAD_USUARIO);
        // Crear un ID único basado en el timestamp y un número aleatorio
        const timestamp = new Date();
        const uniqueId = timestamp.getTime().toString(36) + Math.random().toString(36).slice(2);

        const newRow = [];
        newRow[COLS_ACTIVIDAD_USUARIO.id - 1] = uniqueId;
        newRow[COLS_ACTIVIDAD_USUARIO.timestamp - 1] = timestamp;
        newRow[COLS_ACTIVIDAD_USUARIO.idUsuario - 1] = userId;
        newRow[COLS_ACTIVIDAD_USUARIO.nombreUsuario - 1] = userName;
        newRow[COLS_ACTIVIDAD_USUARIO.tipoActividad - 1] = activityType;
        newRow[COLS_ACTIVIDAD_USUARIO.idElementoAsociado - 1] = associatedId;
        newRow[COLS_ACTIVIDAD_USUARIO.detalle - 1] = details;
        sheet.appendRow(newRow);
    } catch (e) {
        Logger.log(`CRITICAL: Fallo al registrar actividad de usuario. Error: ${e.message}`);
    }
}

function handleRecordLike(payload) {
    const { vehicleId, corteIndex, userId, userName } = payload;
    if (!vehicleId || !corteIndex || !userId || !userName) {
        throw new Error("Faltan datos para registrar el 'like' (vehicleId, corteIndex, userId, userName).");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const ids = sheet.getRange(2, COLS_CORTES.id, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == vehicleId);

    if (rowIndex === -1) {
        throw new Error("No se encontró el vehículo con el ID proporcionado.");
    }

    const actualRow = rowIndex + 2;
    const utilColName = `utilCorte${corteIndex}`;
    const utilCol = COLS_CORTES[utilColName];

    if (!utilCol) {
        throw new Error(`Índice de corte inválido: ${corteIndex}`);
    }

    const cell = sheet.getRange(actualRow, utilCol);
    let currentValue = cell.getValue();
    if (typeof currentValue !== 'number' || isNaN(currentValue)) {
        currentValue = 0;
    }
    cell.setValue(currentValue + 1);

    logUserActivity(userId, userName, 'like', vehicleId, `Like en corte ${corteIndex}. Nuevo total: ${currentValue + 1}`);
    return { status: 'success', message: 'Like registrado correctamente.' };
}

function handleAssignCollaborator(payload) {
    const { vehicleId, corteIndex, userName } = payload;
    if (!vehicleId || !corteIndex || !userName) {
        throw new Error("Faltan datos para asignar colaborador.");
    }
    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == vehicleId);

    if (rowIndex === -1) {
        throw new Error("Vehículo no encontrado.");
    }

    const actualRow = rowIndex + 2;
    const colName = `colaboradorCorte${corteIndex}`;
    const col = COLS_CORTES[colName];
    if (!col) throw new Error("Índice de corte inválido.");

    sheet.getRange(actualRow, col).setValue(userName);
    return { status: 'success', message: 'Colaborador asignado.' };
}

function handleSuggestYear(payload) {
    const { vehicleId, newYear, userId, userName } = payload;
    if (!vehicleId || !newYear || !userId || !userName) {
        throw new Error("Faltan datos para sugerir año (vehicleId, newYear, userId, userName).");
    }

    const year = parseInt(newYear, 10);
    if (isNaN(year) || String(year).length !== 4) {
        throw new Error("El año proporcionado no es un número válido de 4 dígitos.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const fullDataRange = sheet.getDataRange();
    const allValues = fullDataRange.getValues();
    allValues.shift(); // Remove headers

    let targetRowIndex = -1;
    let targetVehicle = null;

    for (let i = 0; i < allValues.length; i++) {
        if (allValues[i][COLS_CORTES.id - 1] == vehicleId) {
            targetRowIndex = i;
            targetVehicle = {
                marca: allValues[i][COLS_CORTES.marca - 1],
                modelo: allValues[i][COLS_CORTES.modelo - 1],
                tipoEncendido: allValues[i][COLS_CORTES.tipoEncendido - 1],
                anoDesde: allValues[i][COLS_CORTES.anoDesde - 1],
                anoHasta: allValues[i][COLS_CORTES.anoHasta - 1]
            };
            break;
        }
    }

    if (!targetVehicle) {
        throw new Error("Vehículo no encontrado.");
    }

    const currentAnoDesde = targetVehicle.anoDesde ? parseInt(targetVehicle.anoDesde, 10) : year;
    const currentAnoHasta = targetVehicle.anoHasta ? parseInt(targetVehicle.anoHasta, 10) : currentAnoDesde;

    if (year >= currentAnoDesde && year <= currentAnoHasta) {
        return { status: 'info', message: 'El año sugerido ya está dentro del rango existente.' };
    }

    // Anti-collision Logic
    for (let i = 0; i < allValues.length; i++) {
        if (i === targetRowIndex) continue;

        const otherVehicle = {
            marca: allValues[i][COLS_CORTES.marca - 1],
            modelo: allValues[i][COLS_CORTES.modelo - 1],
            tipoEncendido: allValues[i][COLS_CORTES.tipoEncendido - 1],
            anoDesde: allValues[i][COLS_CORTES.anoDesde - 1],
            anoHasta: allValues[i][COLS_CORTES.anoHasta - 1]
        };

        if (otherVehicle.marca === targetVehicle.marca && otherVehicle.modelo === targetVehicle.modelo && otherVehicle.tipoEncendido === targetVehicle.tipoEncendido) {
            const otherAnoDesde = otherVehicle.anoDesde ? parseInt(otherVehicle.anoDesde, 10) : null;
            const otherAnoHasta = otherVehicle.anoHasta ? parseInt(otherVehicle.anoHasta, 10) : otherAnoDesde;
            if (otherAnoDesde && otherAnoHasta && year >= otherAnoDesde && year <= otherAnoHasta) {
                throw new Error(`Conflicto de generaciones. El año ${year} ya está cubierto por otro registro (${otherAnoDesde}-${otherAnoHasta}).`);
            }
        }
    }

    let newAnoDesde = currentAnoDesde;
    let newAnoHasta = currentAnoHasta;
    let updated = false;

    if (year < currentAnoDesde) {
        newAnoDesde = year;
        updated = true;
    }
    if (year > currentAnoHasta) {
        newAnoHasta = year;
        updated = true;
    }

    if (updated) {
        const sheetRowIndex = targetRowIndex + 2;
        sheet.getRange(sheetRowIndex, COLS_CORTES.anoDesde).setValue(newAnoDesde);
        sheet.getRange(sheetRowIndex, COLS_CORTES.anoHasta).setValue(newAnoHasta);
        logUserActivity(userId, userName, 'suggest_year', vehicleId, `Año sugerido: ${year}. Rango actualizado a ${newAnoDesde}-${newAnoHasta}.`);
        return { status: 'success', message: `Rango de años actualizado a ${newAnoDesde}-${newAnoHasta}.` };
    }

    return { status: 'info', message: 'No se requirió ninguna actualización.' };
}

function handleReportProblem(payload) {
    const { vehicleId, problemText, userId, userName } = payload;
    if (!vehicleId || !problemText || !userId || !userName) {
        throw new Error("Faltan datos para reportar el problema (vehicleId, problemText, userId, userName).");
    }

    const feedbackSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const newRow = [];
    newRow[COLS_FEEDBACKS.ID - 1] = new Date().getTime().toString();
    newRow[COLS_FEEDBACKS.ID_Usuario - 1] = userId; // <-- GUARDAR ID DEL USUARIO
    newRow[COLS_FEEDBACKS.Usuario - 1] = userName;
    newRow[COLS_FEEDBACKS.ID_vehiculo - 1] = vehicleId;
    newRow[COLS_FEEDBACKS.Problema - 1] = problemText;

    // Inicializar las otras columnas para mantener la estructura
    newRow[COLS_FEEDBACKS.Respuesta - 1] = "";
    newRow[COLS_FEEDBACKS["Se resolvio"] - 1] = false;
    newRow[COLS_FEEDBACKS.Responde - 1] = "";
    newRow[COLS_FEEDBACKS["Reporte de util"] - 1] = "";

    feedbackSheet.appendRow(newRow);

    logUserActivity(userId, userName, 'report_problem', vehicleId, problemText);
    return { status: 'success', message: 'Problema reportado correctamente.' };
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

function handleGetComments(payload) {
    const { vehicleId } = payload;
    if (!vehicleId) {
        throw new Error("Se requiere el ID del vehículo para obtener los comentarios.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const data = sheet.getDataRange().getValues();
    data.shift(); // remove headers

    const comments = data
        .filter(row => row[COLS_FEEDBACKS.ID_vehiculo - 1] == vehicleId)
        .map(row => ({
            user: row[COLS_FEEDBACKS.Usuario - 1],
            problem: row[COLS_FEEDBACKS.Problema - 1],
            response: row[COLS_FEEDBACKS.Respuesta - 1],
            responder: row[COLS_FEEDBACKS.Responde - 1]
        }))
        .slice(-2); // Take only the last 2 comments

    return { status: 'success', data: comments };
}

// ============================================================================
// INBOX HANDLERS (FOR SUPERVISORS/JEFES)
// ============================================================================

function handleGetReportedProblems(payload) {
    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const problems = data
        .map(row => {
            let problem = {};
            headers.forEach((header, i) => {
                const key = Object.keys(COLS_FEEDBACKS).find(k => COLS_FEEDBACKS[k] === i + 1);
                if (key) problem[key] = row[i];
            });
            return problem;
        })
        .filter(p => !p["Se resolvio"])
        .map(p => ({ // Mapear a un formato más simple para el frontend
             id: p.ID,
             userId: p.ID_Usuario,
             user: p.Usuario,
             vehicleId: p.ID_vehiculo,
             problem: p.Problema
        }));

    return { status: 'success', data: problems.reverse() }; // Mostrar los más recientes primero
}


function handleReplyToProblem(payload) {
    const { problemId, replyText, responderName } = payload;
    if (!problemId || !replyText || !responderName) {
        throw new Error("Faltan datos para responder (problemId, replyText, responderName).");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const idColumn = sheet.getRange(2, COLS_FEEDBACKS.ID, sheet.getLastRow(), 1).getValues().flat();
    const rowIndex = idColumn.findIndex(id => id == problemId);

    if (rowIndex === -1) {
        throw new Error("No se encontró el reporte con el ID proporcionado.");
    }

    const actualRow = rowIndex + 2;
    const rowData = sheet.getRange(actualRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const userIdToNotify = rowData[COLS_FEEDBACKS.ID_Usuario - 1];

    sheet.getRange(actualRow, COLS_FEEDBACKS.Respuesta).setValue(replyText);
    sheet.getRange(actualRow, COLS_FEEDBACKS.Responde).setValue(responderName);

    // Crear notificación para el usuario que reportó el problema
    if (userIdToNotify) {
        const notificationMessage = `El administrador ${responderName} ha respondido a tu reporte de problema.`;
        createNotification(userIdToNotify, notificationMessage);
    }

    return { status: 'success', message: 'Respuesta enviada y notificación creada.' };
}


function handleResolveProblem(payload) {
    const { problemId } = payload;
    if (!problemId) throw new Error("Se requiere el ID del problema para resolverlo.");

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const ids = sheet.getRange(2, COLS_FEEDBACKS.ID, sheet.getLastRow(), 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == problemId);

    if (rowIndex === -1) throw new Error("No se encontró el reporte con el ID proporcionado.");

    sheet.getRange(rowIndex + 2, COLS_FEEDBACKS["Se resolvio"]).setValue(true);
    return { status: 'success', message: 'Problema marcado como resuelto.' };
}


function handleDeleteProblem(payload) {
    const { problemId } = payload;
    if (!problemId) throw new Error("Se requiere el ID del problema para eliminarlo.");

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.FEEDBACKS);
    const ids = sheet.getRange(2, COLS_FEEDBACKS.ID, sheet.getLastRow(), 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == problemId);

    if (rowIndex === -1) throw new Error("No se encontró el reporte con el ID proporcionado.");

    sheet.deleteRow(rowIndex + 2);
    return { status: 'success', message: 'Problema eliminado permanentemente.' };
}

// ============================================================================
// NOTIFICATION HANDLERS (FOR ALL USERS)
// ============================================================================

function createNotification(userId, message) {
    try {
        const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.NOTIFICACIONES);
        const timestamp = new Date();
        const uniqueId = timestamp.getTime().toString(36) + Math.random().toString(36).slice(2);

        sheet.appendRow([uniqueId, userId, message, false, timestamp]);
    } catch (e) {
        Logger.log(`CRITICAL: Fallo al crear notificación para el usuario ${userId}. Error: ${e.message}`);
    }
}

function handleGetUnreadNotifications(payload) {
    const { userId } = payload;
    if (!userId) throw new Error("Se requiere el ID de usuario para obtener notificaciones.");

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.NOTIFICACIONES);
    if (!sheet) {
        // Si la hoja de Notificaciones no existe, no hay notificaciones que mostrar.
        return { status: 'success', data: [] };
    }
    const data = sheet.getDataRange().getValues();
    data.shift();

    const notifications = data
        .filter(row => row[COLS_NOTIFICACIONES.ID_Usuario - 1] == userId && !row[COLS_NOTIFICACIONES.Leido - 1])
        .map(row => ({
            id: row[COLS_NOTIFICACIONES.ID - 1],
            message: row[COLS_NOTIFICACIONES.Mensaje - 1],
            timestamp: row[COLS_NOTIFICACIONES.Timestamp - 1]
        }));

    return { status: 'success', data: notifications };
}


function handleMarkNotificationsAsRead(payload) {
    const { userId, notificationIds } = payload;
    if (!userId || !Array.isArray(notificationIds) || notificationIds.length === 0) {
        throw new Error("Se requiere ID de usuario y un array de IDs de notificación.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.NOTIFICACIONES);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    let updated = false;
    for (let i = 1; i < values.length; i++) { // Start from 1 to skip header
        const rowUserId = values[i][COLS_NOTIFICACIONES.ID_Usuario - 1];
        const rowNotifId = values[i][COLS_NOTIFICACIONES.ID - 1];

        if (rowUserId == userId && notificationIds.includes(rowNotifId)) {
            values[i][COLS_NOTIFICACIONES.Leido - 1] = true;
            updated = true;
        }
    }

    if (updated) {
        dataRange.setValues(values);
        return { status: 'success', message: `${notificationIds.length} notificaciones marcadas como leídas.` };
    }

    return { status: 'info', message: 'No se encontraron notificaciones para marcar.' };
}
