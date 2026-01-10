// ============================================================================
// GPSPEDIA-USERS SERVICE (COMPATIBLE WITH DB V2.0)
// ============================================================================
// COMPONENT VERSION: 2.4.1

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
    ACTIVE_SESSIONS: "ActiveSessions"
};

const COLS_USERS = {
    ID: 1,
    Nombre_Usuario: 2,
    Password: 3,
    Privilegios: 4,
    Telefono: 5,
    Correo_Electronico: 6,
    Nombre_Completo: 7,
    SessionToken: 8
};

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
    const defaultResponse = { status: 'success', message: 'GPSpedia Users-SERVICE v2.4.1 is active.' };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
    let response;
    try {
        const request = JSON.parse(e.postData.contents);
        switch (request.action) {
            case 'getUsers':
                response = handleGetUsers(request.payload);
                break;
            case 'createUser':
                response = handleCreateUser(request.payload);
                break;
            case 'updateUser':
                response = handleUpdateUser(request.payload);
                break;
            case 'deleteUser':
                response = handleDeleteUser(request.payload);
                break;
            case 'changePassword':
                response = handleChangePassword(request.payload);
                break;
            default:
                throw new Error(`La acción '${request.action}' es desconocida.`);
        }
    } catch (error) {
        response = { status: 'error', message: 'Ocurrió un error en el servicio.', details: { errorMessage: error.message } };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================================
// VERIFICACIÓN DE ROL
// ============================================================================

function getVerifiedRole(sessionToken) {
    if (!sessionToken) {
        throw new Error("Acceso no autorizado: Se requiere token de sesión.");
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

    for (const row of usersData) {
        if (row[COLS_USERS.ID - 1] == userId) {
            return row[COLS_USERS.Privilegios - 1];
        }
    }

    throw new Error("Acceso no autorizado: Usuario asociado a la sesión no encontrado.");
}

// ============================================================================
// MANEJADORES DE ACCIONES
// ============================================================================

function handleGetUsers(payload) {
    const { privilegios } = payload;
    if (!privilegios) throw new Error("Se requiere el rol del solicitante.");

    if (privilegios !== 'Desarrollador' && privilegios !== 'Gefe' && privilegios !== 'Supervisor') {
        throw new Error('Acceso denegado. Permisos insuficientes.');
    }

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();
    const headers = data.shift();
    const users = data.map(row => {
        // FIX: Construir manualmente el objeto para asegurar que 'ID' sea mayúscula.
        return {
            ID: row[COLS_USERS.ID - 1],
            Nombre_Usuario: row[COLS_USERS.Nombre_Usuario - 1],
            Privilegios: row[COLS_USERS.Privilegios - 1],
            Telefono: row[COLS_USERS.Telefono - 1],
            Correo_Electronico: row[COLS_USERS.Correo_Electronico - 1],
            Nombre_Completo: row[COLS_USERS.Nombre_Completo - 1]
        };
    });

    return { status: 'success', users: users };
}

function handleCreateUser(payload) {
    const { newUser, sessionToken } = payload;
    if (!newUser || !sessionToken) throw new Error("Datos insuficientes para crear el usuario. Se requiere sessionToken.");

    const creatorRole = getVerifiedRole(sessionToken);
    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);

    const allowedRoles = {
        'Desarrollador': ['Desarrollador', 'Gefe', 'Supervisor', 'Tecnico', 'Tecnico_Exterior'],
        'Gefe': ['Gefe', 'Supervisor', 'Tecnico'],
        'Supervisor': ['Tecnico']
    };
    if (!allowedRoles[creatorRole] || !allowedRoles[creatorRole].includes(newUser.Privilegios)) {
        throw new Error(`El rol '${creatorRole}' no tiene permisos para crear usuarios de tipo '${newUser.Privilegios}'.`);
    }

    const newUsername = generateUniqueUsername(userSheet, newUser.Nombre_Usuario);
    const lastRow = userSheet.getLastRow();
    const newRowRange = userSheet.getRange(lastRow + 1, 1, 1, userSheet.getLastColumn());

    if (lastRow > 0) {
        userSheet.getRange(lastRow, 1, 1, userSheet.getLastColumn()).copyTo(newRowRange, { contentsOnly: false });
    }
    newRowRange.clearContent();

    const newRowData = new Array(userSheet.getLastColumn()).fill('');
    newRowData[COLS_USERS.Nombre_Usuario - 1] = newUsername;
    newRowData[COLS_USERS.Password - 1] = newUser.Password;
    newRowData[COLS_USERS.Privilegios - 1] = newUser.Privilegios;
    newRowData[COLS_USERS.Telefono - 1] = newUser.Telefono || '';
    newRowData[COLS_USERS.Correo_Electronico - 1] = newUser.Correo_Electronico || '';
    newRowRange.setValues([newRowData]);

    return { status: 'success', message: `Usuario '${newUsername}' creado.` };
}

function handleUpdateUser(payload) {
    const { userId, updates, sessionToken } = payload;
    if (!userId || !updates || !sessionToken) throw new Error("Datos insuficientes para actualizar. Se requiere sessionToken.");

    const updaterRole = getVerifiedRole(sessionToken);
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
                    if (key === 'password' && !updates.password) return; // No actualizar contraseña si está vacía
                    userSheet.getRange(i + 2, colIndex).setValue(updates[key]);
                }
            });

            return { status: 'success', message: 'Usuario actualizado.' };
        }
    }
    throw new Error("Usuario no encontrado para actualizar.");
}

function handleDeleteUser(payload) {
    const { userId, sessionToken } = payload;
    if (!userId || !sessionToken) throw new Error("Datos insuficientes para eliminar. Se requiere sessionToken.");

    const deleterRole = getVerifiedRole(sessionToken);
    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getRange(2, 1, userSheet.getLastRow() - 1, COLS_USERS.Privilegios).getValues();

    for (let i = 0; i < data.length; i++) {
        if (data[i][COLS_USERS.ID - 1] == userId) {
            const userToDeleteRole = data[i][COLS_USERS.Privilegios - 1];
            const canDelete = {
                 'Desarrollador': () => true,
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
    const { userId, currentPassword, newPassword } = payload;
    if (!userId || !currentPassword || !newPassword) {
        throw new Error("Datos insuficientes para cambiar la contraseña.");
    }

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();
    data.shift();

    for (let i = 0; i < data.length; i++) {
        if (data[i][COLS_USERS.ID - 1] == userId) {
            const storedPassword = String(data[i][COLS_USERS.Password - 1]);
            if (storedPassword.toLowerCase() !== currentPassword.toLowerCase()) {
                throw new Error("La contraseña actual es incorrecta.");
            }
            userSheet.getRange(i + 2, COLS_USERS.Password).setValue(newPassword);
            return { status: 'success', message: 'Contraseña actualizada correctamente.' };
        }
    }
    throw new Error("Usuario no encontrado.");
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function generateUniqueUsername(sheet, fullname) {
    let username = String(fullname).trim().toLowerCase().replace(/\s+/g, '.');
    let finalUsername = username;
    let counter = 1;
    const usernames = sheet.getRange(2, COLS_USERS.Nombre_Usuario, sheet.getLastRow() -1, 1).getValues().flat();

    while (usernames.includes(finalUsername)) {
        finalUsername = `${username}${counter}`;
        counter++;
    }
    return finalUsername;
}
