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

## 3. Plan Estratégico v4 (Final y Optimizado)

Esta sección define la hoja de ruta para la siguiente gran versión de GPSpedia, centrada en una re-arquitectura de datos y la implementación de funcionalidades de alta eficiencia.

### Fase 1: Migración y Lógica de Datos Fundamental
- **Objetivo:** Migrar a la nueva base de datos (DB v2.0) y establecer la lógica de negocio principal para la gestión de datos.
- **Tareas Clave:**
    - [ ] **Diseñar Nuevo Esquema:** Implementar la estructura granular detallada en la sección "Diseño Detallado de `GPSpedia_DB_v2.0`".
    - [ ] **Script de Migración:** Desarrollar un endpoint para migrar y transformar los datos de la base de datos antigua a la nueva.
    - [ ] **Lógica de Gestión de Años Simplificada:**
        - El formulario de entrada solo solicitará un único año.
        - Este año se guardará en la columna `anoDesde` al crear un nuevo registro. `anoHasta` quedará vacío.
    - [ ] **Lógica de Gestión de Logos Automatizada:**
        - Al agregar un nuevo vehículo, el sistema buscará una coincidencia en la hoja `LogosMarcas` por el campo `marca`.
        - Si se encuentra, se asociará automáticamente. Si no, se usará un logo temporal de GPSpedia. El usuario no seleccionará el logo.

### Fase 2: Sistema de Feedback Avanzado y Calidad de Datos
- **Objetivo:** Mejorar la calidad de los datos a través de la interacción del usuario.
- **Tareas Clave:**
    - [ ] **Feedback Granular:** Implementar "likes" y colaborador por cada corte individual.
    - [ ] **Ordenamiento por Utilidad:** El backend ordenará los cortes de un vehículo según su popularidad antes de enviarlos al frontend.
    - [ ] **Campos Obligatorios:** Forzar el llenado de `tipo`, `ubicación`, `color` e `imagen` para cada nuevo corte.
    - [ ] **Expansión de Rango de Años por Feedback:**
        - Implementar una nueva función de feedback que permita a los usuarios sugerir que un corte aplica a un año diferente.
        - El backend recibirá el nuevo año y actualizará `anoDesde` (si el nuevo año es menor) o `anoHasta` (si el nuevo año es mayor), expandiendo dinámicamente el rango de aplicabilidad.

### Fase 3: Funcionalidades de Gestión y Experiencia de Usuario
- **Objetivo:** Introducir herramientas de gestión y mejorar la experiencia visual y de usuario.
- **Tareas Clave:**
    - [ ] **Dashboard de Desempeño:** Crear una vista para Supervisores con métricas de contribución de técnicos.
    - [ ] **Edición "In-Modal":** Permitir la edición de datos directamente desde el modal de detalles, con permisos por rol.
    - [ ] **Enlaces de un solo uso:** Generar enlaces temporales (24h) y de un solo uso para compartir información.
    - [ ] **Notificaciones Inteligentes:** Reemplazar el banner de instalación con notificaciones "toast" sobre nuevos cortes.
    - [ ] **Visualización de Logos:**
        - Mostrar el logo de la marca (formato PNG/WEBP sin fondo) en una esquina del modal de detalle (`altura: 50px`, `anchura: auto`).
        - En la vista de listado de marcas, mostrar el logo correspondiente si existe al menos un vehículo de esa marca.

### Fase 4: Mejoras Adicionales
- **Objetivo:** Añadir funcionalidades de alto valor para el trabajo en campo.
- **Tareas Clave:**
    - [ ] **Modo Offline Robusto:** Implementar caching avanzado.
    - [ ] **Notas Personales:** Permitir a los usuarios guardar notas privadas por vehículo.
    - [ ] **Modal de Relay Anidado:** Mostrar detalles de configuraciones de Relay en un modal secundario, con la imagen de referencia limitada a `250px` de altura.

---

### **Plan de Implementación Técnica Detallado: Fase 1**

Esta sección describe los pasos técnicos específicos requeridos para ejecutar la Fase 1 del Plan Estratégico.

#### 1. Modificaciones al Servicio `GPSpedia-Write` (`write.js`)
- **Objetivo:** Reemplazar el proceso de adición de cortes por un nuevo sistema multifase basado en la lógica de `GPSpedia 1.5`, adaptado a la nueva estructura de la base de datos y con un flujo de trabajo anti-duplicado.

