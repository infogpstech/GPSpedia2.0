### 5.4. Reglas Críticas de Uso de `CacheService`

El `CacheService` de Google Apps Script es una herramienta potente para mejorar el rendimiento, pero su uso indebido puede causar fallos críticos y caídas totales del servicio. Es **mandatorio** seguir las siguientes reglas en toda la arquitectura backend:

1.  **Límite de Tamaño Estricto (100 KB):**
    *   `CacheService` tiene un límite máximo de **100 KB por objeto**.
    *   **PROHIBIDO** intentar cachear objetos grandes, como el catálogo completo de vehículos o respuestas JSON complejas. Intentarlo resultará en un error `Argumento demasiado grande` que detendrá la ejecución del script.

2.  **Manejo de Errores Obligatorio:**
    *   Toda interacción con la caché (`cache.get`, `cache.put`, `cache.remove`) **DEBE** estar envuelta en un bloque `try...catch`.
    *   Un fallo en la caché **NUNCA** debe impedir que el servicio siga funcionando. El servicio debe ser capaz de continuar su ejecución (ej. obteniendo los datos desde la fuente original) si la caché falla.

3.  **Casos de Uso Aceptables:**
    *   **Datos Pequeños y Ligeros:** Ideal para cachear metadatos, listas de IDs, resultados de búsquedas frecuentes y pequeñas, o flags de configuración.
    *   **Imágenes Pequeñas:** Se pueden cachear imágenes solo si se ha verificado explícitamente que su tamaño (en base64) es inferior al límite (ej. < 90 KB como margen de seguridad).

4.  **Estrategia de Remediación Aplicada:**
    *   **`catalog-service`:** Se ha **deshabilitado permanentemente** el cacheo del catálogo completo. Cualquier futura implementación de caché en este servicio deberá ser granular (ej. cachear solo la lista de marcas o modelos).
    *   **`image-service`:** Mantiene el cacheo, pero solo para imágenes < 90 KB y con manejo de errores robusto.

El incumplimiento de estas reglas se considera una violación arquitectónica crítica que introduce un riesgo inaceptable de inestabilidad en producción.

# GPSpedia - Documentación Arquitectónica v4

## 1. Descripción General

GPSpedia es una Aplicación Web Progresiva (PWA) interna diseñada para técnicos e instaladores de GPS. Su objetivo principal es centralizar y estandarizar el conocimiento sobre los puntos de corte de corriente e ignición en una amplia variedad de vehículos, mejorando la eficiencia y reduciendo errores en las instalaciones.

Esta documentación describe la **arquitectura final propuesta** para el sistema, migrando de un modelo monolítico a una arquitectura desacoplada basada en microservicios y un frontend modular.

## 2. Arquitectura del Sistema

La arquitectura de GPSpedia se compone de tres capas principales, cada una con responsabilidades claramente definidas para asegurar la mantenibilidad, escalabilidad y seguridad del sistema.

### 2.1. Diagrama de Arquitectura General

El sistema está diseñado con una separación estricta entre el frontend (la interfaz de usuario en el navegador) y el backend (la lógica de negocio en Google Apps Script). Google Drive actúa como el sistema de almacenamiento de archivos, pero su acceso está mediado exclusivamente por el backend.

```
┌───────────────────────────┐
│     Frontend (Cliente)    │
│  (HTML + CSS + JS Modular)│
└─────────────┬─────────────┘
              │
              │ HTTP Requests
              ▼
┌───────────────────────────┐
│   Backend (Apps Script)   │
│     (Microservicios)      │
├───────────────────────────┤
│ 🔹 auth-service           │
│ 🔹 users-service          │
│ 🔹 feedback-service      │
│ 🔹 catalog-service       │
│ 🔹 write-service         │
│ 🔹 image-service (Nuevo)  │
└─────────────┬─────────────┘
              │
              │ Lectura/Escritura
              ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│     Google Sheets         │   │      Google Drive         │
│   (Base de Datos)         │   │ (Almacén de Imágenes)     │
└───────────────────────────┘   └───────────────────────────┘
```

### 2.2. Diagrama de Comunicación (Flujo de Datos)

La comunicación entre las capas sigue flujos estrictos para garantizar la integridad y seguridad de los datos.

#### **🔹 Flujo de Datos del Catálogo**
Este flujo describe cómo el frontend solicita y recibe información del catálogo.

1.  **Petición:** El **Frontend** (ej. `catalogApi.js`) realiza una llamada `fetch` al microservicio `catalog-service`.
2.  **Procesamiento:** `catalog-service` recibe la petición, accede a la **Spreadsheet** de Google Sheets, lee los datos, los normaliza, ordena y prepara la respuesta.
3.  **Respuesta:** `catalog-service` devuelve al **Frontend** un objeto JSON con los datos listos para ser renderizados.

```
Frontend               catalog-service           Spreadsheet
   │                        │                        │
   ├─ GET /catalogData ───> │                        │
   │                        ├─ getDataRange() ─────> │
   │                        │ <─── Raw Data ─────────┤
   │                        │                        │
   │                        │ normalize() & sort()   │
   │ <─── JSON (Datos) ──── │                        │
   │                        │                        │
```

#### **🔹 Flujo de Imágenes Final y Verificado (Proxy Seguro)**
Este diagrama documenta el flujo de datos final y auditado para la carga de imágenes.

