# GPSpedia - Sistema de Gestión de Cortes Vehiculares

## 1. Descripción General

GPSpedia es una aplicación web interna diseñada para técnicos e instaladores de GPS. Su objetivo principal es centralizar y estandarizar el conocimiento sobre los puntos de corte de corriente e ignición en una amplia variedad de vehículos. La aplicación permite a los técnicos consultar información detallada y colaborar añadiendo nuevos datos, optimizando así los tiempos de instalación y reduciendo errores.

La plataforma funciona como una Progressive Web App (PWA), permitiendo su instalación en la pantalla de inicio de dispositivos móviles para un acceso rápido y eficiente en campo.

## 2. Arquitectura del Sistema

El proyecto sigue una arquitectura de dos capas:

*   **Frontend:** Una aplicación cliente ligera construida con HTML, CSS y JavaScript nativo. Se encarga de la interfaz de usuario, la interacción y la comunicación con el backend.
*   **Backend:** Un potente script desarrollado en **Google Apps Script**, que actúa como una API REST. Gestiona toda la lógica de negocio, el control de acceso y la interacción con la base de datos.
*   **Base de Datos:** Se utiliza **Google Sheets** como un sistema de base de datos robusto y fácil de gestionar. Toda la información de la aplicación se almacena en diferentes hojas dentro de un único spreadsheet.

La comunicación entre el frontend y el backend se realiza mediante solicitudes `fetch` (POST) a una única URL de Web App de Google Apps Script. El backend direcciona cada solicitud a la función adecuada basándose en un parámetro `action` en el cuerpo de la solicitud.

## 3. Estructura de la Base de Datos (Google Sheets)

El Spreadsheet con ID `1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo` contiene las siguientes hojas:

### Hoja: `Users`
Almacena la información de los usuarios y sus credenciales.
*   **Columnas:**
    *   `ID`: Identificador único para cada usuario.
    *   `Nombre_Usuario`: Nickname utilizado para el login (ej. `p_pena`).
    *   `Password`: Contraseña del usuario (hasheada).
    *   `Privilegios`: Rol del usuario, que define sus permisos.
    *   `Nombre`: Nombre completo del usuario.
    *   `Telefono`: Número de contacto.
    *   `Correo_Electronico`: Email de contacto.
    *   `SessionToken`: Token de sesión para gestionar sesiones activas.

### Hoja: `Cortes`
El catálogo principal de la aplicación, contiene toda la información técnica de los vehículos.
*   **Columnas:**
    *   `ID`: Identificador único (fórmula).
    *   `Categoria`: Tipo de vehículo (ej. `Auto`, `Camioneta`).
    *   `Imagen del vehiculo`: URL a una imagen del vehículo.
    *   `Marca`: Marca del vehículo (ej. `Nissan`).
    *   `Modelo`: Modelo del vehículo (ej. `Versa`).
    *   `Tipo de encendido`: (ej. `Llave`, `Botón`).
    *   `Año (generacion)`: Rango de años o generación.
    *   `Tipo de corte`: Ubicación del primer corte (ej. `Bomba de Gasolina`).
    *   `Descripcion del corte`: Detalles sobre el primer corte.
    *   `Imagen del Corte`: URL a una imagen del primer corte.
    *   `Descripción del Segundo corte`: Detalles sobre el segundo corte (opcional).
    *   `Tipo de corte 2`: Ubicación del segundo corte (opcional).
    *   `Imagen de corte 2`: URL a una imagen del segundo corte (opcional).
    *   `Apertura`: Información sobre la apertura remota.
    *   `Imagen de la apertura`: URL a una imagen de la apertura.
    *   `Nota Importante`: Información adicional relevante.
    *   `Cables de Alimentacion`: Ubicación y colores de los cables de alimentación.
    *   `Imagen de los cables de alimentacion`: URL a una imagen de los cables.
    *   `Como desarmar los plasticos (embed)`: URL a un video tutorial (YouTube).
    *   `Colaborador`: Nombre del usuario que añadió la información.
    *   `Tipo de corte 3`: Ubicación del tercer corte (opcional).
    *   `Descripción del corte 3`: Detalles sobre el tercer corte (opcional).
    *   `Imagen del corte 3`: URL a una imagen del tercer corte (opcional).
    *   `Util`: Nombres de los usuarios que marcaron la entrada como "útil".

