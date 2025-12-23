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

## 3. Plan Estratégico de Evolución (GPSpedia v3.3) - v3 Final

Esta sección define la hoja de ruta oficial para la siguiente gran versión de GPSpedia. El plan se centra en una re-arquitectura de la base de datos y la implementación de funcionalidades de alta eficiencia.

### Fase 1: Migración a Nueva Infraestructura de Base de Datos (DB v2)
- **Objetivo:** Crear una base de datos optimizada en un **nuevo Google Spreadsheet** (`GPSpedia_DB_v2.0`) para soportar funcionalidades avanzadas, manteniendo el spreadsheet actual intacto por compatibilidad con GPSpedia v1.5.
- **Tareas Clave:**
    - [ ] **Diseñar Nuevo Esquema Granular:** Implementar la nueva estructura de hojas y columnas (ver sección 6 para detalles), que incluye la consolidación de modelos con `versionesAplicables` y feedback por corte individual.
    - [ ] **Crear Script de Migración Automatizada:** Desarrollar un endpoint (`?action=executeMigration`) en `GPSpedia-Write` (protegido para rol "Desarrollador") que transfiera y transforme los datos del spreadsheet antiguo al nuevo.
    - [ ] **Actualizar Configuración Global:** Modificar la constante `SPREADSHEET_ID` en todos los microservicios para apuntar a la nueva base de datos.
- **Nota Crítica de Compatibilidad:** La columna `Año (Generacion)` del spreadsheet antiguo se preserva y no debe ser modificada, garantizando el funcionamiento de la v1.5.

### Fase 2: Sistema de Feedback Avanzado y Calidad de Datos
- **Objetivo:** Mejorar drásticamente la calidad de los datos y la utilidad del feedback.
- **Tareas Clave:**
    - [ ] **Feedback Granular por Corte:**
        - **Backend:** Modificar `feedback.js` para que la acción `recordLike` acepte un índice de corte y actualice la columna `utilCorteX` correspondiente.
        - **Frontend:** Re-diseñar el modal de detalles para mostrar un botón "Útil" y el colaborador para **cada corte individual**, y ordenar los cortes por número de "likes".
    - [ ] **Validación de Datos Obligatorios:** Implementar validaciones en el frontend (`add_cortes.html`) y backend (`write.js`) para asegurar que cada nuevo corte incluya obligatoriamente: `tipo de corte`, `ubicación`, `color de cable` e `imagen`.

### Fase 3: Funcionalidades de Gestión y Experiencia de Usuario
- **Objetivo:** Introducir herramientas de gestión y mejorar la experiencia del usuario final.
- **Tareas Clave:**
    - [ ] **Dashboard de Desempeño (Jefes/Supervisores):**
        - **Backend:** Crear un nuevo endpoint que analice la hoja `ActividadUsuario` y las columnas `colaboradorCorteX` para generar estadísticas de contribución por técnico.
        - **Frontend:** Desarrollar una nueva página (`dashboard.html`) con acceso restringido para visualizar estas métricas.
    - [ ] **Ranking de "Más Buscados":**
        - **Backend:** Modificar `catalog.js` para incrementar `contadorBusquedas` en cada búsqueda y crear un endpoint `getMostSearched`.
        - **Frontend:** Añadir una sección en `index.html` para mostrar los vehículos más populares.
    - [ ] **Edición "In-Modal" con Permisos por Rol:**
        - **Backend:** Crear un endpoint `updateVehicleData` en `write.js` con lógica de permisos por rol (Técnico: solo añadir; Supervisor: modificar; Desarrollador: borrar).
        - **Frontend:** Adaptar el modal para mostrar campos como editables o solo texto según el rol del usuario.
    - [ ] **Sistema de Compartir de Un Solo Uso:**
        - **Backend:** Implementar la lógica para generar y validar tokens de un solo uso en la nueva hoja `TokensCompartir`.
        - **Frontend:** Modificar la función de compartir para que solicite un token al backend y construya una URL temporal.
    - [ ] **Sistema de Notificaciones Inteligentes:**
        - **Eliminar Notificación de "Instalar App".**
        - **Backend:** Modificar `getCatalogData` para que, basado en un timestamp, devuelva una lista de cortes agregados recientemente.
        - **Frontend:** Al iniciar, mostrar una notificación no intrusiva con los nuevos cortes.

