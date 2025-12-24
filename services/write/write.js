// ============================================================================
// GPSPEDIA-WRITE SERVICE (REFACTORED WITH MIGRATION ENDPOINT)
// ============================================================================
// COMPONENT VERSION: 1.2.0

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID_V1_5 = "1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo";
const SPREADSHEET_ID_V2_0 = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs";
const DRIVE_FOLDER_ID = '1-8QqhS-wtEFFwyBG8CmnEOp5i8rxSM-2';
let spreadsheet_v1_5 = null; // Renombrado para claridad
let spreadsheet_v2_0 = null; // Renombrado para claridad

// Se mantiene getSpreadsheet para compatibilidad con addCorte que aún usa la v1.5
function getSpreadsheet() {
  if (spreadsheet_v1_5 === null) {
    spreadsheet_v1_5 = SpreadsheetApp.openById(SPREADSHEET_ID_V1_5);
  }
  return spreadsheet_v1_5;
}

const SHEET_NAMES = {
    CORTES: "Cortes",
    USERS: "Users"
};

// Mapa de columnas para la DB v1.5
const COLS_CORTES_V1_5 = {
    id: 1, categoria: 2, marca: 3, modelo: 4, anoGeneracion: 5, tipoDeEncendido: 6, colaborador: 7, util: 8,
    tipoDeCorte: 9, descripcionDelCorte: 10, imagenDelCorte: 11, tipoDeCorte2: 12, descripcionDelSegundoCorte: 13,
    imagenDeCorte2: 14, tipoDeCorte3: 15, descripcionDelCorte3: 16, imagenDelCorte3: 17, apertura: 18,
    imagenDeLaApertura: 19, cablesDeAlimentacion: 20, imagenDeLosCablesDeAlimentacion: 21,
    comoDesarmarLosPlasticos: 22, notaImportante: 23, timestamp: 24
};

// Mapa de columnas para la DB v2.0
const COLS_CORTES_V2_0 = {
    id: 1, categoria: 2, marca: 3, modelo: 4, versionesAplicables: 5, anoDesde: 6, anoHasta: 7, tipoEncendido: 8,
    imagenVehiculo: 9, videoGuiaDesarmeUrl: 10, contadorBusqueda: 11, tipoCorte1: 12, ubicacionCorte1: 13,
    colorCableCorte1: 14, configRelay1: 15, imgCorte1: 16, utilCorte1: 17, colaboradorCorte1: 18,
    tipoCorte2: 19, ubicacionCorte2: 20, colorCableCorte2: 21, configRelay2: 22, imgCorte2: 23,
    utilCorte2: 24, colaboradorCorte2: 25, tipoCorte3: 26, ubicacionCorte3: 27, colorCableCorte3: 28,
    configRelay3: 29, imgCorte3: 30, utilCorte3: 31, colaboradorCorte3: 32, timestamp: 33, notaImportante: 34
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) { /* ... sin cambios ... */ }

function doPost(e) {
    let response;
    let request;
    try {
        request = JSON.parse(e.postData.contents);

        switch (request.action) {
            case 'addCorte':
                response = handleAddCorte(request.payload);
                break;
            case 'executeMigration':
                response = handleExecuteMigration(request.payload);
                break;
            default:
                throw new Error(`Acción desconocida en Write Service: ${request.action}`);
        }
    } catch (error) { /* ... sin cambios ... */ }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// LÓGICA DE MIGRACIÓN
// ============================================================================

function handleExecuteMigration(payload) {
    // 1. Verificación de Seguridad
    const { user } = payload;
    if (!user || user.privilegios !== 'Desarrollador') {
        throw new Error("Acceso denegado. Se requiere rol de Desarrollador.");
    }

    // 2. Conexión a las Bases de Datos
    const sourceSheet = SpreadsheetApp.openById(SPREADSHEET_ID_V1_5).getSheetByName(SHEET_NAMES.CORTES);
    const destinationSheet = SpreadsheetApp.openById(SPREADSHEET_ID_V2_0).getSheetByName(SHEET_NAMES.CORTES);

    // 3. Principio de Idempotencia: Limpiar hoja de destino
    const lastRow = destinationSheet.getLastRow();
    if (lastRow > 1) {
        destinationSheet.deleteRows(2, lastRow - 1);
    }

    // 4. Lectura de Datos de Origen
    const sourceData = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, sourceSheet.getLastColumn()).getValues();
    const transformedData = [];

    // 5. Bucle de Transformación
    for (const row of sourceData) {
        transformedData.push(transformRow(row));
    }

    // 6. Escritura de Datos en Destino
    if (transformedData.length > 0) {
        destinationSheet.getRange(2, 1, transformedData.length, transformedData[0].length).setValues(transformedData);
    }

    return { status: 'success', message: `Migración completada. ${transformedData.length} filas procesadas.` };
}

