// ============================================================================
// GPSpedia LEGACY BACKEND (v3.009 - POST-MIGRATION)
// ============================================================================
// Este archivo ahora solo contiene la funcionalidad de logging remoto.
// Todas las demás funcionalidades han sido migradas a microservicios dedicados.
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

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
  try {
    const response = { status: 'success', message: 'GPSpedia LEGACY-SERVICE (Logger) v1.0 is active.' };
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorResponse = {
        status: 'error',
        message: 'Error en el servidor legacy (doGet).',
        details: { message: error.message, stack: error.stack }
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
        try {
            request = JSON.parse(e.postData.contents);
        } catch (jsonError) {
            throw new Error(`El formato de la solicitud no es un JSON válido.`);
        }

        switch (request.action) {
            case 'logFrontend':
                // Esta es la única acción que permanece en el script legacy.
                Logger.log(`[FRONTEND ${request.payload.level}] ${request.payload.message} | Data: ${JSON.stringify(request.payload.data)}`);
                response = { status: 'success', message: 'Log recibido.' };
                break;

            default:
                // Si se recibe cualquier otra acción, es un error, ya que debería haber sido
                // enrutada a un microservicio por el api-manager.js.
                throw new Error(`Acción desconocida o no migrada recibida por el script legacy: ${request.action}`);
        }
    } catch (error) {
        Logger.log(`Error CRÍTICO en Legacy Script doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error inesperado en el servidor legacy.',
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