### Fase 4: Mejoras Adicionales de Eficiencia
- **Objetivo:** Añadir funcionalidades de alto valor para el trabajo en campo.
- **Propuestas a Implementar:**
    - [ ] **Modo Offline Robusto:** Implementar caching de datos e imágenes con un Service Worker.
    - [ ] **Notas Personales por Vehículo:** Desarrollar la funcionalidad para que los usuarios guarden notas privadas en cada vehículo.

---

## 4. Trabajos Pendientes (Checklist)

Esta sección documenta las tareas de desarrollo, corrección y regresiones pendientes de la versión actual.

### Bugs y Regresiones por Corregir
- [x] **Carga de Información en Secciones:** Las secciones "Tutoriales" y "Relay" no cargan su contenido. *(Solucionado en v3.1.8 con la refactorización del backend).*
- [ ] **Organización del Pie de Página:** Los enlaces del footer deben aparecer debajo del aviso de copyright.
- [ ] **Layout del Modal de Detalle:** El nombre del colaborador debe estar posicionado sobre los botones de feedback.
- [ ] **Estilo de Botones de Feedback:** Los botones "Útil" y "Reportar" en el modal no tienen el estilo aplicado.
- [ ] **Visibilidad de Tercera Opción de Corte:** La tercera opción de corte no es visible en el modal, incluso si existen los datos.
- [ ] **Posición del Botón Limpiar Búsqueda:** El botón "x" de la barra de búsqueda se muestra fuera de su contenedor.
- [ ] **Error en Carga de Nombre de Usuario:** En la gestión de usuarios, el "Nombre de usuario" se muestra como `undefined` en la lista.

### Mejoras de Funcionalidad Pendientes
- [ ] **Mejora del Sistema de Búsqueda (`checkVehicle`):**
    - [ ] Implementar una lógica de búsqueda flexible que muestre múltiples opciones si hay coincidencias parciales (ej. "Frontier" debe poder encontrar "Frontier NP300 SE").
    - [ ] La búsqueda debe considerar coincidencias con palabras separadas o la primera palabra completa.
- [ ] **Mejora del Sistema de Feedback (Colaborador):**
    - [ ] Modificar el formato del campo "Colaborador" para incluir la contribución específica entre paréntesis.
    - [ ] Ejemplo: `Byron López (Cort 1, Apert.)`.
    - [ ] Si hay múltiples colaboradores, deben aparecer en líneas separadas. Ejemplo: `Byron López (Cort 1, Apert.)\nJoel Reyes (Cort 2, C. Alimen.)`.
- [ ] **Implementación de Sistema de Debugging Integral:**
    - [ ] **Backend:** Cada microservicio debe tener su propio módulo de debugging para responder a llamadas cURL.
    - [ ] **Frontend:** Crear una consola de debugging en `index.html`, accesible solo para el rol "Desarrollador".
    - [ ] **Funcionalidades de la Consola:**
        - [ ] Visualizar el estado y los errores de los servicios.
        - [ ] Guardar registros (error, advertencia, etc.) en la hoja "Logs" de Google Sheets.
        - [ ] Activar/desactivar funciones del navegador para prevenir debugging externo (ej. F12, menú contextual, copiar, zoom).
- [ ] **Implementar Estrategia de Carga de Imágenes Optimizada (Lazy Load):**
    - [ ] **Tarjetas del catálogo:** Cargar miniaturas de baja resolución (ej. `sz=w200`) para acelerar la carga inicial.
    - [ ] **Modal de detalle:** Al abrir el modal, cargar miniaturas de resolución media (ej. `sz=w800`).
    - [ ] **Lightbox:** Al hacer clic en una imagen del modal, mostrar la imagen en su resolución original (ej. `sz=w2048`) en un lightbox.
    - [ ] **Seguridad en Lightbox:** En la vista de lightbox, deshabilitar el menú contextual, la función de copiar y las herramientas de desarrollador (F12) para proteger las imágenes. La única interacción permitida debe ser el zoom.
