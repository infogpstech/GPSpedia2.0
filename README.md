# GPSpedia - Sistema de Gestión de Cortes Vehiculares

## 1. Descripción General

GPSpedia es una aplicación web interna diseñada para técnicos e instaladores de GPS. Su objetivo principal es centralizar y estandarizar el conocimiento sobre los puntos de corte de corriente e ignición en una amplia variedad de vehículos. La aplicación permite a los técnicos consultar información detallada y colaborar añadiendo nuevos datos, optimizando así los tiempos de instalación y reduciendo errores.

La plataforma funciona como una Progressive Web App (PWA), permitiendo su instalación en la pantalla de inicio de dispositivos móviles para un acceso rápido y eficiente en campo.

## 2. Arquitectura del Sistema (Versión 2.0 - Modular)

El proyecto ha sido migrado a una arquitectura de microservicios para mejorar el rendimiento, la escalabilidad y la mantenibilidad.

*   **Frontend:** Una aplicación cliente ligera construida con HTML, CSS y JavaScript nativo.
*   **API Manager (`api-manager.js`):** Un módulo central en el frontend que actúa como un enrutador de API. Dirige todas las solicitudes al microservicio de backend correcto.
*   **Backend (Microservicios):** El backend ahora consiste en **cinco (5) proyectos independientes de Google Apps Script**, cada uno con una responsabilidad única:
    *   `GPSpedia-Auth`: Gestiona la autenticación y las sesiones de usuario.
    *   `GPSpedia-Catalog`: Provee datos de solo lectura del catálogo de vehículos.
    *   `GPSpedia-Write`: Maneja la escritura de nuevos cortes y la subida de archivos a Google Drive.
    *   `GPSpedia-Users`: Administra la creación, edición y eliminación de usuarios.
    *   `GPSpedia-Feedback`: Procesa el feedback y los reportes de problemas.
*   **Base de Datos:** Se utiliza **Google Sheets** como un sistema de base de datos robusto y fácil de gestionar.

## 3. Estructura de la Base de Datos (Google Sheets)

El Spreadsheet con ID `1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo` contiene las siguientes hojas:

### Hoja: `Users`
Almacena la información de los usuarios y sus credenciales.

*   **Columnas:**
    1.  `ID`: Identificador único para cada usuario.
    2.  `Nombre_Usuario`: Nickname utilizado para el login.
    3.  `Password`: Contraseña del usuario.
    4.  `Privilegios`: Rol del usuario (ej. `Desarrollador`, `Gefe`, `Tecnico`).
    5.  `Nombre`: Nombre completo del usuario.
    6.  `Telefono`: Número de contacto.
    7.  `Correo_Electronico`: Email de contacto.
    8.  `SessionToken`: Token de sesión para gestionar sesiones activas.

> **NOTA IMPORTANTE SOBRE LA AUTENTICACIÓN:** La lógica del servicio de autenticación (`Auth.js`) que interactúa con esta hoja ha sido **construida desde cero** para garantizar la máxima estabilidad y seguridad. Utiliza una correspondencia de columnas fija y directa (hardcoded) en lugar de un sistema dinámico. Esto significa que **el orden y el nombre de las columnas aquí definidas son críticos y no deben ser alterados**, ya que son una dependencia fundamental del sistema de inicio de sesión.

### Hoja: `Cortes`
El catálogo principal de la aplicación, contiene toda la información técnica de los vehículos.
*   **Columnas:**
    *   `ID`: Identificador único (fórmula).
    *   `Categoria`: Tipo de vehículo (ej. `Auto`, `Camioneta`).
    *   `Imagen del vehiculo`: URL a una imagen del vehículo.
    *   ... (y el resto de las columnas como estaban definidas)

### Hoja: `Feedbacks`
Registra los problemas reportados por los usuarios sobre las entradas del catálogo.
*   **Columnas:** `ID`, `Usuario`, `ID_vehiculo`, `Problema`, `Respuesta`, etc.

