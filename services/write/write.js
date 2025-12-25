// ============================================================================
// GPSPEDIA-WRITE SERVICE (STANDARDIZED FOR DB V2.0)
// ============================================================================
// COMPONENT VERSION: 2.1.0

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs";
const DRIVE_FOLDER_ID = '1-8QqhS-wtEFFwyBG8CmnEOp5i8rxSM-2';
let spreadsheet = null;

function getSpreadsheet() {
  if (spreadsheet === null) {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return spreadsheet;
}

const SHEET_NAMES = {
    CORTES: "Cortes"
};

// Mapa de columnas para la DB v2.0
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

// ============================================================================
// HELPERS
// ============================================================================
function mapRowToObject(row, colMap) {
    const obj = {};
    for (const key in colMap) {
        const colIndex = colMap[key] - 1;
        if (colIndex < row.length) {
            obj[key] = row[colIndex];
        }
    }
    return obj;
}

function isYearInRange(inputYear, anoDesde, anoHasta) {
    if (isNaN(inputYear)) return false;
    const desde = anoDesde ? parseInt(anoDesde, 10) : inputYear;
    const hasta = anoHasta ? parseInt(anoHasta, 10) : desde;
    return inputYear >= desde && inputYear <= hasta;
}

function isFlexibleModelMatch(inputModelo, sheetModelo, sheetVersiones) {
    const inputWords = new Set(inputModelo.toLowerCase().split(' ').filter(Boolean));
    const sheetWords = new Set(
        `${sheetModelo.toLowerCase()} ${sheetVersiones.toLowerCase()}`.split(' ').filter(Boolean)
    );
    for (const word of inputWords) {
        if (sheetWords.has(word)) {
            return true;
        }
    }
    return false;
}


function doGet(e) {
    if (e.parameter.debug === 'true') {
        const serviceState = {
            service: 'GPSpedia-Write',
            version: '2.1.0',
            spreadsheetId: SPREADSHEET_ID,
            driveFolderId: DRIVE_FOLDER_ID,
            sheetsAccessed: [SHEET_NAMES.CORTES]
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Write-SERVICE v2.0.0 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    let response;
    let request;
    try {
        request = JSON.parse(e.postData.contents);

        // El nuevo flujo de trabajo de 3 etapas (descrito en README.md)
        // debe implementarse aquí.
        switch (request.action) {
            case 'checkVehicle':
                response = handleCheckVehicle(request.payload);
                break;
            case 'addOrUpdateCut':
                response = handleAddOrUpdateCut(request.payload);
                break;
            case 'addSupplementaryInfo':
                response = handleAddSupplementaryInfo(request.payload);
                break;
            default:
                throw new Error(`La acción '${request.action}' es desconocida o aún no ha sido implementada en Write-Service.`);
        }
    } catch (error) {
        Logger.log(`Error en Write-Service doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error en el servicio de escritura.',
            details: {
                errorMessage: error.message
            }
        };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// STAGE 2: REGISTER NEW CUT HANDLER
// ============================================================================
function handleAddOrUpdateCut(payload) {
    const { vehicleData, cutData, vehicleId, colaborador } = payload;
    if (!cutData || !colaborador) {
        throw new Error("Datos del corte y del colaborador son requeridos.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    let rowIndex;
    let newRowData = [];

    if (vehicleId) {
        // Find existing row
        const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
        const existingIndex = ids.findIndex(id => id == vehicleId);
        if (existingIndex === -1) throw new Error("El ID del vehículo proporcionado no fue encontrado.");
        rowIndex = existingIndex + 2;
    } else {
        // Create new row
        if (!vehicleData) throw new Error("Los datos del vehículo son requeridos para un nuevo registro.");

        const lastRow = sheet.getLastRow();
        const previousRowRange = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn());
        const newRowRange = sheet.getRange(lastRow + 1, 1, 1, sheet.getLastColumn());

        previousRowRange.copyTo(newRowRange);
        newRowRange.clearContent();
        rowIndex = lastRow + 1;

        newRowData[COLS_CORTES.marca - 1] = vehicleData.marca;
        newRowData[COLS_CORTES.modelo - 1] = vehicleData.modelo;
        newRowData[COLS_CORTES.anoDesde - 1] = vehicleData.anio;
        newRowData[COLS_CORTES.tipoEncendido - 1] = vehicleData.tipoEncendido;
        newRowData[COLS_CORTES.categoria - 1] = vehicleData.categoria || '';

        // Handle vehicle image upload
        if (vehicleData.imagenVehiculo) {
            const folder = getOrCreateFolder(vehicleData.categoria, vehicleData.marca, vehicleData.modelo, vehicleData.anio);
            const imageUrl = uploadImageToDrive(vehicleData.imagenVehiculo, `vehiculo_${Date.now()}`, folder);
            newRowData[COLS_CORTES.imagenVehiculo - 1] = imageUrl;
        }
    }

    // Find available cut slot
    const rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    let cutSlotIndex = -1;
    for (let i = 1; i <= 3; i++) {
        if (!rowValues[COLS_CORTES[`tipoCorte${i}`] - 1]) {
            cutSlotIndex = i;
            break;
        }
    }

    if (cutSlotIndex === -1) {
        throw new Error("No hay espacios disponibles para agregar más cortes a este vehículo.");
    }

    // Handle cut image upload
    if (cutData.imgCorte) {
        const folderData = vehicleId ? {
            categoria: rowValues[COLS_CORTES.categoria - 1],
            marca: rowValues[COLS_CORTES.marca - 1],
            modelo: rowValues[COLS_CORTES.modelo - 1],
            anio: rowValues[COLS_CORTES.anoDesde - 1]
        } : vehicleData;
        const folder = getOrCreateFolder(folderData.categoria, folderData.marca, folderData.modelo, folderData.anio);
        const imageUrl = uploadImageToDrive(cutData.imgCorte, `corte${cutSlotIndex}_${Date.now()}`, folder);
        cutData.imgCorteUrl = imageUrl;
    }

    // Prepare data for writing
    const updates = {};
    updates[`tipoCorte${cutSlotIndex}`] = cutData.tipoCorte;
    updates[`ubicacionCorte${cutSlotIndex}`] = cutData.ubicacionCorte;
    updates[`colorCableCorte${cutSlotIndex}`] = cutData.colorCable;
    updates[`configRelay${cutSlotIndex}`] = cutData.configRelay;
    updates[`imgCorte${cutSlotIndex}`] = cutData.imgCorteUrl || '';
    updates[`colaboradorCorte${cutSlotIndex}`] = colaborador;
    updates['timestamp'] = new Date().toISOString();

    if (vehicleId) {
        // Update existing row
        for (const key in updates) {
            sheet.getRange(rowIndex, COLS_CORTES[key]).setValue(updates[key]);
        }
    } else {
        // Populate new row data
        for (const key in updates) {
            newRowData[COLS_CORTES[key] - 1] = updates[key];
        }
        sheet.getRange(rowIndex, 1, 1, newRowData.length).setValues([newRowData]);
    }

    return { status: 'success', message: `Corte ${cutSlotIndex} agregado exitosamente.`, vehicleId: vehicleId || sheet.getRange(rowIndex, COLS_CORTES.id).getValue() };
}


// ============================================================================
// STAGE 1: ANTI-DUPLICATION HANDLER
// ============================================================================
function handleCheckVehicle(payload) {
    const { marca, modelo, anio, tipoEncendido } = payload;
    if (!marca || !modelo || !anio || !tipoEncendido) {
        throw new Error("Parámetros de búsqueda incompletos para la verificación.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getDataRange().getValues();
    data.shift(); // Remove headers

    const paramMarca = marca.trim().toLowerCase();
    const paramAnio = parseInt(anio.trim(), 10);
    const paramTipoEncendido = tipoEncendido.trim().toLowerCase();

    const matches = [];

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const sheetMarca = (row[COLS_CORTES.marca - 1] || "").toString().trim().toLowerCase();
        const sheetModelo = (row[COLS_CORTES.modelo - 1] || "").toString();
        const sheetVersiones = (row[COLS_CORTES.versionesAplicables - 1] || "").toString();
        const sheetTipoEncendido = (row[COLS_CORTES.tipoEncendido - 1] || "").toString().trim().toLowerCase();
        const anoDesde = row[COLS_CORTES.anoDesde - 1];
        const anoHasta = row[COLS_CORTES.anoHasta - 1];

        if (
            sheetMarca === paramMarca &&
            sheetTipoEncendido === paramTipoEncendido &&
            isYearInRange(paramAnio, anoDesde, anoHasta) &&
            isFlexibleModelMatch(modelo, sheetModelo, sheetVersiones)
        ) {
            matches.push(mapRowToObject(row, COLS_CORTES));
        }
    }

    return { status: 'success', matches: matches };
}

// ============================================================================
// GOOGLE DRIVE HELPER FUNCTIONS
// ============================================================================
function getOrCreateFolder(categoria, marca, modelo, anio) {
    const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    const categoriaFolder = getOrCreateSubFolder(rootFolder, categoria || 'Sin Categoria');
    const marcaFolder = getOrCreateSubFolder(categoriaFolder, marca || 'Sin Marca');
    const modeloFolder = getOrCreateSubFolder(marcaFolder, modelo || 'Sin Modelo');
    const anioFolder = getOrCreateSubFolder(modeloFolder, anio || 'Sin Año');

    return anioFolder;
}

function getOrCreateSubFolder(parentFolder, name) {
    const folders = parentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
        return folders.next();
    }
    return parentFolder.createFolder(name);
}

function uploadImageToDrive(base64Data, filename, folder) {
    if (!base64Data || !base64Data.startsWith('data:image/')) {
        throw new Error("Formato de imagen (base64) inválido.");
    }
    const parts = base64Data.split(',');
    const mimeType = parts[0].match(/:(.*?);/)[1];
    const decodedData = Utilities.base64Decode(parts[1]);
    const blob = Utilities.newBlob(decodedData, mimeType, filename);

    const file = folder.createFile(blob);
    return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
}

// ============================================================================
// STAGE 3: ADD SUPPLEMENTARY INFO HANDLER
// ============================================================================
function handleAddSupplementaryInfo(payload) {
    const { vehicleId, infoData } = payload;
    if (!vehicleId || !infoData) {
        throw new Error("Se requieren el ID del vehículo y los datos a agregar.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == vehicleId);

    if (rowIndex === -1) {
        throw new Error("No se encontró el vehículo con el ID proporcionado.");
    }
    const row = rowIndex + 2;

    // Get folder info from the existing row
    const rowValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const folder = getOrCreateFolder(
        rowValues[COLS_CORTES.categoria - 1],
        rowValues[COLS_CORTES.marca - 1],
        rowValues[COLS_CORTES.modelo - 1],
        rowValues[COLS_CORTES.anoDesde - 1]
    );

    // Process and upload images
    if (infoData.imgApertura) {
        infoData.imgAperturaUrl = uploadImageToDrive(infoData.imgApertura, `apertura_${Date.now()}`, folder);
    }
    if (infoData.imgCableAlimen) {
        infoData.imgCableAlimenUrl = uploadImageToDrive(infoData.imgCableAlimen, `alimentacion_${Date.now()}`, folder);
    }

    // Prepare updates
    const updates = {};
    if (infoData.apertura) updates.apertura = infoData.apertura;
    if (infoData.imgAperturaUrl) updates.imgApertura = infoData.imgAperturaUrl;
    if (infoData.cableAlimen) updates.cableAlimen = infoData.cableAlimen;
    if (infoData.imgCableAlimenUrl) updates.imgCableAlimen = infoData.imgCableAlimenUrl;
    if (infoData.notaImportante) updates.notaImportante = infoData.notaImportante;
    updates.timestamp = new Date().toISOString();

    for (const key in updates) {
        const col = COLS_CORTES[key];
        if (col) {
            sheet.getRange(row, col).setValue(updates[key]);
        }
    }

    return { status: 'success', message: 'Información suplementaria agregada correctamente.' };
}
