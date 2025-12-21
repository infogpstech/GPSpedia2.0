// GPSpedia-Auth v1.0
// Servicio de Autenticación para GPSpedia 2.0

// --- CONFIGURACIÓN GLOBAL ---
const SCRIPT_VERSION = "1.0";
const SPREADSHEET_ID = "1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo";
const LOG_SHEET_NAME = "Logs";
const USERS_SHEET_NAME = "Users";
const ACTIVE_SESSIONS_SHEET_NAME = "ActiveSessions";

// --- MAPA DE COLUMNAS FIJO ---
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

/*****************************************************************************************************************
 * FUNCIÓN DE REGISTRO (LOGGING)
 *****************************************************************************************************************/
function logEvent(level, message, details = {}) {
  try {
    const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET_NAME);
    const timestamp = new Date().toISOString();
    const detailsString = JSON.stringify(details);
    logSheet.appendRow([timestamp, level, "GPSpedia-Auth", message, detailsString]);
  } catch (e) {
    console.error(`Fallo al escribir en el log: ${e.message}. Evento original: [${level}] ${message}`);
  }
}

/*****************************************************************************************************************
 * FUNCIÓN PRINCIPAL - doGet
 *****************************************************************************************************************/
function doGet(e) {
  // --- ENDPOINT DE MIGRACIÓN DE CONTRASEÑAS (USO ÚNICO) ---
  // Para ejecutar, el admin debe visitar la URL del script con el parámetro ?action=migratePasswords
  // Ejemplo: https://script.google.com/macros/s/.../exec?action=migratePasswords
  if (e.parameter.action === 'migratePasswords') {
    return migratePasswordsToHashes_();
  }

  // Respuesta estándar si no hay acción de migración
  return ContentService.createTextOutput(`GPSpedia-Auth Service v${SCRIPT_VERSION} is active.`);
}

/**
 * FUNCIÓN DE MIGRACIÓN (USO ÚNICO)
 * Itera sobre todas las contraseñas en la hoja "Users". Si una contraseña
 * no parece ser un hash (no contiene "$"), la hashea y la reemplaza.
 */
function migratePasswordsToHashes_() {
  try {
    const usersSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET_NAME);
    const range = usersSheet.getRange(2, COLS.PASSWORD, usersSheet.getLastRow() - 1, 1);
    const passwords = range.getValues();
    let migratedCount = 0;

    const newHashedPasswords = passwords.map(row => {
      const currentPassword = String(row[0]).trim();
      // Si la contraseña ya está hasheada (contiene el separador '$'), no la tocamos.
      if (currentPassword.includes('$')) {
        return [currentPassword];
      }
      // Si es texto plano, generamos una nueva sal y la hasheamos.
      const salt = generateSalt_();
      const hashedPassword = hashPassword_(currentPassword, salt);
      migratedCount++;
      return [`${salt}$${hashedPassword}`];
    });

    // Escribir todas las contraseñas (hasheadas y las que ya lo estaban) de vuelta a la hoja.
    range.setValues(newHashedPasswords);

    const message = `Migración completada. ${migratedCount} contraseñas fueron hasheadas.`;
    logEvent('INFO', message);
    return ContentService.createTextOutput(message);

  } catch (error) {
    const errorMessage = `Error durante la migración de contraseñas: ${error.message}`;
    logEvent('CRITICAL', errorMessage, { stack: error.stack });
    return ContentService.createTextOutput(errorMessage);
  }
}

/*****************************************************************************************************************
 * FUNCIÓN PRINCIPAL - doPost
 *****************************************************************************************************************/
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;

    logEvent('INFO', `Acción '${action}' recibida.`);

    switch (action) {
      case 'login':
        return handleLogin(payload);
      case 'validateSession':
        return handleValidateSession(payload);
      default:
        logEvent('WARN', `Acción desconocida recibida: '${action}'.`);
        return createJsonResponse({ status: 'error', message: `Acción desconocida: ${action}` });
    }
  } catch (error) {
    logEvent('ERROR', 'Error crítico en doPost', { errorMessage: error.message, stack: error.stack, postData: e.postData.contents });
    return createJsonResponse({ status: 'error', message: 'Error en el servidor', details: { errorMessage: error.message } });
  }
}

