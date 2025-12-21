# GPSpedia - Sistema de Gestión de Cortes Vehiculares (v2.0 - Arquitectura Modular)

## 1. Descripción General

GPSpedia es una Aplicación Web Progresiva (PWA) interna diseñada para técnicos e instaladores de GPS. Su objetivo principal es centralizar y estandarizar el conocimiento sobre los puntos de corte de corriente e ignición en una amplia variedad de vehículos, mejorando la eficiencia y reduciendo errores en las instalaciones.

La versión 2.0 representa una refactorización completa del sistema original, migrando de una arquitectura monolítica a una basada en **microservicios**. Este cambio mejora drásticamente el rendimiento, la escalabilidad y la facilidad de mantenimiento del proyecto.

## 2. Arquitectura del Sistema

La arquitectura de GPSpedia 2.0 se compone de tres capas principales:

1.  **Frontend (Cliente):** Una PWA construida con HTML, CSS y JavaScript puro. Se encarga de toda la interfaz de usuario y la interacción.
2.  **Backend (Servidor):** Compuesto por cinco microservicios independientes, cada uno desplegado como un proyecto de Google Apps Script.
3.  **Base de Datos:** Una única hoja de cálculo de Google Sheets que actúa como base de datos central para todos los servicios.

### Diagrama de Comunicación

```
                         ┌──────────────────┐
                         │   API_MANAGER.JS │ (Enrutador Lógico en Frontend)
                         └──────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
┌───────────────────┐   ┌────────────────────┐   ┌──────────────────┐
│ GPSpedia-Auth     │   │ GPSpedia-Catalog   │   │ GPSpedia-Write   │
│ (auth.js)         │   │ (catalog.js)       │   │ (write.js)       │
└───────────────────┘   └────────────────────┘   └──────────────────┘
           ▲                       ▲                       ▲
           │                       │                       │
┌───────────────────┐   ┌────────────────────┐             │
│ GPSpedia-Users    │   │ GPSpedia-Feedback  │             │
│ (users.js)        │   │ (feedback.js)      │             │
└───────────────────┘   └────────────────────┘             │
           │                       │                       │
           └───────────────────────▼───────────────────────┘
                                   │
                         ┌──────────────────┐
                         │  GOOGLE SHEETS   │ (Base de Datos Central)
                         └──────────────────┘
```

## 3. Componentes del Backend (Microservicios)

El backend consta de cinco servicios de Google Apps Script, cada uno con una responsabilidad única.

###  servizio 1: `GPSpedia-Auth` (`services/auth/auth.js`)
- **Responsabilidad:** Gestionar la autenticación y las sesiones de usuario.
- **Funciones Principales:**
    - `handleLogin`: Valida las credenciales del usuario contra la hoja `Users`.
    - `handleValidateSession`: Verifica si un token de sesión es válido.
- **Hojas Accedidas:** `Users` (Lectura), `ActiveSessions` (Lectura/Escritura).
- **Nota Crítica:** Este servicio utiliza un mapeo de columnas **fijo y codificado (hardcoded)** para acceder a los datos de la hoja `Users`. Cualquier cambio en el orden o nombre de las columnas de `Users` romperá el sistema de inicio de sesión.

###  servizio 2: `GPSpedia-Catalog` (`services/catalog/catalog.js`)
- **Responsabilidad:** Proveer acceso de solo lectura a los datos del catálogo.
- **Funciones Principales:**
    - `handleGetCatalogData`: Obtiene y formatea todos los datos de las hojas `Cortes`, `Tutoriales` y `Relay`.
    - `handleGetDropdownData`: Obtiene los valores para los menús desplegables del formulario de `add_cortes.html`.
    - `handleCheckVehicle`: Verifica si un vehículo ya existe en la base de datos antes de agregar uno nuevo.
- **Hojas Accedidas:** `Cortes`, `Tutoriales`, `Relay` (Solo Lectura).

###  servizio 3: `GPSpedia-Write` (`services/write/write.js`)
- **Responsabilidad:** Manejar todas las operaciones de escritura y subida de archivos.
- **Funciones Principales:**
    - `handleAddCorte`: Agrega un nuevo registro de corte o actualiza uno existente en la hoja `Cortes`.
    - `handleFileUploads`: Procesa los archivos de imagen subidos desde el frontend, los guarda en una carpeta específica de Google Drive y devuelve las URLs.
- **Hojas Accedidas:** `Cortes` (Escritura).
- **Recursos Adicionales:** Accede a una carpeta de Google Drive (`ID: 1-8QqhS-wtEFFwyBG8CmnEOp5i8rxSM-2`) para almacenar imágenes.