1.  **Petición de Datos:** El **Frontend** solicita el catálogo al `catalog-service`.
2.  **Normalización en `catalog-service`:** `catalog-service` lee la Spreadsheet. Para cada campo de imagen, la función `normalizeAndValidateImageId` asegura que el valor sea un `fileId` válido o `null`, descartando URLs malformadas.
3.  **Respuesta con Contrato de Imagen:** `catalog-service` devuelve los datos, garantizando que todos los campos de imagen contienen **únicamente un `fileId` válido o `null`**.
4.  **Construcción de URL en `main.js`:** Al renderizar la UI, la función `getImageUrl(fileId)` toma el `fileId` y lo **codifica correctamente** (`encodeURIComponent`) para construir una URL segura que apunta al `image-service`.
5.  **Petición de Imagen (Proxy):** El navegador realiza una petición `GET` a la URL del `image-service`.
6.  **Resolución en `image-service`:** El `image-service` recibe la petición.
    *   **Intento de Caché:** Primero busca la imagen en `CacheService`. Si la encuentra (y es menor de 90KB), la devuelve inmediatamente.
    *   **Acceso a Drive:** Si no está en caché, usa `DriveApp.getFileById()` para obtener el blob de Google Drive, determina su `Content-Type` real, y lo guarda en caché (si es seguro) antes de devolverlo.
7.  **Respuesta de Imagen:** El `image-service` devuelve el blob de la imagen con el `Content-Type` correcto, que el navegador renderiza.

```
┌──────────┐   ┌───────────────────┐   ┌──────────────────────────┐   ┌──────────────────┐   ┌──────────────┐
│ Frontend │   │   API Manager     │   │      catalog-service     │   │  image-service   │   │ Google Drive │
└────┬─────┘   └─────────┬─────────┘   └────────────┬─────────────┘   └────────┬─────────┘   └──────┬───────┘
     │                   │                          │                        │                     │
     ├─ getCatalogData() ─>────────────────────────> │                        │                     │
     │                   │                          ├─ getSheetData() ──────> (Spreadsheet)      │
     │                   │                          │ 1. normalizeAndValidate()│                        │                     │
     │                   │ <────────────────────────┼─ 2. { img: "fileId" }   │                        │                     │
     │ <─────────────────┴─ { data }                 │                        │                     │
     │                                              │                        │                     │
     │ UI Render:                                   │                        │                     │
     │ getImageUrl(fileId)                          │                        │                     │
     │ (encodeURIComponent)                         │                        │                     │
     │ src="/image?fileId=..."                      │                        │                     │
     ├─ GET /image?fileId=... ──────────────────────────────────────────────> │                     │
     │                   │                          │                        ├─ 1. cache.get()    │
     │                   │                          │                        ├─ 2. getFileById()──>
     │                   │                          │                        │ <── Image Blob ────┤
     │                   │                          │                        ├─ 3. cache.put()    │
     │ <────────────────────────────────────────────┴─ Image Blob            │                     │
     │                                              │                        │                     │
```
⚠️ **Responsabilidades Clave (Auditado y Final):**
-   **`catalog-service`:** **Guardián de la integridad de datos.** Lee, valida y normaliza. Garantiza el **Contrato de Imagen**: solo envía `fileId` limpios o `null`.
-   **`main.js` (`getImageUrl`)**: **Constructor de URLs seguras.** Codifica el `fileId` usando `encodeURIComponent` y construye la URL del proxy. Confía en el contrato del `catalog-service`.
-   **`image-service`**: **Proxy seguro y optimizado.** Resuelve el `fileId`, maneja el `MimeType` real, y utiliza una caché para acelerar las respuestas. Es el único punto de contacto con Google Drive.

### 2.3. Responsabilidades por Capa

#### **🎨 Frontend**
-   **Renderizado:** Es responsable de "pintar" la interfaz de usuario basándose en los datos que recibe del backend.
-   **Gestión de Eventos:** Captura las interacciones del usuario (clics, envíos de formulario) y las traduce en llamadas a la capa de API.
-   **Gestión de Estado de UI:** Controla estados puramente visuales (ej. si un modal está abierto o cerrado).
-   **Estilos:** Aplica todo el diseño visual a través de hojas de estilo CSS.
-   **Regla de Oro:** NO contiene ninguna lógica de negocio (validación de datos, cálculos, ordenamiento).

#### **🗂️ Backend**
-   **Lógica de Negocio:** Es el cerebro de la aplicación. Contiene toda la lógica para validar, procesar y gestionar los datos.
-   **Validaciones:** Asegura que todos los datos recibidos del frontend sean correctos y seguros antes de escribirlos.
-   **Normalización y Ordenamiento:** Prepara los datos (ej. ordena los cortes por utilidad, formatea fechas) antes de enviarlos al frontend.
-   **Seguridad:** Gestiona la autenticación, las sesiones y los permisos de usuario. Es la única capa que puede decidir si un usuario está autorizado para realizar una acción.
-   **Acceso a Datos:** Es la única capa que tiene acceso directo a Google Sheets (la base de datos) y a Google Drive (el almacén de archivos).

### 2.4. Justificación Técnica de la Arquitectura

Esta arquitectura modular y desacoplada fue elegida para resolver problemas históricos y estructurales del sistema.

-   **Por qué `index.html` ya no debe ser monolítico:** El enfoque anterior de tener todo el HTML, CSS y JavaScript en un solo archivo (`index.html`) creaba un "código espagueti" difícil de mantener, depurar y escalar. Cualquier pequeño cambio tenía el potencial de romper funcionalidades no relacionadas.
-   **Por qué se separa la lógica en módulos JS:** Separar el JavaScript en módulos con responsabilidades únicas (API, estado, UI) permite:
    -   **Reutilización de Código:** Funciones comunes pueden ser compartidas.
    -   **Facilidad de Depuración:** Los errores se aíslan en módulos específicos.
    -   **Mantenimiento Sencillo:** Es más fácil encontrar y modificar la lógica relevante sin afectar otras partes del sistema.