/*****************************************************************************************************************
 * MANEJADOR DE ACCIÓN - handleLogin
 *****************************************************************************************************************/
function handleLogin(payload) {
  const { username, password } = payload;

  if (!username || !password) {
    logEvent('WARN', 'Intento de login con datos incompletos.', { username: username || 'N/A' });
    return createJsonResponse({ status: 'error', message: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
    const data = usersSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sheetUsername = String(row[COLS.NOMBRE_USUARIO - 1]).trim();

      if (sheetUsername.toLowerCase() === username.trim().toLowerCase()) {
        const storedPassword = String(row[COLS.PASSWORD - 1]).trim();

        if (verifyPassword_(password, storedPassword)) {
          const userId = row[COLS.ID - 1];
          const nombre = row[COLS.NOMBRE - 1];
          const sessionToken = Utilities.getUuid();

          // --- IMPLEMENTACIÓN DE SESIÓN ÚNICA ---
          // Antes de crear una nueva sesión, invalidar todas las sesiones antiguas para este usuario.
          invalidateOldSessions_(ss, userId);

          const sessionsSheet = ss.getSheetByName(ACTIVE_SESSIONS_SHEET_NAME);
          sessionsSheet.appendRow([userId, sessionToken, new Date().toISOString()]);
          usersSheet.getRange(i + 1, COLS.SESSION_TOKEN).setValue(sessionToken);

          logEvent('INFO', `Login exitoso para el usuario '${username}'. Sesiones antiguas invalidadas.`);

          return createJsonResponse({
            status: 'success',
            user: {
              id: userId,
              nombre: nombre,
              sessionToken: sessionToken
            }
          });
        } else {
          logEvent('WARN', `Intento de login fallido (contraseña incorrecta) para '${username}'.`);
          return createJsonResponse({ status: 'error', message: 'Credenciales inválidas' });
        }
      }
    }

    logEvent('WARN', `Intento de login fallido (usuario no encontrado) para '${username}'.`);
    return createJsonResponse({ status: 'error', message: 'Credenciales inválidas' });

  } catch (error) {
    logEvent('ERROR', 'Error durante el proceso de login.', { errorMessage: error.message, stack: error.stack });
    return createJsonResponse({ status: 'error', message: 'Ocurrió un error interno al intentar iniciar sesión.' });
  }
}

/*****************************************************************************************************************
 * MANEJADOR DE ACCIÓN - handleValidateSession
 *****************************************************************************************************************/
function handleValidateSession(payload) {
  const { userId, sessionToken } = payload;

  if (!userId || !sessionToken) {
    logEvent('WARN', 'Intento de validación de sesión con datos incompletos.', { userId: userId || 'N/A' });
    return createJsonResponse({ valid: false, reason: 'ID de usuario o token de sesión no proporcionado.' });
  }

  try {
    const sessionsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ACTIVE_SESSIONS_SHEET_NAME);
    const data = sessionsSheet.getDataRange().getValues();

    for (let i = data.length - 1; i > 0; i--) { // Iterar desde el final para encontrar la sesión más reciente
      const row = data[i];
      const sheetUserId = String(row[0]).trim();
      const sheetToken = String(row[1]).trim();

      if (sheetUserId === String(userId).trim() && sheetToken === String(sessionToken).trim()) {
        logEvent('INFO', `Sesión válida encontrada para el usuario ID '${userId}'.`);
        return createJsonResponse({ valid: true });
      }
    }

    logEvent('WARN', `No se encontró una sesión válida para el usuario ID '${userId}'.`);
    return createJsonResponse({ valid: false, reason: 'Sesión no encontrada.' });

  } catch (error) {
    logEvent('ERROR', 'Error durante la validación de la sesión.', { errorMessage: error.message, stack: error.stack });
    return createJsonResponse({ valid: false, reason: 'Error interno del servidor.' });
  }
}

