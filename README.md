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

## 3. Trabajos Pendientes (Checklist)

Esta sección documenta las tareas de desarrollo y corrección que están pendientes de implementación.

### Corrección de Errores (Bugs)
- [ ] **Reparar Secciones "Tutoriales" y "Relay":** Actualmente, estas secciones no cargan datos al ser seleccionadas. Se debe implementar la lógica de `fetch` en la función `mostrarSeccion` de `index.html` para que los datos se soliciten al backend.
- [ ] **Corregir Lógica de Imágenes del Catálogo:** La imagen que se muestra en las tarjetas de Categoría y Marca no es la correcta. Se debe ajustar la lógica para que se priorice la `imagenDelVehiculo`.
- [ ] **Error de Layout (Header):** El encabezado (barra de búsqueda) no se mantiene fijo en la parte superior al hacer scroll. Se requiere una corrección de CSS para asegurar su posición.

### Nuevas Funcionalidades y Mejoras de UI/UX
- [ ] **Implementar Menú Hamburguesa Funcional:**
    - [ ] Mover los botones de secciones ("Cortes", "Tutoriales", "Relay") del `section-selector` al interior del menú lateral (`side-menu`).
    - [ ] Mover el botón "Agregar Nuevo" al menú lateral.
    - [ ] Mover el botón de "Cerrar Sesión" del header al menú lateral.
- [ ] **Agregar Botón de Instalación PWA:** Añadir un botón de instalación personalizado que solo sea visible en navegadores web y esté oculto cuando la aplicación ya se está ejecutando como una PWA.
- [ ] **Agregar Enlaces en el Footer:** Añadir los enlaces "Sobre Nosotros", "Contáctenos" y "Preguntas Frecuentes" en el pie de página de la aplicación y agregar el html que contenga esa información y el formulario de contacto. 

## 4. Componentes del Backend (Microservicios)

El backend consta de cinco servicios de Google Apps Script, cada uno con una responsabilidad única.

### `GPSpedia-Auth` (`services/auth/auth.js`)
- **Responsabilidad:** Autenticación y sesiones de usuario.
- **Hojas Accedidas:** `Users` (Lectura), `ActiveSessions` (Lectura/Escritura).
- **Nota Crítica:** Utiliza un mapeo de columnas **fijo y codificado**. Cambios en la estructura de la hoja `Users` romperán el login.

### `GPSpedia-Catalog` (`services/catalog/catalog.js`)
- **Responsabilidad:** Acceso de solo lectura a los datos del catálogo.
- **Hojas Accedidas:** `Cortes`, `Tutoriales`, `Relay` (Solo Lectura).

### `GPSpedia-Write` (`services/write/write.js`)
- **Responsabilidad:** Escritura de datos y subida de archivos.
- **Hojas Accedidas:** `Cortes` (Escritura).
- **Recursos Adicionales:** Google Drive (`ID: 1-8QqhS-wtEFFwyBG8CmnEOp5i8rxSM-2`).

### `GPSpedia-Feedback` (`services/feedback/feedback.js`)
- **Responsabilidad:** Retroalimentación de usuarios (likes y reportes).
- **Hojas Accedidas:** `Cortes` (L/E en columna "Util"), `Feedbacks` (Escritura).

### `GPSpedia-Users` (`services/users/users.js`)
- **Responsabilidad:** Gestión CRUD de usuarios con jerarquía de roles.
- **Hojas Accedidas:** `Users` (Lectura/Escritura).

## 5. Componentes del Frontend (Cliente)

- **`api-manager.js`:** Enrutador central que dirige las solicitudes al microservicio correcto.
- **`index.html`:** Página principal, catálogo y vista de detalles.
- **`add_cortes.html`:** Formulario para agregar/actualizar cortes.
- **`users.html`:** Interfaz para gestión de perfiles y usuarios.
- **`manifest.json` y `service-worker.js`:** Habilitan la funcionalidad PWA y el caching offline.