###  servizio 4: `GPSpedia-Feedback` (`services/feedback/feedback.js`)
- **Responsabilidad:** Gestionar la retroalimentación de los usuarios.
- **Funciones Principales:**
    - `handleRecordLike`: Registra cuando un usuario marca un corte como "útil".
    - `handleReportProblem`: Guarda un reporte de problema enviado por un usuario en la hoja `Feedbacks`.
- **Hojas Accedidas:** `Cortes` (Lectura/Escritura en la columna "Util"), `Feedbacks` (Escritura).

###  servizio 5: `GPSpedia-Users` (`services/users/users.js`)
- **Responsabilidad:** Gestionar el alta, baja y modificación de usuarios (CRUD).
- **Funciones Principales:**
    - `handleGetUsers`: Obtiene una lista de usuarios, filtrada según los privilegios del solicitante.
    - `handleCreateUser`, `handleUpdateUser`, `handleDeleteUser`: Realizan las operaciones CRUD sobre la hoja `Users`, respetando una jerarquía de permisos.
    - `handleChangePassword`: Permite a un usuario cambiar su propia contraseña.
- **Hojas Accedidas:** `Users` (Lectura/Escritura).

## 4. Componentes del Frontend (Cliente)

### `api-manager.js`
- **Propósito:** Es el componente más crítico del frontend. Actúa como un **enrutador** que dirige todas las solicitudes de la aplicación al microservicio de backend correcto.
- **Funcionamiento:** Mantiene un mapa de `API_ENDPOINTS` (las URLs de cada servicio desplegado) y un `ACTION_TO_SERVICE_MAP` que asocia cada acción (ej. `'login'`) con un servicio (ej. `'AUTH'`). La función `routeAction` es la única vía de comunicación con el backend.

### `index.html`
- **Propósito:** Es la página principal de la aplicación y el catálogo principal.
- **Funcionalidad:**
    - Muestra la pantalla de inicio de sesión (`login-modal`).
    - Una vez autenticado, muestra el catálogo de cortes vehiculares.
    - Permite la navegación jerárquica: Categoría -> Marca -> Modelo -> Versión.
    - Incluye una barra de búsqueda para filtrar el contenido.
    - Presenta los datos en tarjetas interactivas que abren un modal con los detalles completos del corte.
    - Permite cambiar entre las secciones de "Cortes", "Tutoriales" y "Relay".

### `add_cortes.html`
- **Propósito:** Formulario para agregar nuevos cortes de vehículos o actualizar la información de los existentes.
- **Funcionalidad:**
    - **Fase 1 (Chequeo):** El usuario introduce los datos básicos del vehículo. El sistema verifica si ya existe.
    - **Fase 2 (Verificación):** Si el vehículo existe, muestra los datos actuales y ofrece opciones para agregar información faltante (ej. un nuevo corte, datos de apertura, etc.).
    - **Fase 3 (Entrada de Datos):** El usuario introduce los detalles del nuevo corte, sube imágenes y añade notas.
    - **Lógica de Subida de Archivos:** Las imágenes seleccionadas se convierten a formato Base64 en el cliente antes de ser enviadas al `GPSpedia-Write` service.

### `users.html`
- **Propósito:** Interfaz para la gestión de perfiles y usuarios.
- **Funcionalidad:**
    - **Mi Perfil:** Muestra la información del usuario que ha iniciado sesión y le permite cambiar su contraseña.
    - **Gestión de Usuarios:** (Visible solo para roles con permisos) Muestra una tabla con los usuarios del sistema y permite crear, editar o eliminar usuarios según una jerarquía de roles.

### `manifest.json` y `service-worker.js`
- **Propósito:** Proporcionan la funcionalidad de **Aplicación Web Progresiva (PWA)**.
- **`manifest.json`:** Define el nombre, iconos, colores y comportamiento de la aplicación cuando se instala en un dispositivo.
- **`service-worker.js`:** Gestiona el almacenamiento en caché de los recursos de la aplicación, permitiendo un funcionamiento offline limitado y tiempos de carga más rápidos. Utiliza una estrategia de "Network-First", intentando obtener siempre la versión más reciente del servidor y recurriendo a la caché solo si la red falla.

## 5. Estructura de la Base de Datos (Google Sheets)

El Spreadsheet con ID `1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo` es la única fuente de verdad para la aplicación.

- **`Users`:** Almacena la información y credenciales de los usuarios. **La estructura de esta hoja es crítica y no debe ser modificada**.
- **`Cortes`:** El catálogo principal de vehículos e información de cortes.
- **`Tutoriales`:** Contenido para la sección de tutoriales.
- **`Relay`:** Contenido para la sección de configuración de relays.
- **`Feedbacks`:** Almacena los reportes de problemas enviados por los usuarios.
- **`Logs`:** Hoja utilizada por los servicios de backend para registrar eventos de depuración y errores.
- **`ActiveSessions`:** Gestiona las sesiones de usuario activas para controlar el número de inicios de sesión simultáneos por rol.
