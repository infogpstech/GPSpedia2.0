# GPSpedia - Sistema de Gestión de Cortes Vehiculares (v2.0 - Arquitectura Modular)

## 1. Descripción General

GPSpedia es una aplicación web interna diseñada para técnicos e instaladores de GPS. Su objetivo principal es centralizar y estandarizar el conocimiento sobre los puntos de corte de corriente e ignición en una amplia variedad de vehículos.

En su versión 2.0, la aplicación ha sido completamente refactorizada para utilizar una **arquitectura de microservicios**, mejorando drásticamente el rendimiento, la escalabilidad y la facilidad de mantenimiento.

## 2. Plan Detallado de Migración a Arquitectura Modular (Plan B)

Este documento sirve como la documentación oficial de la nueva arquitectura de GPSpedia.

### 📋 FASE 1: INVENTARIO Y ANÁLISIS

#### 1.1 Inventario de Funciones
Se identificaron y categorizaron todas las funciones del sistema original:

```
CURRENT Code.gs FUNCTIONS INVENTORY:
─────────────────────────────────────
CATEGORÍA       | FUNCIONES         | VOLUMEN | CRÍTICO
─────────────────────────────────────
AUTH/LOGIN      | handleLogin       | Alto    | Sí
                | handleValidateSession
                | SESSION_LIMITS
─────────────────────────────────────
CATÁLOGO/LECTURA| handleGetCatalogData | Muy Alto | Sí
                | handleGetDropdownData
                | handleCheckVehicle
                | camelCase
                | getColumnMap
─────────────────────────────────────
ESCRITURA       | handleAddCorte    | Alto    | Sí
                | handleFileUploads
                | getOrCreateFolder
                | updateRowData
                | isYearInRange
─────────────────────────────────────
FEEDBACK        | handleRecordLike  | Bajo    | No
                | handleReportProblem
─────────────────────────────────────
USUARIOS        | handleGetUsers    | Medio   | Sí
                | handleCreateUser
                | handleUpdateUser
                | handleDeleteUser
                | handleChangePassword
                | generateUniqueUsername
─────────────────────────────────────
AUXILIARES      | arrayToMap        | Bajo    | Sí
                | (compartidas)
─────────────────────────────────────
```

#### 1.2 Análisis de Dependencias

```
DEPENDENCY MAP:
1. handleAddCorte → handleFileUploads → getOrCreateFolder
2. handleLogin → SESSION_LIMITS → ActiveSessions
3. Most handlers → getColumnMap → camelCase
4. handleCheckVehicle → isYearInRange
```

### 🏗️ FASE 2: DISEÑO ARQUITECTURAL

#### 2.1 Definición de 5 Proyectos Apps Script

Se diseñó la separación en cinco microservicios independientes:

```
PROYECTO 1: GPSPEDIA-AUTH (autenticacion.js)
────────────────────────────────────────────
FUNCIONES:
• handleLogin
• handleValidateSession
• SESSION_LIMITS management
• ActiveSessions sheet handling
HOJAS ACCEDIDAS: Users, ActiveSessions
PERMISOS: Lectura/Escritura en 2 hojas

────────────────────────────────────────────
PROYECTO 2: GPSPEDIA-CATALOG (catalog.js)
────────────────────────────────────────────
FUNCIONES:
• handleGetCatalogData
• handleGetDropdownData
• handleCheckVehicle
• camelCase (local)
• getColumnMap (versión catálogo)
• isYearInRange
HOJAS ACCEDIDAS: Cortes, Tutoriales, Relay
PERMISOS: SOLO LECTURA

────────────────────────────────────────────
PROYECTO 3: GPSPEDIA-WRITE (write.js)
────────────────────────────────────────────
FUNCIONES:
• handleAddCorte
• handleFileUploads
• getOrCreateFolder
• updateRowData
• camelCase (local)
• getColumnMap (versión cortes)
HOJAS ACCEDIDAS: Cortes (escritura)
PERMISOS: Lectura/Escritura en 1 hoja + Drive

────────────────────────────────────────────
PROYECTO 4: GPSPEDIA-USERS (users.js)
────────────────────────────────────────────
FUNCIONES:
• handleGetUsers
• handleCreateUser
• handleUpdateUser
• handleDeleteUser
• handleChangePassword
• generateUniqueUsername
• getColumnMap (versión users)
HOJAS ACCEDIDAS: Users
PERMISOS: Lectura/Escritura en 1 hoja

────────────────────────────────────────────
PROYECTO 5: GPSPEDIA-FEEDBACK (feedback.js)
────────────────────────────────────────────
FUNCIONES:
• handleRecordLike
• handleReportProblem
HOJAS ACCEDIDAS: Cortes (solo campo "util"), Feedbacks
PERMISOS: Lectura/Escritura limitada
```