## 6. Estructura de la Base de Datos (Google Sheets)

El Spreadsheet con ID `1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo` contiene las siguientes hojas:

### Hoja: `Users`
- **Propósito:** Almacena la información de los usuarios. **La estructura es crítica y no debe ser modificada.**
- **Columnas:** `ID`, `Nombre_Usuario`, `Password`, `Privilegios`, `Nombre`, `Telefono`, `Correo_Electronico`, `SessionToken`.

### Hoja: `Cortes`
- **Propósito:** Catálogo principal de vehículos.
- **Columnas Principales:** `ID`, `Categoría`, `Marca`, `Modelo`, `Año (Generacion)`, `Tipo de Encendido`, `Colaborador`, `Util`, `Imagen del Vehiculo`, `Tipo de Corte`, `Descripcion del Corte`, `Imagen del Corte`, `Tipo de Corte 2`, `Descripcion del Segundo Corte`, `Imagen de Corte 2`, `Tipo de Corte 3`, `Descripcion del Corte 3`, `Imagen del Corte 3`, `Apertura`, `Imagen de la Apertura`, `Cables de Alimentacion`, `Imagen de los Cables de Alimentacion`, `Nota Importante`, `Como desarmar los plasticos`.

### Hoja: `Tutoriales`
- **Propósito:** Contenido para la sección de tutoriales.
- **Columnas:** `ID`, `Tema`, `Como identificarlo`, `Donde encontrarlo`, `Detalles`, `Imagen`, `Video`.

### Hoja: `Relay`
- **Propósito:** Contenido para la sección de configuración de relays.
- **Columnas:** `ID`, `Configuracion`, `Funcion`, `Vehiculo donde se utiliza`, `PIN 30(entrada)`, `PIN 85(bobina +)`, `PIN 86(bobina - )`, `PIN 87a(comun cerrado)`, `PIN 87(Comunmente Abierto)`, `Observacion`, `Imagen`.

### Hojas de Sistema
- **`Feedbacks`:** Almacena los reportes de problemas.
- **`Logs`:** Registra eventos y errores del backend para depuración.
- **`ActiveSessions`:** Gestiona las sesiones activas para controlar inicios de sesión simultáneos.

## 7. Guía y Normas para el Desarrollo

Para mantener la consistencia, calidad y mantenibilidad del proyecto, es mandatorio seguir las siguientes normas en todo momento:

### A. Control de Versiones y Documentación
1.  **Actualización de Versión:**
    *   Cualquier cambio, por menor que sea, debe ir acompañado de una actualización en el número de versión visible para el usuario.
    *   **Archivos HTML (e.g., `index.html`):** Actualizar el número de versión en el modal de login.
    *   **Archivos de Servicio (`.js`, `.gs`):** Actualizar el número de versión en el mensaje de estado `doGet` para confirmar el despliegue exitoso.

2.  **Documentación Interna Obligatoria:**
    *   Antes de iniciar cualquier tarea, se debe consultar la documentación interna: `README.md`, `INSTRUCTIVO.TXT` y `CHANGESLOGS.txt`.
    *   Al finalizar cualquier cambio, se deben actualizar estos tres archivos de manera detallada.

3.  **Formato del `CHANGESLOGS.txt`:**
    *   Cada entrada debe incluir el archivo modificado y, de ser posible, el número de línea exacto donde se realizó el cambio para facilitar la revisión.

### B. Calidad del Código
1.  **Comentarios en el Código:**
    *   Toda línea de código nueva o modificada debe ir acompañada de un comentario claro y conciso que explique su función o el cambio realizado.
    *   El objetivo es que cualquier desarrollador pueda entender el propósito del código sin necesidad de análisis profundos.

### C. Proceso de Aprobación
1.  **Verificación Post-Commit:**
    *   No se debe 'marcar' una tarea como realizada antes de hacer un commit. La verificación final de una tarea la realiza el Project Manager después de que los cambios han sido entregados.