- **Flujo de Trabajo Detallado:**

    - **Etapa 1: Anti-duplicado y Verificación de Existencia.**
        1.  El frontend (`add_cortes.html`) inicialmente solo pedirá 4 campos: `Marca` (texto), `Modelo` (texto), `Año` (texto) y `Tipo de Encendido` (lista desplegable).
        2.  Al enviar, el backend (`write.js`) realizará una búsqueda en la hoja 'Cortes'.
        3.  **Lógica de Búsqueda:** La búsqueda será **exacta** para `Marca`, `Año` y `Tipo de Encendido`. Para `Modelo`, la búsqueda será **flexible**, encontrando coincidencias de palabras completas.
        4.  **Respuesta:** El servicio devolverá una lista de coincidencias (si las hay) al frontend. La UI mostrará los vehículos encontrados y presentará tres opciones al usuario:
            *   **Opción 1: "Es un Duplicado".** El usuario confirma que el corte ya existe. El formulario se cierra.
            *   **Opción 2: "Agregar otro corte".** El vehículo ya existe, pero el usuario quiere añadir un segundo o tercer corte. El flujo avanza a la **Etapa 2**.
            *   **Opción 3: "Agregar apertura u otra información".** El usuario quiere añadir información suplementaria a un vehículo existente. El flujo avanza a la **Etapa 3**.
        5.  **Si no hay coincidencias:** El flujo avanza directamente a la **Etapa 2**.

    - **Etapa 2: Registro de un Nuevo Corte.**
        1.  El frontend presentará los siguientes campos para el nuevo corte:
            *   `Imagen del vehículo` (botón de subida con vista previa, **solo si es un vehículo completamente nuevo**).
            *   `Tipo de corte` (lista desplegable desde Spreadsheet).
            *   `Ubicación del Corte` (área de texto).
            *   `Color del cable` (campo de texto).
            *   `Configuración de relay` (lista desplegable desde Spreadsheet, con un valor por defecto).
            *   `Agregar Imagen` del corte (botón de subida con vista previa).
        2.  Un botón "Continuar" enviará estos datos al backend.
        3.  El backend validará la información. Si es un vehículo nuevo, creará una nueva fila asegurándose de heredar las validaciones de la fila anterior. Si es un vehículo existente, encontrará la primera columna de corte disponible (`tipoCorte2`, `tipoCorte3`) y la rellenará.
        4.  Las imágenes se subirán a Google Drive bajo la estructura `Categoria/Marca/Modelo/Año`.
        5.  Se registrarán automáticamente el `colaborador` y el `timestamp`.
        6.  Una respuesta exitosa permitirá al frontend avanzar a la **Etapa 3**.

    - **Etapa 3: Adición de Información Suplementaria.**
        1.  La UI mostrará la información del corte recién añadido y presentará tres opciones en formato de acordeón desplegable:
            *   **"Agregar apertura":** Contendrá un campo de texto `Detalle de apertura` y un botón para subir la `imgApertura`.
            *   **"Cable de alimentación:":** Contendrá un campo de texto `Cable de alimentación` y un botón para subir la `imgCableAlimen`.
            *   **"Agregar nota sobre este corte":** Contendrá un área de texto para la `notaImportante`.
        2.  Un botón "Terminar" enviará toda la información suplementaria al backend, que actualizará las celdas correspondientes en la fila del vehículo existente.

#### 2. Modificaciones al Servicio `GPSpedia-Catalog` (`catalog.js`)
- **Objetivo:** Adaptar el servicio para leer desde la DB v2.0 y soportar las nuevas funcionalidades.
- **Acciones Técnicas:**
    - **Actualizar `SPREADSHEET_ID`:** La constante apuntará al ID de la nueva `GPSpedia_DB_v2.0`.
    - **Reescribir `COLS_CORTES`:** El objeto de mapeo de columnas se actualizará para reflejar la nueva estructura de 38 columnas.
    - **Refactorizar Lógica de Búsqueda:** `handleCheckVehicle` se modificará para buscar coincidencias en `modelo` y `versionesAplicables`.
    - **Implementar Ordenamiento por Utilidad:** En `handleGetCatalogData`, los bloques de corte se reordenarán en el objeto JSON de respuesta basándose en el conteo de "likes" en `utilCorteX` antes de ser enviados al frontend.

