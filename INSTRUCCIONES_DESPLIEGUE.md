# Instrucciones de Despliegue - Arquitectura Modular

## Descripción General
Este documento describe el proceso para desplegar o actualizar la aplicación GPSpedia, que ahora utiliza una arquitectura de microservicios. En lugar de un solo script, el sistema se compone de **5 Google Apps Scripts independientes** y un **frontend** que los consume.

## Arquitectura
1.  **5 Proyectos Apps Script (Backend):**
    *   `GPSpedia-Auth`: Gestiona la autenticación.
    *   `GPSpedia-Catalog`: Provee datos de solo lectura.
    *   `GPSpedia-Write`: Maneja la escritura de datos y subida de archivos.
    *   `GPSpedia-Users`: Administra los usuarios.
    *   `GPSpedia-Feedback`: Procesa el feedback de los usuarios.
2.  **Archivos `html` y `js` (Frontend):**
    *   `index.html`, `add_cortes.html`, `users.html`: Las interfaces de usuario.
    *   `api-manager.js`: **Archivo clave** que centraliza las URLs de los 5 servicios.

---

## Proceso de Despliegue (Primera Vez)

### Paso 1: Crear y Desplegar los 5 Servicios de Backend

Deberás crear un proyecto de Google Apps Script para cada uno de los servicios. Repite el siguiente proceso 5 veces:

1.  **Crear un nuevo proyecto en Apps Script:**
    *   Ve a [script.google.com/create](https://script.google.com/create).
    *   Nombra el proyecto según el servicio (ej. `GPSpedia-Auth`).

2.  **Copiar el Código del Servicio:**
    *   Dentro del nuevo proyecto, renombra el archivo `Code.gs` por uno más descriptivo (ej. `auth.js`).
    *   Copia el contenido completo del archivo correspondiente que se encuentra en la carpeta `services/` de este repositorio.
        *   Para `GPSpedia-Auth`, copia el código de `services/auth/auth.js`.
        *   Para `GPSpedia-Catalog`, copia el código de `services/catalog/catalog.js`.
        *   Y así sucesivamente para los 5 servicios.

3.  **Configurar el Acceso a la Hoja de Cálculo:**
    *   Asegúrate de que la constante `SPREADSHEET_ID` en cada script (`"1jEdC2NMc2a5F36xE2MJfgxMZiZFVfeDqnCdVizNGIMo"`) es correcta.

4.  **Realizar el Despliegue (Deployment):**
    *   Haz clic en el botón azul **Deploy > New deployment**.
    *   En la ventana, haz clic en el icono de **engranaje (⚙️)** y selecciona **Web app**.
    *   Configura las siguientes opciones:
        *   **Description:** "Versión 1.0"
        *   **Execute as:** "Me (your email)"
        *   **Who has access:** "Anyone" (o "Anyone within your organization" si es interno).
    *   Haz clic en **Deploy**.
    *   **Autoriza los permisos** que te solicite (acceso a Google Sheets, Drive, etc.).
    *   **¡MUY IMPORTANTE!** Copia la **Web app URL** que se genera. La necesitarás en el siguiente paso.

5.  **Verificar el Despliegue:**
    *   Pega la URL de la Web app en tu navegador. Deberías ver un mensaje de éxito en formato JSON, como: `{"status":"success","message":"GPSpedia AUTH-SERVICE v1.0 is active."}`. Esto confirma que el servicio está funcionando.

### Paso 2: Configurar el Frontend

1.  **Actualizar `api-manager.js`:**
    *   Abre el archivo `api-manager.js` en tu editor de código.
    *   Pega cada una de las 5 URLs que obtuviste en el paso anterior en el lugar que les corresponde dentro del objeto `API_ENDPOINTS`.

    ```javascript
    const API_ENDPOINTS = {
        LEGACY: "...",
        AUTH:     "URL_QUE COPIASTE PARA EL SERVICIO DE AUTENTICACIÓN",
        CATALOG:  "URL_QUE COPIASTE PARA EL SERVICIO DE CATÁLOGO",
        WRITE:    "URL_QUE COPIASTE PARA EL SERVICIO DE ESCRITURA",
        USERS:    "URL_QUE COPIASTE PARA EL SERVICIO DE USUARIOS",
        FEEDBACK: "URL_QUE COPIASTE PARA EL SERVICIO DE FEEDBACK"
    };
    ```

### Paso 3: Desplegar el Script Principal (que aloja el Frontend)

El frontend (`index.html`, `add_cortes.html`, `users.html`, y `api-manager.js`) todavía necesita ser alojado en algún lugar. Puedes usar el script "legacy" para este propósito.

1.  **Abrir tu proyecto de Apps Script principal/antiguo.**
2.  **Asegurarte de que los archivos HTML y `api-manager.js` están actualizados:**
    *   Sube o copia el contenido de los archivos `index.html`, `add_cortes.html`, `users.html` y `api-manager.js` de este repositorio a tu proyecto de Apps Script.
3.  **Realizar un Nuevo Despliegue:**
    *   Sigue el mismo proceso de **Deploy > Manage deployments**, selecciona tu despliegue activo, edítalo y crea una **New version**.
    *   Esto actualizará la interfaz de usuario para que utilice el nuevo `api-manager.js` y, por lo tanto, los nuevos microservicios.

---

## Proceso de Actualización

### Si modificas un servicio de Backend (ej. `auth.js`)
1.  Abre el proyecto de Apps Script correspondiente (ej. `GPSpedia-Auth`).
2.  Realiza tus cambios en el código.
3.  Haz clic en **Deploy > Manage deployments**.
4.  Edita tu despliegue activo, elige **New version** y haz clic en **Deploy**. La URL no cambiará.

### Si modificas el Frontend (ej. `index.html`)
1.  Abre tu proyecto de Apps Script principal (el que aloja los HTML).
2.  Actualiza el archivo HTML o JS correspondiente.
3.  Haz clic en **Deploy > Manage deployments**.
4.  Edita tu despliegue activo, elige **New version** y haz clic en **Deploy**.
