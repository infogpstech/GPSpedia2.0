// ============================================================================
// GPSPEDIA-AUTH SERVICE (DEFINITIVE FIX)
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
    USERS: "Users",
    ACTIVE_SESSIONS: "ActiveSessions"
};

const SESSION_LIMITS = {
    'desarrollador': 5,
    'gefe': 3,
    'supervisor': 2,
    'tecnico': 1,
    'tecnico_exterior': 1
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'GPSpedia AUTH-SERVICE is active.' })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    let response;
    try {
        const request = JSON.parse(e.postData.contents);
        switch (request.action) {
            case 'login':
                response = handleLogin(request.payload);
                break;
            case 'validateSession':
                response = handleValidateSession(request.payload);
                break;
            default:
                throw new Error(`Acción desconocida en Auth Service: ${request.action}`);
        }
    } catch (error) {
        response = { status: 'error', message: 'Error inesperado en el servicio de autenticación.', details: { errorMessage: error.message } };
    }
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================
function handleLogin(payload) {
    const { username, password } = payload;

    try {
        if (!username || !password) throw new Error("Usuario y contraseña son requeridos.");

        const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const COLS = getColumnMap(SHEET_NAMES.USERS);
        const data = userSheet.getDataRange().getValues();
        data.shift(); // Remove headers

        let foundUserRow = null;
        let foundUserIndex = -1;

        for (let i = 0; i < data.length; i++) {
            // Ensure column exists before trying to access it
            if (COLS.nombreusuario) {
                const sheetUsername = (data[i][COLS.nombreusuario - 1] || '').toString();
                if (sheetUsername.trim().toLowerCase() === username.trim().toLowerCase()) {
                    foundUserRow = data[i];
                    foundUserIndex = i;
                    break;
                }
            }
        }

        logToSheet({ attemptedUsername: username, columnMap: JSON.stringify(COLS) });

        if (!foundUserRow) {
            throw new Error("Credenciales inválidas (usuario no encontrado).");
        }

        const sheetPassword = (foundUserRow[COLS.password - 1] || '').toString();
        if (sheetPassword.trim() !== password.trim()) {
            throw new Error("Credenciales inválidas (contraseña incorrecta).");
        }

        const userRole = (foundUserRow[COLS.privilegios - 1] || '').toString().toLowerCase();
        const userId = foundUserRow[COLS.id - 1];
        const sessionLimit = SESSION_LIMITS[userRole] || 1;

        // Manage sessions
        const activeSessionsSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.ACTIVE_SESSIONS);
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
        userSheet.getRange(foundUserIndex + 2, COLS.sessiontoken).setValue(sessionToken);
        activeSessionsSheet.appendRow([userId, sessionToken, new Date().toISOString()]);

        const user = {};
        for (const key in COLS) {
            if (key !== 'password') {
                user[key] = foundUserRow[COLS[key] - 1];
            }
        }
        user.sessiontoken = sessionToken;

        return { status: 'success', user: user };

    } catch (error) {
        return { status: 'error', message: error.message, details: { errorMessage: error.message } };
    }
}

function handleValidateSession(payload) {
    const { userId, sessionToken } = payload;
    if (!userId || !sessionToken) return { valid: false };

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const COLS = getColumnMap(SHEET_NAMES.USERS);
    const data = userSheet.getRange(2, 1, userSheet.getLastRow(), userSheet.getLastColumn()).getValues();

    for (const row of data) {
        if (row[COLS.id - 1] == userId && row[COLS.sessiontoken - 1] === sessionToken) {
            return { valid: true };
        }
    }
    return { valid: false };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================
function logToSheet(details) {
    try {
        const logSheet = getSpreadsheet().getSheetByName("Logs");
        if (!logSheet) return;
        if (logSheet.getLastRow() === 0) {
            logSheet.appendRow(["Timestamp", "Username", "Column Map"]);
        }
        logSheet.appendRow([new Date().toISOString(), details.attemptedUsername, details.columnMap]);
    } catch (e) {
        // Fail silently if logging fails
    }
}

function getColumnMap(sheetName) {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return {};
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    return headers.reduce((map, header, i) => {
        const cleanHeader = header.toString().toLowerCase().replace(/\s+/g, '');
        if (cleanHeader) map[cleanHeader] = i + 1;
        return map;
    }, {});
}
