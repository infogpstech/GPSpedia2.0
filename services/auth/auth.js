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
    let logDetails = {
        timestamp: new Date().toISOString(),
        attemptedUsername: username,
        passwordFromFrontend: password,
        passwordFromSheet: null,
        frontendPasswordType: typeof password,
        sheetPasswordType: null,
        comparisonResult: false,
        outcome: ''
    };

    try {
        if (!username || !password) throw new Error("Usuario y contraseña son requeridos.");

        const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const COLS = getColumnMap(SHEET_NAMES.USERS);
        const data = userSheet.getDataRange().getValues();
        const headers = data.shift().map(h => camelCase(h.trim()));

        for (let i = 0; i < data.length; i++) {
            const userRow = data[i];
            const sheetUsername = (userRow[COLS.nombreUsuario - 1] || '').toString();

            if (sheetUsername.trim() !== username.trim()) {
                continue;
            }

            // User found, now check password and log everything
            const sheetPassword = (userRow[COLS.password - 1] || '');
            const frontendPassword = password || '';
            const passwordMatch = String(sheetPassword).trim() === String(frontendPassword).trim();

            logDetails.passwordFromSheet = sheetPassword;
            logDetails.sheetPasswordType = typeof sheetPassword;
            logDetails.comparisonResult = passwordMatch;

            if (passwordMatch) {
                logDetails.outcome = 'Login Exitoso';
                logToSheet(logDetails);

                const userRole = userRow[COLS.privilegios - 1];
                const userId = userRow[COLS.id - 1];
            const sessionLimit = SESSION_LIMITS[userRole] || 1;

            let activeSessionsSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.ACTIVE_SESSIONS);
            if (!activeSessionsSheet) {
                activeSessionsSheet = getSpreadsheet().insertSheet(SHEET_NAMES.ACTIVE_SESSIONS);
                activeSessionsSheet.appendRow(['UserID', 'SessionToken', 'Timestamp']);
            }

            const sessionsData = activeSessionsSheet.getDataRange().getValues();
            sessionsData.shift();

            const userSessions = sessionsData
                .map((row, index) => ({
                    userId: row[0],
                    token: row[1],
                    timestamp: new Date(row[2]),
                    rowIndex: index + 2
                }))
                .filter(session => session.userId == userId)
                .sort((a, b) => a.timestamp - b.timestamp);

            const sessionsToCloseCount = userSessions.length - sessionLimit + 1;
            if (sessionsToCloseCount > 0) {
                const sessionsToClose = userSessions.slice(0, sessionsToCloseCount);

                const allUsersData = userSheet.getDataRange().getValues();
                for (const session of sessionsToClose) {
                    for (let j = 1; j < allUsersData.length; j++) {
                        if (allUsersData[j][COLS.sessionToken - 1] === session.token) {
                            userSheet.getRange(j + 1, COLS.sessionToken).clearContent();
                            break;
                        }
                    }
                }

                sessionsToClose.reverse().forEach(session => {
                    activeSessionsSheet.deleteRow(session.rowIndex);
                });
            }

            const sessionToken = Utilities.getUuid();
            userSheet.getRange(i + 2, COLS.sessionToken).setValue(sessionToken);

            activeSessionsSheet.appendRow([userId, sessionToken, new Date().toISOString()]);

            const user = {};
            headers.forEach((header, index) => {
                if (header !== 'password') {
                    user[header] = userRow[index];
                }
            });
            user.sessionToken = sessionToken;
            user.id = userId;

            return { status: 'success', user };
            }
        }

        // Si el bucle termina, el usuario no fue encontrado o la contraseña fue incorrecta.
        logDetails.outcome = 'Fallo de Login: Credenciales Inválidas';
        logToSheet(logDetails);
        throw new Error("Credenciales inválidas.");

    } catch (error) {
        if (!logDetails.outcome) { // Si el error ocurrió antes de poder registrar un resultado
            logDetails.outcome = `Fallo de Login: ${error.message}`;
            logToSheet(logDetails);
        }
        Logger.log(`Error crítico en handleLogin para el usuario '${payload ? payload.username : 'N/A'}': ${error.stack}`);
        return {
            status: 'error',
            message: 'Error interno al intentar iniciar sesión.',
            details: {
                errorMessage: error.message,
                errorStack: error.stack
            }
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
            // No creamos la hoja para no interferir si el usuario la nombró diferente.
            // Simplemente registramos en Logger si no se encuentra.
            Logger.log("No se encontró la hoja 'Logs'. Log en Logger: " + JSON.stringify(details));
            return;
        }

        const headers = [
            "Timestamp", "Username", "Frontend Password", "Frontend Type",
            "Sheet Password", "Sheet Type", "Comparison Result", "Outcome"
        ];

        // Si la hoja está vacía, añadir encabezados.
        if (logSheet.getLastRow() === 0) {
            logSheet.appendRow(headers);
        }

        const logRow = [
            details.timestamp,
            details.attemptedUsername,
            details.passwordFromFrontend,
            details.frontendPasswordType,
            details.passwordFromSheet,
            details.sheetPasswordType,
            details.comparisonResult.toString(),
            details.outcome
        ];
        logSheet.appendRow(logRow);
    } catch (e) {
        Logger.log(`FALLO CRÍTICO en logToSheet: ${e.toString()}`);
        Logger.log(`Datos del log que no se pudieron escribir: ${JSON.stringify(details)}`);
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