#### 3. Modificaciones al Servicio `GPSpedia-Feedback` (`feedback.js`)
- **Objetivo:** Adaptar el servicio para gestionar feedback por corte individual y la expansión de años.
- **Acciones Técnicas:**
    - **Actualizar `SPREADSHEET_ID`:** Apuntará al ID de la nueva `GPSpedia_DB_v2.0`.
    - **Refactorizar `recordLike`:** La función ahora aceptará un `corteIndex` (1, 2, o 3) para actualizar la columna `utilCorteX` correcta.
    - **Crear `assignCollaborator`:** Se desarrollará para asignar un colaborador a un corte específico.
    - **Crear `suggestYear`:** Nueva acción que recibirá un `vehicleId` y un `newYear`. La lógica leerá `anoDesde` y `anoHasta`, comparará el `newYear` y actualizará el campo correspondiente si el nuevo año expande el rango.

## 4. Trabajos Pendientes (Checklist)

Esta sección documenta las tareas de desarrollo, corrección y regresiones pendientes de la versión actual.

### Tareas Completadas Recientemente
- [X] **Estandarización de la Base de Datos del Backend:** Se ha verificado y actualizado toda la capa de microservicios (`auth`, `catalog`, `users`, `write`, `feedback`) para asegurar que todos apunten exclusivamente a la base de datos canónica v2.0. Se eliminó el código heredado y las referencias a la antigua base de datos v1.5.
- [X] **Resolución del Bug Crítico "Pantalla Blanca":** Se refactorizó el frontend (`index.html`) para alinearlo con la nueva estructura de datos `camelCase` del backend v2.0, solucionando la incompatibilidad que impedía la renderización de la aplicación.
- [X] **Implementación del Sistema de Notificación de Errores:** Se añadió un sistema de notificaciones globales en `index.html` y `api-manager.js` para mostrar al usuario los errores de comunicación con la API, mejorando la depuración y la transparencia.
- [X] **Refactorización del Acceso a Datos del Backend:** Se han actualizado todos los microservicios (`catalog`, `write`, `users`, `feedback`) para utilizar un mapa de columnas fijo, eliminando la inconsistencia arquitectónica y mejorando la estabilidad del sistema.

### Bugs y Regresiones Críticas
- [ ] **Inconsistencias de Versionamiento:** Sincronizar la versión global (ChangesLogs, UI) y las versiones de componentes (cabeceras en todos los archivos `.html` y `.js`) para cumplir con las normas del proyecto.
- [ ] **Layout del Modal:** Corregir la posición del nombre del colaborador y el estilo de los botones de feedback.
- [ ] **Visibilidad de Cortes:** Asegurar que las tres opciones de corte sean visibles en el modal si existen los datos.
- [ ] **UI General:** Solucionar bugs visuales (pie de página, botón de limpiar búsqueda, carga de nombre de usuario).

### Mejoras de Funcionalidad Prioritarias
- [ ] **Refactorización del Flujo de Escritura:** Implementar el nuevo flujo de trabajo de 3 etapas para añadir/actualizar cortes.
- [ ] **Búsqueda Flexible:** Mejorar `checkVehicle` para que devuelva coincidencias parciales y múltiples resultados.
- [ ] **Debugging Integral:** Implementar un sistema de debugging en backend y frontend accesible por rol.
- [ ] **Carga Optimizada de Imágenes (Lazy Load):** Implementar carga progresiva de imágenes para mejorar el rendimiento.
- [ ] **Soporte para Rango de Años (Feedback-driven):** Implementar la lógica de `suggestYear` en el backend y la UI correspondiente en el frontend.
- [ ] **Sistema de Versionamiento Híbrido:** Aplicar el nuevo sistema de versionamiento a todos los componentes del código fuente.

### Deuda Técnica y Mejoras
- [ ] **Script de Migración de Timestamps:** Implementar un script de ejecución única para obtener la fecha de creación de las imágenes antiguas de Google Drive y rellenar el campo `timestamp` en los registros existentes.

### Revisiones de UI/UX
- [ ] **Ajustes de Layout:** Realizar ajustes de espaciado, encabezado y visualización de "Últimos Agregados" según las especificaciones.
- [ ] **Modal de Detalle - Logo de Marca:** Implementar la visualización del logo de la marca en una esquina (`altura: 50px`, `anchura: auto`).
- [ ] **Modal de Detalle - Imagen de Relay:** Limitar la altura de la imagen de referencia del relay a `250px`.
- [ ] **Listado de Marcas - Logos:** Mostrar el logo de cada marca en la vista de listado de marcas.