-   **Por qué se introduce `image-service`:** El `image-service` es una capa de seguridad crítica. Exponer directamente las URLs de Google Drive es un riesgo de seguridad y crea una dependencia frágil. Al usar un proxy, el backend controla el acceso a los archivos, previene el hotlinking no autorizado y centraliza la lógica de obtención de imágenes, lo que permite futuras optimizaciones como el caching.
-   **Problemas históricos que soluciona esta arquitectura:**
    -   **Imágenes Inconsistentes y Rotas:** Centraliza la lógica de acceso a imágenes, eliminando errores de conversión de URL en el frontend.
    -   **Bugs Intermitentes:** La separación clara de responsabilidades reduce las interacciones complejas e inesperadas entre diferentes partes del código.
    -   **Código Duplicado:** La modularización permite reutilizar funciones de API, UI y utilidades.
    -   **Cambios "Fantasma":** Un sistema modular hace que el impacto de cada cambio sea más predecible y fácil de verificar.

## 3. Plan Estratégico y Tareas Pendientes

Para consultar la hoja de ruta detallada, el plan de implementación técnica y la lista de tareas pendientes, por favor, refiérase al archivo `Instrucciones.txt`.

## 4. Componentes del Backend (Microservicios)

El backend consta de los siguientes servicios de Google Apps Script:

### `GPSpedia-Auth` (`services/auth/auth.js`)
- **Responsabilidad:** Autenticación y sesiones de usuario.

### `GPSpedia-Users` (`services/users/users.js`)
- **Responsabilidad:** Gestión CRUD de usuarios con jerarquía de roles.

### `GPSpedia-Feedback` (`services/feedback/feedback.js`)
- **Responsabilidad:** Retroalimentación de usuarios (likes y reportes).

### `GPSpedia-Catalog` (`services/catalog/catalog.js`)
- **Responsabilidad:** Acceso de solo lectura, validación, normalización y preparación de los datos del catálogo. Es el guardián de la integridad de los datos leídos desde la hoja de cálculo.
- **Características Clave:**
    - **Contrato de Imagen:** Garantiza que todos los campos de imagen devueltos al frontend contendrán únicamente un `fileId` de Google Drive válido o `null`.
    - **Caché:** Utiliza un sistema de caché para minimizar las lecturas a la hoja de cálculo y mejorar el rendimiento.
    - **Modo Diagnóstico:** Incluye un modo `?diagnostics=true` que proporciona metadatos sobre la ejecución y una lista de los IDs de imagen inválidos encontrados en los datos de origen.

### `GPSpedia-Write` (`services/write/write.js`)
- **Responsabilidad:** Escritura de datos y subida de archivos.

### `GPSpedia-Image` (Nuevo)
- **Responsabilidad:** Servir de proxy seguro para las imágenes de Google Drive.

### `GPSpedia-Utilities` (Opcional)
- **Responsabilidad:** Funciones de utilidad compartidas.

## 5. Arquitectura de la Base de Datos

La base de datos del sistema es una hoja de cálculo de Google Sheets (`ID: 1M6zAVch_EGKGGRXIo74Nbn_ihH1APZ7cdr2kNdWfiDs`). Para una descripción detallada de la estructura de cada tabla (hoja) y columna, por favor, refiérase a la sección "Arquitectura de la Base de Datos v2.0" más adelante en este documento.

---
*El resto del contenido del README.md (Plan de Implementación, Estructura de la Base de Datos v1.5 y v2.0, Sistema de Versionamiento, etc.) se mantiene sin cambios y sigue a continuación.*
---

### **Plan de Implementación Técnica Detallado: Fase 1**

Esta sección describe los pasos técnicos específicos requeridos para ejecutar la Fase 1 del Plan Estratégico.

#### 1. Modificaciones al Servicio `GPSpedia-Write` (`write.js`)
- **Objetivo:** Reemplazar el proceso de adición de cortes por un nuevo sistema multifase basado en la lógica de `GPSpedia 1.5`, adaptado a la nueva estructura de la base de datos y con un flujo de trabajo anti-duplicado.

- **Flujo de Trabajo Detallado:**

    - **Etapa 1: Anti-duplicado y Verificación de Existencia.**
        1.  El frontend (`add_cortes.html`) inicialmente solo pedirá 4 campos: `Marca` (texto), `Modelo` (texto), `Año` (texto) y `Tipo de Encendido` (lista desplegable).
        2.  Al enviar, el backend (`write.js`) realizará una búsqueda en la hoja 'Cortes'.
        3.  **Lógica de Búsqueda (Actualizada):** La verificación se realiza cruzando 4 campos para encontrar coincidencias en la base de datos.
            *   **Búsqueda Flexible (Marca y Modelo):**
                *   **Marca:** La búsqueda es insensible a mayúsculas/minúsculas y busca coincidencias parciales. Por ejemplo, "Mercedes" encontrará "Mercedes Benz", y "Chery" encontrará "Chery / Chirey".
                *   **Modelo:** La búsqueda también es flexible. Por ejemplo, "np300" encontrará un vehículo cuyo modelo sea "Frontier NP300".
            *   **Búsqueda Exacta (Año y Encendido):**
                *   **Año:** El año proporcionado por el usuario debe estar dentro del rango `[anoDesde, anoHasta]` del registro en la base de datos.
                *   **Tipo de Encendido:** Debe haber una coincidencia exacta (insensible a mayúsculas/minúsculas).
        4.  **Respuesta:** El servicio devolverá una **lista con todas las coincidencias** que cumplan los 4 criterios. Si no hay ninguna, la lista estará vacía. La UI mostrará los vehículos encontrados y permitirá al usuario decidir si desea agregar información a un registro existente o crear uno completamente nuevo.
            *   **Opción 1: "Es un Duplicado".** El usuario confirma que el corte ya existe. El formulario se cierra.
            *   **Opción 2: "Agregar otro corte".** El vehículo ya existe, pero el usuario quiere añadir un segundo o tercer corte. El flujo avanza a la **Etapa 2**.
            *   **Opción 3: "Agregar apertura u otra información".** El usuario quiere añadir información suplementaria a un vehículo existente. El flujo avanza a la **Etapa 3**.
        5.  **Si no hay coincidencias:** El flujo avanza directamente a la **Etapa 2**.