### Hoja: `Feedbacks`
Registra los problemas reportados por los usuarios sobre las entradas del catálogo.
*   **Columnas:**
    *   `ID`: Identificador único del feedback.
    *   `Usuario`: Nombre del usuario que reporta.
    *   `ID_vehiculo`: ID de la entrada de "Cortes" a la que se refiere.
    *   `Problema`: Descripción del problema reportado.
    *   `Respuesta`: Respuesta del administrador o supervisor.
    *   `¿Se resolvió?`: Estado del feedback (ej. `SI`, `NO`, `Pendiente`).
    *   `Responde`: Nombre del administrador que gestionó el feedback.

### Hoja: `Logs`
Utilizada para el registro remoto de errores y eventos del frontend.
*   **Columnas:**
    *   `Timestamp`: Fecha y hora del evento.
    *   `Level`: Nivel del log (ej. `ERROR`, `INFO`, `DEBUG`).
    *   `Message`: Mensaje principal del log.
    *   `Data`: Objeto JSON con datos adicionales (ej. stack trace, contexto).

## 4. Funcionalidades Detalladas

### Autenticación y Gestión de Sesión
*   **Login:** Los usuarios inician sesión con su `Nombre_Usuario` y `Password`.
*   **Validación:** El backend verifica las credenciales contra la hoja `Users`.
*   **Sesión:** Si las credenciales son correctas, se crea un objeto de sesión con los datos del usuario, que se almacena en el `localStorage` del navegador. Esto permite mantener la sesión activa entre recargas.
*   **Límites de Sesión:** El sistema controla el número de sesiones activas por rol mediante un `SessionToken`. Si se excede el límite (ej. un técnico inicia sesión en un segundo dispositivo), la sesión más antigua se invalida.

### Control de Acceso Basado en Roles (RBAC)
Los privilegios determinan las acciones que un usuario puede realizar. La jerarquía es estricta:
*   **`Desarrollador`:** Acceso total. Puede gestionar todas las cuentas de usuario, incluyendo otros Desarrolladores, y es el único que puede ver y gestionar a los `Tecnico_Exterior`.
*   **`Gefe`:** Puede gestionar a `Supervisor` y `Tecnico`. Puede crear otros `Gefe`, pero no modificarlos ni eliminarlos.
*   **`Supervisor`:** Puede gestionar únicamente a los usuarios con rol `Tecnico`.
*   **`Tecnico` y `Tecnico_Exterior`:** No tienen acceso a la gestión de usuarios. Solo pueden ver y editar su propio perfil (cambiar contraseña).

### Gestión de Usuarios (CRUD)
*   **Vista:** La página `users.html` muestra una tabla de usuarios a los roles con privilegios (`Supervisor` y superior). Los roles `Tecnico` solo ven su propio perfil.
*   **Crear:** Los usuarios con privilegios pueden crear nuevos usuarios a través de un modal. El formulario limita los roles que se pueden asignar según la jerarquía.
*   **Editar:** Se pueden modificar los datos de usuarios de menor rango.
*   **Eliminar:** Se pueden eliminar usuarios de menor rango.
*   **Cambio de Contraseña:** Cualquier usuario puede cambiar su propia contraseña.

### Catálogo de "Cortes"
*   **Búsqueda:** La página principal (`index.html`) permite buscar en el catálogo por marca, modelo y año.
*   **Vista de Detalles:** Al seleccionar un vehículo, un modal muestra toda la información detallada, incluyendo hasta 3 cortes, imágenes, notas y videos.
*   **Añadir Nuevos Cortes:** Los usuarios pueden añadir nuevas entradas al catálogo a través del formulario en `add_cortes.html`. El backend se encarga de añadir la fila a la hoja `Cortes` y gestionar la subida de imágenes a una carpeta designada en Google Drive (`1-8QqhS-wtEFFwyBG8CmnEOp5i8rxSM-2`).

### Sistema de Feedback
*   **"Útil" (Like):** En la vista de detalles de un corte, los usuarios pueden marcar la información como "Útil". El backend registra el nombre del usuario en la columna `Util` de la hoja `Cortes`.
*   **Reportar Problema:** Si un usuario encuentra un error, puede reportarlo. Esto crea una nueva fila en la hoja `Feedbacks` para que sea revisada por un administrador.

### Registro Remoto de Errores (Remote Logging)
*   **Captura:** El frontend está equipado con un manejador de errores global (`window.onerror`) y una función `remoteLog`.
*   **Envío:** Cualquier error no capturado o evento importante se envía al backend.
*   **Almacenamiento:** El backend recibe el log y lo escribe en la hoja `Logs`, proporcionando una herramienta vital para la depuración y el monitoreo de problemas en el lado del cliente.
