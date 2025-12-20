// ============================================================================
// GPSPEDIA-AUTH SERVICE (FROM SCRATCH - DEFINITIVE)
// ============================================================================

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo";
const SHEET_NAMES = {
    USERS: "Users",
    ACTIVE_SESSIONS: "ActiveSessions"
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
// ROUTER PRINCIPAL
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
                throw new Error(`Acción desconocida: ${request.action}`);
        }
    } catch (error) {
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
        if (!username || !password) throw new Error("Usuario y contraseña son requeridos.");

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
                break;
            }
        }

        if (!foundUserRow) {
            throw new Error("Credenciales inválidas.");
        }

        const sheetPassword = (foundUserRow[COLS.PASSWORD - 1] || '').toString();
        if (sheetPassword.trim() !== password.trim()) {
            throw new Error("Credenciales inválidas.");
        }

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
            userSessions.reverse().slice(sessionLimit - 1).forEach(session => {
                activeSessionsSheet.deleteRow(session.rowIndex);
            });
        }

        const sessionToken = Utilities.getUuid();
        userSheet.getRange(foundUserIndex + 2, COLS.SESSION_TOKEN).setValue(sessionToken);
        activeSessionsSheet.appendRow([userId, sessionToken, new Date().toISOString()]);

        const user = {
            id: userId,
            nombreUsuario: foundUserRow[COLS.NOMBRE_USUARIO - 1],
            privilegios: foundUserRow[COLS.PRIVILEGIOS - 1],
            nombre: foundUserRow[COLS.NOMBRE - 1],
            telefono: foundUserRow[COLS.TELEFONO - 1],
            correoElectronico: foundUserRow[COLS.CORREO_ELECTRONICO - 1],
            sessionToken: sessionToken
        };

        return { status: 'success', user: user };

    } catch (error) {
        return { status: 'error', message: error.message };
    }
}

function handleValidateSession(payload) {
    try {
        const { userId, sessionToken } = payload;
        if (!userId || !sessionToken) return { valid: false };

        const userSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS);
        const data = userSheet.getDataRange().getValues();
        data.shift();

        for (const row of data) {
            if (row[COLS.ID - 1] == userId && row[COLS.SESSION_TOKEN - 1] === sessionToken) {
                return { valid: true };
            }
        }
        return { valid: false };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}
