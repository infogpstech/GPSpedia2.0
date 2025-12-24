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
- **Objetivo:** Adaptar el servicio para la lógica de la DB v2.0, incluyendo la migración y la gestión de años/logos.
- **Acciones Técnicas:**
    - **Modificar `addCorte`:**
        - La función ya no recibirá `anoDesde` ni `anoHasta`. Recibirá un único `anio`.
        - Al crear una nueva fila, escribirá el `anio` en la columna `anoDesde` y dejará `anoHasta` en blanco.
        - Antes de escribir, consultará la hoja `LogosMarcas` para encontrar la URL del logo. Si no la encuentra, usará una URL temporal del logo de GPSpedia.
    - **Crear Nuevo Endpoint `executeMigration`:**
        - **Activación:** La función `doGet(e)` se activará con el parámetro `action=executeMigration`.
        - **Seguridad:** Se implementará una verificación para asegurar que solo los usuarios con rol "Desarrollador" puedan ejecutar la migración.
        - **Lógica de Lectura:** Se conectará a la `GPSpedia_DB_v1.5` y leerá todas las filas de la hoja "Cortes".
        - **Lógica de Transformación (por fila):**
            - **`anoDesde`/`anoHasta`:** Se analizará `Año (Generacion)` para extraer rangos o duplicar el año en `anoDesde`.
            - **Cortes y Logos:** Se mapearán los datos de los cortes y se buscará el logo correspondiente.
        - **Lógica de Escritura:** Se conectará a la nueva `GPSpedia_DB_v2.0` y escribirá los datos transformados.
        - **Respuesta:** Devolverá un JSON confirmando el éxito y el número de filas procesadas.

#### 2. Modificaciones al Servicio `GPSpedia-Catalog` (`catalog.js`)
- **Objetivo:** Adaptar el servicio para leer desde la DB v2.0 y soportar las nuevas funcionalidades.
- **Acciones Técnicas:**
    - **Actualizar `SPREADSHEET_ID`:** La constante apuntará al ID de la nueva `GPSpedia_DB_v2.0`.
    - **Reescribir `COLS_CORTES`:** El objeto de mapeo de columnas se actualizará para reflejar la nueva estructura granular.
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
- [X] **Refactorización del Acceso a Datos del Backend:** Se han actualizado todos los microservicios (`catalog`, `write`, `users`, `feedback`) para utilizar un mapa de columnas fijo, eliminando la inconsistencia arquitectónica y mejorando la estabilidad del sistema.

### Bugs y Regresiones Críticas
- [ ] **Inconsistencias de Versionamiento:** Sincronizar la versión global (ChangesLogs, UI) y las versiones de componentes (cabeceras en todos los archivos `.html` y `.js`) para cumplir con las normas del proyecto.
- [ ] **Layout del Modal:** Corregir la posición del nombre del colaborador y el estilo de los botones de feedback.
- [ ] **Visibilidad de Cortes:** Asegurar que las tres opciones de corte sean visibles en el modal si existen los datos.
- [ ] **UI General:** Solucionar bugs visuales (pie de página, botón de limpiar búsqueda, carga de nombre de usuario).

### Mejoras de Funcionalidad Prioritarias
- [ ] **Búsqueda Flexible:** Mejorar `checkVehicle` para que devuelva coincidencias parciales y múltiples resultados.
- [ ] **Debugging Integral:** Implementar un sistema de debugging en backend y frontend accesible por rol.
- [ ] **Carga Optimizada de Imágenes (Lazy Load):** Implementar carga progresiva de imágenes para mejorar el rendimiento.
- [ ] **Soporte para Rango de Años (Feedback-driven):** Implementar la lógica de `suggestYear` en el backend y la UI correspondiente en el frontend.
- [ ] **Sistema de Versionamiento Híbrido:** Aplicar el nuevo sistema de versionamiento a todos los componentes del código fuente.

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

A continuación se detalla la estructura de cada hoja en la nueva base de datos. Los nombres de las columnas están normalizados a formato `camelCase` para mantener la consistencia en el código.

##### 1. Hoja: `Users`
- **Propósito:** Gestión de usuarios, credenciales y perfiles.
| Columna | Descripción |
| :--- | :--- |
| `id` | Identificador único numérico para cada usuario. |
| `nombreUsuario`| Nombre de usuario para el login (debe ser único). |
| `password` | Contraseña del usuario (se migrará a formato hash). |
| `privilegios` | Rol del usuario (ej. 'Tecnico', 'Supervisor'). |
| `nombre` | Nombre completo del usuario para visualización. |
| `telefono` | Número de contacto del usuario. |
| `correoElectronico`| Correo electrónico del usuario. |
| `sessionToken`| Token de sesión activa para validación. |

