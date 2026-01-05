/**
 * @file services/users/users.js
 * @version 2.2.0
 * @author Cadete
 * @copyright 2024 Cadete
 * @license MIT
 * @description Microservicio para la gestión de usuarios de GPSpedia. Proporciona funcionalidades para crear, leer, actualizar y eliminar usuarios, así como para gestionar sus sesiones y permisos.
 */

// Constantes y Configuración Global
const SPREADSHEET_ID = '1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs';
const SS = SpreadsheetApp.openById(SPREADSHEET_ID);
const SHEET_USERS = SS.getSheetByName('Users');
const SHEET_ACTIVE_SESSIONS = SS.getSheetByName('ActiveSessions');

// Mapeo de columnas para la hoja 'Users'
const COLS_USERS = {
    ID: 0,
    NOMBRE_USUARIO: 1,
    NOMBRE_COMPLETO: 2,
    CONTRASENA: 3,
    ROL: 4,
    SESSION_TOKEN: 5,
    LAST_LOGIN: 6
};

// Jerarquía de roles para validación de permisos
const ROLE_HIERARCHY = {
    'Desarrollador': 4,
    'Gefe': 3,
    'Supervisor': 2,
    'Tecnico': 1,
    'Tecnico_Exterior': 1,
    'Usuario': 0
};

/**
 * @function getVerifiedUser
 * @description Valida un token de sesión y devuelve el objeto de usuario verificado.
 * @param {string} sessionToken - El token de sesión a validar.
 * @returns {object|null} El objeto de usuario verificado con { ID, Nombre_Usuario, Rol } o null si el token es inválido.
 */
function getVerifiedUser(sessionToken) {
    if (!sessionToken) return null;
    try {
        const sessionsData = SHEET_ACTIVE_SESSIONS.getDataRange().getValues();
        const sessionRow = sessionsData.find(row => row[2] === sessionToken);
        if (!sessionRow) return null;

        const usersData = SHEET_USERS.getDataRange().getValues();
        const userRow = usersData.find(row => row[COLS_USERS.ID] === sessionRow[0]);

        if (!userRow) return null;

        return {
            ID: userRow[COLS_USERS.ID],
            Nombre_Usuario: userRow[COLS_USERS.NOMBRE_USUARIO],
            Nombre_Completo: userRow[COLS_USERS.NOMBRE_COMPLETO],
            Rol: userRow[COLS_USERS.ROL]
        };
    } catch (e) {
        return null;
    }
}

/**
 * @function doGet
 * @description Responde a las solicitudes GET para verificar la disponibilidad del servicio.
 * @param {object} e - El objeto de evento de la solicitud GET.
 * @returns {ContentService.TextOutput} Respuesta JSON con el estado del servicio.
 */
