// GPSpedia API Configuration Module | Version: 1.0.0
// ============================================================================
// ÚNICA FUENTE DE VERDAD PARA LA CONFIGURACIÓN DE ENDPOINTS Y RUTEO DE ACCIONES
// ============================================================================

export const API_ENDPOINTS = {
    // URL del script original (monolítico). Se usará como fallback durante la migración.
    LEGACY: "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec",

    // URLs para los nuevos microservicios.
    AUTH:     "https://script.google.com/macros/s/AKfycbwATstMSSnuYZMeGEjI7Q5cznO6kA8rqLo7zNZLmu_f29qwcyt4Fucn5VIBdB9tMoRg/exec",
    CATALOG:  "https://script.google.com/macros/s/AKfycbzUdYI2MpBcXvXsNZvfBTbsDmBBzFgsqONemSd6vjwGEP2jls_eIVjXylU-nXgWa7-m7A/exec",
    WRITE:    "https://script.google.com/macros/s/AKfycbyzP3RwEAqxJN8xzrqxjlsChx4xDgRuvpW-ygWM9teMHM0hWl0DDx91gR3TTR832BWakQ/exec",
    USERS:    "https://script.google.com/macros/s/AKfycbwMOfQDAykWJ-m7wOIuxINeqxd88mieYeK6D6YoWFMGfK1j4XMsM7PWiOXBYi8D-N4T2w/exec",
    FEEDBACK: "https://script.google.com/macros/s/AKfycbzWdXSF_J2snWC43_wW9SxOGtVvQ9U_jKreNrXSt-RZhnoD9zYHwkXYHeM2OZpsB-4/exec",
    UTILITIES: "https://script.google.com/macros/s/AKfycbzkGXk_kSm3rN7K5PM0RntiPAn7DlH78RkH66a2vuwZwU8KgwDufkOiPjXoUKzuHAgG/exec"
};

export const ACTION_TO_SERVICE_MAP = {
    // Auth Service
    'login': 'AUTH',
    'validateSession': 'AUTH',

    // Catalog Service
    'getCatalogData': 'CATALOG',
    'getDropdownData': 'CATALOG',
    'checkVehicle': 'CATALOG',

    // Write Service
    'addCorte': 'WRITE',
    'addOrUpdateCut': 'WRITE',
    'addSupplementaryInfo': 'WRITE',

    // Users Service
    'getUsers': 'USERS',
    'createUser': 'USERS',
    'updateUser': 'USERS',
    'deleteUser': 'USERS',
    'changePassword': 'USERS',

    // Feedback Service
    'recordLike': 'FEEDBACK',
    'reportProblem': 'FEEDBACK',
    'sendContactForm': 'FEEDBACK', // <-- Corregido/Añadido

    // Utilities Service (NUEVO)
    'migrateYearRanges': 'UTILITIES',
    'migrateTimestamps': 'UTILITIES',

    // Legacy (acciones que aún no se han migrado o son de propósito general)
    'logFrontend': 'LEGACY'
};
