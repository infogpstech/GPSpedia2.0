// ============================================================================
// GPSPEDIA-AUTH SERVICE (REWRITE V2.0 COMPATIBLE)
// ============================================================================
// COMPONENT VERSION: 3.0.0

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs";
const SHEET_NAMES = {
    USERS: "Users",
    ACTIVE_SESSIONS: "ActiveSessions",
    LOGS: "Logs"
};

const COLS_USERS = {
    ID: 1,
    Nombre_Usuario: 2,
    Password: 3,
    Privilegios: 4,
    Telefono: 5,
    Correo_Electronico: 6,
    SessionToken: 7
};

const COLS_ACTIVE_SESSIONS = {
    ID_Usuario: 1,
    Usuario: 2,
    ActiveSessions: 3,
    date: 4,
    Logs: 5
};

// ============================================================================
// MÓDULO DE DEPURACIÓN
// ============================================================================
function _log(level, message, details = {}) {
    try {
        const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
        if (!logSheet) {
            console.error("Log sheet not found.");
            return;
        }
        const timestamp = new Date().toISOString();
        const detailsString = Object.keys(details).length > 0 ? JSON.stringify(details) : '';
        logSheet.appendRow([timestamp, level, message, detailsString]);
    } catch (e) {
        console.error(`Failed to write to log sheet: ${e.message}`);
    }
}

// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================
function doGet(e) {
    const response = {
        service: 'GPSpedia-Auth',
        status: 'active',
        version: '3.0.0'
    };
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
    let response;
    try {
        const request = JSON.parse(e.postData.contents);
        _log('INFO', `Request received for action: ${request.action}`);

        switch (request.action) {
            case 'login':
                response = handleLogin(request.payload);
                break;
            case 'validateSession':
                response = handleValidateSession(request.payload);
                break;
            default:
                throw new Error(`Unknown action: ${request.action}`);
        }
    } catch (error) {
        _log('ERROR', `doPost Error: ${error.message}`, { stack: error.stack });
        response = { status: 'error', message: `Server error: ${error.message}` };
    }
    // Critical: Always return as text/plain to avoid CORS issues.
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================================
// HELPERS DE LÓGICA DE AUTENTICACIÓN
// ============================================================================

/**
 * Finds a user by username (case-insensitive) in the Users sheet.
 * @param {string} username The username to find.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} userSheet The Users sheet object.
 * @returns {object|null} An object with user data and rowIndex, or null if not found.
 */
function _findUser(username, userSheet) {
    const data = userSheet.getDataRange().getValues();
    data.shift(); // Remove headers

    for (let i = 0; i < data.length; i++) {
        const sheetUsername = (data[i][COLS_USERS.Nombre_Usuario - 1] || '').toString().trim();
        if (sheetUsername.toLowerCase() === username.trim().toLowerCase()) {
            return {
                data: data[i],
                rowIndex: i + 2 // 1-based index + header row
            };
        }
    }
    return null;
}

/**
 * Deletes all active sessions for a given user ID.
 * @param {string} userId The user's ID.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} activeSessionsSheet The ActiveSessions sheet object.
 */
function _clearUserSessions(userId, activeSessionsSheet) {
    const data = activeSessionsSheet.getDataRange().getValues();
    const rowsToDelete = [];

    // Find all rows matching the userId
    for (let i = data.length - 1; i >= 1; i--) { // Iterate backwards from the end
        if (String(data[i][COLS_ACTIVE_SESSIONS.ID_Usuario - 1]).trim() == String(userId).trim()) {
            rowsToDelete.push(i + 1); // 1-based index
        }
    }

    // Delete rows from bottom to top to avoid shifting issues
    if (rowsToDelete.length > 0) {
        _log('INFO', `Clearing ${rowsToDelete.length} old session(s) for user ID ${userId}.`);
        rowsToDelete.forEach(rowIndex => {
            activeSessionsSheet.deleteRow(rowIndex);
        });
    }
}

/**
 * Creates a new session token and writes it to the Users and ActiveSessions sheets.
 * @param {object} foundUser The user object from _findUser.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} userSheet The Users sheet object.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} activeSessionsSheet The ActiveSessions sheet object.
 * @returns {string} The new session token.
 */
function _createNewSession(foundUser, userSheet, activeSessionsSheet) {
    const sessionToken = Utilities.getUuid();
    const userId = foundUser.data[COLS_USERS.ID - 1];
    const username = foundUser.data[COLS_USERS.Nombre_Usuario - 1];

    // 1. Update the token in the Users sheet
    userSheet.getRange(foundUser.rowIndex, COLS_USERS.SessionToken).setValue(sessionToken);

    // 2. Create the new session record in ActiveSessions
    const newSessionRow = [];
    newSessionRow[COLS_ACTIVE_SESSIONS.ID_Usuario - 1] = userId;
    newSessionRow[COLS_ACTIVE_SESSIONS.Usuario - 1] = username;
    newSessionRow[COLS_ACTIVE_SESSIONS.ActiveSessions - 1] = sessionToken;
    newSessionRow[COLS_ACTIVE_SESSIONS.date - 1] = new Date().toISOString();
    activeSessionsSheet.appendRow(newSessionRow);

    _log('INFO', `Created new session for user ${username} (ID: ${userId}).`);

    return sessionToken;
}


// ============================================================================
// HANDLERS DE ACCIONES
// ============================================================================

function handleLogin(payload) {
    const { username, password } = payload;
    if (!username || !password) {
        throw new Error("Username and password are required.");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(SHEET_NAMES.USERS);
    const activeSessionsSheet = ss.getSheetByName(SHEET_NAMES.ACTIVE_SESSIONS);

    if (!userSheet || !activeSessionsSheet) {
        throw new Error("Database sheets are missing. Contact administrator.");
    }

    const foundUser = _findUser(username, userSheet);

    if (!foundUser) {
        _log('WARN', `Login failed: User not found for username: ${username}`);
        throw new Error("Invalid credentials.");
    }

    const sheetPassword = String(foundUser.data[COLS_USERS.Password - 1]).trim();
    const inputPassword = String(password).trim();

    // Case-insensitive password comparison
    if (sheetPassword.toLowerCase() !== inputPassword.toLowerCase()) {
        _log('WARN', `Login failed: Password mismatch for user: ${username}`);
        throw new Error("Invalid credentials.");
    }

    const userId = foundUser.data[COLS_USERS.ID - 1];

    // SINGLE-SESSION LOGIC: Clear all old sessions before creating a new one.
    _clearUserSessions(userId, activeSessionsSheet);

    // Create the new session and get the token
    const newSessionToken = _createNewSession(foundUser, userSheet, activeSessionsSheet);

    const user = {
        ID: userId,
        Nombre_Usuario: foundUser.data[COLS_USERS.Nombre_Usuario - 1],
        Privilegios: foundUser.data[COLS_USERS.Privilegios - 1],
        Telefono: foundUser.data[COLS_USERS.Telefono - 1],
        Correo_Electronico: foundUser.data[COLS_USERS.Correo_Electronico - 1],
        SessionToken: newSessionToken // Return the new token
    };

    return { status: 'success', user: user };
}

function handleValidateSession(payload) {
    const { userId, sessionToken } = payload;
    if (!userId || !sessionToken) {
        return { valid: false };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const activeSessionsSheet = ss.getSheetByName(SHEET_NAMES.ACTIVE_SESSIONS);
    if (!activeSessionsSheet) {
        _log('ERROR', `Session validation failed: ActiveSessions sheet not found.`);
        return { valid: false };
    }

    const data = activeSessionsSheet.getDataRange().getValues();
    data.shift(); // Remove headers

    for (const row of data) {
        const sheetUserId = String(row[COLS_ACTIVE_SESSIONS.ID_Usuario - 1]).trim();
        const sheetToken = String(row[COLS_ACTIVE_SESSIONS.ActiveSessions - 1]).trim();

        if (sheetUserId === String(userId).trim() && sheetToken === String(sessionToken).trim()) {
            return { valid: true };
        }
    }

    return { valid: false };
}
