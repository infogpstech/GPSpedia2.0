// ============================================================================
// GPSPEDIA-WRITE SERVICE (STANDARDIZED FOR DB V2.0)
// ============================================================================
// COMPONENT VERSION: 2.2.2

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
// ROUTER PRINCIPAL
// ============================================================================
function doGet(e) {
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Write-SERVICE v2.2.2 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
    let response;
    try {
        const request = JSON.parse(e.postData.contents);
        if (!request.action) {
            throw new Error("La acción no fue especificada en la solicitud.");
        }

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
                throw new Error(`La acción '${request.action}' es desconocida o no es válida para el Write-Service.`);
        }
    } catch (error) {
        Logger.log(`Error en Write-Service doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error en el servidor de escritura.',
            details: { errorMessage: error.message, stack: error.stack }
        };
    }

    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================================
// HANDLERS DE ACCIONES
// ============================================================================

function handleCheckVehicle(payload) {
    const { marca, modelo, anoDesde, tipoEncendido } = payload;
    if (!marca || !modelo || !anoDesde || !tipoEncendido) {
        throw new Error("Los campos Marca, Modelo, Año y Tipo de Encendido son obligatorios para la verificación.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getDataRange().getValues();
    data.shift();

    const paramMarca = marca.trim().toLowerCase();
    const paramAnio = parseInt(anoDesde.trim(), 10);
    const paramTipoEncendido = tipoEncendido.trim().toLowerCase();

    const matches = data.map(row => mapRowToObject(row, COLS_CORTES)).filter(item => {
        const sheetMarca = (item.marca || "").toString().trim().toLowerCase();
        const sheetTipoEncendido = (item.tipoEncendido || "").toString().trim().toLowerCase();

        return sheetMarca === paramMarca &&
               sheetTipoEncendido === paramTipoEncendido &&
               isYearInRange(paramAnio, item.anoDesde, item.anoHasta) &&
               isFlexibleModelMatch(modelo, item.modelo, item.versionesAplicables);
    });

    return { status: 'success', matches };
}

function handleAddOrUpdateCut(payload) {
    const { vehicleInfo, cutInfo, colaborador, existingVehicleId } = payload;

    if (!cutInfo || !cutInfo.tipoCorte) throw new Error("La información del 'Tipo de Corte' es obligatoria.");
    if (!colaborador) throw new Error("El nombre del colaborador es obligatorio.");

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);

    if (existingVehicleId) {
        return addCutToExistingVehicle(sheet, existingVehicleId, cutInfo, colaborador);
    } else {
        if (!vehicleInfo) throw new Error("La información completa del vehículo es obligatoria para crear un nuevo registro.");
        return createNewVehicleWithCut(sheet, vehicleInfo, cutInfo, colaborador);
    }
}

function handleAddSupplementaryInfo(payload) {
    const { vehicleId, supplementaryInfo } = payload;
    if (!vehicleId || !supplementaryInfo) {
        throw new Error("Se requiere el ID del vehículo y la información suplementaria.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getDataRange().getValues();
    const idColumn = COLS_CORTES.id - 1;
    const rowIndex = data.findIndex(row => row[idColumn] == vehicleId);

    if (rowIndex === -1) {
        throw new Error(`No se encontró ningún vehículo con el ID: ${vehicleId}.`);
    }
    const rowNumber = rowIndex + 1;

    const rowData = mapRowToObject(data[rowIndex], COLS_CORTES);
    const folder = getOrCreateFolder(rowData.categoria, rowData.marca, rowData.modelo, rowData.anoDesde);

    const updates = {
        apertura: supplementaryInfo.apertura,
        imgApertura: uploadImageToDrive(supplementaryInfo.imgApertura, `apertura_${vehicleId}`, folder),
        cableAlimen: supplementaryInfo.cableAlimen,
        imgCableAlimen: uploadImageToDrive(supplementaryInfo.imgCableAlimen, `alimentacion_${vehicleId}`, folder),
        videoGuiaDesarmeUrl: supplementaryInfo.videoGuiaDesarmeUrl,
        notaImportante: supplementaryInfo.notaImportante,
        timestamp: new Date().toISOString()
    };

    for (const key in updates) {
        const value = updates[key];
        if (value && COLS_CORTES[key]) {
            sheet.getRange(rowNumber, COLS_CORTES[key]).setValue(value);
        }
    }

    return { status: 'success', message: 'Información suplementaria guardada correctamente.' };
}

// ============================================================================
// LÓGICA DE ESCRITURA AUXILIAR
// ============================================================================

function createNewVehicleWithCut(sheet, vehicleInfo, cutInfo, colaborador) {
    const lastRow = sheet.getLastRow();
    const newRowIndex = lastRow + 1;

    sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).copyTo(sheet.getRange(newRowIndex, 1, 1, sheet.getLastColumn()));
    sheet.getRange(newRowIndex, 1, 1, sheet.getLastColumn()).clearContent();

    const folder = getOrCreateFolder(vehicleInfo.categoria, vehicleInfo.marca, vehicleInfo.modelo, vehicleInfo.anoDesde);

    const newRowData = [];
    newRowData[COLS_CORTES.id - 1] = generateUniqueId();
    newRowData[COLS_CORTES.categoria - 1] = vehicleInfo.categoria;
    newRowData[COLS_CORTES.marca - 1] = vehicleInfo.marca;
    newRowData[COLS_CORTES.modelo - 1] = vehicleInfo.modelo;
    newRowData[COLS_CORTES.anoDesde - 1] = vehicleInfo.anoDesde;
    newRowData[COLS_CORTES.tipoEncendido - 1] = vehicleInfo.tipoEncendido;
    newRowData[COLS_CORTES.versionesAplicables - 1] = vehicleInfo.versionesAplicables || '';

    newRowData[COLS_CORTES.tipoCorte1 - 1] = cutInfo.tipoCorte;
    newRowData[COLS_CORTES.ubicacionCorte1 - 1] = cutInfo.ubicacionCorte || '';
    newRowData[COLS_CORTES.colorCableCorte1 - 1] = cutInfo.colorCableCorte || '';
    newRowData[COLS_CORTES.imgCorte1 - 1] = uploadImageToDrive(cutInfo.imgCorte, `corte1_${newRowData[0]}`, folder);
    newRowData[COLS_CORTES.colaboradorCorte1 - 1] = colaborador;
    newRowData[COLS_CORTES.timestamp - 1] = new Date().toISOString();

    sheet.getRange(newRowIndex, 1, 1, newRowData.length).setValues([newRowData]);

    return { status: 'success', message: 'Nuevo vehículo creado y corte guardado.', vehicleId: newRowData[COLS_CORTES.id - 1] };
}

function addCutToExistingVehicle(sheet, vehicleId, cutInfo, colaborador) {
    const data = sheet.getDataRange().getValues();
    const idColumn = COLS_CORTES.id - 1;
    const rowIndex = data.findIndex(row => row[idColumn] == vehicleId);

    if (rowIndex === -1) {
        throw new Error(`No se encontró ningún vehículo con el ID: ${vehicleId}.`);
    }
    const rowNumber = rowIndex + 1;
    const rowData = mapRowToObject(data[rowIndex], COLS_CORTES);

    let cutSlot = 0;
    for (let i = 1; i <= 3; i++) {
        if (!rowData[`tipoCorte${i}`]) {
            cutSlot = i;
            break;
        }
    }

    if (cutSlot === 0) {
        throw new Error("Este vehículo ya tiene el número máximo de cortes (3).");
    }

    const folder = getOrCreateFolder(rowData.categoria, rowData.marca, rowData.modelo, rowData.anoDesde);
    const imageUrl = uploadImageToDrive(cutInfo.imgCorte, `corte${cutSlot}_${vehicleId}`, folder);

    sheet.getRange(rowNumber, COLS_CORTES[`tipoCorte${cutSlot}`]).setValue(cutInfo.tipoCorte);
    sheet.getRange(rowNumber, COLS_CORTES[`ubicacionCorte${cutSlot}`]).setValue(cutInfo.ubicacionCorte || '');
    sheet.getRange(rowNumber, COLS_CORTES[`colorCableCorte${cutSlot}`]).setValue(cutInfo.colorCableCorte || '');
    sheet.getRange(rowNumber, COLS_CORTES[`imgCorte${cutSlot}`]).setValue(imageUrl);
    sheet.getRange(rowNumber, COLS_CORTES[`colaboradorCorte${cutSlot}`]).setValue(colaborador);
    sheet.getRange(rowNumber, COLS_CORTES.timestamp).setValue(new Date().toISOString());

    return { status: 'success', message: `Corte #${cutSlot} agregado al vehículo existente.`, vehicleId: vehicleId };
}

// ============================================================================
// HELPERS
// ============================================================================

function mapRowToObject(row, colMap) {
    const obj = {};
    for (const key in colMap) {
        obj[key] = row[colMap[key] - 1];
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
    const sheetText = `${sheetModelo || ''} ${sheetVersiones || ''}`.toLowerCase();
    for (const word of inputWords) {
        if (sheetText.includes(word)) {
            return true;
        }
    }
    return false;
}

function generateUniqueId() {
    return Utilities.getUuid();
}

function getOrCreateFolder(categoria, marca, modelo, anio) {
    const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const catFolder = getOrCreateSubFolder(rootFolder, categoria || 'SIN_CATEGORIA');
    const marcaFolder = getOrCreateSubFolder(catFolder, marca || 'SIN_MARCA');
    const modeloFolder = getOrCreateSubFolder(marcaFolder, modelo || 'SIN_MODELO');
    return getOrCreateSubFolder(modeloFolder, anio || 'SIN_AÑO');
}

function getOrCreateSubFolder(parent, name) {
    const sanitizedName = name.toString().replace(/[\/\\?%*:|"<>]/g, '-');
    const folders = parent.getFoldersByName(sanitizedName);
    return folders.hasNext() ? folders.next() : parent.createFolder(sanitizedName);
}

function uploadImageToDrive(imageData, filename, folder) {
    if (!imageData) return "";

    try {
        let blob;
        if (imageData.startsWith('http')) {
            const response = UrlFetchApp.fetch(imageData);
            blob = response.getBlob();
        } else if (imageData.startsWith('data:image')) {
            const [metadata, base64Data] = imageData.split(',');
            const mimeType = metadata.match(/:(.*?);/)[1];
            const decodedData = Utilities.base64Decode(base64Data);
            blob = Utilities.newBlob(decodedData, mimeType);
        } else {
            return "";
        }
        blob.setName(filename);
        const file = folder.createFile(blob);
        return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
    } catch (e) {
        Logger.log(`Error al subir imagen: ${e.message}`);
        return "";
    }
}
