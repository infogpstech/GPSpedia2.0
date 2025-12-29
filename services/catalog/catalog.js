// ============================================================================
// GPSPEDIA-CATALOG SERVICE (COMPATIBLE WITH DB V2.0)
// ============================================================================
// COMPONENT VERSION: 2.3.0

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
    LOGOS_MARCA: "LogosMarca",
    TUTORIALES: "Tutorial",
    RELAY: "Relay"
};

// Mapas de columnas actualizados al esquema v2.0
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

const COLS_LOGOS_MARCA = {
    id: 1,
    nombreMarca: 2,
    urlLogo: 3,
    fabricanteNombre: 4
};

const COLS_TUTORIALES = {
    ID: 1,
    Tema: 2,
    Imagen: 3,
    comoIdentificarlo: 4,
    dondeEncontrarlo: 5,
    Detalles: 6,
    Video: 7
};

const COLS_RELAY = {
    ID: 1,
    configuracion: 2,
    funcion: 3,
    vehiculoDondeSeUtiliza: 4,
    pin30Entrada: 5,
    pin85BobinaPositivo: 6,
    pin86bobinaNegativo: 7,
    pin87aComunCerrado: 8,
    pin87ComunmenteAbierto: 9,
    imagen: 10,
    observacion: 11
};

// ============================================================================
// ROUTER PRINCIPAL (doGet y doPost)
// ============================================================================
function doGet(e) {
    if (e.parameter.debug === 'true') {
        const serviceState = {
            service: 'GPSpedia-Catalog',
            version: '1.2.1',
            spreadsheetId: SPREADSHEET_ID,
            sheetsAccessed: [SHEET_NAMES.CORTES, SHEET_NAMES.TUTORIALES, SHEET_NAMES.RELAY]
        };
        return ContentService.createTextOutput(JSON.stringify(serviceState, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const defaultResponse = {
        status: 'success',
        message: 'GPSpedia Catalog-SERVICE v1.2.1 is active.'
    };
    return ContentService.createTextOutput(JSON.stringify(defaultResponse))
        .setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload || {};
    let result;

    switch (action) {
      case 'getCatalogData':
        result = handleGetCatalogData();
        break;
      case 'getDropdownData':
        result = handleGetDropdownData();
        break;
      case 'getNavigationData':
        result = handleGetNavigationData(payload);
        break;
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const errorResponse = {
      status: 'error',
      message: 'Se ha producido un error en el servidor.',
      details: {
        errorMessage: error.message,
        stack: error.stack
      }
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// MANEJADORES DE ACCIONES (HANDLERS)
// ============================================================================
/**
 * Convierte una fila de hoja de cálculo (array) en un objeto utilizando un mapa de columnas.
 * @param {Array} row - La fila de datos.
 * @param {object} colMap - El objeto que mapea nombres de clave a índices de columna (basado en 1).
 * @returns {object|null} - El objeto mapeado o null si la fila está vacía.
 */
function mapRowToObject(row, colMap) {
  if (!row || row.length === 0) {
    return null;
  }
  const obj = {};
  for (const key in colMap) {
    const colIndex = colMap[key] - 1;
    // Asegurarse de que el valor no es undefined; de lo contrario, asignar null.
    obj[key] = row[colIndex] !== undefined && row[colIndex] !== '' ? row[colIndex] : null;
  }
  return obj;
}

function handleGetCatalogData() {
    const allData = {};
    const ss = getSpreadsheet();

    // Fetch Cortes
    const cortesSheet = ss.getSheetByName(SHEET_NAMES.CORTES);
    let cortesData = [];
    if (cortesSheet) {
        const data = cortesSheet.getDataRange().getValues();
        data.shift();
        cortesData = data
          .filter(row => row && row[0]) // <-- FIX: Ignorar filas vacías (chequea si la fila existe y tiene un ID en la primera columna)
          .map(row => {
            const vehicle = mapRowToObject(row, COLS_CORTES);

            // Si por alguna razón el mapeo falla, devolvemos null para filtrarlo después
            if (!vehicle) return null;

            // Re-implementar la lógica de ordenamiento por utilidad
            const cortes = [
                { index: 1, util: parseInt(vehicle.utilCorte1, 10) || 0 },
                { index: 2, util: parseInt(vehicle.utilCorte2, 10) || 0 },
                { index: 3, util: parseInt(vehicle.utilCorte3, 10) || 0 }
            ].sort((a, b) => b.util - a.util); // Orden descendente

            const orderedVehicle = { ...vehicle };
            const tempCortes = {};

            // Guardar los datos originales de los cortes temporalmente
            for (let i = 1; i <= 3; i++) {
                tempCortes[i] = {
                    tipo: vehicle[`tipoCorte${i}`],
                    ubicacion: vehicle[`ubicacionCorte${i}`],
                    color: vehicle[`colorCableCorte${i}`],
                    config: vehicle[`configRelay${i}`],
                    img: vehicle[`imgCorte${i}`],
                    util: vehicle[`utilCorte${i}`],
                    colaborador: vehicle[`colaboradorCorte${i}`]
                };
            }

            // Reasignar los cortes en el nuevo orden
            cortes.forEach((corte, i) => {
                const newIndex = i + 1;
                const oldIndex = corte.index;
                orderedVehicle[`tipoCorte${newIndex}`] = tempCortes[oldIndex].tipo;
                orderedVehicle[`ubicacionCorte${newIndex}`] = tempCortes[oldIndex].ubicacion;
                orderedVehicle[`colorCableCorte${newIndex}`] = tempCortes[oldIndex].color;
                orderedVehicle[`configRelay${newIndex}`] = tempCortes[oldIndex].config;
                orderedVehicle[`imgCorte${newIndex}`] = tempCortes[oldIndex].img;
                orderedVehicle[`utilCorte${newIndex}`] = tempCortes[oldIndex].util;
                orderedVehicle[`colaboradorCorte${newIndex}`] = tempCortes[oldIndex].colaborador;
            });

            return orderedVehicle;
        }).filter(Boolean); // <-- FIX: Eliminar cualquier objeto nulo resultante del mapeo
    }
    allData.cortes = cortesData;

    // Fetch Logos
    const logosSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.LOGOS_MARCA);
    let logosData = [];
    if (logosSheet) {
        const data = logosSheet.getDataRange().getValues();
        data.shift();
        logosData = data.map(row => mapRowToObject(row, COLS_LOGOS_MARCA));
    }
    allData.logos = logosData;

    // Fetch Tutoriales
    const tutorialesSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.TUTORIALES);
    let tutorialesData = [];
    if (tutorialesSheet) {
        const data = tutorialesSheet.getDataRange().getValues();
        data.shift();
        tutorialesData = data.map(row => mapRowToObject(row, COLS_TUTORIALES));
    }
    allData.tutoriales = tutorialesData;

    // Fetch Relay
    const relaySheet = getSpreadsheet().getSheetByName(SHEET_NAMES.RELAY);
    let relayData = [];
    if (relaySheet) {
        const data = relaySheet.getDataRange().getValues();
        data.shift();
        relayData = data.map(row => mapRowToObject(row, COLS_RELAY));
    }
    allData.relay = relayData;

    return { status: 'success', data: allData };
}

function handleGetDropdownData() {
    try {
        const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
        if (!sheet) {
            throw new Error(`Sheet "${SHEET_NAMES.CORTES}" not found.`);
        }

        // Obtener la regla de validación de la columna "Categoría"
        const categoriaRule = sheet.getRange(2, COLS_CORTES.categoria).getDataValidation();
        const categorias = categoriaRule ? categoriaRule.getCriteriaValues()[0].getValues().flat().filter(String).sort() : [];

        const data = sheet.getDataRange().getValues();
        data.shift(); // Remove headers

        // Helper function to get unique, sorted values from a column index
        const getUniqueSortedValues = (colIndex) => {
            const values = new Set();
            data.forEach(row => {
                if (row[colIndex] && row[colIndex].toString().trim()) {
                    values.add(row[colIndex].toString().trim());
                }
            });
            return Array.from(values).sort((a, b) => a.localeCompare(b));
        };

        const marcas = getUniqueSortedValues(COLS_CORTES.marca - 1);
        const tiposCorte = getUniqueSortedValues(COLS_CORTES.tipoCorte1 -1);
        const tiposEncendido = getUniqueSortedValues(COLS_CORTES.tipoEncendido - 1);
        const configRelay = getUniqueSortedValues(COLS_CORTES.configRelay1 -1);


        const dropdownData = {
            categoria: categorias,
            marca: marcas,
            tipoDeCorte: tiposCorte,
            tipoDeEncendido: tiposEncendido,
            configRelay: configRelay
        };

        return { status: 'success', dropdowns: dropdownData };

    } catch (error) {
        return {
            status: 'error',
            message: 'Failed to get dropdown data.',
            details: { errorMessage: error.message }
        };
    }
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

/**
 * Normaliza un nombre de marca o categoría para una comparación consistente.
 * Convierte a minúsculas y elimina espacios, paréntesis y guiones.
 * @param {string} str - La cadena a normalizar.
 * @returns {string} La cadena normalizada.
 */
function normalizeName(str) {
    if (typeof str !== 'string') return '';
    return str.toLowerCase().replace(/[\s\(\)-]/g, '');
}

function handleGetNavigationData(payload) {
    const { nivel, filtros } = payload;
    if (!nivel) throw new Error("El parámetro 'nivel' es requerido.");

    const sheet = getSpreadsheet().getSheetByName(SHEET_NAMES.CORTES);
    if (!sheet) {
        // Si la hoja de Cortes no existe, no se puede navegar. Devolver una respuesta vacía y válida.
        return { status: 'success', data: [], nextNivel: 'final' };
    }
    const allData = sheet.getDataRange().getValues();
    allData.shift(); // Quitar encabezados

    let data = allData;

    // Aplicar filtros jerárquicos
    if (filtros) {
        if (filtros.categoria) data = data.filter(row => row[COLS_CORTES.categoria - 1] === filtros.categoria);
        if (filtros.marca) data = data.filter(row => row[COLS_CORTES.marca - 1] === filtros.marca);
        if (filtros.modelo) data = data.filter(row => row[COLS_CORTES.modelo - 1] === filtros.modelo);
        if (filtros.version) data = data.filter(row => row[COLS_CORTES.versionesAplicables - 1] === filtros.version);
        if (filtros.tipoEncendido) data = data.filter(row => row[COLS_CORTES.tipoEncendido - 1] === filtros.tipoEncendido);
    }

    let results = [];
    let nextNivel = null;

    const getUniqueValues = (colIndex) => [...new Set(data.map(row => row[colIndex]).filter(Boolean))].sort();

    switch (nivel) {
        case 'categoria':
            const order = ["Sedán", "SUV", "Pickup", "Motocicleta", "Microbús", "Autobús", "Camión Ligero", "Camión Pesado", "Maquinaria de construcción", "Equipo Utilitario"];
            results = [...new Set(allData.map(row => row[COLS_CORTES.categoria - 1]).filter(Boolean))]
                .sort((a, b) => {
                    const indexA = order.indexOf(a);
                    const indexB = order.indexOf(b);
                    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });
            nextNivel = 'marca';
            break;

        case 'marca':
            const brandNames = getUniqueValues(COLS_CORTES.marca - 1);
            const logosSheet = getSpreadsheet().getSheetByName(SHEET_NAMES.LOGOS_MARCA);
            const logosData = logosSheet.getDataRange().getValues();
            logosData.shift();
            const allLogos = logosData.map(row => mapRowToObject(row, COLS_LOGOS_MARCA));

            results = brandNames.map(brand => {
                const normalizedBrand = normalizeName(brand);
                const categoria = filtros.categoria;
                let foundLogo = null;
                // 1. Buscar coincidencia específica de categoría (ej. "hondaMotocicletas")
                if (categoria) {
                    const categorySpecificName = normalizeName(`${brand}${categoria}`);
                    foundLogo = allLogos.find(logo => normalizeName(logo.nombreMarca) === categorySpecificName);
                }
                // 2. Si no se encuentra, buscar por nombre de marca general (ej. "honda")
                if (!foundLogo) {
                    foundLogo = allLogos.find(logo => normalizeName(logo.nombreMarca) === normalizedBrand);
                }
                return {
                    nombreMarca: brand,
                    urlLogo: foundLogo ? foundLogo.urlLogo : null
                };
            });
            nextNivel = 'modelo';
            break;

        case 'modelo':
            results = getUniqueValues(COLS_CORTES.modelo - 1);
            nextNivel = 'version';
            break;

        case 'version':
            results = getUniqueValues(COLS_CORTES.versionesAplicables - 1);
            if (results.length === 0 || (results.length === 1 && results[0] === '')) {
                // Si no hay versiones, saltar directamente a tipoEncendido
                const nextPayload = { nivel: 'tipoEncendido', filtros: filtros };
                return handleGetNavigationData(nextPayload);
            }
            nextNivel = 'tipoEncendido';
            break;

        case 'tipoEncendido':
            results = getUniqueValues(COLS_CORTES.tipoEncendido - 1);
             if (results.length === 1) {
                // Si solo hay un tipo de encendido, saltar a generación
                const newFilters = {...filtros, tipoEncendido: results[0]};
                const nextPayload = { nivel: 'generacion', filtros: newFilters };
                return handleGetNavigationData(nextPayload);
            }
            nextNivel = 'generacion';
            break;

        case 'generacion':
            results = data.map(row => {
                const anoDesde = row[COLS_CORTES.anoDesde - 1];
                const anoHasta = row[COLS_CORTES.anoHasta - 1];
                const id = row[COLS_CORTES.id - 1];
                return {
                    id: id,
                    label: anoHasta && anoHasta != anoDesde ? `${anoDesde} - ${anoHasta}` : `${anoDesde}`
                };
            });
            nextNivel = 'final';
            break;

        default:
            throw new Error(`Nivel '${nivel}' no reconocido.`);
    }

    // Si después de todo el procesamiento, solo hay un resultado, y no es el final,
    // se hace una llamada recursiva para avanzar al siguiente nivel automáticamente.
    // EXCEPCIÓN: No se salta el nivel 'modelo', para asegurar que el usuario siempre vea el modelo del vehículo.
    if (results.length === 1 && nextNivel !== 'final' && nivel !== 'modelo') {
         const newFilters = {...filtros};
         // El resultado puede ser un string (modelo) o un objeto (marca)
         newFilters[nivel] = (typeof results[0] === 'object' && results[0] !== null) ? results[0].nombreMarca : results[0];

         // Evitar recursión infinita en el caso de 'version' saltando a 'tipoEncendido'
         if (nivel === 'version' && results[0] === '') {
              const nextPayload = { nivel: 'tipoEncendido', filtros: filtros };
              return handleGetNavigationData(nextPayload);
         }

         const nextPayload = { nivel: nextNivel, filtros: newFilters };
         return handleGetNavigationData(nextPayload);
    }
    return { status: 'success', data: results, nextNivel: nextNivel };
}
