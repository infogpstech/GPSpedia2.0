/**
 * @file services/users/users.js
 * @version 2.1.0
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

/**
 * @function doGet
 * @description Responde a las solicitudes GET. Útil para verificar la disponibilidad y versión del servicio.
 * @param {object} e - El objeto de evento de la solicitud GET.
 * @returns {ContentService.TextOutput} Un objeto de Content Service con la respuesta en formato JSON.
 */
function doGet(e) {
    const response = {
        service: 'GPSpedia-Users',
        componentVersion: '2.1.0',
        status: 'ok',
        timestamp: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * @function doPost
 * @description Punto de entrada para todas las solicitudes POST. Enruta la acción solicitada a la función manejadora correspondiente.
 * @param {object} e - El objeto de evento de la solicitud POST.
 * @returns {ContentService.TextOutput} La respuesta de la función manejadora, formateada como texto.
 */
function doPost(e) {
    let response;
    try {
        const payload = JSON.parse(e.postData.contents);
        const action = payload.action;

        switch (action) {
            case 'getUsers':
                response = handleGetUsers(payload);
                break;
            case 'createUser':
                response = handleCreateUser(payload);
                break;
            case 'updateUser':
                response = handleUpdateUser(payload);
                break;
            case 'deleteUser':
                response = handleDeleteUser(payload);
                break;
            case 'changePassword':
                response = handleChangePassword(payload);
                break;
            default:
                response = {
                    status: 'error',
                    message: 'Acción desconocida'
                };
        }
    } catch (error) {
        response = {
            status: 'error',
            message: 'Error en el servidor: ' + error.message,
            details: error.stack
        };
    }

    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.TEXT);
}


/**
 * @function handleGetUsers
 * @description Obtiene la lista de todos los usuarios de la hoja de cálculo.
 * @param {object} payload - El payload de la solicitud.
 * @returns {object} Un objeto con el estado y la lista de usuarios.
 */
function handleGetUsers(payload) {
    try {
        // Validación de permisos (ejemplo simple, requiere mejora con Tarea 14)
        if (!payload.session || payload.session.user.Rol !== 'Desarrollador') {
            return {
                status: 'error',
                message: 'No tienes permisos para realizar esta acción.'
            };
        }

        const data = SHEET_USERS.getDataRange().getValues();
        const headers = data.shift();
        const users = data.map(row => {
            let user = {};
            headers.forEach((header, index) => {
                user[header] = row[index];
            });
            delete user.Contrasena; // No enviar contraseñas al cliente
            return user;
        });

        return {
            status: 'success',
            users: users
        };
    } catch (error) {
        return {
            status: 'error',
            message: 'No se pudo obtener la lista de usuarios: ' + error.message
        };
    }
}

/**
 * @function handleCreateUser
 * @description Crea un nuevo usuario en la hoja de cálculo.
 * @param {object} payload - El payload con los datos del nuevo usuario.
 * @returns {object} Un objeto con el estado de la operación.
 */
function handleCreateUser(payload) {
    try {
        // Validación de permisos (requiere mejora con Tarea 14)
        if (!payload.session || payload.session.user.Rol !== 'Desarrollador') {
            return {
                status: 'error',
                message: 'No tienes permisos para crear usuarios.'
            };
        }

        const newUser = payload.newUser;
        // Validación básica de datos
        if (!newUser.Nombre_Usuario || !newUser.Contrasena || !newUser.Rol) {
            return {
                status: 'error',
                message: 'Faltan datos requeridos para crear el usuario.'
            };
        }

        // Añadir el nuevo usuario. La fórmula del ID debería heredarse.
        SHEET_USERS.appendRow(['', newUser.Nombre_Usuario, newUser.Nombre_Completo || '', newUser.Contrasena, newUser.Rol, '', '']);
        SpreadsheetApp.flush(); // Asegurar que la escritura se complete

        return {
            status: 'success',
            message: 'Usuario creado correctamente'
        };
    } catch (error) {
        return {
            status: 'error',
            message: 'Error al crear el usuario: ' + error.message
        };
    }
}

/**
 * @function handleUpdateUser
 * @description Actualiza los datos de un usuario existente.
 * @param {object} payload - El payload con los datos del usuario a actualizar.
 * @returns {object} Un objeto con el estado de la operación.
 */
function handleUpdateUser(payload) {
    try {
        // Validación de permisos (requiere mejora con Tarea 14)
        if (!payload.session || payload.session.user.Rol !== 'Desarrollador') {
            return {
                status: 'error',
                message: 'No tienes permisos para actualizar usuarios.'
            };
        }

        const updatedUser = payload.updatedUser;
        if (!updatedUser.ID) {
            return {
                status: 'error',
                message: 'Se requiere el ID del usuario para actualizarlo.'
            };
        }

        const data = SHEET_USERS.getDataRange().getValues();
        const rowIndex = data.findIndex(row => row[COLS_USERS.ID] == updatedUser.ID);

        if (rowIndex === -1) {
            return {
                status: 'error',
                message: 'Usuario no encontrado.'
            };
        }

        // El índice de la fila en la hoja es rowIndex + 1
        const sheetRowIndex = rowIndex + 1;
        SHEET_USERS.getRange(sheetRowIndex, COLS_USERS.NOMBRE_COMPLETO + 1).setValue(updatedUser.Nombre_Completo);
        SHEET_USERS.getRange(sheetRowIndex, COLS_USERS.ROL + 1).setValue(updatedUser.Rol);

        return {
            status: 'success',
            message: 'Usuario actualizado correctamente.'
        };
    } catch (error) {
        return {
            status: 'error',
            message: 'Error al actualizar el usuario: ' + error.message
        };
    }
}


/**
 * @function handleDeleteUser
 * @description Elimina un usuario de la hoja de cálculo.
 * @param {object} payload - El payload con el ID del usuario a eliminar.
 * @returns {object} Un objeto con el estado de la operación.
 */
function handleDeleteUser(payload) {
    try {
        // Validación de permisos (requiere mejora con Tarea 14)
        if (!payload.session || payload.session.user.Rol !== 'Desarrollador') {
            return {
                status: 'error',
                message: 'No tienes permisos para eliminar usuarios.'
            };
        }

        const userId = payload.userId;
        if (!userId) {
            return {
                status: 'error',
                message: 'Se requiere el ID del usuario para eliminarlo.'
            };
        }

        const data = SHEET_USERS.getDataRange().getValues();
        const rowIndex = data.findIndex(row => row[COLS_USERS.ID] == userId);

        if (rowIndex === -1) {
            return {
                status: 'error',
                message: 'Usuario no encontrado.'
            };
        }

        // El índice de la fila en la hoja es rowIndex + 1. La primera fila es la cabecera.
        const sheetRowIndex = rowIndex + 1;
        SHEET_USERS.deleteRow(sheetRowIndex);

        return {
            status: 'success',
            message: 'Usuario eliminado correctamente.'
        };
    } catch (error) {
        return {
            status: 'error',
            message: 'Error al eliminar el usuario: ' + error.message
        };
    }
}

/**
 * @function handleChangePassword
 * @description Permite a un usuario cambiar su propia contraseña.
 * @param {object} payload - El payload con la información de la sesión y las contraseñas.
 * @returns {object} Un objeto con el estado de la operación.
 */
function handleChangePassword(payload) {
    try {
        const session = payload.session;
        const currentPassword = payload.currentPassword;
        const newPassword = payload.newPassword;

        if (!session || !currentPassword || !newPassword) {
            return {
                status: 'error',
                message: 'Faltan datos para cambiar la contraseña.'
            };
        }

        const data = SHEET_USERS.getDataRange().getValues();
        const userRow = data.find(row => row[COLS_USERS.ID] == session.user.ID);

        if (!userRow) {
            return {
                status: 'error',
                message: 'Usuario no encontrado.'
            };
        }

        // Corrección de bug (Tarea 15): comparación case-insensitive
        if (String(userRow[COLS_USERS.CONTRASENA]).toLowerCase() !== String(currentPassword).toLowerCase()) {
            return {
                status: 'error',
                message: 'La contraseña actual es incorrecta.'
            };
        }

        const rowIndex = data.findIndex(row => row[COLS_USERS.ID] == session.user.ID);
        const sheetRowIndex = rowIndex + 1;

        SHEET_USERS.getRange(sheetRowIndex, COLS_USERS.CONTRASENA + 1).setValue(newPassword);

        return {
            status: 'success',
            message: 'Contraseña actualizada correctamente.'
        };

    } catch (error) {
        return {
            status: 'error',
            message: 'Error al cambiar la contraseña: ' + error.message
        };
    }
}
