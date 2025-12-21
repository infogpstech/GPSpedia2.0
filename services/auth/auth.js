// ============================================================================
// GPSPEDIA-AUTH SERVICE (WITH DEBUG LOGGING)
// ============================================================================

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo";
const SHEET_NAMES = {
    USERS: "Users",
    ACTIVE_SESSIONS: "ActiveSessions",
    LOGS: "Logs" // Hoja para depuración
};

// This hardcoded map eliminates all errors from dynamic column parsing.
const COLS = {
    ID: 1,
    NOMBRE_USUARIO: 2,
    PASSWORD: 3,
    PRIVILEGIOS: 4,
    NOMBRE: 5,
    TELEFONO: 6,
    CORREO_ELECTRONICO: 7,
    SESSION_TOKEN: 8
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
/**
 * Escribe un mensaje de registro en la hoja 'Logs' de la spreadsheet.
 * @param {string} level - El nivel del log (e.g., INFO, DEBUG, ERROR).
 * @param {string} message - El mensaje a registrar.
 * @param {object} [details={}] - Un objeto con detalles adicionales para registrar.
 */
function logToSheet(level, message, details = {}) {
    try {
        const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
        const timestamp = new Date().toISOString();
        const detailsString = Object.keys(details).length > 0 ? JSON.stringify(details) : '';
        logSheet.appendRow([timestamp, level, message, detailsString]);
    } catch (e) {
        // Fallback en caso de que el logging falle.
        console.error("Fallo al escribir en la hoja de logs:", e.message);
    }
}


// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'GPSpedia AUTH-SERVICE is active. v1.1-debug' })).setMimeType(ContentService.MimeType.JSON);
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
            logToSheet('WARN', 'Login attempt with missing username or password.');
            throw new Error("Usuario y contraseña son requeridos.");
        }

        const userSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS);
        const data = userSheet.getDataRange().getValues();
        data.shift(); // Remove headers

        let foundUserRow = null;
        let foundUserIndex = -1;

        for (let i = 0; i < data.length; i++) {
            const sheetUsername = (data[i][COLS.NOMBRE_USUARIO - 1] || '').toString();
            if (sheetUsername.trim().toLowerCase() === username.trim().toLowerCase()) {
                foundUserRow = data[i];
                foundUserIndex = i;
                logToSheet('DEBUG', `User found at row index ${i}.`, { username: sheetUsername });
                break;
            }
        }

        if (!foundUserRow) {
            logToSheet('WARN', 'User not found in sheet.', { attemptedUsername: username });
            throw new Error("Credenciales inválidas.");
        }

        const sheetPassword = foundUserRow[COLS.PASSWORD - 1];
        const isPasswordMatch = String(sheetPassword).trim() === String(password).trim();

        logToSheet('DEBUG', 'Password comparison details.', {
            sheetPassword: String(sheetPassword),
            sheetPasswordTrimmed: String(sheetPassword).trim(),
            frontendPassword: String(password),
            frontendPasswordTrimmed: String(password).trim(),
            comparisonResult: isPasswordMatch
        });

        if (!isPasswordMatch) {
            logToSheet('WARN', 'Password mismatch for user.', { username: username });
            throw new Error("Credenciales inválidas.");
        }

        logToSheet('INFO', 'Password match successful. Proceeding with session management.', { username: username });

        const userRole = (foundUserRow[COLS.PRIVILEGIOS - 1] || '').toString().toLowerCase();
        const userId = foundUserRow[COLS.ID - 1];
        const sessionLimit = SESSION_LIMITS[userRole] || 1;

        // Manage sessions
        const activeSessionsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.ACTIVE_SESSIONS);
        const sessionsData = activeSessionsSheet.getDataRange().getValues();
        sessionsData.shift();

        const userSessions = sessionsData
            .map((row, index) => ({ userId: row[0], rowIndex: index + 2 }))
            .filter(session => session.userId == userId);

        if (userSessions.length >= sessionLimit) {
            logToSheet('INFO', `Session limit reached for user. Clearing oldest sessions.`, { userId: userId, limit: sessionLimit });
            userSessions.reverse().slice(sessionLimit - 1).forEach(session => {
                activeSessionsSheet.deleteRow(session.rowIndex);
            });
        }

        const sessionToken = Utilities.getUuid();
        userSheet.getRange(foundUserIndex + 2, COLS.SESSION_TOKEN).setValue(sessionToken);
        activeSessionsSheet.appendRow([userId, sessionToken, new Date().toISOString()]);
        logToSheet('INFO', 'New session created and stored.', { userId: userId });

        const user = {
            id: userId,
            nombreUsuario: foundUserRow[COLS.NOMBRE_USUARIO - 1],
            privilegios: foundUserRow[COLS.PRIVILEGIOS - 1],
            nombre: foundUserRow[COLS.NOMBRE - 1],
            telefono: foundUserRow[COLS.TELEFONO - 1],
            correoElectronico: foundUserRow[COLS.CORREO_ELECTRONICO - 1],
            sessionToken: sessionToken
        };

        logToSheet('INFO', 'Login successful. Returning user object.', { userId: userId });
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
            logToSheet('WARN', 'validateSession called with missing userId or sessionToken.');
            return { valid: false };
        }

        const userSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS);
        const data = userSheet.getDataRange().getValues();
        data.shift();

        for (const row of data) {
            if (row[COLS.ID - 1] == userId && row[COLS.SESSION_TOKEN - 1] === sessionToken) {
                logToSheet('INFO', 'Session validation successful.', { userId: userId });
                return { valid: true };
            }
        }

        logToSheet('WARN', 'Session validation failed.', { userId: userId });
        return { valid: false };
    } catch (error) {
        logToSheet('ERROR', `Error in handleValidateSession: ${error.message}`, { stack: error.stack });
        return { valid: false, error: error.message };
    }
}