- [ ] **Refactorizar Base de Datos y Lógica para Soportar Rangos de Años:**
    - [ ] **Cambio de Esquema:** En la hoja "Cortes", reemplazar la columna `Año (Generacion)` por `anoDesde` y `anoHasta`.
    - [ ] **Migración de Datos:** Crear un script (posiblemente en `write.js`) para migrar los datos de la columna antigua a las dos nuevas.
    - [ ] **Actualización de Servicios:** Modificar todos los servicios (`catalog.js`, `write.js`, `feedback.js`) y el frontend (`index.html`, `add_cortes.html`) para que utilicen la nueva estructura de años.

### Revisiones y Ajustes de UI Pendientes
- [ ] **Ajuste del Encabezado Principal (`index.html`):**
    - [ ] Posicionar el encabezado (`GPSpedia`) a la izquierda.
    - [ ] Mostrar el saludo de bienvenida justo debajo del título, con una fuente un 20% más pequeña.
- [ ] **Ajuste de "Últimos Agregados" (`index.html`):**
    - [ ] En vista móvil/PWA, mostrar los últimos 6 cortes en lugar de 5.
    - [ ] En vista web, mostrar una mayor cantidad de tarjetas según el ancho de la pantalla.
- [ ] **Ajuste de Espaciado General (`index.html`):**
    - [ ] Reducir los espacios verticales y horizontales entre los contenedores principales (header, barra de búsqueda, botones de sección, contenido, footer).
    - [ ] Ajustar el espaciado vertical de las tarjetas para mantener la consistencia visual tras la reducción del espaciado horizontal.

### Nuevas Funcionalidades Pendientes
- [ ] **Crear Página de Información (`info.html`):**
    - [ ] Desarrollar una página estática con las secciones "Sobre Nosotros", "Contáctenos" y "Preguntas Frecuentes".
    - [ ] **"Sobre Nosotros":** Redactar un texto para consumidores finales basado en la descripción del proyecto en `README.md`, omitiendo detalles técnicos internos.
    - [ ] **"Contáctenos":** Crear un formulario con los campos: "Nombre de la Organización", "Correo Electrónico", "Número de Teléfono" y "Mensaje". La información deberá enviarse a una nueva hoja de cálculo en Google Sheets.
    - [ ] **"Preguntas Frecuentes":** Implementar una sección (preferiblemente un acordeón) que explique de manera clara y concisa cada una de las funcionalidades del catálogo para un usuario nuevo (ej. cómo crear una cuenta, cómo agregar un corte, cómo usar el feedback). Se deben evitar detalles sobre la jerarquía de roles.

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
- **Columnas (Alta Granularidad):**
    - `id`, `categoria`, `marca`, `modelo`, `versionesAplicables` (nuevo, para consolidar variantes como "NP300, SE, LE"), `anoDesde`, `anoHasta`, `tipoEncendido`, `imagenVehiculo`, `videoGuiaDesarmeURL`, `contadorBusquedas` (nuevo).
    - **Por cada corte (x3):** `tipoCorteX`, `ubicacionCorteX` (nuevo), `colorCableCorteX` (nuevo), `imgCorteX`, `utilCorteX` (nuevo), `colaboradorCorteX` (nuevo).
    - `timestamp`.

### Hoja: `Tutorial` y `Configuración del Relay`
- **Propósito:** Se mantienen sin cambios estructurales y serán migrados a la nueva base de datos.

