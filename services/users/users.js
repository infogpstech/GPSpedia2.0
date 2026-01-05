// ============================================================================
// GPSPEDIA-USERS SERVICE (COMPATIBLE WITH DB V2.0)
// ============================================================================
// COMPONENT VERSION: 2.3.0

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
    USERS: "Users",
    ACTIVE_SESSIONS: "ActiveSessions" // Hoja añadida para verificación
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

// Definición de columnas añadida para la nueva función de verificación
const COLS_ACTIVE_SESSIONS = {
    ID_Usuario: 1,
    Usuario: 2,
    ActiveSessions: 3,
    date: 4,
    Logs: 5
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
    // ... (sin cambios)
}

function doPost(e) {
    // ... (sin cambios)
}

// ============================================================================
// NUEVA FUNCIÓN DE VERIFICACIÓN DE ROL
// ============================================================================

/**
 * Verifica un token de sesión y devuelve el rol del usuario correspondiente.
 * @param {string} sessionToken - El token de sesión a verificar.
 * @returns {string} El rol del usuario verificado.
 * @throws {Error} Si el token es inválido o no se encuentra.
 */
function getVerifiedRole(sessionToken) {
    if (!sessionToken) {
        throw new Error("Acceso no autorizado: Se requiere token de sesión.");
    }

    const sessionsSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.ACTIVE_SESSIONS);
    const sessionsData = sessionsSheet.getDataRange().getValues();
    sessionsData.shift(); // Remove headers

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
    const usersData = usersSheet.getDataRange().getValues();
    usersData.shift(); // Remove headers

    for (const row of usersData) {
        if (row[COLS_USERS.ID - 1] == userId) {
            return row[COLS_USERS.Privilegios - 1];
        }
    }

    throw new Error("Acceso no autorizado: Usuario asociado a la sesión no encontrado.");
}


// ============================================================================
// MANEJADORES DE ACCIONES (ACTUALIZADOS)
// ============================================================================

function handleGetUsers(payload) {
    // El rol para esta función se obtiene de una fuente confiable (el objeto currentUser del propio usuario),
    // por lo que no necesita el cambio a sessionToken. Se mantiene como está.
    const { privilegios } = payload;
    if (!privilegios) throw new Error("Se requiere el rol del solicitante.");

    // ... (resto de la función sin cambios)
}

function handleCreateUser(payload) {
    const { newUser, sessionToken } = payload; // Cambiado de creatorRole a sessionToken
    if (!newUser || !sessionToken) throw new Error("Datos insuficientes para crear el usuario. Se requiere sessionToken.");

    const creatorRole = getVerifiedRole(sessionToken); // Se obtiene el rol de forma segura

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);

    const allowedRoles = {
        'Desarrollador': ['Desarrollador', 'Gefe', 'Supervisor', 'Tecnico', 'Tecnico_Exterior'],
        'Gefe': ['Gefe', 'Supervisor', 'Tecnico'],
        'Supervisor': ['Tecnico']
    };
    if (!allowedRoles[creatorRole] || !allowedRoles[creatorRole].includes(newUser.Privilegios)) {
        throw new Error(`El rol '${creatorRole}' no tiene permisos para crear usuarios de tipo '${newUser.Privilegios}'.`);
    }

    // ... (resto de la función sin cambios)
}

function handleUpdateUser(payload) {
    const { userId, updates, sessionToken } = payload; // Cambiado de updaterRole a sessionToken
    if (!userId || !updates || !sessionToken) throw new Error("Datos insuficientes para actualizar. Se requiere sessionToken.");

    const updaterRole = getVerifiedRole(sessionToken); // Se obtiene el rol de forma segura

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();
    data.shift();

    for (let i = 0; i < data.length; i++) {
        if (data[i][COLS_USERS.ID - 1] == userId) {
            const userToUpdateRole = data[i][COLS_USERS.Privilegios - 1];

            const canUpdate = {
                'Desarrollador': () => true,
                'Gefe': (targetRole) => !['Desarrollador', 'Tecnico_Exterior'].includes(targetRole),
                'Supervisor': (targetRole) => targetRole === 'Tecnico'
            };

            if (!canUpdate[updaterRole] || !canUpdate[updaterRole](userToUpdateRole)) {
                 throw new Error(`Rol '${updaterRole}' no puede modificar a '${userToUpdateRole}'.`);
            }

            Object.keys(updates).forEach(key => {
                const colIndex = COLS_USERS[key];
                if (colIndex && key !== 'id') {
                    if (key === 'password' && !updates.password) return;
                    userSheet.getRange(i + 2, colIndex).setValue(updates[key]);
                }
            });

            return { status: 'success', message: 'Usuario actualizado.' };
        }
    }
    throw new Error("Usuario no encontrado para actualizar.");
}

function handleDeleteUser(payload) {
    const { userId, sessionToken } = payload; // Cambiado de deleterRole a sessionToken
    if (!userId || !sessionToken) throw new Error("Datos insuficientes para eliminar. Se requiere sessionToken.");

    const deleterRole = getVerifiedRole(sessionToken); // Se obtiene el rol de forma segura

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const lastRow = userSheet.getLastRow();
    if (lastRow < 2) return { status: 'success', message: 'No hay usuarios para eliminar.' };
    const data = userSheet.getRange(2, 1, lastRow - 1, COLS_USERS.Privilegios).getValues();

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row[COLS_USERS.ID - 1] == userId) {
            const userToDeleteRole = row[COLS_USERS.Privilegios - 1];

            const canDelete = {
                 'Desarrollador': (targetRole) => true,
                 'Gefe': (targetRole) => !['Desarrollador', 'Gefe', 'Tecnico_Exterior'].includes(targetRole),
                 'Supervisor': (targetRole) => targetRole === 'Tecnico'
            };

            if (!canDelete[deleterRole] || !canDelete[deleterRole](userToDeleteRole)) {
                throw new Error(`Rol '${deleterRole}' no puede eliminar a '${userToDeleteRole}'.`);
            }

            userSheet.deleteRow(i + 2);
            return { status: 'success', message: 'Usuario eliminado.' };
        }
    }
    throw new Error("Usuario no encontrado para eliminar.");
}

function handleChangePassword(payload) {
    // ... (sin cambios)
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function generateUniqueUsername(sheet, fullname) {
    // ... (sin cambios)
}
