// ============================================================================
// GPSPEDIA-AUTH SERVICE (COMPATIBLE WITH DB V2.0)
// ============================================================================
// COMPONENT VERSION: 1.2.1

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs"; // <-- ACTUALIZADO A DB V2.0
const SHEET_NAMES = {
    USERS: "Users",
    ACTIVE_SESSIONS: "ActiveSessions",
    LOGS: "Logs"
};

// Mapa de columnas actualizado al esquema v2.0 (camelCase)
const COLS = {
    id: 1,
    nombreUsuario: 2,
    password: 3,
    privilegios: 4,
    nombre: 5,
    telefono: 6,
    correoElectronico: 7,
    sessionToken: 8
};

const SESSION_LIMITS = {
    'desarrollador': 5,
    'gefe': 3,
    'supervisor': 2,
    'tecnico': 1,
    'tecnico_exterior': 1
};

// ============================================================================
// MÓDULO DE DEPURACIÓN
// ============================================================================
function logToSheet(level, message, details = {}) {
    try {
        const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
        const timestamp = new Date().toISOString();
        const detailsString = Object.keys(details).length > 0 ? JSON.stringify(details) : '';
        logSheet.appendRow([timestamp, level, message, detailsString]);
    } catch (e) {
        console.error("Fallo al escribir en la hoja de logs:", e.message);
    }
}

// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================
function doGet(e) {
    if (e.parameter.debug === 'true') {
        const serviceState = {
            service: 'GPSpedia-Auth',
            version: '1.2.1', // Mantener sincronizado con la versión del componente
            spreadsheetId: SPREADSHEET_ID,
            sheetsAccessed: [SHEET_NAMES.USERS, SHEET_NAMES.ACTIVE_SESSIONS, SHEET_NAMES.LOGS]
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    // Comportamiento por defecto si no está en modo de depuración
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Auth-SERVICE v1.2.1 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    let response;
    try {
        logToSheet('INFO', 'doPost received a request.');
        const request = JSON.parse(e.postData.contents);
        logToSheet('DEBUG', `Request parsed. Action: ${request.action}`, { payload: request.payload });

        switch (request.action) {
            case 'login':
                response = handleLogin(request.payload);
                break;
            case 'validateSession':
                response = handleValidateSession(request.payload);
                break;
            default:
                throw new Error(`Acción desconocida: ${request.action}`);
        }
    } catch (error) {
        logToSheet('ERROR', `Error in doPost: ${error.message}`, { stack: error.stack });
        response = { status: 'error', message: error.message };
    }
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// LÓGICA DE AUTENTICACIÓN
// ============================================================================
function handleLogin(payload) {
    try {
        const { username, password } = payload;
        logToSheet('INFO', 'handleLogin started.', { username: username });

        if (!username || !password) {
            throw new Error("Usuario y contraseña son requeridos.");
        }

        const userSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS);
        const data = userSheet.getDataRange().getValues();
        data.shift(); // Remove headers

        let foundUserRow = null;
        let foundUserIndex = -1;

        for (let i = 0; i < data.length; i++) {
            const sheetUsername = (data[i][COLS.nombreUsuario - 1] || '').toString(); // <-- Clave actualizada
            if (sheetUsername.trim().toLowerCase() === username.trim().toLowerCase()) {
                foundUserRow = data[i];
                foundUserIndex = i;
                break;
            }
        }

        if (!foundUserRow) {
            throw new Error("Credenciales inválidas.");
        }

        const sheetPassword = foundUserRow[COLS.password - 1]; // <-- Clave actualizada
        const isPasswordMatch = String(sheetPassword).trim() === String(password).trim();

        if (!isPasswordMatch) {
            throw new Error("Credenciales inválidas.");
        }

        const userRole = (foundUserRow[COLS.privilegios - 1] || '').toString().toLowerCase(); // <-- Clave actualizada
        const userId = foundUserRow[COLS.id - 1]; // <-- Clave actualizada
        const sessionLimit = SESSION_LIMITS[userRole] || 1;

        // Manage sessions
        const activeSessionsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.ACTIVE_SESSIONS);
        const sessionsData = activeSessionsSheet.getDataRange().getValues();
        sessionsData.shift();

        const userSessions = sessionsData
            .map((row, index) => ({ userId: row[0], rowIndex: index + 2 }))
            .filter(session => session.userId == userId);

        if (userSessions.length >= sessionLimit) {
            userSessions.reverse().slice(sessionLimit - 1).forEach(session => {
                activeSessionsSheet.deleteRow(session.rowIndex);
            });
        }

        const sessionToken = Utilities.getUuid();
        userSheet.getRange(foundUserIndex + 2, COLS.sessionToken).setValue(sessionToken); // <-- Clave actualizada
        activeSessionsSheet.appendRow([userId, sessionToken, new Date().toISOString()]);

        const user = {
            id: userId,
            nombreUsuario: foundUserRow[COLS.nombreUsuario - 1],
            privilegios: foundUserRow[COLS.privilegios - 1],
            nombre: foundUserRow[COLS.nombre - 1],
            telefono: foundUserRow[COLS.telefono - 1],
            correoElectronico: foundUserRow[COLS.correoElectronico - 1],
            sessionToken: sessionToken
        };

        return { status: 'success', user: user };

    } catch (error) {
        logToSheet('ERROR', `Error in handleLogin: ${error.message}`, { stack: error.stack });
        return { status: 'error', message: error.message };
    }
}

function handleValidateSession(payload) {
    try {
        const { userId, sessionToken } = payload;
        if (!userId || !sessionToken) {
            return { valid: false };
        }

        const userSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS);
        const data = userSheet.getDataRange().getValues();
        data.shift();

        for (const row of data) {
            if (row[COLS.id - 1] == userId && row[COLS.sessionToken - 1] === sessionToken) { // <-- Claves actualizadas
                return { valid: true };
            }
        }

        return { valid: false };
    } catch (error) {
        logToSheet('ERROR', `Error in handleValidateSession: ${error.message}`, { stack: error.stack });
        return { valid: false, error: error.message };
    }
}
