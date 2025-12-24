// ============================================================================
// GPSPEDIA-WRITE SERVICE | Version: 1.1.0
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

// --- MAPEO DE COLUMNAS ESTÁTICO ---
// Refactorización para eliminar el mapeo dinámico y aumentar la robustez.
const COLS_CORTES = {
    id: 1,
    categoria: 2,
    marca: 3,
    modelo: 4,
    anoGeneracion: 5,
    tipoDeEncendido: 6,
    colaborador: 7,
    util: 8,
    tipoDeCorte: 9,
    descripcionDelCorte: 10,
    imagenDelCorte: 11,
    tipoDeCorte2: 12,
    descripcionDelSegundoCorte: 13,
    imagenDeCorte2: 14,
    tipoDeCorte3: 15,
    descripcionDelCorte3: 16,
    imagenDelCorte3: 17,
    apertura: 18,
    imagenDeLaApertura: 19,
    cablesDeAlimentacion: 20,
    imagenDeLosCablesDeAlimentacion: 21,
    comoDesarmarLosPlasticos: 22,
    notaImportante: 23,
    timestamp: 24,
    imagenDelVehiculo: 25
};


// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
  try {
    const response = {
      status: 'success',
      message: 'GPSpedia WRITE-SERVICE v1.1.0 is active.'
    };
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorResponse = {
        status: 'error',
        message: 'Error en el servidor (doGet).',
        details: { message: error.message }
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
        request = JSON.parse(e.postData.contents);

        switch (request.action) {
            case 'addCorte':
                response = handleAddCorte(request.payload);
                break;
            default:
                throw new Error(`Acción desconocida en Write Service: ${request.action}`);
        }
    } catch (error) {
        Logger.log(`Error CRÍTICO en Write-Service doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error inesperado en el servicio de escritura.',
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

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================

function handleAddCorte(payload) {
    const { vehicleInfo, additionalInfo, files } = payload;
    const { rowIndex, categoria, marca, modelo, anio, tipoEncendido, colaborador } = vehicleInfo;

    if (!marca || !modelo || !anio || !categoria || !tipoEncendido) {
        throw new Error("Información esencial del vehículo está incompleta.");
    }

    const fileUrls = handleFileUploads(files, { categoria, marca, modelo, anio });
    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);

    let targetRow;
    const isNewRow = !rowIndex || rowIndex === -1;

    if (isNewRow) {
        const lastRow = sheet.getLastRow();
        sheet.insertRowAfter(lastRow);
        targetRow = lastRow + 1;

        const previousRowRange = sheet.getRange(lastRow, 1, 1, sheet.getMaxColumns());
        const newRowRange = sheet.getRange(targetRow, 1, 1, sheet.getMaxColumns());
        previousRowRange.copyTo(newRowRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        previousRowRange.copyTo(newRowRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
        previousRowRange.copyTo(newRowRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
        newRowRange.clearContent();

        sheet.getRange(targetRow, COLS_CORTES.categoria).setValue(categoria);
        sheet.getRange(targetRow, COLS_CORTES.marca).setValue(marca);
        sheet.getRange(targetRow, COLS_CORTES.modelo).setValue(modelo);
        sheet.getRange(targetRow, COLS_CORTES.anoGeneracion).setValue(anio);
        sheet.getRange(targetRow, COLS_CORTES.tipoDeEncendido).setValue(tipoEncendido);
        if (fileUrls.imagenVehiculo) {
            sheet.getRange(targetRow, COLS_CORTES.imagenDelVehiculo).setValue(fileUrls.imagenVehiculo);
        }
    } else {
        targetRow = parseInt(rowIndex, 10);
    }

    updateRowData(sheet, targetRow, additionalInfo, fileUrls, colaborador);

    return { status: 'success', message: "Registro guardado exitosamente.", row: targetRow };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

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
            { typeCol: COLS_CORTES.tipoDeCorte, descCol: COLS_CORTES.descripcionDelCorte, imgCol: COLS_CORTES.imagenDelCorte, imgUrl: fileUrls.imagenCorte },
            { typeCol: COLS_CORTES.tipoDeCorte2, descCol: COLS_CORTES.descripcionDelSegundoCorte, imgCol: COLS_CORTES.imagenDeCorte2, imgUrl: fileUrls.imagenCorte },
            { typeCol: COLS_CORTES.tipoDeCorte3, descCol: COLS_CORTES.descripcionDelCorte3, imgCol: COLS_CORTES.imagenDelCorte3, imgUrl: fileUrls.imagenCorte }
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

    if (apertura && !rowValues[COLS_CORTES.apertura - 1]) {
        sheet.getRange(targetRow, COLS_CORTES.apertura).setValue(apertura);
        if (fileUrls.imagenApertura) sheet.getRange(targetRow, COLS_CORTES.imagenDeLaApertura).setValue(fileUrls.imagenApertura);
    }
    if (alimentacion && !rowValues[COLS_CORTES.cablesDeAlimentacion - 1]) {
        sheet.getRange(targetRow, COLS_CORTES.cablesDeAlimentacion).setValue(alimentacion);
        if (fileUrls.imagenAlimentacion) sheet.getRange(targetRow, COLS_CORTES.imagenDeLosCablesDeAlimentacion).setValue(fileUrls.imagenAlimentacion);
    }
    if (notas && !rowValues[COLS_CORTES.notaImportante - 1]) {
        sheet.getRange(targetRow, COLS_CORTES.notaImportante).setValue(notas);
    }

    const existingColaborador = (rowValues[COLS_CORTES.colaborador - 1] || "").toString();
    if (existingColaborador && !existingColaborador.toLowerCase().includes(colaborador.toLowerCase())) {
        sheet.getRange(targetRow, COLS_CORTES.colaborador).setValue(`${existingColaborador}<br>${colaborador}`);
    } else if (!existingColaborador) {
        sheet.getRange(targetRow, COLS_CORTES.colaborador).setValue(colaborador);
    }
}
