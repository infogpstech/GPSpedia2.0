# Instrucciones para Solucionar el Error "Credenciales Inválidas"

## Problema
El código en este repositorio de Git ya ha sido corregido, pero la aplicación web que estás utilizando en la URL pública no se ha actualizado. Esto causa que sigas viendo el error "Credenciales inválidas", porque la versión antigua del archivo `index.html` todavía está en uso.

## Solución
Necesitas crear un **nuevo despliegue (deployment)** desde el editor de Google Apps Script. Esto forzará la actualización de todos los archivos (`.gs` y `.html`) a la versión más reciente.

## Pasos a Seguir

1.  **Abrir el proyecto:** Ve al editor de Google Apps Script abriendo esta URL en tu navegador: `https://script.google.com`. Busca y abre tu proyecto.

2.  **Gestionar Despliegues:**
    *   En la parte superior derecha de la pantalla, haz clic en el botón azul que dice **Deploy**.
    *   En el menú que se despliega, selecciona la opción **Manage deployments**.

3.  **Editar el Despliegue Activo:**
    *   Verás una lista de tus despliegues. Localiza el que corresponda a tu aplicación web (generalmente estará marcado como **Active**).
    *   A la derecha de ese despliegue, haz clic en el icono de **lápiz (Editar)**.

4.  **Crear una Nueva Versión:**
    *   Se abrirá una ventana de configuración. Busca el menú desplegable llamado **Version**.
    *   Haz clic en él y selecciona la opción **New version**.

5.  **Desplegar:**
    *   Puedes añadir una descripción si lo deseas (por ejemplo: "Corrección de inicio de sesión").
    *   Haz clic en el botón azul **Deploy** para finalizar el proceso.

Una vez que hayas completado estos pasos, la URL de tu aplicación web se actualizará con el código más reciente. Por favor, intenta iniciar sesión de nuevo. El problema debería estar resuelto.