function doGet(e) {
    const response = {
        service: 'GPSpedia-Users',
        componentVersion: '2.2.0',
        status: 'ok',
        timestamp: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * @function doPost
 * @description Punto de entrada para todas las solicitudes POST. Enruta la acción a la función correspondiente.
 * @param {object} e - El objeto de evento de la solicitud POST.
 * @returns {ContentService.TextOutput} La respuesta de la función manejadora.
 */
function doPost(e) {
    let response;
    try {
        const payload = JSON.parse(e.postData.contents);
        const action = payload.action;
        const requester = getVerifiedUser(payload.sessionToken);

        if (!requester) {
            return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sesión inválida o expirada.' }))
                .setMimeType(ContentService.MimeType.TEXT);
        }

        switch (action) {
            case 'getUsers':
                response = handleGetUsers(requester);
                break;
            case 'createUser':
                response = handleCreateUser(requester, payload.newUser);
                break;
            case 'updateUser':
                response = handleUpdateUser(requester, payload.updatedUser);
                break;
            case 'deleteUser':
                response = handleDeleteUser(requester, payload.userId);
                break;
            case 'changePassword':
                response = handleChangePassword(requester, payload);
                break;
            default:
                response = { status: 'error', message: 'Acción desconocida' };
        }
    } catch (error) {
        response = { status: 'error', message: 'Error en el servidor: ' + error.message, details: error.stack };
    }

    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * @function handleGetUsers
 * @description Obtiene la lista de usuarios si el solicitante tiene permisos.
 * @param {object} requester - El objeto de usuario verificado que realiza la solicitud.
 * @returns {object} Un objeto con el estado y la lista de usuarios.
 */
function handleGetUsers(requester) {
    if (ROLE_HIERARCHY[requester.Rol] < ROLE_HIERARCHY['Supervisor']) {
        return { status: 'error', message: 'No tienes permisos para ver la lista de usuarios.' };
    }
    const data = SHEET_USERS.getDataRange().getValues();
    const headers = data.shift();
    const users = data.map(row => {
        let user = {};
        headers.forEach((header, index) => {
            user[header] = row[index];
        });
        delete user.Contrasena; // Nunca enviar contraseñas al cliente
        return user;
    });
    return { status: 'success', users: users };
}

/**
 * @function handleCreateUser
 * @description Crea un nuevo usuario validando la jerarquía de roles.
 * @param {object} requester - El usuario verificado que crea el nuevo usuario.
 * @param {object} newUser - El objeto con los datos del nuevo usuario.
 * @returns {object} Un objeto con el estado de la operación.
 */
function handleCreateUser(requester, newUser) {
    if (!newUser || !newUser.Nombre_Usuario || !newUser.Contrasena || !newUser.Rol) {
        return { status: 'error', message: 'Faltan datos requeridos.' };
    }
    // Un usuario solo puede crear otros usuarios con un rol inferior al suyo.
    if (ROLE_HIERARCHY[requester.Rol] <= ROLE_HIERARCHY[newUser.Rol]) {
        return { status: 'error', message: 'No tienes permisos para crear un usuario con este rol.' };
    }
    SHEET_USERS.appendRow(['', newUser.Nombre_Usuario, newUser.Nombre_Completo || '', newUser.Contrasena, newUser.Rol, '', '']);
    return { status: 'success', message: 'Usuario creado correctamente.' };
}

/**
 * @function handleUpdateUser
 * @description Actualiza un usuario existente validando la jerarquía de roles.
 * @param {object} requester - El usuario verificado que actualiza.
 * @param {object} updatedUser - Los datos del usuario a actualizar.
 * @returns {object} Un objeto con el estado de la operación.
 */
function handleUpdateUser(requester, updatedUser) {
    if (!updatedUser || !updatedUser.ID) {
        return { status: 'error', message: 'Se requiere el ID del usuario para actualizarlo.' };
    }

    const data = SHEET_USERS.getDataRange().getValues();
    const userToUpdateRowIndex = data.findIndex(row => row[COLS_USERS.ID] == updatedUser.ID);

    if (userToUpdateRowIndex === -1) {
        return { status: 'error', message: 'Usuario no encontrado.' };
    }

    const userToUpdateRole = data[userToUpdateRowIndex][COLS_USERS.ROL];

    // Un usuario no puede modificar a otro con un rol igual o superior.
    if (ROLE_HIERARCHY[requester.Rol] <= ROLE_HIERARCHY[userToUpdateRole]) {
        return { status: 'error', message: 'No tienes permisos para modificar a este usuario.' };
    }
    // Y no puede asignar un rol igual o superior al suyo.
    if (updatedUser.Rol && ROLE_HIERARCHY[requester.Rol] <= ROLE_HIERARCHY[updatedUser.Rol]) {
        return { status: 'error', message: 'No puedes asignar un rol igual o superior al tuyo.' };
    }

    const sheetRowIndex = userToUpdateRowIndex + 1; // +1 porque el array es 0-indexed, y las filas de la hoja son 1-indexed.
    SHEET_USERS.getRange(sheetRowIndex, COLS_USERS.NOMBRE_COMPLETO + 1).setValue(updatedUser.Nombre_Completo);
    SHEET_USERS.getRange(sheetRowIndex, COLS_USERS.ROL + 1).setValue(updatedUser.Rol);

    return { status: 'success', message: 'Usuario actualizado correctamente.' };
}

/**
 * @function handleDeleteUser
 * @description Elimina un usuario validando la jerarquía de roles.
 * @param {object} requester - El usuario verificado que elimina.
 * @param {string} userIdToDelete - El ID del usuario a eliminar.
 * @returns {object} Un objeto con el estado de la operación.
 */
function handleDeleteUser(requester, userIdToDelete) {
    const data = SHEET_USERS.getDataRange().getValues();
    const userToDeleteRowIndex = data.findIndex(row => row[COLS_USERS.ID] == userIdToDelete);

    if (userToDeleteRowIndex === -1) {
        return { status: 'error', message: 'Usuario no encontrado.' };
    }
    const userToDeleteRole = data[userToDeleteRowIndex][COLS_USERS.ROL];

    // Un usuario no puede eliminar a otro con un rol igual o superior.
    if (ROLE_HIERARCHY[requester.Rol] <= ROLE_HIERARCHY[userToDeleteRole]) {
        return { status: 'error', message: 'No tienes permisos para eliminar a este usuario.' };
    }

    // +1 porque findIndex es sobre el array de datos (sin header), y deleteRow es 1-indexed sobre la hoja.
    SHEET_USERS.deleteRow(userToDeleteRowIndex + 1);

    return { status: 'success', message: 'Usuario eliminado correctamente.' };
}

/**
 * @function handleChangePassword
 * @description Permite a un usuario cambiar su propia contraseña.
 * @param {object} requester - El usuario verificado.
 * @param {object} payload - El payload con las contraseñas.
 * @returns {object} Un objeto con el estado de la operación.
 */
function handleChangePassword(requester, payload) {
    const { currentPassword, newPassword } = payload;
    if (!currentPassword || !newPassword) {
        return { status: 'error', message: 'Faltan datos para cambiar la contraseña.' };
    }

    const data = SHEET_USERS.getDataRange().getValues();
    const userRowIndex = data.findIndex(row => row[COLS_USERS.ID] == requester.ID);

    if (userRowIndex === -1) {
        return { status: 'error', message: 'Usuario no encontrado.' };
    }
    const userRow = data[userRowIndex];

    if (String(userRow[COLS_USERS.CONTRASENA]).toLowerCase() !== String(currentPassword).toLowerCase()) {
        return { status: 'error', message: 'La contraseña actual es incorrecta.' };
    }

    SHEET_USERS.getRange(userRowIndex + 2, COLS_USERS.CONTRASENA + 1).setValue(newPassword); // +2 para account for header and 0-indexing

    return { status: 'success', message: 'Contraseña actualizada correctamente.' };
}