- **Flujo de Trabajo Detallado (Anti-duplicado y Asistente de Búsqueda)**

    - **Etapa 1: Verificación de Vehículo (Anti-duplicado).**
        1.  El frontend (`add_cortes.html`) solicita 4 campos clave: `Marca`, `Modelo`, `Año` y `Tipo de Encendido`.
        2.  Al enviar, el backend realiza una búsqueda avanzada con la siguiente lógica:
            *   **Búsqueda Flexible (Marca y Modelo):** Se utilizan coincidencias parciales e insensibles a mayúsculas/minúsculas.
                *   Ej. `Marca`: "Mercedes" encontrará "Mercedes Benz".
                *   Ej. `Modelo`: "np300" encontrará un vehículo cuyo modelo sea "Frontier NP300".
            *   **Búsqueda Exacta (Año y Encendido):** Se requiere una coincidencia precisa.
                *   `Año`: El año proporcionado debe estar dentro del rango `[anoDesde, anoHasta]` del registro.
                *   `Tipo de Encendido`: Debe coincidir exactamente.
        3.  **Respuesta y Visualización (Anti-duplicado de Cortes):** Al encontrar coincidencias, la UI muestra los vehículos y sus cortes existentes de forma **informativa**. El flujo de trabajo se controla mediante **botones de elección inline**, eliminando modales y clics innecesarios.
            *   **Texto de Confirmación:** Se muestra el texto: `"Este modelo ya tiene estos cortes, ¿quieres agregar uno nuevo?"`.
            *   **Botones de Acción Inline:** Debajo de los resultados, se presentan tres opciones claras:
                1.  **"Sí, es el mismo corte (cancelar)":** Cancela la operación y regresa al catálogo principal.
                2.  **"Es uno nuevo":** Avanza al **Paso 2** para agregar un nuevo corte al vehículo encontrado.
                3.  **"Agregar información adicional":** Avanza directamente al **Paso 3** para añadir detalles suplementarios.
            *   **Tarjetas Informativas:** Las tarjetas de los vehículos ya no son interactivas (no tienen `onclick`) para evitar confusiones. Su único propósito es mostrar los datos.
        4.  Este flujo final es directo, mantiene al usuario en el mismo contexto y cumple con el requisito de una interacción inline sin capas de UI adicionales.

    - **Funcionalidad "Quizás quisiste decir...".**
        1.  Para asistir al usuario y reducir errores, se implementa un corrector ortográfico para los campos `Marca` y `Modelo`.
        2.  Cuando el usuario deja de escribir en uno de estos campos (`onblur` event), el frontend envía el término al backend.
        3.  El backend utiliza el **algoritmo de distancia de Levenshtein** para encontrar la cadena de texto más similar en la base de datos.
        4.  Si se encuentra una coincidencia cercana (con una distancia de Levenshtein baja), el frontend muestra una sugerencia en la que se puede hacer clic, ej: "Quizás quisiste decir: *Chevrolet*".

    - **Etapa 2: Registro de Nuevo Corte y Gestión de Archivos.**
        1.  Cuando se añade un nuevo corte o un nuevo vehículo, el sistema gestiona las imágenes de la siguiente manera:
            *   **Creación de Directorios:** El backend crea automáticamente una estructura de carpetas jerárquica en Google Drive siguiendo la ruta: `GPSpedia/Categoria/Marca/Modelo/Año`.
            *   **Nomenclatura de Archivos Estandarizada:** Las imágenes subidas se renombran automáticamente para seguir un formato predecible y consistente:
                *   `Marca_Modelo_TipoEncendido_Año_Vehiculo.jpg`
                *   `Marca_Modelo_TipoEncendido_Año_Corte1.jpg`
                *   `Marca_Modelo_TipoEncendido_Año_Apertura.jpg`
        2.  Esto asegura que todos los archivos estén organizados y sean fácilmente identificables tanto para el sistema como para los administradores.


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

---

### **Plan de Implementación Técnica: Tareas Adicionales**

Esta sección detalla los requerimientos para un nuevo conjunto de funcionalidades críticas centradas en la migración de datos y la mejora de la lógica de negocio para la gestión de rangos de años y timestamps.

#### **1. Nuevo Microservicio: `GPSpedia-Utilities` (Ejecución Única)**

Se creará un nuevo proyecto de Google Apps Script, independiente de los microservicios existentes, con el único propósito de realizar una migración y corrección de datos en la hoja `Cortes` de la base de datos. Este script se ejecutará una sola vez y contendrá dos funciones principales:

