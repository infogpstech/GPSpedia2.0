// ============================================================================
// GPSPEDIA-WRITE SERVICE | Version: 2.0.0
// ============================================================================

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs"; // ID de GPSpedia_DB_v2.0
const DRIVE_FOLDER_ID = '1-8QqhS-wtEFFwyBG8CmnEOp5i8rxSM-2';
const GPSpedia_LOGO_URL = 'https://drive.google.com/uc?export=view&id=1m-Go3h0S2WW717zm6Fhjy-phTuXiDdUl';

let spreadsheet = null;

function getSpreadsheet() {
  if (spreadsheet === null) {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return spreadsheet;
}

const SHEET_NAMES = {
    CORTES: "Cortes",
    LOGOS: "LogosMarcas"
};

// --- MAPEO DE COLUMNAS ESTÁTICO PARA DB v2.0 ---
const COLS_CORTES = {
    id: 1,
    categoria: 2,
    marca: 3,
    modelo: 4,
    versionesAplicables: 5,
    anoDesde: 6,
    anoHasta: 7,
    tipoEncendido: 8,
    imagenVehiculo: 9,
    videoGuiaDesarmeUrl: 10,
    contadorBusqueda: 11,
    tipoCorte1: 12,
    ubicacionCorte1: 13,
    colorCableCorte1: 14,
    configRelay1: 15,
    imgCorte1: 16,
    utilCorte1: 17,
    colaboradorCorte1: 18,
    tipoCorte2: 19,
    ubicacionCorte2: 20,
    colorCableCorte2: 21,
    configRelay2: 22,
    imgCorte2: 23,
    utilCorte2: 24,
    colaboradorCorte2: 25,
    tipoCorte3: 26,
    ubicacionCorte3: 27,
    colorCableCorte3: 28,
    configRelay3: 29,
    imgCorte3: 30,
    utilCorte3: 31,
    colaboradorCorte3: 32,
    timestamp: 33,
    notaImportante: 34
};

const COLS_LOGOS = {
    id: 1,
    nombreMarca: 2,
    urlLogo: 3
};


// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================

function doGet(e) {
    try {
        // La función doGet ahora solo devuelve el estado del servicio.
        const response = {
            status: 'success',
            message: 'GPSpedia WRITE-SERVICE v2.0.0 is active.'
        };
        return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        const errorResponse = {
            status: 'error',
            message: `Error en el servidor (doGet): ${error.message}`,
            details: { stack: error.stack }
        };
        return ContentService.createTextOutput(JSON.stringify(errorResponse)).setMimeType(ContentService.MimeType.JSON);
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
            case 'executeMigration':
                // La migración ahora se activa de forma segura a través de doPost
                const userEmail = Session.getActiveUser().getEmail();
                const authorizedUsers = ['azgheall@gmail.com'];
                if (!authorizedUsers.includes(userEmail)) {
                    throw new Error('Acceso denegado. No tienes permiso para ejecutar la migración.');
                }
                response = executeMigration();
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
    // Se recibe 'anio' en lugar de 'anoDesde' o 'anoHasta'
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
        previousRowRange.copyTo(newRowRange); // Copia formato, validaciones, etc.
        newRowRange.clearContent(); // Limpia el contenido copiado

        // Lógica de negocio de la Fase 1
        const logoUrl = getLogoForMarca(marca) || GPSpedia_LOGO_URL; // Busca el logo

        sheet.getRange(targetRow, COLS_CORTES.categoria).setValue(categoria);
        sheet.getRange(targetRow, COLS_CORTES.marca).setValue(marca);
        sheet.getRange(targetRow, COLS_CORTES.modelo).setValue(modelo);
        sheet.getRange(targetRow, COLS_CORTES.anoDesde).setValue(anio); // Guarda el año único en 'anoDesde'
        sheet.getRange(targetRow, COLS_CORTES.anoHasta).setValue('');   // 'anoHasta' se deja vacío
        sheet.getRange(targetRow, COLS_CORTES.tipoEncendido).setValue(tipoEncendido);
        // La URL del logo no se guarda en la hoja 'Cortes' según el esquema v2.0
        // Se asume que el frontend la solicitará al servicio de catálogo.

        if (fileUrls.imagenVehiculo) {
            sheet.getRange(targetRow, COLS_CORTES.imagenVehiculo).setValue(fileUrls.imagenVehiculo);
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

function getLogoForMarca(marca) {
    const logoSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.LOGOS);
    if (!logoSheet) return null;

    const data = logoSheet.getRange(2, COLS_LOGOS.nombreMarca, logoSheet.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
        if ((data[i][0] || '').toString().toLowerCase() === marca.toLowerCase()) {
            return data[i][1]; // Retorna la URL del logo
        }
    }
    return null;
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
    const { nuevoCorte, videoDesarme, notas } = additionalInfo;
    const rowValues = sheet.getRange(targetRow, 1, 1, sheet.getMaxColumns()).getValues()[0];

    // Asignar nuevo corte al primer slot disponible
    if (nuevoCorte && nuevoCorte.tipo && nuevoCorte.ubicacion && nuevoCorte.color) {
        const cutSlots = [
            {
                type: COLS_CORTES.tipoCorte1, ubicacion: COLS_CORTES.ubicacionCorte1, color: COLS_CORTES.colorCableCorte1,
                img: COLS_CORTES.imgCorte1, collab: COLS_CORTES.colaboradorCorte1, imgUrl: fileUrls.imagenCorte1
            },
            {
                type: COLS_CORTES.tipoCorte2, ubicacion: COLS_CORTES.ubicacionCorte2, color: COLS_CORTES.colorCableCorte2,
                img: COLS_CORTES.imgCorte2, collab: COLS_CORTES.colaboradorCorte2, imgUrl: fileUrls.imagenCorte2
            },
            {
                type: COLS_CORTES.tipoCorte3, ubicacion: COLS_CORTES.ubicacionCorte3, color: COLS_CORTES.colorCableCorte3,
                img: COLS_CORTES.imgCorte3, collab: COLS_CORTES.colaboradorCorte3, imgUrl: fileUrls.imagenCorte3
            }
        ];

        for (const slot of cutSlots) {
            // Un slot está vacío si su campo 'tipo' no tiene valor
            if (!rowValues[slot.type - 1]) {
                sheet.getRange(targetRow, slot.type).setValue(nuevoCorte.tipo);
                sheet.getRange(targetRow, slot.ubicacion).setValue(nuevoCorte.ubicacion);
                sheet.getRange(targetRow, slot.color).setValue(nuevoCorte.color);
                sheet.getRange(targetRow, slot.collab).setValue(colaborador);
                if (slot.imgUrl) {
                    sheet.getRange(targetRow, slot.img).setValue(slot.imgUrl);
                }
                break; // Salir después de encontrar y llenar un slot
            }
        }
    }

    // Actualizar campos adicionales si están vacíos
    if (videoDesarme && !rowValues[COLS_CORTES.videoGuiaDesarmeUrl - 1]) {
        sheet.getRange(targetRow, COLS_CORTES.videoGuiaDesarmeUrl).setValue(videoDesarme);
    }
    if (notas && !rowValues[COLS_CORTES.notaImportante - 1]) {
        sheet.getRange(targetRow, COLS_CORTES.notaImportante).setValue(notas);
    }

    // Actualizar timestamp en cada modificación
    sheet.getRange(targetRow, COLS_CORTES.timestamp).setValue(new Date().toISOString());
}

// ============================================================================
// LÓGICA DE MIGRACIÓN DE DATOS
// ============================================================================

const SPREADSHEET_ID_V1_5 = "1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo";

// Mapeo de columnas para la DB v1.5 (similar al de los servicios refactorizados)
const COLS_CORTES_V1_5 = {
    id: 1, categoria: 2, marca: 3, modelo: 4, anoGeneracion: 5, tipoDeEncendido: 6,
    colaborador: 7, util: 8, tipoDeCorte: 9, descripcionDelCorte: 10, imagenDelCorte: 11,
    tipoDeCorte2: 12, descripcionDelSegundoCorte: 13, imagenDeCorte2: 14,
    tipoDeCorte3: 15, descripcionDelCorte3: 16, imagenDelCorte3: 17,
    apertura: 18, imagenDeLaApertura: 19, cablesDeAlimentacion: 20,
    imagenDeLosCablesDeAlimentacion: 21, comoDesarmarLosPlasticos: 22,
    notaImportante: 23, timestamp: 24
};

function executeMigration() {
    const oldSheet = SpreadsheetApp.openById(SPREADSHEET_ID_V1_5).getSheetByName("Cortes");
    const newSheet = getSpreadsheet().getSheetByName("Cortes");

    // Hacer idempotente: Limpiar la hoja antes de escribir.
    // Se asume que la fila 1 es de cabeceras y no se debe borrar.
    if (newSheet.getLastRow() > 1) {
        newSheet.getRange(2, 1, newSheet.getLastRow() - 1, newSheet.getLastColumn()).clearContent();
    }

    const oldData = oldSheet.getDataRange().getValues();
    oldData.shift(); // Quitar cabeceras

    const newData = [];
    let processedRows = 0;

    oldData.forEach(row => {
        try {
            const transformedRow = transformRow(row);
            newData.push(transformedRow);
            processedRows++;
        } catch (e) {
            Logger.log(`Error transformando fila con ID ${row[COLS_CORTES_V1_5.id - 1]}: ${e.message}`);
        }
    });

    if (newData.length > 0) {
        newSheet.getRange(newSheet.getLastRow() + 1, 1, newData.length, newData[0].length).setValues(newData);
    }

    return { status: 'success', message: 'Migración completada.', processedRows: processedRows, totalRows: oldData.length };
}

function transformRow(row) {
    const newRow = new Array(Object.keys(COLS_CORTES).length).fill('');

    // Mapeo directo
    newRow[COLS_CORTES.id - 1] = row[COLS_CORTES_V1_5.id - 1];
    newRow[COLS_CORTES.categoria - 1] = row[COLS_CORTES_V1_5.categoria - 1];
    newRow[COLS_CORTES.marca - 1] = row[COLS_CORTES_V1_5.marca - 1];
    newRow[COLS_CORTES.modelo - 1] = row[COLS_CORTES_V1_5.modelo - 1];
    newRow[COLS_CORTES.tipoEncendido - 1] = row[COLS_CORTES_V1_5.tipoDeEncendido - 1];
    newRow[COLS_CORTES.notaImportante - 1] = row[COLS_CORTES_V1_5.notaImportante - 1];
    newRow[COLS_CORTES.timestamp - 1] = row[COLS_CORTES_V1_5.timestamp - 1] || new Date().toISOString();

    // Transformación de año
    const [anoDesde, anoHasta] = parseYearRange(row[COLS_CORTES_V1_5.anoGeneracion - 1]);
    newRow[COLS_CORTES.anoDesde - 1] = anoDesde;
    newRow[COLS_CORTES.anoHasta - 1] = anoHasta;

    // Transformación de cortes a estructura granular
    const colaborador = row[COLS_CORTES_V1_5.colaborador - 1];

    // Corte 1
    newRow[COLS_CORTES.tipoCorte1 - 1] = row[COLS_CORTES_V1_5.tipoDeCorte - 1];
    newRow[COLS_CORTES.ubicacionCorte1 - 1] = row[COLS_CORTES_V1_5.descripcionDelCorte - 1]; // Asumiendo que descripción es ubicación
    newRow[COLS_CORTES.imgCorte1 - 1] = row[COLS_CORTES_V1_5.imagenDelCorte - 1];
    newRow[COLS_CORTES.colaboradorCorte1 - 1] = colaborador; // Se asigna el mismo colaborador a todos los cortes

    // Corte 2
    newRow[COLS_CORTES.tipoCorte2 - 1] = row[COLS_CORTES_V1_5.tipoDeCorte2 - 1];
    newRow[COLS_CORTES.ubicacionCorte2 - 1] = row[COLS_CORTES_V1_5.descripcionDelSegundoCorte - 1];
    newRow[COLS_CORTES.imgCorte2 - 1] = row[COLS_CORTES_V1_5.imagenDeCorte2 - 1];
    newRow[COLS_CORTES.colaboradorCorte2 - 1] = colaborador;

    // Corte 3
    newRow[COLS_CORTES.tipoCorte3 - 1] = row[COLS_CORTES_V1_5.tipoDeCorte3 - 1];
    newRow[COLS_CORTES.ubicacionCorte3 - 1] = row[COLS_CORTES_V1_5.descripcionDelCorte3 - 1];
    newRow[COLS_CORTES.imgCorte3 - 1] = row[COLS_CORTES_V1_5.imagenDelCorte3 - 1];
    newRow[COLS_CORTES.colaboradorCorte3 - 1] = colaborador;

    return newRow;
}

function parseYearRange(yearString) {
    if (!yearString) return ['', ''];
    const years = String(yearString).split('-').map(y => y.trim());
    if (years.length === 2) {
        return [years[0], years[1]];
    }
    return [years[0], ''];
}