##### 2. Hoja: `Cortes`
- **Propósito:** Catálogo principal con estructura granular para datos de alta calidad.
| Columna | Descripción y Validación de Datos |
| :--- | :--- |
| `id` | Identificador único numérico para cada registro de vehículo. |
| `categoria` | **(Validación de Datos)** Segmento del vehículo. La lista de opciones se carga dinámicamente desde una hoja de cálculo. Ej: 'Pickup', 'SUV', 'Sedán'. |
| `marca` | Nombre del fabricante del vehículo. Ej: 'Toyota'. |
| `modelo` | Nombre del modelo del vehículo. Ej: 'Hilux'. |
| `versionesAplicables`| Nombres de modelos alternativos o relacionados a los que aplica este corte. Ej: 'Frontier, NP300'. |
| `anoDesde` | Año de inicio de la generación o versión del modelo. |
| `anoHasta` | Año de fin de la generación o versión del modelo. |
| `tipoEncendido` | **(Validación de Datos)** Tipo de sistema de encendido. La lista se carga dinámicamente. Ej: 'Botón', 'Llave', 'Switch'. |
| `imagenVehiculo` | URL de la imagen principal del vehículo. |
| `videoGuiaDesarmeUrl`| URL de un video tutorial para el desarme. |
| `contadorBusqueda` | Contador numérico de cuántas veces se ha consultado este registro. |
| `tipoCorteX` | **(Validación de Datos)** Tipo de corte a realizar. La lista se carga dinámicamente. Ej: 'Ignición', 'Bomba de Gasolina', 'Motor de Arranque'. |
| `ubicacionCorteX`| Descripción textual de la ubicación del cable o componente a intervenir. |
| `colorCableCorteX`| Color o combinación de colores del cable a cortar. |
| `configRelayX` | **(Relación)** ID numérico que corresponde a una entrada en la hoja `Relay`, especificando la configuración a usar. |
| `imgCorteX` | URL de la imagen que muestra el detalle del corte. |
| `utilCorteX` | Contador de "likes" o "útil" para este corte específico. |
| `colaboradorCorteX`| Nombre del usuario que aportó la información de este corte. |
| `timestamp` | Fecha y hora de la última modificación del registro. |
| `notaImportante` | Campo de texto para advertencias o detalles cruciales. |

*Nota: La `X` en columnas como `tipoCorteX` se reemplaza por los números 1, 2 y 3 para representar los tres posibles cortes por vehículo.*

##### 3. Hoja: `LogosMarcas`
- **Propósito:** Centralizar la gestión de logos de marcas para el frontend.
| Columna | Descripción |
| :--- | :--- |
| `id` | Identificador único numérico. |
| `nombreMarca` | Nombre normalizado de la marca. |
| `urlLogo` | URL del archivo de imagen del logo. |
| `fabricanteNombre`| Nombre del grupo fabricante (ej. 'Volkswagen Group'). |

##### 4. Hoja: `Tutorial`
- **Propósito:** Almacenar guías y tutoriales multimedia.
- **Columnas:** `id`, `tema`, `imagen`, `comoIdentificarlo`, `dondeEncontrarlo`, `detalles`, `video`.

##### 5. Hoja: `Relay`
- **Propósito:** Almacenar información técnica sobre configuraciones de relays.
- **Columnas:** `id`, `configuracion`, `funcion`, `vehiculoDondeSeUtiliza`, `pin30Entrada`, `pin85BobinaPositivo`, `pin86bobinaNegativo`, `pin87aComunCerrado`, `pin87ComunmenteAbierto`, `imagen`, `observacion`.

##### 6. Hoja: `ActiveSessions`
- **Propósito:** Rastrear las sesiones de usuario activas para la validación.
- **Columnas:** `idUsuario`, `sessionToken`, `timestamp`.

##### 7. Hoja: `Feedbacks`
- **Propósito:** Gestionar los reportes de problemas enviados por los usuarios.
- **Columnas:** `id`, `usuario`, `idVehiculo`, `problema`, `respuesta`, `seResolvio`, `responde`, `reporteDeUtil`.

##### 8. Hoja: `Contactanos`
- **Propósito:** Recibir y gestionar los mensajes enviados a través del formulario de contacto.
- **Columnas:** `contactoId`, `userId`, `asunto`, `mensaje`, `respuestaMensaje`, `idUsuarioResponde`.

##### 9. Hoja: `Logs`
- **Propósito:** Registrar eventos importantes y errores del sistema para depuración.
- **Columnas:** `timestamp`, `level`, `message`, `data`.

##### 10. Hoja: `ActividadUsuario`
- **Propósito:** Registrar acciones de los usuarios para futuras analíticas y dashboards de desempeño.
- **Columnas:** `id`, `timestamp`, `idUsuario`, `nombreUsuario`, `tipoActividad`, `idElementoAsociado`, `detalle`.

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

## 8. Auditoría del Sistema

Para consultar los resultados detallados, el análisis de factibilidad y las recomendaciones estratégicas del proyecto, por favor, refiérase al archivo `Auditoria.txt` en la raíz del repositorio.
