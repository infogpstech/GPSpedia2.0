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
  return ContentService.createTextOutput(`GPSpedia-Auth Service v${SCRIPT_VERSION} is active.`);
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
        const sheetPassword = String(row[COLS.PASSWORD - 1]).trim();
        const frontendPassword = String(password).trim();

        if (sheetPassword === frontendPassword) {
          const userId = row[COLS.ID - 1];
          const nombre = row[COLS.NOMBRE - 1];
          const sessionToken = Utilities.getUuid();

          const sessionsSheet = ss.getSheetByName(ACTIVE_SESSIONS_SHEET_NAME);
          const expiration = new Date(Date.now() + (24 * 60 * 60 * 1000));
          sessionsSheet.appendRow([userId, sessionToken, new Date(), expiration]);
          usersSheet.getRange(i + 1, COLS.SESSION_TOKEN).setValue(sessionToken);

          logEvent('INFO', `Login exitoso para el usuario '${username}'.`);

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
      const expiration = new Date(row[3]);

      if (sheetUserId === String(userId).trim() && sheetToken === String(sessionToken).trim()) {
        if (expiration > new Date()) {
          logEvent('INFO', `Sesión válida encontrada para el usuario ID '${userId}'.`);
          return createJsonResponse({ valid: true });
        } else {
          logEvent('WARN', `Sesión expirada encontrada para el usuario ID '${userId}'.`);
          return createJsonResponse({ valid: false, reason: 'Sesión expirada.' });
        }
      }
    }

    logEvent('WARN', `No se encontró una sesión válida para el usuario ID '${userId}'.`);
    return createJsonResponse({ valid: false, reason: 'Sesión no encontrada.' });

  } catch (error) {
    logEvent('ERROR', 'Error durante la validación de la sesión.', { errorMessage: error.message, stack: error.stack });
    return createJsonResponse({ valid: false, reason: 'Error interno del servidor.' });
  }
}


/*****************************************************************************************************************
 * FUNCIÓN UTILITARIA - createJsonResponse
 *****************************************************************************************************************/
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
