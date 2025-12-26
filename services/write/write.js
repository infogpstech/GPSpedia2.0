// ============================================================================
// GPSPEDIA-WRITE SERVICE (REFACTORED FOR 3-STAGE WORKFLOW)
// ============================================================================
// COMPONENT VERSION: 3.0.0

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
    CORTES: "Cortes",
    LOGOS_MARCA: "LogosMarca" // Necesario para la lógica de logos automáticos
};

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
            service: 'GPSpedia-Write',
            version: '3.0.0', // Versión actualizada
            description: 'This service implements the 3-stage workflow for adding and updating vehicle cuts.',
            spreadsheetId: SPREADSHEET_ID,
            driveFolderId: DRIVE_FOLDER_ID
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Write-SERVICE v3.0.0 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    let response;
    let request;
    try {
        request = JSON.parse(e.postData.contents);

        // Este router direcciona a la función correcta según la etapa del flujo de trabajo.
        switch (request.action) {
            // ETAPA 1: Verificación anti-duplicados
            case 'checkVehicle':
                response = handleCheckVehicle(request.payload);
                break;
            // ETAPA 2: Añadir un nuevo vehículo o un nuevo corte
            case 'addOrUpdateCut':
                response = handleAddOrUpdateCut(request.payload);
                break;
            // ETAPA 3: Añadir información suplementaria
            case 'addSupplementaryInfo':
                response = handleAddSupplementaryInfo(request.payload);
                break;
            default:
                throw new Error(`La acción '${request.action}' es desconocida en el servicio de escritura.`);
        }
    } catch (error) {
        Logger.log(`Error en Write-Service doPost: ${error.stack}`);
        response = {
            status: 'error',
            message: 'Ocurrió un error en el servicio de escritura.',
            details: { errorMessage: error.message }
        };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// ETAPA 1: VERIFICACIÓN ANTI-DUPLICADOS
// ============================================================================
function handleCheckVehicle(payload) {
    const { marca, modelo, anio, tipoEncendido } = payload;
    if (!marca || !modelo || !anio || !tipoEncendido) {
        throw new Error("Parámetros incompletos. Se requiere marca, modelo, año y tipo de encendido.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getDataRange().getValues();
    data.shift(); // Remove headers

    const paramMarca = marca.trim().toLowerCase();
    const paramAnio = parseInt(anio.trim(), 10);
    const paramTipoEncendido = tipoEncendido.trim().toLowerCase();

    const matches = data.map(row => mapRowToObject(row, COLS_CORTES)).filter(vehicle => {
        if (!vehicle || !vehicle.id) return false;

        const sheetMarca = (vehicle.marca || "").toString().trim().toLowerCase();
        const sheetTipoEncendido = (vehicle.tipoEncendido || "").toString().trim().toLowerCase();

        const anioMatch = isYearInRange(paramAnio, vehicle.anoDesde, vehicle.anoHasta);
        const modeloMatch = isFlexibleModelMatch(modelo, vehicle.modelo || "", vehicle.versionesAplicables || "");

        return sheetMarca === paramMarca && sheetTipoEncendido === paramTipoEncendido && anioMatch && modeloMatch;
    });

    return { status: 'success', matches };
}

// ============================================================================
// ETAPA 2: AÑADIR NUEVO VEHÍCULO O CORTE
// ============================================================================
function handleAddOrUpdateCut(payload) {
    const { vehicleData, cutData, vehicleId, colaborador } = payload;
    if (!cutData || !colaborador) {
        throw new Error("Datos del corte y del colaborador son requeridos.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    let rowIndex;
    let newRowData = [];
    let isNewVehicle = false;

    if (vehicleId) {
        // ACTUALIZAR VEHÍCULO EXISTENTE: Encontrar la fila por ID.
        const ids = sheet.getRange(2, COLS_CORTES.id, sheet.getLastRow() - 1, 1).getValues().flat();
        const existingIndex = ids.findIndex(id => id == vehicleId);
        if (existingIndex === -1) throw new Error("El ID del vehículo proporcionado no fue encontrado.");
        rowIndex = existingIndex + 2;
    } else {
        // CREAR VEHÍCULO NUEVO: Preparar una nueva fila.
        if (!vehicleData) throw new Error("Los datos del vehículo son requeridos para un nuevo registro.");
        isNewVehicle = true;

        const lastRow = sheet.getLastRow();
        rowIndex = lastRow + 1;

        // Heredar validaciones y formato de la fila anterior.
        const previousRowRange = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn());
        const newRowRange = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn());
        previousRowRange.copyTo(newRowRange);
        newRowRange.clearContent();

        // Poblar datos del nuevo vehículo.
        newRowData[COLS_CORTES.marca - 1] = vehicleData.marca;
        newRowData[COLS_CORTES.modelo - 1] = vehicleData.modelo;
        newRowData[COLS_CORTES.anoDesde - 1] = vehicleData.anio; // Solo se guarda 'anoDesde'.
        newRowData[COLS_CORTES.anoHasta - 1] = vehicleData.anio; // Se copia a 'anoHasta'.
        newRowData[COLS_CORTES.tipoEncendido - 1] = vehicleData.tipoEncendido;
        newRowData[COLS_CORTES.categoria - 1] = vehicleData.categoria || '';
        newRowData[COLS_CORTES.versionesAplicables - 1] = vehicleData.versionesAplicables || '';

        // Subir imagen del vehículo si se proporciona.
        if (vehicleData.imagenVehiculo) {
            const folder = getOrCreateFolder(vehicleData.categoria, vehicleData.marca, vehicleData.modelo, vehicleData.anio);
            const imageUrl = uploadImageToDrive(vehicleData.imagenVehiculo, `vehiculo_${Date.now()}`, folder);
            newRowData[COLS_CORTES.imagenVehiculo - 1] = imageUrl;
        }
    }

    // Encontrar el primer espacio disponible para el nuevo corte.
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

    // Subir la imagen del corte si se proporciona.
    let imgCorteUrl = '';
    if (cutData.imgCorte) {
        const folderData = isNewVehicle ? vehicleData : mapRowToObject(rowValues, COLS_CORTES);
        const folder = getOrCreateFolder(folderData.categoria, folderData.marca, folderData.modelo, folderData.anoDesde);
        imgCorteUrl = uploadImageToDrive(cutData.imgCorte, `corte${cutSlotIndex}_${Date.now()}`, folder);
    }

    // Preparar los datos del nuevo corte para escribirlos en la hoja.
    const cutUpdates = {};
    cutUpdates[`tipoCorte${cutSlotIndex}`] = cutData.tipoCorte;
    cutUpdates[`ubicacionCorte${cutSlotIndex}`] = cutData.ubicacionCorte;
    cutUpdates[`colorCableCorte${cutSlotIndex}`] = cutData.colorCable;
    cutUpdates[`configRelay${cutSlotIndex}`] = cutData.configRelay;
    cutUpdates[`imgCorte${cutSlotIndex}`] = imgCorteUrl;
    cutUpdates[`colaboradorCorte${cutSlotIndex}`] = colaborador;
    cutUpdates.timestamp = new Date().toLocaleDateString('es-ES'); // Actualizar timestamp.

    // Escribir los datos.
    if (isNewVehicle) {
        for (const key in cutUpdates) {
            newRowData[COLS_CORTES[key] - 1] = cutUpdates[key];
        }
        sheet.getRange(rowIndex, 1, 1, newRowData.length).setValues([newRowData]);
    } else {
        for (const key in cutUpdates) {
            sheet.getRange(rowIndex, COLS_CORTES[key]).setValue(cutUpdates[key]);
        }
    }

    const finalVehicleId = isNewVehicle ? sheet.getRange(rowIndex, COLS_CORTES.id).getValue() : vehicleId;
    return { status: 'success', message: `Corte ${cutSlotIndex} agregado exitosamente.`, vehicleId: finalVehicleId };
}

// ============================================================================
// ETAPA 3: AÑADIR INFORMACIÓN SUPLEMENTARIA
// ============================================================================
function handleAddSupplementaryInfo(payload) {
    const { vehicleId, infoData } = payload;
    if (!vehicleId || !infoData) {
        throw new Error("Se requieren el ID del vehículo y los datos a agregar.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const ids = sheet.getRange(2, COLS_CORTES.id, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => id == vehicleId);

    if (rowIndex === -1) {
        throw new Error("No se encontró el vehículo con el ID proporcionado.");
    }
    const rowNumber = rowIndex + 2;

    // Obtener datos de la fila para crear la carpeta de Drive.
    const rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
    const vehicle = mapRowToObject(rowValues, COLS_CORTES);
    const folder = getOrCreateFolder(vehicle.categoria, vehicle.marca, vehicle.modelo, vehicle.anoDesde);

    // Subir imágenes si se proporcionan.
    if (infoData.imgApertura) {
        infoData.imgAperturaUrl = uploadImageToDrive(infoData.imgApertura, `apertura_${Date.now()}`, folder);
    }
    if (infoData.imgCableAlimen) {
        infoData.imgCableAlimenUrl = uploadImageToDrive(infoData.imgCableAlimen, `alimentacion_${Date.now()}`, folder);
    }

    // Preparar las actualizaciones.
    const updates = {};
    if (infoData.apertura) updates.apertura = infoData.apertura;
    if (infoData.imgAperturaUrl) updates.imgApertura = infoData.imgAperturaUrl;
    if (infoData.cableAlimen) updates.cableAlimen = infoData.cableAlimen;
    if (infoData.imgCableAlimenUrl) updates.imgCableAlimen = infoData.imgCableAlimenUrl;
    if (infoData.notaImportante) updates.notaImportante = infoData.notaImportante;

    // Solo actualizar si hay algo que cambiar.
    if (Object.keys(updates).length > 0) {
        updates.timestamp = new Date().toLocaleDateString('es-ES'); // Actualizar timestamp.
        for (const key in updates) {
            const col = COLS_CORTES[key];
            if (col) {
                sheet.getRange(rowNumber, col).setValue(updates[key]);
            }
        }
    }

    return { status: 'success', message: 'Información suplementaria agregada correctamente.' };
}

// ============================================================================
// FUNCIONES AUXILIARES (HELPERS)
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
    const sheetWords = new Set(`${sheetModelo.toLowerCase()} ${sheetVersiones.toLowerCase()}`.split(' ').filter(Boolean));
    for (const word of inputWords) {
        if (sheetWords.has(word)) return true;
    }
    return false;
}

function getOrCreateFolder(categoria, marca, modelo, anio) {
    const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const catFolder = getOrCreateSubFolder(rootFolder, categoria || 'Sin Categoria');
    const marcaFolder = getOrCreateSubFolder(catFolder, marca || 'Sin Marca');
    const modeloFolder = getOrCreateSubFolder(marcaFolder, modelo || 'Sin Modelo');
    return getOrCreateSubFolder(modeloFolder, String(anio || 'Sin Año'));
}

function getOrCreateSubFolder(parentFolder, name) {
    const folders = parentFolder.getFoldersByName(name);
    return folders.hasNext() ? folders.next() : parentFolder.createFolder(name);
}

function uploadImageToDrive(imageData, filename, folder) {
    if (!imageData) return "";
    let blob;
    try {
        if (imageData.startsWith('http')) {
            const response = UrlFetchApp.fetch(imageData);
            blob = response.getBlob().setName(filename);
        } else if (imageData.startsWith('data:image/')) {
            const parts = imageData.split(',');
            const mimeType = parts[0].match(/:(.*?);/)[1];
            const decodedData = Utilities.base64Decode(parts[1]);
            blob = Utilities.newBlob(decodedData, mimeType, filename);
        } else {
            throw new Error("Formato de imagen no reconocido.");
        }
        const file = folder.createFile(blob);
        return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
    } catch (e) {
        Logger.log(`Fallo al subir imagen: ${e.message}`);
        return ""; // Devolver vacío en caso de error para no romper el flujo.
    }
}
