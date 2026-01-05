// ============================================================================
// GPSPEDIA-IMAGE SERVICE (PROXY SEGURO DE IMÁGENES)
// ============================================================================
// COMPONENT VERSION: 1.0.0

/**
 * @summary Este servicio actúa como un proxy seguro para las imágenes de Google Drive.
 * @description Su única responsabilidad es recibir un fileId, obtener el archivo de
 * imagen correspondiente desde Google Drive y devolverlo como un blob de datos.
 * Esta capa de abstracción es CRÍTICA para la seguridad y estabilidad del sistema:
 * 1.  **Seguridad:** El frontend NUNCA conoce la URL real de Google Drive,
 *     previniendo el acceso no autorizado o el hotlinking.
 * 2.  **Estabilidad:** Centraliza la lógica de acceso a archivos. Si Google cambia
 *     sus formatos de URL, solo este servicio necesita ser actualizado.
 * 3.  **Rendimiento:** Permite la implementación de una caché en el servidor para
 *     reducir las lecturas directas a Drive y acelerar la entrega de imágenes
 *     frecuentemente solicitadas.
 */

// ============================================================================
// ROUTER PRINCIPAL (doGet)
// ============================================================================

function doGet(e) {
  const fileId = e.parameter.fileId;

  // 1. Validación del fileId
  if (!fileId) {
    return createErrorResponse('El parámetro "fileId" es requerido.', 400);
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = `image_${fileId}`;
  const cachedImage = cache.get(cacheKey);

  // 2. Servir desde la caché si está disponible
  if (cachedImage) {
    try {
      const imageBlob = Utilities.newBlob(
        Utilities.base64Decode(cachedImage),
        guessMimeType(fileId)
      );
      return ContentService.createImage(imageBlob);
    } catch (cacheError) {
      // Si hay un error con los datos cacheados, proceder a obtenerlos de Drive.
    }
  }

  // 3. Obtener el archivo de Google Drive
  try {
    const file = DriveApp.getFileById(fileId);
    const imageBlob = file.getBlob();

    // 4. Guardar en caché para futuras solicitudes (expira en 6 horas)
    cache.put(cacheKey, Utilities.base64Encode(imageBlob.getBytes()), 21600);

    // 5. Devolver la imagen
    return ContentService.createImage(imageBlob);

  } catch (error) {
    // 6. Manejo de errores (ej. archivo no encontrado)
    return createErrorResponse(`No se pudo encontrar o acceder al archivo con ID: ${fileId}`, 404);
  }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Crea una respuesta de error estandarizada en formato JSON.
 * @param {string} message - El mensaje de error.
 * @param {number} statusCode - Un código de estado similar a HTTP.
 * @returns {ContentService} - Una respuesta de texto JSON.
 */
function createErrorResponse(message, statusCode) {
  const error = {
    status: 'error',
    statusCode: statusCode,
    message: message
  };
  return ContentService.createTextOutput(JSON.stringify(error))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Intenta adivinar el MimeType basándose en la extensión de archivo común.
 * Esto es un fallback, ya que DriveApp suele manejar esto correctamente, pero es útil
 * al reconstruir un blob desde base64 cacheado.
 * @param {string} filenameOrId - El ID o nombre del archivo.
 * @returns {string} - El MimeType adivinado (default: 'image/jpeg').
 */
function guessMimeType(filenameOrId) {
    if (filenameOrId.toLowerCase().endsWith('.png')) {
        return 'image/png';
    }
    // Por defecto, se asume JPEG, que es el formato más común.
    return 'image/jpeg';
}