/**
 * Invalida todas las sesiones antiguas de un usuario en la hoja "ActiveSessions".
 * Esto se hace eliminando las filas correspondientes.
 * @param {Spreadsheet} ss - La instancia activa del Spreadsheet.
 * @param {string} userId - El ID del usuario para quien se invalidarán las sesiones.
 */
function invalidateOldSessions_(ss, userId) {
  const sessionsSheet = ss.getSheetByName(ACTIVE_SESSIONS_SHEET_NAME);
  const data = sessionsSheet.getDataRange().getValues();
  const rowsToDelete = [];

  // Recorrer las filas en reversa para eliminar de forma segura.
  for (let i = data.length - 1; i >= 1; i--) {
    const rowUserId = String(data[i][0]).trim();
    if (rowUserId === String(userId).trim()) {
      rowsToDelete.push(i + 1); // +1 porque los índices de fila son 1-based.
    }
  }

  if (rowsToDelete.length > 0) {
    logEvent('INFO', `Invalidando ${rowsToDelete.length} sesión(es) antigua(s) para el usuario ID '${userId}'.`);
    // Eliminar las filas encontradas. Apps Script maneja la eliminación en batch de manera eficiente.
    for (const rowIndex of rowsToDelete) {
      sessionsSheet.deleteRow(rowIndex);
    }
  }
}


/*****************************************************************************************************************
 * FUNCIONES DE SEGURIDAD - HASHING DE CONTRASEÑAS
 *****************************************************************************************************************/

/**
 * Genera una sal (salt) aleatoria para el hashing de la contraseña.
 * @returns {string} Una cadena de texto única.
 */
function generateSalt_() {
  return Utilities.getUuid();
}

/**
 * Calcula el hash SHA-256 de una contraseña con una sal.
 * @param {string} password - La contraseña en texto plano.
 * @param {string} salt - La sal aleatoria.
 * @returns {string} El hash de la contraseña en formato hexadecimal.
 */
function hashPassword_(password, salt) {
  const saltedPassword = password + salt;
  const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedPassword);
  // Convertir el array de bytes a una cadena hexadecimal
  return hashBytes.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Verifica una contraseña en texto plano contra un hash almacenado.
 * El formato almacenado es "salt$hash".
 * @param {string} plaintextPassword - La contraseña que envía el usuario.
 * @param {string} storedPassword - La contraseña hasheada y salada desde la hoja de cálculo.
 * @returns {boolean} True si la contraseña es válida, false en caso contrario.
 */
function verifyPassword_(plaintextPassword, storedPassword) {
  // -- INICIO DE LOGGING DE DEPURACIÓN TEMPORAL --
  logEvent('DEBUG', 'Iniciando verificación de contraseña.', {
    storedPasswordType: typeof storedPassword,
    storedPasswordValue: storedPassword,
    plaintextPasswordType: typeof plaintextPassword
  });

  if (!storedPassword || !storedPassword.includes('$')) {
    logEvent('DEBUG', 'Fallo de verificación: La contraseña almacenada no es un hash válido (no contiene "$").');
    return false;
  }

  const [salt, storedHash] = storedPassword.split('$');
  const trimmedPlaintext = String(plaintextPassword).trim();
  const hashOfPlaintext = hashPassword_(trimmedPlaintext, salt);

  const verificationResult = hashOfPlaintext === storedHash;

  logEvent('DEBUG', 'Resultado de la verificación de contraseña.', {
    saltUsed: salt,
    hashFromSheet: storedHash,
    hashCalculated: hashOfPlaintext,
    passwordsMatch: verificationResult
  });
  // -- FIN DE LOGGING DE DEPURACIÓN TEMPORAL --

  return verificationResult;
}


/*****************************************************************************************************************
 * FUNCIÓN UTILITARIA - createJsonResponse
 *****************************************************************************************************************/
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