### Hoja: `Logs`
Utilizada para el registro remoto de errores y eventos importantes del sistema.

---

## 4. Plan de Migración a Arquitectura Modular (Plan B - v2.0)

A continuación se detalla el plan que se siguió para la migración de GPSpedia a su versión 2.0.

### 📋 FASE 1: INVENTARIO Y ANÁLISIS

**1.1 Identificar todas las funciones actuales:** Se realizó un inventario de todas las funciones en el script monolítico `Code.gs`, clasificándolas por categoría (Autenticación, Catálogo, Escritura, etc.).

**1.2 Análisis de Dependencias:** Se mapearon las dependencias entre funciones para asegurar que la separación en microservicios no rompiera la lógica existente.

### 🏗️ FASE 2: DISEÑO ARQUITECTURAL

**2.1 Definición de 5 Proyectos Apps Script:** Se diseñó la separación en cinco servicios, cada uno con su propia URL de despliegue y un conjunto limitado de permisos y funciones:
1.  **GPSPEDIA-AUTH:** Para `handleLogin`, `handleValidateSession`.
2.  **GPSPEDIA-CATALOG:** Para `handleGetCatalogData`, `handleGetDropdownData` (solo lectura).
3.  **GPSPEDIA-WRITE:** Para `handleAddCorte`, `handleFileUploads`.
4.  **GPSPEDIA-USERS:** Para todo el CRUD de usuarios.
5.  **GPSPEDIA-FEEDBACK:** Para `handleRecordLike`, `handleReportProblem`.

**2.2 Esquema de Comunicación:** Se definió un esquema donde el Frontend se comunica con el `api-manager.js`, que a su vez enruta las solicitudes al microservicio correspondiente.

### 🛠️ FASE 3: IMPLEMENTACIÓN

**3.1 Crear Proyectos Base:** Se crearon y configuraron los 5 nuevos proyectos en Google Apps Script.

**3.2 Implementar Microservicios:** Se copió y adaptó la lógica de negocio del antiguo `Code.gs` a cada nuevo servicio (`auth.js`, `catalog.js`, etc.).

### 🔄 FASE 4: REFACTOR FRONTEND

**4.1 Crear `api-manager.js`:** Se escribió el enrutador central para el frontend.

**4.2 Actualizar HTML:** Todos los archivos (`index.html`, `add_cortes.html`, `users.html`) fueron refactorizados para reemplazar las llamadas directas a `fetch` con llamadas al nuevo `routeAction` del `api-manager.js`.

### 🧪 FASE 5: TESTING Y MIGRACIÓN

**5.1 Plan de Testing:** Se ejecutaron pruebas manuales exhaustivas para cada una de las funcionalidades principales (Autenticación, Catálogo, Escritura, Usuarios, Feedback) para asegurar que la nueva arquitectura funcionaba como se esperaba.

**5.2 Estrategia de Migración:** Se siguió una estrategia de migración gradual, reemplazando los endpoints uno por uno en el `api-manager.js` a medida que se desplegaban y probaban los nuevos servicios.

### 📊 FASE 6: MONITOREO Y OPTIMIZACIÓN (Post-Migración)

**6.1 Monitoreo:** Se utilizó la hoja de `Logs` para monitorear el comportamiento de la aplicación después de la migración.

**6.2 Optimizaciones:** Se identificaron y aplicaron mejoras, principalmente en el servicio de autenticación, que fue reconstruido desde cero para máxima fiabilidad.

⚡ **BENEFICIOS ESPERADOS:**
*   **Mejora drástica en el rendimiento:** Tiempos de carga y respuesta significativamente más rápidos.
*   **Mayor disponibilidad y fiabilidad:** Al aislar los servicios, un fallo en una parte del sistema (ej. Feedback) no afecta a las funcionalidades críticas (ej. Login o Catálogo).
*   **Facilidad de mantenimiento y depuración:** La lógica de negocio está ahora organizada y es más fácil de entender y modificar.