function transformRow(row) {
    const newRow = new Array(Object.keys(COLS_CORTES_V2_0).length).fill('');
    const yearData = parseYear(row[COLS_CORTES_V1_5.anoGeneracion - 1]);
    const likeCount = countLikes(row[COLS_CORTES_V1_5.util - 1]);
    const colaborador = row[COLS_CORTES_V1_5.colaborador - 1];

    newRow[COLS_CORTES_V2_0.id - 1] = row[COLS_CORTES_V1_5.id - 1];
    newRow[COLS_CORTES_V2_0.categoria - 1] = row[COLS_CORTES_V1_5.categoria - 1];
    newRow[COLS_CORTES_V2_0.marca - 1] = row[COLS_CORTES_V1_5.marca - 1];
    newRow[COLS_CORTES_V2_0.modelo - 1] = row[COLS_CORTES_V1_5.modelo - 1];
    newRow[COLS_CORTES_V2_0.anoDesde - 1] = yearData.desde;
    newRow[COLS_CORTES_V2_0.anoHasta - 1] = yearData.hasta;
    newRow[COLS_CORTES_V2_0.tipoEncendido - 1] = row[COLS_CORTES_V1_5.tipoDeEncendido - 1];
    newRow[COLS_CORTES_V2_0.imagenVehiculo - 1] = row[COLS_CORTES_V1_5.imagenDeLaApertura - 1];

    // Corte 1
    if (row[COLS_CORTES_V1_5.tipoDeCorte - 1]) {
        newRow[COLS_CORTES_V2_0.tipoCorte1 - 1] = row[COLS_CORTES_V1_5.tipoDeCorte - 1];
        newRow[COLS_CORTES_V2_0.ubicacionCorte1 - 1] = row[COLS_CORTES_V1_5.descripcionDelCorte - 1];
        newRow[COLS_CORTES_V2_0.imgCorte1 - 1] = row[COLS_CORTES_V1_5.imagenDelCorte - 1];
        newRow[COLS_CORTES_V2_0.utilCorte1 - 1] = likeCount;
        newRow[COLS_CORTES_V2_0.colaboradorCorte1 - 1] = colaborador;
    }
    // Corte 2
    if (row[COLS_CORTES_V1_5.tipoDeCorte2 - 1]) {
        newRow[COLS_CORTES_V2_0.tipoCorte2 - 1] = row[COLS_CORTES_V1_5.tipoDeCorte2 - 1];
        newRow[COLS_CORTES_V2_0.ubicacionCorte2 - 1] = row[COLS_CORTES_V1_5.descripcionDelSegundoCorte - 1];
        newRow[COLS_CORTES_V2_0.imgCorte2 - 1] = row[COLS_CORTES_V1_5.imagenDeCorte2 - 1];
        newRow[COLS_CORTES_V2_0.utilCorte2 - 1] = likeCount;
        newRow[COLS_CORTES_V2_0.colaboradorCorte2 - 1] = colaborador;
    }
    // Corte 3
    if (row[COLS_CORTES_V1_5.tipoDeCorte3 - 1]) {
        newRow[COLS_CORTES_V2_0.tipoCorte3 - 1] = row[COLS_CORTES_V1_5.tipoDeCorte3 - 1];
        newRow[COLS_CORTES_V2_0.ubicacionCorte3 - 1] = row[COLS_CORTES_V1_5.descripcionDelCorte3 - 1];
        newRow[COLS_CORTES_V2_0.imgCorte3 - 1] = row[COLS_CORTES_V1_5.imagenDelCorte3 - 1];
        newRow[COLS_CORTES_V2_0.utilCorte3 - 1] = likeCount;
        newRow[COLS_CORTES_V2_0.colaboradorCorte3 - 1] = colaborador;
    }

    newRow[COLS_CORTES_V2_0.timestamp - 1] = row[COLS_CORTES_V1_5.timestamp - 1];
    newRow[COLS_CORTES_V2_0.notaImportante - 1] = row[COLS_CORTES_V1_5.notaImportante - 1];

    return newRow;
}

function parseYear(yearString) {
    const str = String(yearString || '').trim();
    if (str.includes('-')) {
        const parts = str.split('-').map(p => p.trim());
        return { desde: parts[0] || '', hasta: parts[1] || '' };
    }
    return { desde: str, hasta: '' };
}

function countLikes(utilString) {
    const str = String(utilString || '').trim();
    if (!str) return 0;
    return str.split(',').length;
}


// ============================================================================
// MANEJADORES DE ACCIONES (EXISTENTES)
// ============================================================================
function handleAddCorte(payload) { /* ... sin cambios, se mantiene para no romper la app v1.5 ... */ }
function handleFileUploads(files, vehicleData) { /* ... sin cambios ... */ }
function getOrCreateFolder(parentFolder, pathArray) { /* ... sin cambios ... */ }
function updateRowData(sheet, COLS, targetRow, additionalInfo, fileUrls, colaborador) { /* ... sin cambios ... */ }
