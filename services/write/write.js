// ============================================================================
// GPSPEDIA-WRITE SERVICE (v1.0.1)
// ============================================================================

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo";
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

const COLS = {
    ID: 1, CATEGORIA: 2, IMAGEN_VEHICULO: 3, MARCA: 4, MODELO: 5, TIPO_ENCENDIDO: 6, ANIO: 7,
    TIPO_CORTE_1: 8, DESC_CORTE_1: 9, IMG_CORTE_1: 10,
    DESC_CORTE_2: 11, TIPO_CORTE_2: 12, IMG_CORTE_2: 13,
    APERTURA: 14, IMG_APERTURA: 15, NOTA_IMPORTANTE: 16, CABLES_ALIMENTACION: 17, IMG_ALIMENTACION: 18,
    COMO_DESARMAR: 19, COLABORADOR: 20,
    TIPO_CORTE_3: 21, DESC_CORTE_3: 22, IMG_CORTE_3: 23
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
    // Módulo de depuración para simular llamadas doPost a través de cURL/URL.
    // Ejemplo de uso:
    // curl -L "https://script.google.com/macros/s/URL_DEL_SCRIPT/exec?action=checkVehicle&payload=%7B%22marca%22%3A%22Toyota%22%2C%22modelo%22%3A%22Corolla%22%2C%22anio%22%3A%222020%22%2C%22tipoEncendido%22%3A%22Llave%22%7D"
    if (e.parameter.action && e.parameter.payload) {
        Logger.log("doGet: Modo de depuración activado.");
        const mockEvent = {
            postData: {
                contents: JSON.stringify({
                    action: e.parameter.action,
                    payload: JSON.parse(e.parameter.payload)
                })
            }
        };
        return doPost(mockEvent);
    }

    // Respuesta estándar si no es una llamada de depuración.
    const response = {
      status: 'success',
      message: 'GPSpedia WRITE-SERVICE v1.0.1 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    let response;
    let request;
    try {
        request = JSON.parse(e.postData.contents);

        switch (request.action) {
            case 'addCorte':
                response = handleAddCorte(request.payload);
                break;
            case 'checkVehicle':
                response = handleCheckVehicle(request.payload);
                break;
            default:
                throw new Error(`Acción desconocida en Write Service: ${request.action}`);
        }
    } catch (error) {
        Logger.log(`Error CRÍTICO en Write-Service doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error inesperado en el servicio de escritura.',
            details: { errorMessage: error.message, requestAction: (request && request.action) ? request.action : 'N/A' }
        };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================

function handleCheckVehicle(payload) {
    const { marca, modelo, anio, tipoEncendido } = payload;
    if (!marca || !modelo || !anio || !tipoEncendido) {
        throw new Error("Parámetros de búsqueda para checkVehicle están incompletos.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove headers

    let existingRowData = null;
    let rowIndex = -1;

    for(let i = 0; i < data.length; i++) {
        const row = data[i];
        if (
            (row[COLS.MARCA - 1] || "").toString().trim().toLowerCase() === marca.trim().toLowerCase() &&
            (row[COLS.MODELO - 1] || "").toString().trim().toLowerCase() === modelo.trim().toLowerCase() &&
            isYearInRange(anio, (row[COLS.ANIO - 1] || "").toString()) &&
            (row[COLS.TIPO_ENCENDIDO - 1] || "").toString().trim().toLowerCase() === tipoEncendido.trim().toLowerCase()
        ) {
            rowIndex = i + 2; // +1 for 0-based index, +1 for header row
            existingRowData = headers.reduce((obj, header, index) => {
                const camelHeader = header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").trim().split(' ').map((w, j) => j === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
                obj[camelHeader] = row[index];
                return obj;
            }, {});
            break;
        }
    }
    return { status: 'success', exists: !!existingRowData, data: existingRowData, rowIndex: rowIndex };
}


function handleAddCorte(payload) {
    const { vehicleInfo, additionalInfo, files } = payload;
    const { rowIndex, categoria, marca, modelo, anio, tipoEncendido, colaborador } = vehicleInfo;
    if (!marca || !modelo || !anio || !categoria || !tipoEncendido) throw new Error("Información esencial del vehículo está incompleta.");

    const fileUrls = handleFileUploads(files, { categoria, marca, modelo, anio });
    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);

    let targetRow;
    if (!rowIndex || rowIndex === -1) {
        const lastRow = sheet.getLastRow();
        sheet.insertRowAfter(lastRow);
        targetRow = lastRow + 1;

        const previousRowRange = sheet.getRange(lastRow, 1, 1, sheet.getMaxColumns());
        const newRowRange = sheet.getRange(targetRow, 1, 1, sheet.getMaxColumns());
        previousRowRange.copyTo(newRowRange); // Copia todo: formato, validaciones, fórmulas.
        newRowRange.clearContent(); // Limpia solo el contenido, manteniendo lo demás.

        sheet.getRange(targetRow, COLS.CATEGORIA).setValue(categoria);
        sheet.getRange(targetRow, COLS.MARCA).setValue(marca);
        sheet.getRange(targetRow, COLS.MODELO).setValue(modelo);
        sheet.getRange(targetRow, COLS.ANIO).setValue(anio);
        sheet.getRange(targetRow, COLS.TIPO_ENCENDIDO).setValue(tipoEncendido);
        if (fileUrls.imagenVehiculo) sheet.getRange(targetRow, COLS.IMAGEN_VEHICULO).setValue(fileUrls.imagenVehiculo);
    } else {
        targetRow = parseInt(rowIndex, 10);
    }

    updateRowData(sheet, targetRow, additionalInfo, fileUrls, colaborador);
    return { status: 'success', message: "Registro guardado exitosamente.", row: targetRow };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function isYearInRange(inputYear, sheetYearValue) {
  const year = parseInt(String(inputYear).trim(), 10);
  if (isNaN(year)) return false;
  const cleanedSheetYear = String(sheetYearValue).trim();
  if (cleanedSheetYear.includes('-')) {
    const parts = cleanedSheetYear.split('-').map(part => parseInt(part.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return year >= parts[0] && year <= parts[1];
    }
  }
  const sheetYearNum = parseInt(cleanedSheetYear, 10);
  return !isNaN(sheetYearNum) ? year === sheetYearNum : inputYear.trim() === cleanedSheetYear;
}

function handleFileUploads(files, vehicleData) {
    if (Object.keys(files).length === 0) return {};
    const { categoria, marca, modelo, anio } = vehicleData;
    const parentFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const anioFolder = getOrCreateFolder(parentFolder, [categoria, marca, modelo, anio]);
    const fileUrls = {};

    for (const fieldName in files) {
        const file = files[fieldName];
        if (file && file.data) {
            const fileName = `${marca}_${modelo}_${anio}_${fieldName}`;
            const decoded = Utilities.base64Decode(file.data);
            const blob = Utilities.newBlob(decoded, file.mimeType, fileName);
            const driveFile = anioFolder.createFile(blob);
            driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileUrls[fieldName] = driveFile.getUrl();
        }
    }
    return fileUrls;
}

function getOrCreateFolder(parentFolder, pathArray) {
    let currentFolder = parentFolder;
    pathArray.forEach(folderName => {
        const folders = currentFolder.getFoldersByName(folderName);
        currentFolder = folders.hasNext() ? folders.next() : currentFolder.createFolder(folderName);
    });
    return currentFolder;
}

function updateRowData(sheet, targetRow, additionalInfo, fileUrls, colaborador) {
    const { nuevoCorte, apertura, alimentacion, notas } = additionalInfo;
    const rowValues = sheet.getRange(targetRow, 1, 1, sheet.getMaxColumns()).getValues()[0];

    if (nuevoCorte && nuevoCorte.tipo && nuevoCorte.descripcion) {
        const cutSlots = [
            { typeCol: COLS.TIPO_CORTE_1, descCol: COLS.DESC_CORTE_1, imgCol: COLS.IMG_CORTE_1, imgUrl: fileUrls.imagenCorte },
            { typeCol: COLS.TIPO_CORTE_2, descCol: COLS.DESC_CORTE_2, imgCol: COLS.IMG_CORTE_2, imgUrl: fileUrls.imagenCorte },
            { typeCol: COLS.TIPO_CORTE_3, descCol: COLS.DESC_CORTE_3, imgCol: COLS.IMG_CORTE_3, imgUrl: fileUrls.imagenCorte }
        ];
        for (const slot of cutSlots) {
            if (!rowValues[slot.descCol - 1]) {
                sheet.getRange(targetRow, slot.typeCol).setValue(nuevoCorte.tipo);
                sheet.getRange(targetRow, slot.descCol).setValue(nuevoCorte.descripcion);
                if (slot.imgUrl) sheet.getRange(targetRow, slot.imgCol).setValue(slot.imgUrl);
                break;
            }
        }
    }

    if (apertura && !rowValues[COLS.APERTURA - 1]) {
        sheet.getRange(targetRow, COLS.APERTURA).setValue(apertura);
        if (fileUrls.imagenApertura) sheet.getRange(targetRow, COLS.IMG_APERTURA).setValue(fileUrls.imagenApertura);
    }
    if (alimentacion && !rowValues[COLS.CABLES_ALIMENTACION - 1]) {
        sheet.getRange(targetRow, COLS.CABLES_ALIMENTACION).setValue(alimentacion);
        if (fileUrls.imagenAlimentacion) sheet.getRange(targetRow, COLS.IMG_ALIMENTACION).setValue(fileUrls.imagenAlimentacion);
    }
    if (notas && !rowValues[COLS.NOTA_IMPORTANTE - 1]) {
        sheet.getRange(targetRow, COLS.NOTA_IMPORTANTE).setValue(notas);
    }

    const existingColaborador = (rowValues[COLS.COLABORADOR - 1] || "").toString();
    if (existingColaborador && !existingColaborador.toLowerCase().includes(colaborador.toLowerCase())) {
        sheet.getRange(targetRow, COLS.COLABORADOR).setValue(`${existingColaborador}<br>${colaborador}`);
    } else if (!existingColaborador) {
        sheet.getRange(targetRow, COLS.COLABORADOR).setValue(colaborador);
    }
}
