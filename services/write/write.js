// ============================================================================
// GPSPEDIA-WRITE SERVICE (STANDARDIZED FOR DB V2.0)
// ============================================================================
// COMPONENT VERSION: 2.3.0

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
            service: 'GPSpedia-Write',
            version: '2.2.1',
            spreadsheetId: SPREADSHEET_ID,
            driveFolderId: DRIVE_FOLDER_ID,
            sheetsAccessed: [SHEET_NAMES.CORTES]
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.TEXT);
    }
    const defaultResponse = { status: 'success', message: 'GPSpedia Write-SERVICE v2.2.1 is active.' };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
    let response;
    try {
        const request = JSON.parse(e.postData.contents);
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
                throw new Error(`La acción '${request.action}' es desconocida.`);
        }
    } catch (error) {
        Logger.log(`Error en Write-Service doPost: ${error.stack}`);
        response = { status: 'error', message: 'Ocurrió un error en el servicio.', details: { errorMessage: error.message } };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.TEXT);
}


// ============================================================================
// HANDLERS DE ACCIONES
// ============================================================================

function handleAddOrUpdateCut(payload) {
    const { vehicleData, cutData, vehicleId, colaborador } = payload;
    if (!cutData || !colaborador) {
        throw new Error("Datos del corte y del colaborador son requeridos.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const formattedDate = Utilities.formatDate(new Date(), "GMT-6", "dd/MM/yyyy");
    let rowIndex;
    let newId;

    if (vehicleId) { // --- Lógica para vehículo EXISTENTE ---
        const ids = sheet.getRange(2, 1, sheet.getLastRow(), 1).getValues().flat();
        const existingIndex = ids.findIndex(id => id.toString() == vehicleId.toString());
        if (existingIndex === -1) throw new Error("El ID del vehículo no fue encontrado.");
        rowIndex = existingIndex + 2;

        const rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
        const vehicleInfo = mapRowToObject(rowValues, COLS_CORTES);

        let cutSlotIndex = -1;
        for (let i = 1; i <= 3; i++) {
            if (!rowValues[COLS_CORTES[`tipoCorte${i}`] - 1]) {
                cutSlotIndex = i;
                break;
            }
        }
        if (cutSlotIndex === -1) throw new Error("No hay espacios disponibles para más cortes.");

        let imageUrl = '';
        if (cutData.imgCorte1) {
            const folder = getOrCreateFolder(vehicleInfo.categoria, vehicleInfo.marca, vehicleInfo.modelo, vehicleInfo.anoDesde);
            const filename = `${sanitizeForFilename(vehicleInfo.marca)}_${sanitizeForFilename(vehicleInfo.modelo)}_${sanitizeForFilename(vehicleInfo.tipoEncendido)}_${vehicleInfo.anoDesde}_Corte${cutSlotIndex}.jpg`;
            imageUrl = uploadImageToDrive(cutData.imgCorte1, filename, folder);
        }

        sheet.getRange(rowIndex, COLS_CORTES[`tipoCorte${cutSlotIndex}`]).setValue(cutData.tipoCorte1);
        sheet.getRange(rowIndex, COLS_CORTES[`ubicacionCorte${cutSlotIndex}`]).setValue(cutData.ubicacionCorte1);
        sheet.getRange(rowIndex, COLS_CORTES[`colorCableCorte${cutSlotIndex}`]).setValue(cutData.colorCableCorte1);
        sheet.getRange(rowIndex, COLS_CORTES[`configRelay${cutSlotIndex}`]).setValue(cutData.configRelay1);
        sheet.getRange(rowIndex, COLS_CORTES[`imgCorte${cutSlotIndex}`]).setValue(imageUrl);
        sheet.getRange(rowIndex, COLS_CORTES[`colaboradorCorte${cutSlotIndex}`]).setValue(colaborador);
        sheet.getRange(rowIndex, COLS_CORTES.timestamp).setValue(formattedDate);

        newId = vehicleId;

    } else { // --- Lógica para vehículo NUEVO ---
        if (!vehicleData) throw new Error("Los datos del vehículo son requeridos para un nuevo registro.");

        const lastRow = sheet.getLastRow();
        rowIndex = lastRow + 1;

        // Copiar la fila anterior para heredar TODAS las validaciones, formatos y fórmulas.
        const previousRowRange = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn());
        const newRowRange = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn());
        previousRowRange.copyTo(newRowRange);

        // Limpiar SOLO el contenido de la fila nueva, preservando fórmulas y validaciones.
        newRowRange.clearContent();

        let newRowData = new Array(sheet.getLastColumn()).fill(null); // Usar null para no sobreescribir celdas

        // Parsear año según las reglas estrictas
        const yearInput = vehicleData.anoDesde.trim();
        let anoDesde, anioParaFolder;
        if (yearInput.includes('-')) {
            const [start, end] = yearInput.split('-').map(y => parseInt(y.trim(), 10));
            anoDesde = Math.min(start, end);
            newRowData[COLS_CORTES.anoHasta - 1] = Math.max(start, end);
        } else {
            anoDesde = parseInt(yearInput, 10);
            newRowData[COLS_CORTES.anoHasta - 1] = '';
        }
        newRowData[COLS_CORTES.anoDesde - 1] = anoDesde;
        anioParaFolder = anoDesde;

        newRowData[COLS_CORTES.marca - 1] = vehicleData.marca;
        newRowData[COLS_CORTES.modelo - 1] = vehicleData.modelo;
        newRowData[COLS_CORTES.tipoEncendido - 1] = vehicleData.tipoEncendido;
        newRowData[COLS_CORTES.categoria - 1] = vehicleData.categoria || '';
        newRowData[COLS_CORTES.versionesAplicables - 1] = vehicleData.versionesAplicables || '';

        if (vehicleData.imagenVehiculo) {
            const folder = getOrCreateFolder(vehicleData.categoria, vehicleData.marca, vehicleData.modelo, anioParaFolder);
            const filename = `${sanitizeForFilename(vehicleData.marca)}_${sanitizeForFilename(vehicleData.modelo)}_${sanitizeForFilename(vehicleData.tipoEncendido)}_${yearInput}_Vehiculo.jpg`;
            const imageUrl = uploadImageToDrive(vehicleData.imagenVehiculo, filename, folder);
            newRowData[COLS_CORTES.imagenVehiculo - 1] = imageUrl;
        }

        // Para un vehículo nuevo, el corte siempre va en el slot 1
        const cutSlotIndex = 1;
        let imageUrl = '';
        if (cutData.imgCorte1) {
            const folder = getOrCreateFolder(vehicleData.categoria, vehicleData.marca, vehicleData.modelo, anioParaFolder);
            const filename = `${sanitizeForFilename(vehicleData.marca)}_${sanitizeForFilename(vehicleData.modelo)}_${sanitizeForFilename(vehicleData.tipoEncendido)}_${anioParaFolder}_Corte${cutSlotIndex}.jpg`;
            imageUrl = uploadImageToDrive(cutData.imgCorte1, filename, folder);
        }

        newRowData[COLS_CORTES.tipoCorte1 - 1] = cutData.tipoCorte1;
        newRowData[COLS_CORTES.ubicacionCorte1 - 1] = cutData.ubicacionCorte1;
        newRowData[COLS_CORTES.colorCableCorte1 - 1] = cutData.colorCableCorte1;
        newRowData[COLS_CORTES.configRelay1 - 1] = cutData.configRelay1;
        newRowData[COLS_CORTES.imgCorte1 - 1] = imageUrl;
        newRowData[COLS_CORTES.colaboradorCorte1 - 1] = colaborador;
        newRowData[COLS_CORTES.timestamp - 1] = formattedDate;

        sheet.getRange(rowIndex, 1, 1, newRowData.length).setValues([newRowData]);

        Utilities.sleep(1500); // Espera extendida para que la fórmula del ID se calcule
        newId = sheet.getRange(rowIndex, COLS_CORTES.id).getValue();
    }

    return { status: 'success', message: `Corte agregado exitosamente.`, vehicleId: newId };
}


