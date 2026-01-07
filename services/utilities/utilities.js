// ============================================================================
// GPSPEDIA-UTILITIES SERVICE (COMPATIBLE WITH DB V2.0)
// ============================================================================
// COMPONENT VERSION: 1.0.0

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs";
let spreadsheet = null;

function getSpreadsheet() {
  if (spreadsheet === null) {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return spreadsheet;
}

const SHEET_NAMES = {
    CORTES: "Cortes",
    USERS: "Users"
};

const COLS_CORTES = {
    anoDesde: 6,
    anoHasta: 7,
    imagenVehiculo: 9,
    timestamp: 37
};

const COLS_USERS = {
    ID: 1,
    Privilegios: 4
};


// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) {
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Utilities-SERVICE v1.0.0 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
    let response;
    try {
        const request = JSON.parse(e.postData.contents);
        const { action, payload, session } = request;

        // Authorize the user
        authorize(session.sessionToken, ['Desarrollador']);

        let result;
        switch (action) {
            case 'getImageCreationDateFromUrl':
                if (!payload || !payload.url) {
                    throw new Error("La URL es requerida en el payload para esta acción.");
                }
                const date = getImageCreationDate(payload.url);
                result = { status: 'success', creationDate: date };
                break;
            default:
                throw new Error(`Acción desconocida en Utilities Service: ${action}`);
        }
        response = result;
    } catch (error) {
        response = {
            status: 'error',
            message: 'Ocurrió un error en el servicio de utilidades.',
            details: { errorMessage: error.message }
        };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================================
// LÓGICA DE AUTORIZACIÓN
// ============================================================================
function authorize(sessionToken, requiredRoles) {
    if (!sessionToken) {
        throw new Error("Autenticación requerida. Token de sesión no proporcionado.");
    }

    const sessionsSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.ACTIVE_SESSIONS);
    if (!sessionsSheet) throw new Error("Hoja de sesiones no encontrada.");
    const sessionsData = sessionsSheet.getDataRange().getValues();
    sessionsData.shift();

    let userId = null;
    for (const row of sessionsData) {
        if (row[COLS_ACTIVE_SESSIONS.ActiveSessions - 1] === sessionToken) {
            userId = row[COLS_ACTIVE_SESSIONS.ID_Usuario - 1];
            break;
        }
    }

    if (!userId) {
        throw new Error("Acceso no autorizado: Sesión inválida o expirada.");
    }

    const usersSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    if (!usersSheet) throw new Error("Hoja de usuarios no encontrada.");
    const usersData = usersSheet.getDataRange().getValues();
    usersData.shift();

    const userRow = usersData.find(row => row[COLS_USERS.ID - 1] == userId);

    if (!userRow) {
        throw new Error("Usuario asociado a la sesión no encontrado.");
    }

    const userRole = userRow[COLS_USERS.Privilegios - 1];
    if (!requiredRoles.includes(userRole)) {
        throw new Error("No tienes permisos para realizar esta acción.");
    }
}


// ============================================================================
// FUNCIONES AUXILIARES (HELPERS)
// ============================================================================

/**
 * Extrae el ID de una URL de Google Drive, obtiene el archivo y devuelve su fecha de creación.
 * @param {string} url La URL de Google Drive.
 * @returns {string} La fecha de creación del archivo en formato ISO string.
 * @throws {Error} Si la URL es inválida, no se puede extraer el ID o hay un error al acceder al archivo.
 */
function getImageCreationDate(url) {
    if (!url || typeof url !== 'string') {
        throw new Error("URL inválida o no proporcionada.");
    }

    const idMatch = url.match(/file\/d\/([a-zA-Z0-9_-]+)|id=([a-zA-Z0-9_-]+)|\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) {
        throw new Error("No se pudo extraer el ID del archivo de la URL proporcionada.");
    }

    const fileId = idMatch[1] || idMatch[2] || idMatch[3];

    try {
        const file = DriveApp.getFileById(fileId);
        const dateCreated = file.getDateCreated();
        return dateCreated.toISOString(); // Devolver en formato estándar para consistencia
    } catch (e) {
        // Captura errores comunes como "archivo no encontrado" o problemas de permisos.
        throw new Error(`Error al acceder al archivo de Drive con ID '${fileId}': ${e.message}`);
    }
}


// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================