**A. Función 1: Migración de Rango de Años (COMPLETADO)**
*   **Objetivo:** Procesar la columna `anoDesde`, que actualmente contiene rangos de texto (ej. "2016-2022") o años únicos (ej. "2006"), para poblar correctamente las columnas `anoDesde` y `anoHasta` con valores numéricos individuales.
*   **Lógica de Ejecución:**
    1.  El script iterará sobre cada fila de la hoja `Cortes`.
    2.  Para cada fila, leerá el valor de la celda en la columna `anoDesde`.
    3.  **Si el valor contiene un guion (`-`):**
        *   Se dividirá la cadena de texto en dos partes.
        *   Se identificarán los dos valores numéricos, determinando cuál es el menor y cuál es el mayor.
        *   El valor numérico **menor** se escribirá de nuevo en la columna `anoDesde` de esa fila, sobrescribiendo el rango de texto.
        *   El valor numérico **mayor** se escribirá en la columna `anoHasta` de la misma fila.
    4.  **Si el valor es un único número de 4 dígitos (ej. "2006"):**
        *   El valor de `anoDesde` no se modificará.
        *   El mismo valor se copiará a la columna `anoHasta` de la misma fila.

**B. Función 2: Migración de Timestamps desde Metadatos de Google Drive (COMPLETADO)**
*   **Objetivo:** Rellenar la columna `timestamp` en la hoja `Cortes` utilizando la fecha de creación del archivo de imagen del vehículo almacenado en Google Drive.
*   **Lógica de Ejecución:**
    1.  El script iterará sobre cada fila de la hoja `Cortes`.
    2.  Para cada fila, leerá la URL en la columna `imagenVehiculo`.
    3.  **Si existe una URL:**
        *   Se extraerá el `ID` del archivo de Google Drive de la URL.
        *   Utilizando el servicio `DriveApp` de Apps Script, se obtendrá el objeto de archivo (`File`) correspondiente a ese ID.
        *   Se accederá a los metadatos del archivo para obtener su fecha de creación (`dateCreated`).
        *   La fecha se formateará al estándar `DD/MM/AAAA`.
        *   La fecha formateada se escribirá en la columna `timestamp` de la fila correspondiente.

---

#### **2. Modificaciones a Servicios Existentes (Lógica Continua)**

**A. Servicio `GPSpedia-Feedback`: Lógica de Expansión de Rango de Años**
*   **Objetivo:** Mejorar la funcionalidad del botón "Útil" para que los usuarios puedan sugerir que un corte aplica a un año fuera del rango establecido, expandiendo dinámicamente la aplicabilidad del registro.
*   **Lógica de Backend:**
    1.  El frontend enviará el `ID` del vehículo y el `año sugerido` por el usuario al backend.
    2.  El backend verificará si el `año sugerido` ya se encuentra dentro del rango `[anoDesde, anoHasta]`. Si es así, no se realizará ninguna acción.
    3.  **Lógica de Anti-colisión de Generaciones:**
        *   Antes de realizar cualquier cambio, el sistema buscará en toda la hoja `Cortes` si existe **otro registro** con la misma `marca`, `modelo` y `tipoEncendido`.
        *   Esta comprobación es crucial para evitar que los rangos de diferentes generaciones de un mismo modelo se solapen incorrectamente.
    4.  **Actualización del Rango:**
        *   Si el `año sugerido` es **menor** que `anoDesde` y no hay colisión, el valor de `anoDesde` se actualizará al `año sugerido`.
        *   Si el `año sugerido` es **mayor** que `anoHasta` y no hay colisión, el valor de `anoHasta` se actualizará al `año sugerido`.
*   **Manejo de Casos de Múltiples Generaciones (Ejemplo Técnico):**
    *   **Escenario:** El usuario indica que el corte para una **Honda CR-V (2016-2022)** también fue útil para un modelo **2026**.
    *   **Proceso:**
        1.  El sistema detecta que `2026` está fuera del rango `2016-2022`.
        2.  Realiza una búsqueda y encuentra otro registro para **Honda CR-V** con un rango de `2023-2025`.
        3.  En lugar de modificar el registro original (`2016-2022`), el sistema identifica que `2026` es una extensión lógica del segundo registro (`2023-2025`).
        4.  La columna `anoHasta` del **segundo registro** se actualiza a `2026`.

**B. Servicio `GPSpedia-Write`: Gestión de Timestamps y Lógica Frontend**
*   **Objetivo:** Asegurar que la columna `timestamp` se actualice siempre que se realice una modificación significativa en un registro y que el frontend utilice esta información para mostrar el contenido más reciente.
*   **Lógica de Backend (`write.js`):**
    1.  Al crear un **vehículo completamente nuevo**, se registrará la fecha actual en la columna `timestamp`.
    2.  Al añadir un **nuevo corte** a un vehículo ya existente, la columna `timestamp` de esa fila se actualizará con la fecha actual.
    3.  Al añadir **información suplementaria** (ej. detalles de apertura, videoguía), la columna `timestamp` también se actualizará con la fecha actual.
*   **Lógica de Frontend (`index.html`):**
    1.  La sección "Últimos Agregados" deberá obtener los datos del catálogo y ordenarlos en base a la columna `timestamp` en orden descendente antes de renderizarlos.
    2.  Las tarjetas de vehículo en esta sección deberán indicar qué tipo de información se agregó o actualizó recientemente (ej. "Nuevo Vehículo", "Corte Adicional", "Info. de Apertura"). Esto podría requerir una lógica adicional o un nuevo campo en la respuesta de la API.

---

## 4. Trabajos Pendientes (Checklist)

