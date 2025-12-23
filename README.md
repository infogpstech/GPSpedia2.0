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

### Fase 1: Migración a Base de Datos Optimizada (DB v2.0)
- **Objetivo:** Crear una base de datos en un **nuevo Google Spreadsheet** para soportar funcionalidades avanzadas, manteniendo la compatibilidad con la v1.5.
- **Tareas Clave:**
    - [ ] **Diseñar Nuevo Esquema:** Implementar la estructura granular detallada en la sección "Diseño Detallado de `GPSpedia_DB_v2.0`".
    - [ ] **Script de Migración:** Desarrollar un endpoint para migrar y transformar los datos de la base de datos antigua a la nueva.

### Fase 2: Sistema de Feedback Avanzado y Calidad de Datos
- **Objetivo:** Mejorar la calidad de los datos y la utilidad del feedback.
- **Tareas Clave:**
    - [ ] **Feedback Granular:** Implementar "likes" y colaborador por cada corte individual.
    - [ ] **Ordenamiento por Utilidad:** El backend ordenará los cortes de un vehículo según su popularidad antes de enviarlos al frontend.
    - [ ] **Campos Obligatorios:** Forzar el llenado de `tipo`, `ubicación`, `color` e `imagen` para cada nuevo corte.

### Fase 3: Funcionalidades de Gestión y Experiencia de Usuario
- **Objetivo:** Introducir herramientas de gestión y mejorar la experiencia del usuario.
- **Tareas Clave:**
    - [ ] **Dashboard de Desempeño:** Crear una vista para Supervisores con métricas de contribución de técnicos.
    - [ ] **Edición "In-Modal":** Permitir la edición de datos directamente desde el modal de detalles, con permisos por rol.
    - [ ] **Enlaces de un solo uso:** Generar enlaces temporales (24h) y de un solo uso para compartir información.
    - [ ] **Notificaciones Inteligentes:** Reemplazar el banner de instalación con notificaciones "toast" sobre nuevos cortes.

### Fase 4: Mejoras Adicionales
- **Objetivo:** Añadir funcionalidades de alto valor para el trabajo en campo.
- **Tareas Clave:**
    - [ ] **Modo Offline Robusto:** Implementar caching avanzado.
    - [ ] **Notas Personales:** Permitir a los usuarios guardar notas privadas por vehículo.
    - [ ] **Modal de Relay Anidado:** Mostrar detalles de configuraciones de Relay en un modal secundario.

---

## 4. Trabajos Pendientes (Checklist)

Esta sección documenta las tareas de desarrollo, corrección y regresiones pendientes de la versión actual.

### Bugs y Regresiones Críticas
- [ ] **Layout del Modal:** Corregir la posición del nombre del colaborador y el estilo de los botones de feedback.
- [ ] **Visibilidad de Cortes:** Asegurar que las tres opciones de corte sean visibles en el modal si existen los datos.
- [ ] **UI General:** Solucionar bugs visuales (pie de página, botón de limpiar búsqueda, carga de nombre de usuario).

### Mejoras de Funcionalidad Prioritarias
- [ ] **Búsqueda Flexible:** Mejorar `checkVehicle` para que devuelva coincidencias parciales y múltiples resultados.
- [ ] **Debugging Integral:** Implementar un sistema de debugging en backend y frontend accesible por rol.
- [ ] **Carga Optimizada de Imágenes (Lazy Load):** Implementar carga progresiva de imágenes para mejorar el rendimiento.
- [ ] **Soporte para Rango de Años:** Refactorizar la base de datos y la lógica para usar `anoDesde` y `anoHasta` en lugar de un año fijo.
- [ ] **Sistema de Versionamiento Híbrido:** Aplicar el nuevo sistema de versionamiento a todos los componentes del código fuente.

### Revisiones de UI/UX
- [ ] **Ajustes de Layout:** Realizar ajustes de espaciado, encabezado y visualización de "Últimos Agregados" según las especificaciones.

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

## 6. Estructura de la Base de Datos (Visión General)

La arquitectura de GPSpedia evoluciona a un modelo de dos bases de datos para garantizar la compatibilidad hacia atrás mientras se implementan nuevas funcionalidades.

- **`GPSpedia_DB_v1.5` (ID: `1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo`):** El spreadsheet actual. Se convierte en una base de datos de solo lectura para la versión v2+ de la aplicación, pero sigue siendo la fuente de datos principal para la v1.5. **No debe ser modificado estructuralmente.**
- **`GPSpedia_DB_v2.0` (Nuevo Spreadsheet):** La nueva base de datos optimizada que soportará todas las funcionalidades futuras.

### 6.1. Diseño Detallado de `GPSpedia_DB_v2.0`

#### Hoja: `Cortes`
- **Propósito:** Catálogo principal con estructura granular para datos de alta calidad.
- **Columnas:**
    - `id`, `categoria` (Estandarizada), `marca`, `modelo`, `versionesAplicables` (para consolidar variantes), `anoDesde`, `anoHasta`, `tipoEncendido`, `imagenVehiculo`, `videoGuiaDesarmeURL`, `contadorBusquedas`.
    - **Bloque por Corte (x3):** Para cada corte (1, 2, y 3), se incluyen las siguientes columnas, siendo las primeras 4 obligatorias si el bloque se utiliza:
        - `tipoCorteX` (Obligatorio)
        - `ubicacionCorteX` (Obligatorio)
        - `colorCableCorteX` (Obligatorio)
        - `imgCorteX` (Obligatorio)
        - `utilCorteX`
        - `colaboradorCorteX`
    - `timestamp`.

#### Hoja: `LogosMarca` (Nueva)
- **Propósito:** Centralizar la gestión de logos de marcas.
- **Columnas:** `id`, `nombreMarca` (clave normalizada, ej. "toyota"), `urlLogo`.

#### Hojas de Sistema
- **`Users`, `ActiveSessions`, `Tutoriales`, `Relay`, `Feedbacks`, `Contactanos`, `Logs`:** Estas hojas se migrarán al nuevo spreadsheet, manteniendo sus estructuras ya definidas.
- **`ActividadUsuario` (Nueva):**
    - **Propósito:** Registrar cada acción de usuario (likes, reportes, contribuciones) para el dashboard de desempeño.
    - **Columnas:** `id`, `timestamp`, `idUsuario`, `nombreUsuario`, `tipoActividad`, `idElementoAsociado`, `detalle`.
- **`TokensCompartir` (Nueva):**
    - **Propósito:** Gestionar los enlaces de un solo uso.
    - **Columnas:** `token`, `idVehiculo`, `estado` ('NO_USADO', 'USADO'), `fechaCreacion`, `fechaExpiracion` (nuevo, para purga automática).

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
