// ============================================================================
// GPSPEDIA-USERS SERVICE (COMPATIBLE WITH DB V2.0)
// ============================================================================
// COMPONENT VERSION: 2.3.0

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs"; // <-- ACTUALIZADO A DB V2.0
let spreadsheet = null;

function getSpreadsheet() {
  if (spreadsheet === null) {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return spreadsheet;
}

const SHEET_NAMES = {
    USERS: "Users"
};

// El mapa de columnas ya es compatible con el esquema v2.0
const COLS_USERS = {
    ID: 1,
    Nombre_Usuario: 2,
    Password: 3,
    Privilegios: 4,
    Telefono: 5,
    Correo_Electronico: 6,
    SessionToken: 7
};

// ============================================================================
// HELPERS DE AUTORIZACIÓN
// ============================================================================

function getRoleFromSession(sessionToken) {
    if (!sessionToken) {
        throw new Error("Se requiere un token de sesión para la autorización.");
    }

    const ss = getSpreadsheet();
    const activeSessionsSheet = ss.getSheetByName("ActiveSessions");
    const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);

    if (!activeSessionsSheet || !usersSheet) {
        throw new Error("No se encontraron las hojas de sesión o de usuarios.");
    }

    const sessionsData = activeSessionsSheet.getDataRange().getValues();
    const session = sessionsData.find(row => row[2] === sessionToken);

    if (!session) {
        throw new Error("Sesión inválida o expirada.");
    }

    const userId = session[0];
    const usersData = usersSheet.getDataRange().getValues();
    const user = usersData.find(row => row[COLS_USERS.ID - 1] == userId);

    if (!user) {
        throw new Error("No se encontró el usuario asociado a la sesión.");
    }

    return user[COLS_USERS.Privilegios - 1];
}


// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
    if (e.parameter.debug === 'true') {
        const serviceState = {
            service: 'GPSpedia-Users',
            version: '1.2.1',
            spreadsheetId: SPREADSHEET_ID,
            sheetsAccessed: [SHEET_NAMES.USERS]
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Users-SERVICE v1.2.1 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    let response;
    let request;
    try {
        request = JSON.parse(e.postData.contents);
        let result;

        switch (request.action) {
            case 'getUsers':
                result = handleGetUsers(request.payload);
                break;
            case 'createUser':
                result = handleCreateUser(request.payload);
                break;
            case 'updateUser':
                result = handleUpdateUser(request.payload);
                break;
            case 'deleteUser':
                result = handleDeleteUser(request.payload);
                break;
            case 'changePassword':
                result = handleChangePassword(request.payload);
                break;
            default:
                throw new Error(`Acción desconocida en Users Service: ${request.action}`);
        }
        response = result;
    } catch (error) {
        Logger.log(`Error CRÍTICO en Users-Service doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error inesperado en el servicio de usuarios.',
            details: {
                errorMessage: error.message,
                errorStack: error.stack,
                requestAction: (request && request.action) ? request.action : 'N/A'
            }
        };
    }
    // FIX TAREA 12 (Observado durante auditoría): Usar MimeType.TEXT para compatibilidad con CORS
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================

function handleGetUsers(payload) {
    const { privilegios } = payload;
    if (!privilegios) throw new Error("Se requiere el rol del solicitante.");

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();
    data.shift(); // Remove headers

    const allUsers = data.map(row => {
        // Mapeo manual usando el COLS fijo
        return {
            ID: row[COLS_USERS.ID - 1],
            Nombre_Usuario: row[COLS_USERS.Nombre_Usuario - 1],
            Privilegios: row[COLS_USERS.Privilegios - 1],
            Telefono: row[COLS_USERS.Telefono - 1],
            Correo_Electronico: row[COLS_USERS.Correo_Electronico - 1]
        };
    });

    const visibleUsers = allUsers.filter(user => {
        switch (privilegios) {
            case 'Desarrollador': return true;
            case 'Gefe': return !['Desarrollador', 'Tecnico_Exterior'].includes(user.privilegios);
            case 'Supervisor': return user.privilegios === 'Tecnico';
            default: return false;
        }
    });

    return { status: 'success', users: visibleUsers };
}

function handleCreateUser(payload) {
    const { newUser, sessionToken } = payload;
    if (!newUser || !sessionToken) throw new Error("Datos insuficientes para crear el usuario. Se requiere sessionToken.");

    const creatorRole = getRoleFromSession(sessionToken); // <-- REFACTOR DE SEGURIDAD
    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);

    const allowedRoles = {
        'Desarrollador': ['Desarrollador', 'Gefe', 'Supervisor', 'Tecnico', 'Tecnico_Exterior'],
        'Gefe': ['Gefe', 'Supervisor', 'Tecnico'],
        'Supervisor': ['Tecnico']
    };
    if (!allowedRoles[creatorRole] || !allowedRoles[creatorRole].includes(newUser.Privilegios)) {
        throw new Error(`El rol '${creatorRole}' no tiene permisos para crear usuarios de tipo '${newUser.Privilegios}'.`);
    }

    if (!newUser.Nombre_Usuario) {
        newUser.Nombre_Usuario = generateUniqueUsername(userSheet, newUser.Nombre);
    }

    const usernames = userSheet.getRange(2, COLS_USERS.Nombre_Usuario, userSheet.getLastRow() - 1, 1).getValues().flat();
    if (usernames.map(u => u.toLowerCase()).includes(newUser.Nombre_Usuario.toLowerCase())) {
        throw new Error(`El nombre de usuario '${newUser.Nombre_Usuario}' ya existe.`);
    }

    const newRow = [];
    newRow[COLS_USERS.ID - 1] = ''; // ID se autogenera
    newRow[COLS_USERS.Nombre_Usuario - 1] = newUser.Nombre_Usuario;
    newRow[COLS_USERS.Password - 1] = newUser.Password || '12345678';
    newRow[COLS_USERS.Privilegios - 1] = newUser.Privilegios;
    newRow[COLS_USERS.Telefono - 1] = newUser.Telefono || '';
    newRow[COLS_USERS.Correo_Electronico - 1] = newUser.Correo_Electronico || '';
    newRow[COLS_USERS.SessionToken - 1] = '';

    userSheet.appendRow(newRow);

    return { status: 'success', message: `Usuario '${newUser.nombreUsuario}' creado exitosamente.` };
}

function handleUpdateUser(payload) {
    const { userId, updates, sessionToken } = payload;
    if (!userId || !updates || !sessionToken) throw new Error("Datos insuficientes para actualizar. Se requiere sessionToken.");

    const updaterRole = getRoleFromSession(sessionToken); // <-- REFACTOR DE SEGURIDAD
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
                const colIndex = COLS_USERS[key]; // Usar el mapa fijo
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

    const deleterRole = getRoleFromSession(sessionToken); // <-- REFACTOR DE SEGURIDAD
    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const lastRow = userSheet.getLastRow();
    if (lastRow < 2) return { status: 'success', message: 'No hay usuarios para eliminar.' }; // Hoja vacía
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
    const { userId, currentPassword, newPassword } = payload;
    if(!userId || !currentPassword || !newPassword) throw new Error("Faltan datos para el cambio de contraseña.");

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();
    data.shift();

    for (let i = 0; i < data.length; i++) {
        if (data[i][COLS_USERS.ID - 1] == userId) {
            if (String(data[i][COLS_USERS.Password - 1]) === String(currentPassword)) {
                userSheet.getRange(i + 2, COLS_USERS.Password).setValue(newPassword);
                return { status: 'success', message: 'Contraseña actualizada.' };
            } else {
                throw new Error("La contraseña actual es incorrecta.");
            }
        }
    }
    throw new Error("Usuario no encontrado.");
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function generateUniqueUsername(sheet, fullname) {
    if (!fullname || typeof fullname !== 'string') return '';
    const parts = fullname.trim().toLowerCase().split(' ');
    if (parts.length < 2) return '';

    const nombre = parts[0];
    const primerApellido = parts.find((p, i) => i > 0 && p.length > 2);
    if (!primerApellido) return `${nombre}${Math.floor(Math.random() * 100)}`; // Fallback

    const segundoApellido = parts.find((p, i) => i > 1 && p !== primerApellido && p.length > 2);

    const potentialUsernames = [
        `${nombre.charAt(0)}_${primerApellido}`,
        parts.length > 2 && parts[1] !== primerApellido ? `${parts[1].charAt(0)}_${primerApellido}` : null,
        segundoApellido ? `${nombre.charAt(0)}_${segundoApellido}` : null
    ].filter(Boolean);

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return potentialUsernames[0] || `${nombre.charAt(0)}_${primerApellido}1`; // Hoja vacía, devolver primer username
    const data = sheet.getRange(2, COLS_USERS.Nombre_Usuario, lastRow - 1, 1).getValues().flat();

    for(const username of potentialUsernames) {
        if (!data.includes(username)) {
            return username;
        }
    }
    return `${nombre.charAt(0)}_${primerApellido}${Math.floor(Math.random() * 100)}`;
}
