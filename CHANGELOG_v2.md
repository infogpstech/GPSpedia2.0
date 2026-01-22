# CHANGELOG: GPSpedia v2.0 vs GPSpedia v1.5 (Olds)

Este documento detalla las mejoras, nuevas funcionalidades y cambios arquitectónicos implementados en la versión 2.0 respecto a la versión 1.5.

## 1. Arquitectura y Backend
*   **De Monolito a Microservicios:** Migración de un único script masivo a 7 microservicios independientes (Auth, Catalog, Write, Users, Feedback, Utilities, Legacy).
*   **Seguridad RBAC:** Implementación de un sistema de Control de Acceso Basado en Roles (Jerarquía: Desarrollador > Jefe/Gefe > Supervisor > Tecnico).
*   **Validación de Sesiones:** Uso de tokens de sesión y validación cruzada en backend, eliminando la dependencia de cookies de terceros.
*   **Gestión de Imágenes:** Implementación de constantes de resolución (SMALL, MEDIUM, LARGE) y carga optimizada vía miniaturas de Drive para alto rendimiento.

## 2. Gestión de Datos y Catálogo
*   **Buscador Inteligente:** Nuevo motor de búsqueda con detección automática de marcas y modelos, integrando iconos visuales de fabricantes.
*   **Navegación Jerárquica Fluida:** Flujo optimizado: Categoría -> Marca -> Modelos -> Versiones/Tipos de Encendido -> Años.
*   **Gestión de Versiones de Equipamiento:** Soporte para múltiples variantes de un mismo modelo y año según su equipamiento técnico.
*   **Rango de Años Mejorado:** Mejor manejo de generaciones vehiculares y rangos de años de producción.
*   **Estandarización de Terminología:** Unificación de nombres de cortes (Bomba de combustible, Señal al botón, Ignición).

## 3. Interfaz de Usuario (UI/UX)
*   **Modo Oscuro Nativo:** Implementación completa con persistencia en el dispositivo y cambio dinámico de logos.
*   **Optimización de Imágenes:**
    *   Uso de `loading="lazy"` en todo el catálogo.
    *   Tres resoluciones adaptativas (SMALL 300px, MEDIUM 800px, LARGE 1600px).
    *   Carga de alta resolución bajo demanda (trigger on-click) para ahorro de datos.
*   **Lightbox Avanzado:** Nueva vista de imágenes a pantalla completa con soporte para zoom.
*   **Diseño Responsive:** Uso de VisualViewport API para estabilidad del layout con teclado virtual en móviles.
*   **Footer Interactivo:** Acceso rápido a Información, Contacto y FAQ.

## 4. Funcionalidades de Gestión (Nuevas en 2.0)
*   **Sistema de Feedback (Inbox):** Bandeja de entrada para que administradores gestionen reportes de errores y sugerencias de técnicos.
*   **Dashboard de Actividad:** Panel visual para supervisores con logs de actividad en tiempo real.
*   **Sistema de Votos (Likes):** Los usuarios pueden marcar cortes específicos como "útiles", permitiendo al sistema destacar la información más confiable.
*   **Reporte de Problemas:** Herramienta directa en el detalle del vehículo para informar inconsistencias técnicas.
*   **FAQs Acordeón:** Centro de ayuda integrado con animaciones fluidas.

## 5. Mejoras en Registro de Datos
*   **Asistente Anti-duplicado:** Al agregar un nuevo corte, el sistema verifica coincidencias existentes y asiste al usuario para evitar registros redundantes.
*   **Campos de Colaborador:** Atribución directa de la información aportada por cada técnico.

---
*GPSpedia v2.0 - Marcando la diferencia técnica.*
