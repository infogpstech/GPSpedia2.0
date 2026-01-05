// GPSpedia Image-SERVICE | Version: 1.0.0
// Responsabilidad: Servir de proxy seguro para las imágenes de Google Drive.

function doGet(e) {
  // --- Parámetros de Entrada ---
  // e.parameter.fileId (String): El ID del archivo a obtener de Google Drive.

  // --- Parámetros de Salida (Éxito) ---
  // (ContentService.ImageOutput): El blob de la imagen para ser renderizado por el navegador.

  // --- Parámetros de Salida (Error) ---
  // (ContentService.TextOutput): Un objeto JSON con un mensaje de error.

  if (!e || !e.parameter || !e.parameter.fileId) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'Falta el parámetro fileId.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const fileId = e.parameter.fileId;

  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();

    // Devolver el blob de la imagen directamente.
    // El navegador lo renderizará como una imagen.
    return ContentService.createImageOutput(blob);

  } catch (error) {
    // Si el archivo no se encuentra o hay otro error, devolver un error 404 genérico.
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'Archivo no encontrado.', details: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
