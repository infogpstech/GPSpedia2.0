// ============================================================================
// GPSPEDIA-UTILITIES SERVICE (ONE-TIME EXECUTION SCRIPTS)
// ============================================================================
// COMPONENT VERSION: 1.0.0

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs";
const SHEET_NAME = "Cortes";

// Mapa de columnas canónico para la DB v2.0
const COLS_CORTES = {
    id: 1, categoria: 2, marca: 3, modelo: 4, versionesAplicables: 5, anoDesde: 6, anoHasta: 7, tipoEncendido: 8,
    imagenVehiculo: 9, videoGuiaDesarmeUrl: 10, contadorBusqueda: 11, tipoCorte1: 12, ubicacionCorte1: 13,
    colorCableCorte1: 14, configRelay1: 15, imgCorte1: 16, utilCorte1: 17, colaboradorCorte1: 18,
    tipoCorte2: 19, ubicacionCorte2: 20, colorCableCorte2: 21, configRelay2: 22, imgCorte2: 23,
    utilCorte2: 24, colaboradorCorte2: 25, tipoCorte3: 26, ubicacionCorte3: 27, colorCableCorte3: 28,
    configRelay3: 29, imgCorte3: 30, utilCorte3: 31, colaboradorCorte3: 32,
    apertura: 33, imgApertura: 34, cableAlimen: 35, imgCableAlimen: 36,
    timestamp: 37, notaImportante: 38
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) {
    if (e.parameter.debug === 'true') {
        const serviceState = {
            service: 'GPSpedia-Utilities',
            version: '1.0.0',
            description: 'This service provides one-time execution scripts for data migration.',
            spreadsheetId: SPREADSHEET_ID,
            availableMigrations: ['migrateYearRanges', 'migrateTimestamps']
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'GPSpedia Utilities-SERVICE v1.0.0 is active. Use doPost to run a migration.' }))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    let response;
    try {
        const request = JSON.parse(e.postData.contents);
        // Por seguridad, estas funciones críticas solo se pueden ejecutar con un rol específico.
        if (request.payload.role !== 'Desarrollador') {
            throw new Error("Acceso no autorizado.");
        }

        switch (request.action) {
            case 'migrateYearRanges':
                response = migrateYearRanges();
                break;
            case 'migrateTimestamps':
                response = migrateTimestamps();
                break;
            default:
                throw new Error(`La migración '${request.action}' es desconocida.`);
        }
    } catch (error) {
        Logger.log(`Error en Utilities-Service: ${error.stack}`);
        response = { status: 'error', message: error.message };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// SCRIPTS DE MIGRACIÓN (EJECUCIÓN ÚNICA)
// ============================================================================

/**
 * Procesa la columna 'anoDesde' para separar rangos de años en 'anoDesde' y 'anoHasta'.
 */
function migrateYearRanges() {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const range = sheet.getRange(2, COLS_CORTES.anoDesde, sheet.getLastRow() - 1, 2); // Rango de 'anoDesde' y 'anoHasta'
    const values = range.getValues();
    let updatedCount = 0;

    const newValues = values.map(row => {
        const anoDesdeStr = String(row[0]).trim();
        if (anoDesdeStr.includes('-')) {
            const parts = anoDesdeStr.split('-').map(p => parseInt(p.trim(), 10));
            const year1 = parts[0];
            const year2 = parts[1];

            if (!isNaN(year1) && !isNaN(year2)) {
                updatedCount++;
                return [Math.min(year1, year2), Math.max(year1, year2)];
            }
        } else {
            const year = parseInt(anoDesdeStr, 10);
            if (!isNaN(year) && !row[1]) { // Si 'anoHasta' está vacío
                updatedCount++;
                return [year, year];
            }
        }
        return row; // Devolver la fila sin cambios si no cumple las condiciones
    });

    range.setValues(newValues);
    return { status: 'success', message: `Migración de rangos de años completada. ${updatedCount} filas fueron actualizadas.` };
}

/**
 * Registra un mensaje en la hoja de 'Logs' de la base de datos.
 * @param {string} level - Nivel del log (e.g., 'INFO', 'ERROR').
 * @param {string} message - El mensaje a registrar.
 * @param {object} [data={}] - Datos adicionales para incluir.
 */
function logToSheet(level, message, data = {}) {
    try {
        const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Logs");
        if (logSheet) {
            logSheet.appendRow([
                new Date(),
                level,
                message,
                JSON.stringify(data)
            ]);
        }
    } catch (e) {
        // Fallback a Logger si la escritura en la hoja falla
        Logger.log(`Error al escribir en la hoja de Logs: ${e.message}. Log original: ${level} - ${message}`);
    }
}

/**
 * Extrae el ID de un archivo de Google Drive desde varios formatos de URL.
 * @param {string} url - La URL de Google Drive.
 * @returns {string|null} El ID del archivo o null si no se encuentra.
 */
function extractDriveFileId(url) {
    if (!url || typeof url !== 'string') return null;
    const regexPatterns = [
        /(?:\/file\/d\/|\/d\/)([a-zA-Z0-9_-]{28,})/,
        /[?&]id=([a-zA-Z0-9_-]{28,})/,
        /googleusercontent\.com\/d\/([a-zA-Z0-9_-]{28,})/
    ];
    for (const pattern of regexPatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

/**
 * Rellena la columna 'timestamp' usando la fecha de creación del archivo de imagen en Drive.
 * Versión mejorada con logging, extracción robusta de ID y escritura por lotes.
 */
function migrateTimestamps() {
    logToSheet('INFO', 'Inicio de la migración de timestamps.');
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, COLS_CORTES.timestamp);
    const data = range.getValues();
    let updatedCount = 0;

    const newTimestamps = data.map((row, index) => {
        const currentRowNum = index + 2;
        const timestampCell = row[COLS_CORTES.timestamp - 1];

        // Solo procesar si la celda de timestamp está vacía
        if (!timestampCell) {
            const imageUrl = row[COLS_CORTES.imagenVehiculo - 1];
            const fileId = extractDriveFileId(imageUrl);

            if (fileId) {
                try {
                    const file = DriveApp.getFileById(fileId);
                    const creationDate = file.getDateCreated();
                    const formattedDate = Utilities.formatDate(creationDate, "GMT-6", "dd/MM/yyyy");
                    updatedCount++;
                    logToSheet('INFO', `Fila ${currentRowNum}: Éxito`, { fileId: fileId, date: formattedDate });
                    return [formattedDate];
                } catch (e) {
                    logToSheet('ERROR', `Fila ${currentRowNum}: Error al acceder a Drive`, { fileId: fileId, error: e.message, url: imageUrl });
                    return [timestampCell]; // Mantener valor original en caso de error
                }
            } else {
                logToSheet('WARN', `Fila ${currentRowNum}: No se pudo extraer ID de la URL.`, { url: imageUrl });
                return [timestampCell]; // Mantener valor original si no hay ID
            }
        }
        return [timestampCell]; // Mantener valor original si ya tiene un timestamp
    });

    // Escribir todos los nuevos timestamps en una sola operación
    if (newTimestamps.length > 0) {
        sheet.getRange(2, COLS_CORTES.timestamp, newTimestamps.length, 1).setValues(newTimestamps);
    }

    logToSheet('INFO', `Migración de timestamps completada. Filas actualizadas: ${updatedCount}.`);
    return { status: 'success', message: `Migración de timestamps completada. ${updatedCount} filas fueron actualizadas.` };
}
