LOGS.TXT - GPSpedia Versión 1.5 (Registro de Cambios y Mejoras)
GPSpedia Versión 1.5 (Estable) Estatus: Actualización mayor de infraestructura y gestión de datos.
1. Resumen del Salto Generacional
La versión 1.5 transforma la herramienta de un catálogo de consulta estática (v1.0) a una plataforma de gestión técnica colaborativa. Se ha pasado de una arquitectura de "solo lectura" a un sistema de "escritura y procesamiento" en la nube.
2. Registro de Cambios (Changelog)
 * Integración de Backend Activo (Code.gs): Se implementó una API personalizada mediante Google Apps Script que permite a la aplicación procesar solicitudes complejas, gestionar archivos y comunicarse directamente con Google Sheets y Drive.
 * Módulo de Carga de Datos (add_cortes.html): Se añadió una interfaz dedicada para que los técnicos suban nuevos registros. Este formulario elimina la dependencia de cargar datos manualmente en la hoja de cálculo.
 * Procesamiento de Imágenes en Tiempo Real: Ahora la aplicación permite capturar o seleccionar fotos desde el móvil, convirtiéndolas automáticamente a formato Base64 para su carga inmediata.
 * Automatización de Google Drive: Implementación de lógica para la creación automática de carpetas. El sistema ahora organiza las fotos por marca de vehículo sin intervención humana.
 * Validación Dinámica de Datos: Los campos de selección (Marca, Modelo, Tipo de encendido) ya no son fijos; ahora se sincronizan con las reglas de validación de la base de datos para evitar errores de duplicidad o nombres incorrectos.
 * Sistema de Miniaturas (Performance): Mejora en la velocidad de carga mediante la conversión de enlaces de Drive en thumbnails optimizados, reduciendo el consumo de megas en dispositivos móviles.
 * Actualización de Caché (Service Worker v4): Se optimizó el ciclo de vida del Service Worker para asegurar que el nuevo módulo de carga esté disponible incluso en zonas con cobertura de red inestable (Edge/2G).
 * Navegación Fluida (History API): Se integró la gestión de estados del historial (pushState), permitiendo que el botón "atrás" del teléfono cierre modales o limpie búsquedas en lugar de cerrar la aplicación completa.
3. Mejoras en la Experiencia de Usuario (UX/UI)
 * Formulario Multi-Fase: La carga de información se dividió en tres fases (Vehículo, Cortes, Imágenes) para no abrumar al usuario y garantizar que no se pierdan datos durante el proceso.
 * Indicadores de Carga (Loading Overlays): Se añadieron capas visuales de "Procesando..." que informan al usuario mientras las imágenes se suben a la nube, evitando envíos duplicados.
 * Sanitización de Texto: Mejora en los algoritmos de limpieza de texto que normalizan nombres de vehículos (eliminando tildes y caracteres especiales) para mantener la base de datos profesional y uniforme.
 * Diseño Adaptativo Reforzado: El nuevo formulario utiliza variables CSS dinámicas que se ajustan mejor a diferentes tamaños de pantalla y modos de visualización.
Nota Técnica para el Administrador:
Con esta infraestructura, el sistema está listo para el siguiente paso: la administracion de cuentas, feedbacks, reportes, actualización de informacion proactiva y mas mejoras planteadas para mejorar y facilitar las instalaciones de sostemas gps.
