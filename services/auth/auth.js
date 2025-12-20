// ============================================================================
// GPSPEDIA-AUTH SERVICE
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
    'Desarrollador': 5,
    'Gefe': 3,
    'Supervisor': 2,
    'Tecnico': 1,
    'Tecnico_Exterior': 1
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
  try {
    const response = {
      status: 'success',
      message: 'GPSpedia AUTH-SERVICE v1.0 is active.'
    };
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorResponse = {
        status: 'error',
        message: 'Error en el servidor (doGet).',
        details: { message: error.message, stack: error.stack }
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
        try {
            request = JSON.parse(e.postData.contents);
        } catch (jsonError) {
            throw new Error(`El formato de la solicitud no es un JSON válido.`);
        }

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
        Logger.log(`Error CRÍTICO en Auth-Service doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error inesperado en el servicio de autenticación.',
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

function handleLogin(payload) {
    const { username, password } = payload;

    // Log initial attempt
    logToSheet({
        timestamp: new Date().toISOString(),
        attemptedUsername: username,
        outcome: "Login attempt started."
    });

    try {
        if (!username || !password) {
            throw new Error("Usuario y contraseña son requeridos.");
        }

        const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const COLS = getColumnMap(SHEET_NAMES.USERS);
        const data = userSheet.getDataRange().getValues();
        const headers = data.shift(); // Keep original headers for object creation

        let userFound = false;
        let foundUserRow = null;
        let foundUserIndex = -1;

        for (let i = 0; i < data.length; i++) {
            const sheetUsername = (data[i][COLS.nombreUsuario - 1] || '').toString();
            if (sheetUsername.trim().toLowerCase() === username.trim().toLowerCase()) {
                userFound = true;
                foundUserRow = data[i];
                foundUserIndex = i;
                break;
            }
        }

        if (!userFound) {
            logToSheet({ attemptedUsername: username, outcome: "User not found in sheet." });
            throw new Error("Credenciales inválidas.");
        }

        const sheetPassword = (foundUserRow[COLS.password - 1] || '').toString();
        const passwordMatch = sheetPassword.trim() === password.trim();

        if (!passwordMatch) {
            logToSheet({
                attemptedUsername: username,
                outcome: "Password does not match.",
                passwordFromFrontend: password,
                passwordFromSheet: sheetPassword
            });
            throw new Error("Credenciales inválidas.");
        }

        // At this point, login is successful
        logToSheet({ attemptedUsername: username, outcome: "Login successful. Managing session." });

        const userRole = foundUserRow[COLS.privilegios - 1];
        const userId = foundUserRow[COLS.id - 1];
        const sessionLimit = SESSION_LIMITS[userRole] || 1;

        // Manage active sessions
        let activeSessionsSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.ACTIVE_SESSIONS);
        if (!activeSessionsSheet) {
            activeSessionsSheet = getSpreadsheet().insertSheet(SHEET_NAMES.ACTIVE_SESSIONS);
            activeSessionsSheet.appendRow(['UserID', 'SessionToken', 'Timestamp']);
        }

        const sessionsData = activeSessionsSheet.getDataRange().getValues();
        sessionsData.shift();

        const userSessions = sessionsData
            .map((row, index) => ({ userId: row[0], token: row[1], timestamp: new Date(row[2]), rowIndex: index + 2 }))
            .filter(session => session.userId == userId)
            .sort((a, b) => a.timestamp - b.timestamp);

        const sessionsToCloseCount = Math.max(0, userSessions.length - sessionLimit + 1);
        if (sessionsToCloseCount > 0) {
            const sessionsToClose = userSessions.slice(0, sessionsToCloseCount);
            sessionsToClose.reverse().forEach(session => {
                activeSessionsSheet.deleteRow(session.rowIndex);
            });
        }

        // Create new session
        const sessionToken = Utilities.getUuid();
        userSheet.getRange(foundUserIndex + 2, COLS.sessionToken).setValue(sessionToken);
        activeSessionsSheet.appendRow([userId, sessionToken, new Date().toISOString()]);

        // Prepare user object to return
        const user = {};
        headers.forEach((header, index) => {
            const camelHeader = camelCase(header);
            if (camelHeader !== 'password') {
                user[camelHeader] = foundUserRow[index];
            }
        });
        user.sessionToken = sessionToken;
        user.id = userId;

        return { status: 'success', user: user };

    } catch (error) {
        logToSheet({
            attemptedUsername: username,
            outcome: "Error during login process.",
            errorMessage: error.message
        });
        return {
            status: 'error',
            message: error.message, // Return the specific error message to the frontend
            details: { errorMessage: error.message }
        };
    }
}

function handleValidateSession(payload) {
    const { userId, sessionToken } = payload;
    if (!userId || !sessionToken) return { valid: false };

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const COLS = getColumnMap(SHEET_NAMES.USERS);
    const data = userSheet.getRange(2, 1, userSheet.getLastRow() - 1, Math.max(COLS.id, COLS.sessionToken)).getValues();

    for (const row of data) {
        if (row[COLS.id - 1] == userId && row[COLS.sessionToken - 1] === sessionToken) {
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
        if (!logSheet) {
            Logger.log("Log sheet not found. Logging to Logger: " + JSON.stringify(details));
            return;
        }
        const headers = ["Timestamp", "Username", "Outcome", "Frontend Password", "Sheet Password", "Error Message"];
        if (logSheet.getLastRow() === 0) {
            logSheet.appendRow(headers);
        }
        const logRow = [
            details.timestamp || new Date().toISOString(),
            details.attemptedUsername || 'N/A',
            details.outcome || 'N/A',
            details.passwordFromFrontend || '',
            details.passwordFromSheet || '',
            details.errorMessage || ''
        ];
        logSheet.appendRow(logRow);
    } catch (e) {
        Logger.log(`CRITICAL FAILURE in logToSheet: ${e.toString()}`);
        Logger.log(`Log data that failed to write: ${JSON.stringify(details)}`);
    }
}


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