Esta sección documenta el estado actual de las tareas de desarrollo, bugs, regresiones y nuevas funcionalidades. Todas las tareas marcadas como `[Falta Revisión]` deben ser validadas por el Project Manager.

### Bugs y Regresiones Críticas

1.  **Carga de Imágenes en Modal:**
    - **Orden de Imágenes:** `[Falta Revisión]`
    - **Layout y Espacio Vertical:** `[Falta Revisión]`
2.  **Carga de Logos en Modal:** `[Falta Revisión]`
3.  **Refactorización del Flujo de Escritura:** `[Falta Revisión]` - Se ha completado la refactorización del flujo de adición de cortes en `add_cortes.html`, implementando la lógica de anti-duplicados con una interfaz de botones inline, mejorando la UX y corrigiendo bugs de visualización.
4.  **Inconsistencias de Versionamiento:** `[ ] Pendiente` - Es necesario sincronizar la versión global para que el próximo gran lanzamiento sea `v2.0` y mejorar el formato de registro de fechas en `ChangesLogs.txt`.

### Revisiones de UI/UX

5.  **Rediseño de Botones de Feedback:** `[Falta Revisión]` - Se redujo el tamaño de los botones en un 10%. Pendiente la revisión de la lógica de backend.
6.  **Navegación para Carrusel de 'Categorías':** `[Falta Revisión]` - Se refactorizó la lógica de botones para que sea reutilizable en todos los carruseles.
7.  **Creación del Carrusel 'Marcas de motos':** `[Falta Revisión]` - Se añadió la sección a la página principal.

### Nuevas Funcionalidades

8.  **Sistema de Navegación Jerárquico:** `[ ] Pendiente` - Implementar el flujo de navegación guiado completo: Categoría -> Marca -> Modelo -> Versión/Encendido -> Año.
9.  **Sistema de Gestión de Feedback (Inbox):** `[ ] Pendiente` - La interfaz del Inbox está creada, pero se necesita implementar la lógica de backend en el servicio `GPSpedia-Feedback`.
10. **Visibilidad de la Consola de Debugging:** `[Falta Revisión]` - Se eliminó la visibilidad por URL; ahora solo es accesible a través del modal de "Desarrollador".
11. **Carga Optimizada de Imágenes (Lazy Load):** `[ ] Pendiente` - Implementar la carga progresiva de imágenes y utilizar URLs de thumbnails con tamaños específicos.
12. **Lógica de Gestión de Años:** `[ ] Pendiente` - Falta implementar la lógica de backend para registrar los votos, la hoja de cálculo para almacenar dichos votos y mejorar la presentación del `alert`.
13. **Ordenamiento por Utilidad:** `[ ] Pendiente de Verificación` - Verificar si el backend (`GPSpedia-Catalog`) ordena los cortes por popularidad. Si no existe, se debe construir.
14. **Expansión de Rango de Años por Feedback:** `[ ] Pendiente de Verificación` - Verificar si la lógica de backend que expande el rango de años existe. Si no, se debe construir.
15. **Modal de Relay Anidado:** `[ ] Pendiente` - Implementar la lógica para validar el caso "Sin Relay".
16. **Dashboard de Desempeño:** `[ ] Falta Implementar` - Crear la nueva sección para Supervisores.
17. **Edición "In-Modal":** `[ ] Falta Implementar` - Permitir la edición de datos desde el modal de detalles.

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

### 6.2. Arquitectura de la Base de Datos v2.0 (Nueva)
**IMPORTANTE: NO MODIFICAR.** La siguiente estructura de hojas y columnas es la fuente de verdad canónica para la base de datos `GPSpedia_DB_v2.0` y debe coincidir exactamente con la implementación en Google Sheets.

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
| `SessionToken` |

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
---

Revisión y definición formal de la lógica de navegación del catálogo

Observación general

Los iconos de marca funcionan correctamente y su presentación visual es adecuada.
Sin embargo, la navegación es confusa debido a que:

Se agregó búsqueda por marca sin ajustar el flujo completo de navegación.

Existen rutas redundantes que llevan al mismo resultado final.

No está claramente separado el flujo entre:

Categorías

Marcas de vehículos

Marcas de motocicletas



El objetivo es unificar criterios de navegación, manteniendo coherencia visual y lógica, y evitando duplicidad de rutas.


---

Estructura general de navegación visible para el usuario

Las siguientes secciones deben existir como bloques de navegación independientes, cada una funcionando de forma clara y consistente:

1. Últimos agregados


2. Categoría


3. Búsqueda por marca de vehículos


4. Búsqueda por marca de motocicletas



👉 Las secciones “Categoría”, “Búsqueda por marca de vehículos” y “Búsqueda por marca de motocicletas”
DEBEN funcionar con presentación tipo carrusel en su primera etapa, igual que “Últimos agregados”.


---

I. Navegación por “Categoría”

Etapa 1 – Vista inicial (DESPUÉS de refresh o inicio de sesión)

Se muestran TODAS las categorías disponibles en el catálogo.

El orden debe ser:

De mayor a menor cantidad de modelos asociados a esa categoría.


La presentación debe ser:

Tipo carrusel.




---

Etapa 2 – Selección de categoría (SIN carrusel)

Cuando el usuario selecciona una categoría:

Se muestran TODAS las marcas que tengan al menos un modelo dentro de esa categoría.

La visualización será:

Iconos de marcas

SIN carrusel a partir de este punto.




---

Etapa 3 – Selección de marca

Cuando el usuario selecciona una marca:

Se muestran TODOS los modelos que cumplan:

Categoría seleccionada

Marca seleccionada




---

Etapa 4 – Selección de modelo

