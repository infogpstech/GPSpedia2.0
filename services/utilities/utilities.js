// GPSpedia Utilities-SERVICE | Version: 1.0.1
// ============================================================================
// SERVICE FOR ONE-TIME DATA MIGRATION AND UTILITY TASKS
// ============================================================================

// ============================================================================
// GLOBAL CONFIGURATION
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs"; // GPSpedia_DB_v2.0
const SHEET_NAMES = {
    CORTES: "Cortes",
    USERS: "Users",
    LOGS: "Logs"
};

// Column maps to ensure stability
const COLS_CORTES = {
    id: 1,
    anoDesde: 6,
    anoHasta: 7,
    imagenVehiculo: 9,
    timestamp: 37
};

const COLS_USERS = {
    ID: 1,
    Privilegios: 4,
    SessionToken: 7
};

// ============================================================================
// DEBUGGING MODULE
// ============================================================================
function logToSheet(level, message, details = {}) {
    try {
        const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
        const timestamp = new Date().toISOString();
        const detailsString = Object.keys(details).length > 0 ? JSON.stringify(details) : '';
        logSheet.appendRow([timestamp, level, message, detailsString]);
    } catch (e) {
        // Fallback to console if sheet logging fails
        console.error(`[${level}] ${message}`, details, `Sheet logging failed: ${e.message}`);
    }
}

// ============================================================================
// MAIN ROUTER
// ============================================================================
function doGet(e) {
    if (e.parameter.debug === 'true') {
        const serviceState = {
            service: 'GPSpedia-Utilities',
            version: '1.0.0',
            spreadsheetId: SPREADSHEET_ID,
            sheetsAccessed: [SHEET_NAMES.CORTES, SHEET_NAMES.USERS, SHEET_NAMES.LOGS]
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Utilities-SERVICE v1.0.0 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    let response;
    try {
        const request = JSON.parse(e.postData.contents);
        const { action, payload } = request;

        // Security Check: All actions in this service require developer privileges.
        if (!_isDeveloper(payload)) {
            throw new Error("Acceso denegado. Se requieren privilegios de desarrollador.");
        }

        switch (action) {
            case 'migrateYearRanges':
                response = migrateYearRanges();
                break;
            case 'migrateTimestamps':
                response = migrateTimestamps();
                break;
            default:
                throw new Error(`Acción desconocida: ${action}`);
        }
    } catch (error) {
        logToSheet('ERROR', `Utilities Service Error: ${error.message}`, { stack: error.stack });
        response = { status: 'error', message: error.message, details: { errorMessage: error.toString() } };
    }
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// AUTHENTICATION HELPER
// ============================================================================
/**
 * Checks if the user associated with the payload has developer privileges.
 * @param {object} payload The request payload containing userId and sessionToken.
 * @returns {boolean} True if the user is a validated developer, false otherwise.
 */
function _isDeveloper(payload) {
    try {
        const { userId, sessionToken } = payload;
        if (!userId || !sessionToken) {
            logToSheet('WARN', 'Auth check failed: Missing userId or sessionToken.');
            return false;
        }

        const userSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS);
        const data = userSheet.getDataRange().getValues();
        data.shift(); // Remove headers

        for (const row of data) {
            const currentUserId = row[COLS_USERS.ID - 1];
            const currentToken = row[COLS_USERS.SessionToken - 1];
            const currentRole = (row[COLS_USERS.Privilegios - 1] || '').toString().trim().toLowerCase();

            if (currentUserId == userId && currentToken === sessionToken) {
                if (currentRole === 'desarrollador') {
                    return true; // Valid session and correct role found.
                } else {
                    logToSheet('WARN', `Auth check failed: User ${userId} is not a developer.`);
                    return false; // Valid session, but not a developer.
                }
            }
        }
        logToSheet('WARN', `Auth check failed: No valid session found for user ${userId}.`);
        return false; // No matching user/session found.
    } catch (error) {
        logToSheet('ERROR', `Error in _isDeveloper: ${error.message}`);
        return false;
    }
}


// ============================================================================
// MIGRATION LOGIC
// ============================================================================

/**
 * Migrates year ranges from 'anoDesde' to 'anoDesde' and 'anoHasta'.
 */
function migrateYearRanges() {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.CORTES);
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    const values = range.getValues();
    let updatedCount = 0;

    const newValues = values.map(row => {
        let anoDesdeRaw = row[COLS_CORTES.anoDesde - 1];
        let anoHastaRaw = row[COLS_CORTES.anoHasta - 1];
        let hasChanged = false;

        if (typeof anoDesdeRaw === 'string' && anoDesdeRaw.includes('-')) {
            const parts = anoDesdeRaw.split('-').map(p => parseInt(p.trim(), 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                row[COLS_CORTES.anoDesde - 1] = Math.min(parts[0], parts[1]);
                row[COLS_CORTES.anoHasta - 1] = Math.max(parts[0], parts[1]);
                hasChanged = true;
            }
        } else if (!isNaN(parseInt(anoDesdeRaw)) && !anoHastaRaw) {
            row[COLS_CORTES.anoHasta - 1] = parseInt(anoDesdeRaw);
            hasChanged = true;
        }
        if(hasChanged) updatedCount++;
        return row;
    });

    if (updatedCount > 0) {
        range.setValues(newValues);
    }

    logToSheet('INFO', 'Migration "migrateYearRanges" completed.', { updatedRows: updatedCount });
    return { status: 'success', message: `Migración de años completada. ${updatedCount} registros actualizados.` };
}

function migrateTimestamps() {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.CORTES);
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    const values = range.getValues();
    let updatedCount = 0;

    const newValues = values.map((row, index) => {
        const imageUrl = row[COLS_CORTES.imagenVehiculo - 1];
        const currentTimestamp = row[COLS_CORTES.timestamp - 1];

        if (imageUrl && !currentTimestamp) {
            try {
                const fileIdMatch = imageUrl.match(/id=([a-zA-Z0-9_-]+)/);
                if (fileIdMatch && fileIdMatch[1]) {
                    const fileId = fileIdMatch[1];
                    const file = DriveApp.getFileById(fileId);
                    const creationDate = file.getDateCreated();
                    const formattedDate = Utilities.formatDate(creationDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
                    row[COLS_CORTES.timestamp - 1] = formattedDate;
                    updatedCount++;
                }
            } catch (e) {
                 logToSheet('WARN', `Could not process timestamp for row ${index + 2}`, { imageUrl: imageUrl, error: e.message });
            }
        }
        return row;
    });

    if (updatedCount > 0) {
        range.setValues(newValues);
    }

    logToSheet('INFO', 'Migration "migrateTimestamps" completed.', { updatedRows: updatedCount });
    return { status: 'success', message: `Migración de timestamps completada. ${updatedCount} registros actualizados.` };
}
