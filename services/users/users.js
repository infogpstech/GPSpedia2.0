// ============================================================================
// GPSPEDIA-USERS SERVICE | Version: 1.1.0
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
    USERS: "Users"
};

// --- MAPEO DE COLUMNAS ESTÁTICO ---
// Refactorización para eliminar el mapeo dinámico y aumentar la robustez.
const COLS_USERS = {
    id: 1,
    nombreUsuario: 2,
    password: 3,
    privilegios: 4,
    nombre: 5,
    telefono: 6,
    correoElectronico: 7,
    sessionToken: 8
};


// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
  try {
    const response = {
      status: 'success',
      message: 'GPSpedia USERS-SERVICE v1.1.0 is active.'
    };
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorResponse = {
        status: 'error',
        message: 'Error en el servidor (doGet).',
        details: { message: error.message }
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
        request = JSON.parse(e.postData.contents);

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
                throw new Error(`Acción desconocida en Users Service: ${request.action}`);
        }
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
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================

function handleGetUsers(payload) {
    const { privilegios } = payload;
    if (!privilegios) throw new Error("Se requiere el rol del solicitante.");

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();
    data.shift(); // remove headers

    const headers = Object.keys(COLS_USERS);

    const allUsers = data.map(row => {
        const user = {};
        headers.forEach((h, i) => { if (h !== 'password' && h !== 'sessionToken') user[h] = row[i]; });
        return user;
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
    const { newUser, creatorRole } = payload;
    if (!newUser || !creatorRole) throw new Error("Datos insuficientes para crear el usuario.");

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);

    const allowedRoles = {
        'Desarrollador': ['Desarrollador', 'Gefe', 'Supervisor', 'Tecnico', 'Tecnico_Exterior'],
        'Gefe': ['Gefe', 'Supervisor', 'Tecnico'],
        'Supervisor': ['Tecnico']
    };
    if (!allowedRoles[creatorRole] || !allowedRoles[creatorRole].includes(newUser.privilegios)) {
        throw new Error(`El rol '${creatorRole}' no tiene permisos para crear usuarios de tipo '${newUser.privilegios}'.`);
    }

    if (!newUser.nombreUsuario) {
        newUser.nombreUsuario = generateUniqueUsername(userSheet, newUser.nombre);
    }

    const usernames = userSheet.getRange(2, COLS_USERS.nombreUsuario, userSheet.getLastRow() - 1, 1).getValues().flat();
    if (usernames.includes(newUser.nombreUsuario)) {
        throw new Error(`El nombre de usuario '${newUser.nombreUsuario}' ya existe.`);
    }

    const newRow = [
        '', // ID
        newUser.nombreUsuario,
        newUser.password || '12345678',
        newUser.privilegios,
        newUser.nombre,
        newUser.telefono || '',
        newUser.correoElectronico || '',
        '' // SessionToken
    ];
    userSheet.appendRow(newRow);

    return { status: 'success', message: `Usuario '${newUser.nombreUsuario}' creado exitosamente.` };
}

function handleUpdateUser(payload) {
    const { userId, updates, updaterRole } = payload;
    if (!userId || !updates || !updaterRole) throw new Error("Datos insuficientes para actualizar.");

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();
    data.shift();

    for (let i = 0; i < data.length; i++) {
        if (data[i][COLS_USERS.id - 1] == userId) {
            const userToUpdateRole = data[i][COLS_USERS.privilegios - 1];

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
    const { userId, deleterRole } = payload;
    if (!userId || !deleterRole) throw new Error("Datos insuficientes para eliminar.");

    const userSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getRange(2, 1, userSheet.getLastRow() - 1, COLS_USERS.privilegios).getValues();

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row[COLS_USERS.id - 1] == userId) {
            const userToDeleteRole = row[COLS_USERS.privilegios - 1];

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
    const data = userSheet.getRange(2, 1, userSheet.getLastRow() - 1, Math.max(COLS_USERS.id, COLS_USERS.password)).getValues();

    for (let i = 0; i < data.length; i++) {
        if (data[i][COLS_USERS.id - 1] == userId) {
            if (data[i][COLS_USERS.password - 1] === currentPassword) {
                userSheet.getRange(i + 2, COLS_USERS.password).setValue(newPassword);
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
    const segundoApellido = parts.find((p, i) => i > 1 && p !== primerApellido && p.length > 2);

    const potentialUsernames = [
        `${nombre.charAt(0)}_${primerApellido}`,
        parts.length > 2 ? `${parts[1].charAt(0)}_${primerApellido}` : null,
        segundoApellido ? `${nombre.charAt(0)}_${segundoApellido}` : null
    ].filter(Boolean);

    const data = sheet.getRange(2, COLS_USERS.nombreUsuario, sheet.getLastRow() -1, 1).getValues().flat();

    for(const username of potentialUsernames) {
        if (!data.includes(username)) {
            return username;
        }
    }

    return `${nombre.charAt(0)}_${primerApellido}${Math.floor(Math.random() * 100)}`;
}
