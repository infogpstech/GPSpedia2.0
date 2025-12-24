// ============================================================================
// GPSPEDIA-FEEDBACK SERVICE (COMPATIBLE WITH DB V2.0)
// ============================================================================
// COMPONENT VERSION: 1.2.0

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SPREADSHEET_ID = "1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs"; // <-- ACTUALIZADO A DB V2.0
let spreadsheet = null;

function getSpreadsheet() {
  if (spreadsheet === null) {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return spreadsheet;
}

const SHEET_NAMES = {
    CORTES: "Cortes",
    FEEDBACKS: "Feedbacks"
};

// Mapa de columnas para la hoja "Cortes" (v2.0)
const COLS_CORTES = {
    id: 1, categoria: 2, marca: 3, modelo: 4, versionesAplicables: 5, anoDesde: 6, anoHasta: 7, tipoEncendido: 8,
    imagenVehiculo: 9, videoGuiaDesarmeUrl: 10, contadorBusqueda: 11, tipoCorte1: 12, ubicacionCorte1: 13,
    colorCableCorte1: 14, configRelay1: 15, imgCorte1: 16, utilCorte1: 17, colaboradorCorte1: 18,
    tipoCorte2: 19, ubicacionCorte2: 20, colorCableCorte2: 21, configRelay2: 22, imgCorte2: 23,
    utilCorte2: 24, colaboradorCorte2: 25, tipoCorte3: 26, ubicacionCorte3: 27, colorCableCorte3: 28,
    configRelay3: 29, imgCorte3: 30, utilCorte3: 31, colaboradorCorte3: 32, timestamp: 33, notaImportante: 34
};

// Mapa de columnas para la hoja "Feedbacks" (v2.0)
const COLS_FEEDBACKS = {
    id: 1, usuario: 2, idVehiculo: 3, problema: 4, respuesta: 5, seResolvio: 6, responde: 7, reporteDeUtil: 8
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) { /* ... sin cambios ... */ }

function doPost(e) {
    // ... (código del router sin cambios, se añaden nuevos casos)
    switch (request.action) {
        case 'recordLike':
            response = handleRecordLike(request.payload);
            break;
        case 'reportProblem':
            response = handleReportProblem(request.payload);
            break;
        case 'assignCollaborator':
            response = handleAssignCollaborator(request.payload);
            break;
        case 'suggestYear':
            response = handleSuggestYear(request.payload);
            break;
        default:
            throw new Error(`Acción desconocida en Feedback Service: ${request.action}`);
    }
    // ...
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================

function handleRecordLike(payload) {
    const { vehicleId, corteIndex, userName } = payload;
    if (!vehicleId || !corteIndex || !userName) {
        throw new Error("Faltan datos para registrar el 'like'.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getRange(2, COLS_CORTES.id, sheet.getLastRow() - 1, 1).getValues();

    for (let i = 0; i < data.length; i++) {
        if (data[i][0] == vehicleId) {
            const rowIndex = i + 2;
            const utilColName = `utilCorte${corteIndex}`;
            const utilCol = COLS_CORTES[utilColName];

            if (!utilCol) throw new Error("Índice de corte inválido.");

            const cell = sheet.getRange(rowIndex, utilCol);
            let currentValue = cell.getValue();
            if (typeof currentValue !== 'number') currentValue = 0;

            cell.setValue(currentValue + 1);

            return { status: 'success', message: 'Like registrado.' };
        }
    }
    throw new Error("No se encontró el vehículo con el ID proporcionado.");
}

function handleAssignCollaborator(payload) {
    const { vehicleId, corteIndex, userName } = payload;
    if (!vehicleId || !corteIndex || !userName) {
        throw new Error("Faltan datos para asignar colaborador.");
    }
    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();

    for (let i = 0; i < data.length; i++) {
        if (data[i][0] == vehicleId) {
            const rowIndex = i + 2;
            const colName = `colaboradorCorte${corteIndex}`;
            const col = COLS_CORTES[colName];
            if (!col) throw new Error("Índice de corte inválido.");

            sheet.getRange(rowIndex, col).setValue(userName);
            return { status: 'success', message: 'Colaborador asignado.' };
        }
    }
    throw new Error("Vehículo no encontrado.");
}

function handleSuggestYear(payload) {
    const { vehicleId, newYear } = payload;
    if (!vehicleId || !newYear) throw new Error("Faltan datos para sugerir año.");

    const year = parseInt(newYear, 10);
    if (isNaN(year)) throw new Error("El año proporcionado no es un número válido.");

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();

    for (let i = 0; i < data.length; i++) {
        if (data[i][0] == vehicleId) {
            const rowIndex = i + 2;
            const range = sheet.getRange(rowIndex, COLS_CORTES.anoDesde, 1, 2);
            const values = range.getValues()[0];
            let anoDesde = values[0] ? parseInt(values[0], 10) : year;
            let anoHasta = values[1] ? parseInt(values[1], 10) : year;

            let updated = false;
            if (year < anoDesde) {
                anoDesde = year;
                updated = true;
            }
            if (year > anoHasta) {
                anoHasta = year;
                updated = true;
            }

            if (updated) {
                range.setValues([[anoDesde, anoHasta]]);
                return { status: 'success', message: `Rango de años actualizado a ${anoDesde}-${anoHasta}.` };
            } else {
                return { status: 'info', message: 'El año sugerido ya está dentro del rango existente.' };
            }
        }
    }
    throw new Error("Vehículo no encontrado.");
}

function handleReportProblem(payload) { /* ... sin cambios ... */ }
