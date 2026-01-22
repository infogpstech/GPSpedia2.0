# GPSpedia v2.0 - Plataforma Técnica Vehicular

## 1. Descripción General
GPSpedia es una Aplicación Web Progresiva (PWA) de alto rendimiento diseñada específicamente para técnicos e instaladores de sistemas GPS. Su propósito principal es centralizar, estandarizar y facilitar el acceso a la información crítica sobre puntos de corte (combustible, ignición, señal) y desarme de una amplia variedad de vehículos, optimizando los tiempos de instalación y reduciendo errores operativos en campo.

## 2. Características Principales (v2.0)
- **Navegación Inteligente:** Flujo jerárquico guiado por Categoría -> Marca -> Modelo -> Versión -> Año.
- **Buscador Avanzado:** Barra de búsqueda con detección automática de marcas, modelos y años, integrada con iconos visuales de cada fabricante.
- **Catálogo Optimizado:** Visualización de tarjetas con carga diferida (Lazy Load) y resoluciones adaptativas (300px, 800px, 1600px).
- **Detalle Técnico Exhaustivo:** Modales con información granular de múltiples cortes, diagramas de relay vinculados y guías de vídeo integradas.
- **Gestión de Feedback (Inbox):** Sistema integrado para reportes de problemas y sugerencias, con bandeja de entrada administrativa.
- **Dashboard de Actividad:** Registro en tiempo real de las acciones de los usuarios para auditoría.
- **Seguridad y Roles (RBAC):** Jerarquía de permisos (Desarrollador, Jefe/Gefe, Supervisor, Tecnico/Tecnico_exterior).

## 3. Arquitectura del Sistema
La plataforma utiliza una arquitectura desacoplada basada en microservicios para garantizar escalabilidad y mantenimiento independiente:

### Componentes de Backend (Google Apps Script)
El sistema se compone de **7 microservicios independientes**:
1.  **Auth:** Gestión de autenticación y validación de sesiones.
2.  **Catalog:** Provee datos técnicos de solo lectura (Cortes, Logos, Tutoriales, Relay).
3.  **Write:** Maneja la creación y actualización de registros técnicos.
4.  **Users:** Administración de usuarios y control de acceso (RBAC).
5.  **Feedback:** Procesa likes, reportes de problemas y logs de actividad (Inbox/Dashboard).
6.  **Utilities:** Funciones de mantenimiento y migración de datos.
7.  **Legacy:** Servicio de compatibilidad y log centralizado.

*Nota: Aunque existe un servicio de Image en el backend para futuras implementaciones de proxy seguro, la versión actual del frontend consume directamente las miniaturas de Google Drive para optimizar la velocidad de respuesta.*

### Componentes de Frontend
- **HTML5/CSS3/JS Modular:** Interfaz responsive con soporte nativo para Modo Oscuro.
- **api-config.js:** Única fuente de verdad para la configuración de endpoints y ruteo de acciones.
- **state.js:** Gestión de estado centralizada (Store).

---

## 4. Instrucciones de Despliegue

### Paso 1: Desplegar los Microservicios
Para cada uno de los 7 servicios en la carpeta `services/`:
1.  Cree un nuevo proyecto en [Apps Script](https://script.google.com/create).
2.  Copie el código del archivo `.js` correspondiente (ej. `services/auth/auth.js`).
3.  Configure el `SPREADSHEET_ID` en el script si es necesario.
4.  Despliegue como **Web App**:
    - **Execute as:** Me
    - **Who has access:** Anyone
5.  Copie la **Web App URL** generada.

### Paso 2: Configurar el Frontend
1.  Abra `api-config.js`.
2.  Actualice el objeto `API_ENDPOINTS` con las URLs obtenidas en el paso anterior.
    ```javascript
    export const API_ENDPOINTS = {
        AUTH:     "URL_SERVICIO_AUTH",
        CATALOG:  "URL_SERVICIO_CATALOG",
        // ... completar el resto
    };
    ```

### Paso 3: Alojamiento del Frontend
Suba los archivos del raíz (`index.html`, `style.css`, `main.js`, `api-config.js`, etc.) a su servidor web o a un proyecto principal de Apps Script que actúe como host.

---

## 5. Comparativa GPSpedia 1.5 vs 2.0

| Característica | GPSpedia 1.5 (Olds) | GPSpedia 2.0 |
| :--- | :--- | :--- |
| **Estructura** | Monolítica. | Modular (7 Microservicios). |
| **Imágenes** | Carga directa (Lenta). | Lazy Load y Multi-resolución optimizada. |
| **Seguridad** | Básica. | RBAC jerárquico y validación de tokens. |
| **Funciones** | Consulta básica. | Inbox, Dashboard, FAQ y Sistema de Feedback. |

---

## 6. Changelog resumido (v2.0)
- **Migración a Microservicios:** Separación total de lógica de negocio.
- **Sistema de Roles:** Implementación estricta de permisos por jerarquía.
- **Optimización UI:** Carga asíncrona de datos y componentes visuales reactivos.
- **Modo Oscuro:** Implementación completa con persistencia.

*Para un historial detallado de cambios, consulte `ChangesLogs.txt`.*

---
*GPSpedia v2.0 - 2026 todos los derechos reservados.*