### Nuevas Funcionalidades
- [ ] **Página de Información (`info.html`):** Crear una página estática con las secciones "Sobre Nosotros", "Contáctenos" y "Preguntas Frecuentes", con su respectivo formulario de contacto.

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
- **Responsabilidad:** Escritura de datos y subida de archivos, siguiendo un flujo de trabajo de 3 etapas.
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

## 6. Arquitectura de la Base de Datos

La documentación de la base de datos se divide en dos secciones principales: la arquitectura heredada (v1.5) y la nueva arquitectura propuesta (v2.0).

### 6.1. Arquitectura de Base de Datos v1.5 (Heredada)

Esta sección detalla la estructura y las deficiencias de la base de datos original, que funciona exclusivamente para la aplicación v1.5.

- **ID de Google Sheet:** `1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo`
- **Principio de Diseño:** Una estructura monolítica donde cada fila representa un vehículo, pero la información de múltiples "cortes" se almacena en un número creciente de columnas dentro de esa misma fila.

#### Estructura de Hojas y Columnas (v1.5)

##### Hoja: `Cortes`
- **Propósito:** Almacena toda la información técnica de los vehículos.
- **Columnas Clave:**
    - `ID`, `Categoria`, `Marca`, `Modelo`, `Año (Generacion)`
    - `Tipo de Encendido`, `Colaborador`, `Util` (para "likes" de todo el vehículo)
    - **Corte 1:** `Tipo de Corte`, `Descripcion del Corte`, `Imagen del Corte`
    - **Corte 2:** `Tipo de Corte 2`, `Descripcion del Segundo Corte`, `Imagen de Corte 2`
    - **Corte 3:** `Tipo de Corte 3`, `Descripcion del Corte 3`, `Imagen del Corte 3`
    - **Información Adicional:** `Apertura`, `Imagen de la Apertura`, `Cables de Alimentacion`, `Imagen de los Cables de Alimentacion`, `Como desarmar los Plasticos`, `Nota Importante`, `Timestamp`.

##### Hoja: `Users`
- **Propósito:** Gestión de usuarios y credenciales.
- **Columnas Clave:**
    - `ID`, `Nombre_Usuario`, `Password` (texto plano), `Privilegios`, `Nombre`, `Telefono`, `Correo_Electronico`, `SessionToken`.

##### Hoja: `Tutoriales` y `Relay`
- **Propósito:** Almacenan información de soporte y configuraciones.
- **Estructura:** Siguen un esquema simple con columnas como `ID`, `Tema`/`Configuracion`, `Imagen`, `Video`, y campos de texto descriptivos.

#### Deficiencias de la Arquitectura v1.5
- **Fragilidad por Mapeo Dinámico:** La mayoría de los servicios (`catalog.js`, `write.js`, `users.js`) dependen de la función `getColumnMap`, que lee los nombres de las columnas en tiempo de ejecución. **Un simple cambio en el nombre de una columna en la hoja de cálculo (ej. "Año" en lugar de "Año (Generacion)") rompe la aplicación sin generar errores claros en el backend.**
- **Falta de Granularidad:** El sistema de "likes" (`Util`) y el campo `Colaborador` se aplican a toda la fila del vehículo. Es imposible saber qué corte específico es el más útil o quién aportó cada corte individual.
- **Inflexibilidad en los Años:** La columna `Año (Generacion)` almacena un solo año o un rango de texto, lo que dificulta las búsquedas y la gestión de modelos que abarcan varios años.
- **Inconsistencia Arquitectónica:** El servicio `auth.js` utiliza un mapa de columnas fijo (hardcoded), mientras que el resto de los servicios utiliza un mapa dinámico, creando una inconsistencia en cómo la aplicación accede a su propia base de datos.

> **Nota de Auditoría (2024-08-16):** Esta deficiencia crítica ha sido **resuelta**. Todos los servicios de backend (`auth`, `catalog`, `write`, `feedback`, `users`) han sido refactorizados para utilizar un mapa de columnas fijo, unificando la arquitectura y eliminando la principal fuente de inestabilidad del sistema.

---

### 6.2. Arquitectura de Base de Datos v2.0 (Nueva)

Esta es la nueva arquitectura diseñada para resolver las deficiencias de la v1.5 y soportar las futuras funcionalidades del proyecto.

- **ID de Google Sheet:** `1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs`
- **Principio de Diseño:** Una estructura granular y robusta, diseñada para ser explícita, flexible y a prueba de errores de formato. Es totalmente independiente de la v1.5.