### Hojas de Sistema (DB v2)
- **`Users` y `ActiveSessions`:** Se mantienen sin cambios estructurales.
- **`Feedbacks` y `Contactanos`:** Se mantienen las estructuras ya definidas para la gestión de mensajes.
- **`ActividadUsuario` (Nueva):**
    - **Propósito:** Registrar cada acción de usuario (likes, reportes, contribuciones) para alimentar el dashboard de desempeño.
    - **Columnas:** `id`, `timestamp`, `idUsuario`, `nombreUsuario`, `tipoActividad`, `idElementoAsociado`, `detalle`.
- **`TokensCompartir` (Nueva):**
    - **Propósito:** Gestionar los enlaces de un solo uso para compartir detalles de vehículos.
    - **Columnas:** `token`, `idVehiculo`, `estado` ('NO_USADO', 'USADO'), `fechaCreacion`.
- **`LogosMarca` (Nueva):**
    - **Propósito:** Centralizar la gestión de logos de marcas para consistencia visual.
    - **Columnas:** `id`, `nombreMarca`, `urlLogo`.
- **`Logs`:** Se mantiene para el registro de errores del sistema.

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

## 8. Auditoría del Sistema (Realizada el 2024-08-03)

Esta sección presenta los resultados de una auditoría completa del código fuente y la documentación del proyecto GPSpedia 2.0. El objetivo es identificar inconsistencias, riesgos y las causas raíz de los bugs reportados.

### Hallazgos Críticos

#### A. Inconsistencia Arquitectónica Grave en el Backend

Se ha detectado una contradicción directa y de alto riesgo entre la documentación del proyecto, las normas de desarrollo y la implementación de tres de los cuatro microservicios principales.

1.  **El Problema:**
    *   Los servicios `GPSpedia-Catalog`, `GPSpedia-Write` y `GPSpedia-Users` utilizan una función dinámica (`getColumnMap`) para determinar el índice de las columnas basándose en los nombres de las cabeceras de la hoja de Google Sheets.
    *   Esto viola explícitamente la **"Nota Crítica"** documentada en `README.md` para el servicio `GPSpedia-Auth`, que subraya la necesidad de un **mapeo de columnas fijo y codificado (hardcoded)**. El servicio `Auth` sí implementa correctamente este patrón, utilizando un objeto `COLS` constante.

2.  **Riesgo Asociado:**
    *   **Alta Fragilidad:** Cualquier cambio, por mínimo que sea, en el nombre de una columna en la base de datos (ej. "Año (Generacion)" a "Año") romperá inmediata y silenciosamente todas las operaciones de los servicios afectados.
    *   **Mantenimiento Complejo:** Introduce una capa de incertidumbre. La depuración de errores se vuelve más difícil, ya que el código puede funcionar un día y fallar al siguiente por un cambio externo no relacionado con el código en sí.
    *   **Inconsistencia:** La coexistencia de dos patrones de acceso a datos contradictorios (`fijo` vs. `dinámico`) en la misma arquitectura dificulta el mantenimiento y la incorporación de nuevos desarrolladores.

3.  **Recomendación:**
    *   **Prioridad Máxima:** Refactorizar inmediatamente los servicios `catalog.js`, `write.js` y `users.js` para que utilicen un objeto `COLS` constante y fijo, similar al implementado en `auth.js`. Esto alineará todo el backend con la arquitectura definida y eliminará el riesgo de fallos inesperados.

### Análisis de Bugs del Frontend (`index.html`)

Se ha verificado que todos los bugs listados en la documentación son reproducibles y se han identificado sus causas probables.

1.  **Carga de Información en Secciones "Tutoriales" y "Relay":**
    *   **Causa:** La función `mostrarSeccion(seccion)` en `index.html` es correcta, pero la lógica de renderizado (`mostrarContenidoTutoriales` y `mostrarContenidoRelay`) se basa en las variables globales `datosTutoriales` y `datosRelay`. Estas variables se cargan una sola vez al inicio en `initializeAppData`. Sin embargo, el análisis del `catalog.js` revela que la función `handleGetCatalogData` **no invierte el orden de los datos**. Los elementos más nuevos quedan al final, y es probable que el frontend solo esté mostrando los primeros N elementos, que son los más antiguos.
    *   **Solución Sugerida:** Invertir los arrays de datos en el backend (`catalog.js`) antes de enviarlos al frontend, usando `.reverse()`.