function handleCheckVehicle(payload) {
    const { marca, modelo, anoDesde, tipoEncendido } = payload;
    if (!marca || !modelo || !anoDesde || !tipoEncendido) {
        throw new Error("Parámetros de búsqueda incompletos.");
    }
    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const colMap = COLS_CORTES;

    const paramMarca = marca.trim().toLowerCase();
    const paramAnio = parseInt(anoDesde.trim(), 10);
    const paramTipoEncendido = tipoEncendido.trim().toLowerCase();

    const matches = data.filter(row => {
        const sheetMarca = (row[colMap.marca - 1] || "").toString().trim().toLowerCase();
        const sheetModelo = (row[colMap.modelo - 1] || "").toString();
        const sheetVersiones = (row[colMap.versionesAplicables - 1] || "").toString();
        const sheetTipoEncendido = (row[colMap.tipoEncendido - 1] || "").toString().trim().toLowerCase();
        const sheetAnoDesde = row[colMap.anoDesde - 1];
        const sheetAnoHasta = row[colMap.anoHasta - 1];

        return sheetMarca.includes(paramMarca) &&
            sheetTipoEncendido === paramTipoEncendido &&
            isYearInRange(paramAnio, sheetAnoDesde, sheetAnoHasta) &&
            isFlexibleModelMatch(modelo, sheetModelo, sheetVersiones);
    }).map(row => mapRowToObject(row, colMap));

    return { status: 'success', matches: matches };
}