#### Diseño Detallado de `GPSpedia_DB_v2.0`

A continuación se detalla la estructura de cada hoja en la nueva base de datos. Los nombres de las columnas deben coincidir **exactamente** con los especificados a continuación para garantizar la compatibilidad con los servicios de backend.

##### 1. Hoja: `Users`
- **Propósito:** Gestión de usuarios, credenciales y perfiles.
| Columna |
| :--- |
| `ID` |
| `Nombre_Usuario`|
| `Password` |
| `Privilegios` |
| `Telefono` |
| `Correo_Electronico`|
| `SessionToken`|

##### 2. Hoja: `Cortes`
- **Propósito:** Catálogo principal con estructura granular para datos de alta calidad.
| Columna |
| :--- |
| `id` |
| `categoria` |
| `marca` |
| `modelo` |
| `versionesAplicables`|
| `anoDesde` |
| `anoHasta` |
| `tipoEncendido` |
| `imagenVehiculo` |
| `videoGuiaDesarmeUrl`|
| `contadorBusqueda` |
| `tipoCorte1` |
| `ubicacionCorte1`|
| `colorCableCorte1`|
| `configRelay1` |
| `imgCorte1` |
| `utilCorte1` |
| `colaboradorCorte1`|
| `tipoCorte2` |
| `ubicacionCorte2`|
| `colorCableCorte2`|
| `configRelay2` |
| `imgCorte2` |
| `utilCorte2` |
| `colaboradorCorte2`|
| `tipoCorte3` |
| `ubicacionCorte3`|
| `colorCableCorte3`|
| `configRelay3` |
| `imgCorte3` |
| `utilCorte3` |
| `colaboradorCorte3`|
| `apertura` |
| `imgApertura` |
| `cableAlimen` |
| `imgCableAlimen` |
| `timestamp` |
| `notaImportante` |

##### 3. Hoja: `LogosMarca`
- **Propósito:** Centralizar la gestión de logos de marcas para el frontend.
| Columna |
| :--- |
| `id` |
| `nombreMarca` |
| `urlLogo` |
| `fabricanteNombre`|

##### 4. Hoja: `Tutorial`
- **Propósito:** Almacenar guías y tutoriales multimedia.
| Columna |
| :--- |
| `ID` |
| `Tema` |
| `Imagen` |
| `comoIdentificarlo`|
| `dondeEncontrarlo` |
| `Detalles` |
| `Video` |

##### 5. Hoja: `Relay`
- **Propósito:** Almacenar información técnica sobre configuraciones de relays.
| Columna |
| :--- |
| `ID` |
| `configuracion` |
| `funcion` |
| `vehiculoDondeSeUtiliza`|
| `pin30Entrada` |
| `pin85BobinaPositivo`|
| `pin86bobinaNegativo`|
| `pin87aComunCerrado`|
| `pin87ComunmenteAbierto`|
| `imagen`|
| `observacion`|

##### 6. Hoja: `ActiveSessions`
- **Propósito:** Rastrear las sesiones de usuario activas para la validación.
| Columna |
| :--- |
| `ID_Usuario` |
| `Usuario` |
| `ActiveSessions` |
| `date` |
| `Logs` |

##### 7. Hoja: `Feedbacks`
- **Propósito:** Gestionar los reportes de problemas enviados por los usuarios.
| Columna |
| :--- |
| `ID` |
| `Usuario` |
| `ID_vehiculo` |
| `Problema` |
| `Respuesta` |
| `Se resolvio`|
| `Responde` |
| `Reporte de util`|

##### 8. Hoja: `Contactanos`
- **Propósito:** Recibir y gestionar los mensajes enviados a través del formulario de contacto.
| Columna |
| :--- |
| `Contacto_ID` |
| `User_ID` |
| `Asunto` |
| `Mensaje` |
| `Respuesta_mensaje`|
| `ID_usuario_responde`|

##### 9. Hoja: `Logs`
- **Propósito:** Registrar eventos importantes y errores del sistema para depuración.
| Columna |
| :--- |
| `Timestamp` |
| `Level` |
| `Message` |
| `Data`|

##### 10. Hoja: `ActividadUsuario`
- **Propósito:** Registrar acciones de los usuarios para futuras analíticas y dashboards de desempeño.
| Columna |
| :--- |
| `id` |
| `timestamp` |
| `idUsuario` |
| `nombreUsuario` |
| `tipoActividad`|
| `idElementoAsociado`|
| `detalle`|