#### 2.2 Esquema de Comunicación

```
FRONTEND (HTML/JS) → API_MANAGER.JS → MÚLTIPLES APPS SCRIPTS
    │
    ├─► AUTH-SCRIPT (login, session)
    ├─► CATALOG-SCRIPT (data loading)
    ├─► WRITE-SCRIPT (add cortes)
    └─► USERS-SCRIPT (user management)
```

### 🛠️ FASE 3: IMPLEMENTACIÓN

Se crearon y desplegaron los 5 proyectos de Apps Script, cada uno con su propio archivo de código (`auth.js`, `catalog.js`, etc.).

### 🔄 FASE 4: REFACTOR FRONTEND

**4.1 Crear `api-manager.js`:** Se escribió un módulo central en el frontend para actuar como un enrutador, abstrayendo la complejidad de tener múltiples endpoints de backend.

**4.2 Actualizar HTML:** Todos los archivos (`index.html`, `add_cortes.html`, `users.html`) fueron refactorizados para usar el `api-manager.js`, centralizando toda la lógica de comunicación.

### 🧪 FASE 5: TESTING Y MIGRACIÓN

Se ejecutó un plan de testing exhaustivo para cada servicio y se siguió una estrategia de migración gradual para minimizar el riesgo.

```
TEST SUITE (Resumen):
✔️ Autenticación: Login, logout, validación de sesión.
✔️ Catálogo: Carga de datos, filtros, búsqueda.
✔️ Escritura: Añadir nuevos vehículos, subir imágenes.
✔️ Usuarios: CRUD de usuarios según roles.
✔️ Feedback: Funcionalidad de "útil" y reporte de problemas.
```

### 🚨 RIESGOS Y MITIGACIÓN

*   **Riesgo:** Sesiones no persistentes entre scripts.
    *   **Mitigación:** Se utilizó la misma hoja `ActiveSessions` para todos los servicios relevantes.
*   **Riesgo:** Complejidad en el frontend.
    *   **Mitigación:** `api-manager.js` abstrae y centraliza toda la complejidad.

---

## 3. Estructura de la Base de Datos (Google Sheets)

El Spreadsheet con ID `1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo` contiene las siguientes hojas:

### Hoja: `Users`
Almacena la información de los usuarios y sus credenciales.

*   **Columnas y Orden:**
    1.  `ID`
    2.  `Nombre_Usuario`
    3.  `Password`
    4.  `Privilegios`
    5.  `Nombre`
    6.  `Telefono`
    7.  `Correo_Electronico`
    8.  `SessionToken`

> **NOTA CRÍTICA SOBRE LA AUTENTICACIÓN:** Después de un largo y persistente problema de "Credenciales inválidas" durante la migración, se tomó la decisión de **reconstruir el servicio de autenticación (`Auth.js`) desde cero**. La versión final y funcional utiliza una correspondencia de columnas **fija y directa (hardcoded)**, basada exactamente en el orden y los nombres listados arriba.
>
> **ADVERTENCIA:** **NO ALTERAR, RENOMBRAR NI REORDENAR LAS COLUMNAS DE LA HOJA `Users`**. Hacerlo romperá el sistema de inicio de sesión de forma inmediata. El `Auth.js` actual depende directamente de esta estructura.

### Otras Hojas
*   `Cortes`: Catálogo principal de vehículos.
*   `Feedbacks`: Reportes de problemas.
*   `Logs`: Registro de eventos y errores.
*   `ActiveSessions`: Gestiona las sesiones de usuario activas.