function handleAddSupplementaryInfo(payload) {
    // ... (existing implementation)
}


// ============================================================================
// HELPERS
// ============================================================================
function sanitizeForFilename(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\s+/g, '_');
}

function mapRowToObject(row, colMap) {
    const obj = {};
    for (const key in colMap) {
        const colIndex = colMap[key] - 1;
        obj[key] = (colIndex < row.length) ? row[colIndex] : "";
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
    const sheetWords = new Set(`${sheetModelo.toLowerCase()} ${sheetVersiones.toLowerCase()}`.split(' ').filter(Boolean));
    for (const word of inputWords) {
        if (sheetWords.has(word)) return true;
    }
    return false;
}

function getOrCreateFolder(categoria, marca, modelo, anio) {
    const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const cat = sanitizeForFilename(categoria || 'Sin_Categoria');
    const mar = sanitizeForFilename(marca || 'Sin_Marca');
    const mod = sanitizeForFilename(modelo || 'Sin_Modelo');
    const an = sanitizeForFilename(anio || 'Sin_Año');

    const categoriaFolder = getOrCreateSubFolder(rootFolder, cat);
    const marcaFolder = getOrCreateSubFolder(categoriaFolder, mar);
    const modeloFolder = getOrCreateSubFolder(marcaFolder, mod);
    return getOrCreateSubFolder(modeloFolder, an);
}

function getOrCreateSubFolder(parentFolder, name) {
    const folders = parentFolder.getFoldersByName(name);
    if (folders.hasNext()) return folders.next();
    return parentFolder.createFolder(name);
}

function uploadImageToDrive(imageData, filename, folder) {
    if (!imageData) return "";
    let blob;
    if (imageData.startsWith('http')) {
        try {
            blob = UrlFetchApp.fetch(imageData).getBlob().setName(filename);
        } catch (e) {
            console.error(`Failed to fetch image from URL: ${imageData}. Error: ${e.message}`);
            return "";
        }
    } else if (imageData.startsWith('data:image/')) {
        try {
            const parts = imageData.split(',');
            const mimeType = parts[0].match(/:(.*?);/)[1];
            const decodedData = Utilities.base64Decode(parts[1]);
            blob = Utilities.newBlob(decodedData, mimeType, filename);
        } catch (e) {
            console.error(`Failed to decode base64. Error: ${e.message}`);
            return "";
        }
    } else {
        console.error("Unrecognized image data format.");
        return "";
    }
    const file = folder.createFile(blob);
    return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
}