## 7. Sistema de Versionamiento Híbrido

El proyecto utiliza un sistema de versionamiento dual para un control preciso y claro del ciclo de vida del software.

### A. Versión Global (Pública)
- **Propósito:** Representa el estado general del proyecto en un momento dado, visible para el usuario final.
- **Formato:** `vMAJOR.MINOR.PATCH` (ej. `v3.2.7`).
- **Ubicación:**
    - `ChangesLogs.txt`: Cada `submit` genera una nueva entrada con la versión global incrementada.
    - `index.html`: El pie de página muestra esta versión.

### B. Versión de Componente (Interna)
- **Propósito:** Rastrea el ciclo de vida de cada archivo de código fuente de forma independiente para entender su madurez y cambios.
- **Formato:** `ARQUITECTURA.ARCHIVO.EDICION` (ej. `2.1.0`).
    - **ARQUITECTURA (MAJOR):** Indica la versión de la arquitectura a la que pertenece el componente.
    - **ARCHIVO (MINOR):** Se incrementa para cambios significativos o nuevas funcionalidades dentro del archivo.
    - **EDICION (PATCH):** Se incrementa para correcciones de bugs o cambios menores. Se reinicia a `0` cuando `ARCHIVO` se incrementa. Sigue la regla `0-9`. De `2.1.9` pasa a `2.2.0`.
- **Reglas de Aplicación:**
    - **Componentes Frontend (`.html`, `api-manager.js`):**
        - **Versión de Arquitectura:** `2`.
        - **Versión Inicial:** `2.0.0`.
        - **Ubicación:** Comentario en la primera línea del archivo (ej. `<!-- GPSpedia Frontend Component | Version: 2.0.0 -->`).
    - **Componentes Backend (Microservicios `.gs`):**
        - **Versión de Arquitectura:** `1`.
        - **Versión Inicial:** `1.0.0`.
        - **Ubicación:** Comentario en la primera línea y en el mensaje de estado de la función `doGet()` (ej. `GPSpedia Auth-SERVICE v1.0.0 is active.`).

## 8. Guía y Normas para el Desarrollo

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

## 9. Sistema de Depuración

Para facilitar la identificación y resolución de problemas durante el desarrollo y la transición de la v1.5 a la v2.0, se ha implementado un sistema de depuración dual.

### A. Consola de Depuración del Frontend
- **Propósito:** Proporcionar una visión en tiempo real de la comunicación entre el frontend y el backend directamente en la interfaz de la aplicación.
- **Activación:** Añadir el parámetro `?debug=true` a la URL de la aplicación (ej. `https://.../index.html?debug=true`).
- **Funcionalidad:**
    - Al activarse, aparecerá una consola en la parte inferior de la pantalla.
    - **Registro de Peticiones:** Muestra la `action` y el `payload` de cada solicitud enviada al backend.
    - **Registro de Respuestas:** Muestra la respuesta JSON completa recibida del backend para cada solicitud exitosa.
    - **Registro de Errores:** Captura y muestra cualquier error de JavaScript o de red que ocurra, junto con su contexto.
- **Uso:** Esta herramienta es invaluable para diagnosticar si el frontend está enviando los datos correctos y recibiendo la estructura de datos esperada del backend.

### B. Modo de Depuración del Backend (Servicios)
- **Propósito:** Permitir la inspección del estado y configuración de un microservicio específico directamente a través de su URL de despliegue.
- **Activación:** Añadir el parámetro `?debug=true` a la URL del servicio de Google Apps Script (ej. `https://script.google.com/macros/s/.../exec?debug=true`).
- **Funcionalidad (Ejemplo en `GPSpedia-Catalog`):**
    - Al ser llamado en modo de depuración, el servicio no ejecuta su lógica principal, sino que devuelve un objeto JSON con información de su estado:
        - `service`: Nombre del servicio.
        - `version`: Versión del componente.
        - `spreadsheetId`: El ID de la hoja de cálculo que está utilizando.
        - `sheetsAvailable`: Los nombres de las hojas que espera encontrar.
- **Uso:** Esta herramienta permite verificar rápidamente que un servicio está activo, que está apuntando a la base de datos correcta y que su configuración interna es la esperada, sin necesidad de ejecutar una acción completa a través del frontend.

## 10. Auditoría del Sistema

Para consultar los resultados detallados, el análisis de factibilidad y las recomendaciones estratégicas del proyecto, por favor, refiérase al archivo `Auditoria.txt` en la raíz del repositorio.
