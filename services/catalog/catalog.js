// ============================================================================
// GPSPEDIA-CATALOG SERVICE (COMPATIBLE WITH DB V2.0)
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
    TUTORIALES: "Tutoriales",
    RELAY: "Relay"
};

// Mapas de columnas actualizados al esquema v2.0
const COLS_CORTES = {
    id: 1, categoria: 2, marca: 3, modelo: 4, versionesAplicables: 5, anoDesde: 6, anoHasta: 7, tipoEncendido: 8,
    imagenVehiculo: 9, videoGuiaDesarmeUrl: 10, contadorBusqueda: 11, tipoCorte1: 12, ubicacionCorte1: 13,
    colorCableCorte1: 14, configRelay1: 15, imgCorte1: 16, utilCorte1: 17, colaboradorCorte1: 18,
    tipoCorte2: 19, ubicacionCorte2: 20, colorCableCorte2: 21, configRelay2: 22, imgCorte2: 23,
    utilCorte2: 24, colaboradorCorte2: 25, tipoCorte3: 26, ubicacionCorte3: 27, colorCableCorte3: 28,
    configRelay3: 29, imgCorte3: 30, utilCorte3: 31, colaboradorCorte3: 32, timestamp: 33, notaImportante: 34
};
const COLS_TUTORIALES = { /* ... igual que v1.5 ... */ };
const COLS_RELAY = { /* ... igual que v1.5 ... */ };

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) { /* ... sin cambios ... */ }
function doPost(e) { /* ... sin cambios ... */ }

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================
function mapRowToObject(row, colMap) { /* ... sin cambios ... */ }

function handleGetCatalogData() {
    // ... (lógica para obtener datos de tutoriales y relay sin cambios) ...

    const cortesSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    let cortesData = [];
    if (cortesSheet) {
        const data = cortesSheet.getDataRange().getValues();
        data.shift();
        cortesData = data.map(row => {
            const vehicle = mapRowToObject(row, COLS_CORTES);

            // Lógica de Ordenamiento por Utilidad
            const cortes = [
                { index: 1, util: vehicle.utilCorte1 || 0 },
                { index: 2, util: vehicle.utilCorte2 || 0 },
                { index: 3, util: vehicle.utilCorte3 || 0 }
            ].sort((a, b) => b.util - a.util); // Orden descendente

            const orderedVehicle = { ...vehicle };
            cortes.forEach((corte, i) => {
                const newIndex = i + 1;
                const oldIndex = corte.index;
                orderedVehicle[`tipoCorte${newIndex}`] = vehicle[`tipoCorte${oldIndex}`];
                orderedVehicle[`ubicacionCorte${newIndex}`] = vehicle[`ubicacionCorte${oldIndex}`];
                orderedVehicle[`colorCableCorte${newIndex}`] = vehicle[`colorCableCorte${oldIndex}`];
                orderedVehicle[`configRelay${newIndex}`] = vehicle[`configRelay${oldIndex}`];
                orderedVehicle[`imgCorte${newIndex}`] = vehicle[`imgCorte${oldIndex}`];
                orderedVehicle[`utilCorte${newIndex}`] = vehicle[`utilCorte${oldIndex}`];
                orderedVehicle[`colaboradorCorte${newIndex}`] = vehicle[`colaboradorCorte${oldIndex}`];
            });
            return orderedVehicle;
        });
    }

    allData.cortes = cortesData;
    return { status: 'success', data: allData };
}

function handleGetDropdownData() { /* ... sin cambios, ya que los nombres de columna son los mismos ... */ }

function handleCheckVehicle(payload) {
    const { marca, modelo, anio, tipoEncendido } = payload;
    if (!marca || !modelo || !anio || !tipoEncendido) {
        throw new Error("Parámetros de búsqueda incompletos.");
    }

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    const data = sheet.getDataRange().getValues();
    data.shift();

    const paramMarca = marca.trim().toLowerCase();
    const paramModelo = modelo.trim().toLowerCase();
    const paramAnio = parseInt(anio.trim(), 10);
    const paramTipoEncendido = tipoEncendido.trim().toLowerCase();

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const sheetMarca = (row[COLS_CORTES.marca - 1] || "").toString().trim().toLowerCase();
        const sheetModelo = (row[COLS_CORTES.modelo - 1] || "").toString().trim().toLowerCase();
        const sheetVersiones = (row[COLS_CORTES.versionesAplicables - 1] || "").toString().toLowerCase();
        const sheetTipoEncendido = (row[COLS_CORTES.tipoEncendido - 1] || "").toString().trim().toLowerCase();
        const anoDesde = row[COLS_CORTES.anoDesde - 1];
        const anoHasta = row[COLS_CORTES.anoHasta - 1];

        const modeloMatch = sheetModelo === paramModelo || sheetVersiones.includes(paramModelo);
        const anioMatch = isYearInRangeV2(paramAnio, anoDesde, anoHasta);

        if (sheetMarca === paramMarca && modeloMatch && anioMatch && sheetTipoEncendido === paramTipoEncendido) {
            const existingRowData = mapRowToObject(row, COLS_CORTES);
            return { status: 'success', exists: true, data: existingRowData, rowIndex: i + 2 };
        }
    }
    return { status: 'success', exists: false };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function isYearInRangeV2(inputYear, anoDesde, anoHasta) {
    if (isNaN(inputYear)) return false;
    const desde = anoDesde ? parseInt(anoDesde, 10) : inputYear;
    const hasta = anoHasta ? parseInt(anoHasta, 10) : desde; // Si no hay 'hasta', el rango es solo un año.
    return inputYear >= desde && inputYear <= hasta;
}