2.  **Organización del Pie de Página:**
    *   **Causa:** Existe un error de maquetación en el `footer` de `index.html`. El texto de copyright está fuera del contenedor `div.footer-links`, lo que provoca que se rendericen como bloques separados. Además, el CSS del `footer` no está gestionando correctamente la disposición de estos elementos.
    *   **Solución Sugerida:** Mover el texto de copyright dentro de un `div` propio y ajustar el CSS del `footer` para usar `flex-direction: column` y `align-items: center` para asegurar el orden correcto.

3.  **Layout del Modal de Detalle (Colaborador y Feedback):**
    *   **Causa:** En la función `mostrarDetalleModal` de `index.html`, el `div` que contiene la información del colaborador (`colaboradorInfo`) se añade al `footerModal` *antes* que el `div` de los botones de feedback (`feedbackContainer`). Sin embargo, el CSS (`display: flex; justify-content: space-between;`) posiciona los elementos en los extremos, pero el orden visual sigue siendo incorrecto.
    *   **Solución Sugerida:** Simplemente invertir el orden en el que se añaden los elementos al `footerModal` en el DOM. Añadir primero `feedbackContainer` y luego `colaboradorInfo` para que el `space-between` funcione como se espera.

4.  **Estilo de Botones de Feedback:**
    *   **Causa:** Los botones "Útil" y "Reportar" se crean dinámicamente en JavaScript (`mostrarDetalleModal`) y se les asignan las clases `feedback-btn`, `util-btn`, y `report-btn`. Sin embargo, **no existen reglas CSS definidas** en el bloque `<style>` de `index.html` para estas clases.
    *   **Solución Sugerida:** Añadir las reglas de CSS necesarias para dar estilo a `.feedback-btn`, `.util-btn`, y `.report-btn` (colores de fondo, bordes, padding, etc.).

5.  **Visibilidad de Tercera Opción de Corte:**
    *   **Causa:** La lógica en `mostrarDetalleModal` que genera las secciones desplegables tiene un `if` condicional: `if (seccion.campos.some(c => c.value))`. Esto significa que si al menos uno de los campos de la sección tiene un valor, se crea el botón. Sin embargo, no hay un `if` separado para cada campo dentro del panel. Es muy probable que los datos para `tipoDeCorte3` y `descripcionDelCorte3` existan, pero la `imagenDelCorte3` esté vacía, y la lógica actual no maneja esto correctamente.
    *   **Solución Sugerida:** Revisar la lógica de renderizado dentro del panel desplegable para asegurar que cada campo (`tipo`, `descripción`, `imagen`) se renderice individualmente solo si tiene un valor, en lugar de depender de una única condición para todo el bloque.

6.  **Posición del Botón Limpiar Búsqueda:**
    *   **Causa:** El botón "x" (`#clear-search-btn`) tiene `position: absolute`. Su contenedor (`.search-container`) tiene `position: relative`, lo cual es correcto. El problema radica en que cuando la búsqueda se activa (`body.search-active`), se aplican reglas CSS que añaden `padding-left` al input, pero no se ajusta la posición `right` del botón de limpiar para compensar este cambio.
    *   **Solución Sugerida:** Añadir una regla CSS específica: `body.search-active .search-container.has-text #clear-search-btn { right: 35px; }` para reubicar el botón cuando la búsqueda está activa y hay texto.

### Conclusión de la Auditoría

El proyecto es funcional pero presenta una **deuda técnica significativa** en el backend que debe ser abordada con urgencia para garantizar la estabilidad a largo plazo. Los bugs del frontend son de naturaleza visual y lógica, y pueden ser corregidos con modificaciones específicas en `index.html`. Se recomienda crear un plan de acción que priorice la refactorización del backend antes de abordar las nuevas funcionalidades.