Cuando el usuario selecciona un modelo:

Si el modelo tiene versiones de equipamiento (versionesAplicables):

Se muestran dichas versiones.


Si el modelo NO tiene versiones de equipamiento:

Se muestran los tipos de encendido.




---

Etapa 5 – Selección de versiones de equipamiento o tipo de encendido

Al seleccionar una versión o tipo de encendido:

Se muestran los rangos de años disponibles.




---

Etapa 6 (final) – Selección de años

Cuando el usuario selecciona el rango de años:

Se abre el modal de detalle.




---

Navegación hacia atrás

TODAS las etapas deben incluir un botón claro de:
“Regresar a <etapa anterior>”

El botón debe regresar exactamente a la etapa previa, sin reiniciar el flujo completo.



---

Nota crítica

⚠️ Se debe revisar detenidamente la lógica actual, ya que existen redundancias donde:

Categoría → Marca

Marca → Categoría
terminan mostrando los mismos datos por rutas distintas.


La navegación debe ser lineal y predecible, no circular.


---

II. Navegación por “Marcas de vehículos”

Presentación inicial

Mostrar SOLO marcas de vehículos (NO motocicletas).

Presentación:

Tipo carrusel

Sin tarjetas, solo iconos de marcas.




---

Etapa 1 – Selección de marca

Cuando el usuario selecciona una marca:

Se muestran TODOS los modelos de esa marca.

A partir de aquí:

SIN carrusel.




---

Etapas siguientes

Desde este punto, el flujo debe ser idéntico a la navegación por categoría:

Selección de modelo

Versiones de equipamiento o tipos de encendido

Selección de años

Apertura del modal


📌 Diferencia clave:

Se deben mostrar todas las categorías EXCEPTO motocicletas.



---

III. Navegación por “Marcas de motocicletas”

Debe seguir exactamente el mismo flujo que “Marcas de vehículos”.

La única diferencia es que:

Solo se incluye la categoría de motocicletas.


Presentación inicial:

Tipo carrusel

Solo marcas de motocicletas.




---

Secciones que NO deben alterarse

Las siguientes secciones del catálogo deben permanecer exactamente igual:

Tutoriales

Relay

Cualquier otra sección fuera del flujo principal de navegación de modelos



---

Segunda tarea – Revisión de sección Relay

Problema detectado

En las secciones de Relay:

No se está mostrando la imagen de la configuración del relay.


Acción requerida

Revisar la lógica de carga/renderizado de imágenes en la sección Relay.

Verificar:

Enlaces

Conversión de URL

Condiciones de render
-----

Extensión de requisitos – Iconos, modales de detalle y mejoras de diseño

Visualización de iconos de marca (requisito global)

Se debe garantizar consistencia visual de los iconos de marca en TODAS las vistas relevantes del catálogo, no solo en listados principales.

Requisitos obligatorios

1. Resultados de la barra de búsqueda

Los resultados devueltos por la barra de búsqueda:

DEBEN mostrar el icono de la marca correspondiente.


Aplica tanto para:

Resultados por modelo

Resultados por marca

Resultados combinados




2. Modal de detalle

El icono de la marca debe mostrarse dentro del modal de detalle.

Ubicación exacta:

A la derecha del título del modal, donde se muestra:

> “Detalle de ‘modelo de vehículo’”




El icono no debe romper:

El layout del título

El flujo responsive del modal






---

Mejoras pendientes de diseño en el modal de detalle

Además de la lógica funcional, se deben completar las mejoras visuales y de experiencia de usuario pendientes en los modales de detalle.

#### **Estructura y Orden de Contenido Obligatorio para el Modal de Detalle**

La información en el modal debe presentarse exactamente en el siguiente orden y con el formato especificado para garantizar consistencia y claridad.

1.  **Nombre del modelo en el encabezado, seguido por el logo de la marca.**
2.  **Versión de equipamiento si tiene.** Si no tiene, usar el tipo de encendido.
3.  **Rango de años.** (Tanto el punto 2 como el 3 deben usar letras más pequeñas que el encabezado principal).
4.  **Categoría.** (Debe usar letras más pequeñas que los puntos 2 y 3).
5.  **Imagen del modelo del vehículo.** Debe ser una imagen pequeña (mitad del tamaño de la imagen del corte), centrada, sin bordes ni fondo, y con efecto `drop-shadow`.
6.  **Nota importante.** Debe estar en color rojo y usar el icono de ⚠️ al final de la nota.
7.  **Corte recomendado.** Determinado por la mayor cantidad de votos "útil". La imagen de este corte debe ajustarse para que su ancho coincida con el ancho del modal, con altura automática. Cada corte debe contener la siguiente información en este orden:
    *   Descripción de la ubicación.
    *   Color de cable.
    *   Imagen (con botones de feedback en overlay).
    *   Configuración del Relay.
    *   Colaborador (posicionado a la izquierda, sin cambiar estilos, solo posición).
8.  **Corte 2, si está disponible.**
9.  **Corte 3, si está disponible.**
10. **Apertura.** Con su descripción e imagen.
11. **Cables de alimentación.** Con su descripción e imagen.
12. **Vídeo guía de desarme.**

> La sección de "Notas personales" ha sido eliminada y ya no se implementará.

---

1. Botones de feedback sobre imágenes de corte (overlay)

Los botones de:

“Útil”

“Reportar problema”


Deben posicionarse:

Sobre la imagen del corte, usando un overlay.


No deben ocupar espacio adicional debajo o al costado de la imagen.



---

2. Comportamiento al abrir imagen en lightbox

Cuando el usuario haga clic sobre la imagen del corte:

La imagen se abre en lightbox.

Los botones de feedback:

Deben desaparecer con animación.

No deben permanecer visibles mientras el lightbox esté activo.


Al cerrar el lightbox:

Los botones deben reaparecer correctamente.




---

3. Información del colaborador

El nombre del colaborador que agregó el corte:

Debe tener su propio espacio vertical dedicado.

No debe compartir:

Línea horizontal

Contenedor

Fila con los botones de feedback ni otros elementos interactivos.





---

4. Orden correcto de los botones tipo acordeón

⚠️ El orden actual de los botones tipo acordeón es incorrecto y debe corregirse.

El orden OBLIGATORIO es el siguiente:

1. Corte recomendado

Dinámico

Determinado por la mayor cantidad de votos “útil”.



2. Corte 2

Solo si existe.



3. Corte 3

Solo si existe.



4. Apertura

Solo si existe.



5. Cables de alimentación

Solo si existe.



6. Vídeo guía de desarme

Solo si existe.



📌 Importante:

Las secciones solo deben mostrarse si tienen contenido.

El orden debe mantenerse siempre, independientemente de cómo llegue la data.



---

Regla de implementación

> Todas estas mejoras deben implementarse:

Sin romper la lógica ya reparada

Sin modificar estructuras de datos innecesarias

Sin alterar otros modales o secciones del catálogo

Si algún cambio implica riesgo para la estabilidad:

Documentar el riesgo

Aplicar la solución más conservadora posible

Corregir el problema sin afectar otras secciones.



---

Regla final

> Cualquier ajuste debe priorizar:

Claridad de navegación

Flujo lineal

Evitar duplicidad de rutas

NO romper funcionalidades existentes

---

⚠️ REGRESIÓN CRÍTICA DETECTADA – ÚLTIMO COMMIT (NAVEGACIÓN POR MARCAS)

> ATENCIÓN – REGRESIÓN FATAL
En el último commit donde se agregó la navegación por marcas, se introdujeron regresiones graves que rompen funcionalidades existentes y no cumplen el flujo definido en las instrucciones previas.

Esta sección documenta exactamente qué se rompió y cómo debe corregirse, sin reinterpretaciones.




---

1. Regresión en las secciones de navegación visibles

Estado actual (incorrecto)

Solo aparecen:

Navegación por marca de vehículos

Navegación por categoría


Se eliminaron o dejaron inaccesibles otras secciones clave.


Estado esperado (OBLIGATORIO)

Las siguientes secciones NO deben desaparecer y deben coexistir:

1. Últimos agregados


2. Categoría


3. Búsqueda por marca de vehículos


4. Búsqueda por marca de motocicletas



⚠️ Eliminar “Últimos agregados” es una regresión grave
Esta sección existía y funcionaba antes del último commit y NO debía ser eliminada.


---

2. Incumplimiento del flujo de navegación definido

La navegación actual NO sigue el flujo por etapas previamente documentado, específicamente:

No respeta:

Etapas secuenciales

Separación clara entre categorías, marcas, modelos y versiones


Se mezclan rutas que generan:

Confusión

Redundancia

Pérdida de contexto para el usuario



👉 Es obligatorio volver a implementar la navegación exactamente como fue definida en las instrucciones anteriores, sin simplificaciones ni atajos.


---

3. Regresión en modales de detalle – Tutoriales

Problema

En los modales de detalle de Tutoriales:

NO aparece el vídeo guía, aunque el contenido existe.



Acción requerida

Revisar la lógica de renderizado del vídeo en:

Modales

Condiciones de visibilidad


Corregir sin afectar otros tipos de modal.



---

4. Regresión en modales de detalle – Relay

Problema

En los modales de detalle de Relay:

NO aparece la imagen del diagrama de configuración del Relay.



Acción requerida

Revisar:

Lógica de carga de imagen

Conversión de enlace

Condición de render


Confirmar que el diagrama se muestre correctamente como antes del último commit.



---

5. Error de posicionamiento – Botones de feedback (vehículos)

Estado actual (incorrecto)

Los botones de feedback:

Están a la derecha de la imagen

NO están en la esquina inferior derecha


Esto rompe el diseño solicitado.


Estado esperado (OBLIGATORIO)

Los botones de feedback deben:

Estar sobre la imagen del corte (overlay)

Posicionados en la parte baja de la imagen

Específicamente en la esquina inferior derecha




---

6. Error de layout – Nombre del colaborador

Estado actual (incorrecto)

El nombre del colaborador:

Fue colocado como overlay sobre la imagen del corte



Estado esperado (OBLIGATORIO)

El nombre del colaborador:

NO debe ser overlay

Debe estar FUERA de la imagen

Con su propio espacio vertical dedicado


No debe compartir contenedor ni capa con:

Imagen

Botones de feedback




---

7. Regresión – Posición del logo de marca en el modal de detalle

Estado actual (incorrecto)

El logo de marca:

NO está en la posición solicitada



Estado esperado (OBLIGATORIO)

El logo de marca debe:

Aparecer en el modal de detalle

Ubicarse a la derecha del título, donde dice:

> “Detalle de ‘modelo de vehículo’”




Debe integrarse sin romper:

Layout

Responsividad

Jerarquía visual del título




---

Regla crítica de corrección

> Antes de agregar nuevas funcionalidades:

Revertir o corregir las regresiones

Restaurar funcionalidades eliminadas

Alinear la implementación con el README




⚠️ No se deben sacrificar secciones existentes para introducir nuevas rutas de navegación.
El README define el contrato funcional y visual del catálogo.


---
