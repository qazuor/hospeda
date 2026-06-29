/**
 * @repo/feedback - All user-facing text for the feedback system.
 *
 * Hardcoded in Spanish for the beta phase. No i18n dependency is
 * introduced deliberately to keep the feedback package crash-resistant
 * and independent of the main app's i18n setup.
 *
 * When the beta phase ends, replace this with i18n-based strings if needed.
 */

/**
 * All user-facing strings for the feedback widget, form, and supporting UI.
 *
 * Organized by feature area: `fab` for the floating action button,
 * `form` for modal titles, `fields` for input labels/placeholders,
 * `buttons` for action labels, `techDetails` for the collapsible
 * technical info section, `success`/`errorBoundary` for states, and
 * `validation`/`rateLimit` for error messages.
 *
 * @example
 * ```ts
 * import { FEEDBACK_STRINGS } from '@repo/feedback';
 *
 * // Use in a React component
 * <button title={FEEDBACK_STRINGS.fab.tooltip}>
 *   <BugIcon />
 * </button>
 *
 * // Use a validation message
 * const msg = FEEDBACK_STRINGS.validation.titleMin;
 * // 'El título debe tener al menos 5 caracteres'
 * ```
 */
export const FEEDBACK_STRINGS = {
    /** Floating action button (FAB) strings */
    fab: {
        /** Visible label inside the FAB pill (desktop only). */
        label: 'Reportar problema',
        /** ARIA label and hover tooltip — full description with shortcut. */
        tooltip: 'Reportar un problema (Ctrl+Shift+F)',
        /** ARIA label without keyboard shortcut. */
        tooltipBase: 'Reportar un problema',
        minimizeTooltip: 'Minimizar'
    },

    /** Form modal / page title strings */
    form: {
        title: 'Reportar un problema',
        step2Title: 'Reportar un problema (2/2)'
    },

    /** Input field labels and placeholder text */
    fields: {
        type: 'Tipo',
        title: 'Título',
        titlePlaceholder: 'Resumen breve del problema...',
        description: 'Descripción',
        descriptionPlaceholder: 'Describí qué pasó...',
        email: 'Email',
        name: 'Nombre',
        severity: 'Severidad',
        stepsToReproduce: 'Pasos para reproducir',
        stepsPlaceholder: '1. Ir a...\n2. Hacer click en...',
        expectedResult: 'Resultado esperado',
        expectedResultPlaceholder: 'Lo que esperabas que pasara...',
        actualResult: 'Resultado actual',
        actualResultPlaceholder: 'Lo que realmente ocurrió...',
        severityOptional: '-- Opcional --',
        emailPlaceholder: 'email@ejemplo.com',
        namePlaceholder: 'Tu nombre',
        attachments: 'Capturas de pantalla',
        uploadButton: 'Subir',
        fileTooBig: 'El archivo supera el tamaño máximo permitido',
        fileTypeInvalid: 'Tipo de archivo no permitido',
        fileHintFormat: 'PNG, JPG, WebP, GIF',
        fileHintMaxSize: 'máx. {size} por archivo',
        removeFileLabel: 'Eliminar {name}',
        consoleErrorsCount: '{count} error(es) capturado(s)'
    },

    /** Action button labels */
    buttons: {
        submit: 'Enviar',
        addDetails: 'Agregar más detalles',
        hideDetails: 'Ocultar detalles',
        back: 'Volver',
        close: 'Cerrar',
        submitAnother: 'Enviar otro',
        reportError: 'Reportar este error',
        reloadPage: 'Recargar'
    },

    /** Collapsible technical details section (auto-collected environment data) */
    techDetails: {
        title: 'Detalles técnicos (auto-recolectados)',
        url: 'URL',
        browser: 'Navegador',
        os: 'Sistema operativo',
        viewport: 'Viewport',
        version: 'Build',
        consoleErrors: 'Errores de consola',
        // Field group headers
        groupSystem: 'Sistema',
        groupBrowser: 'Navegador',
        groupTraces: 'Trazas',
        groupContext: 'Contexto',
        // Newly editable fields
        locale: 'Idioma',
        timezone: 'Zona horaria',
        deviceType: 'Tipo de dispositivo',
        connectionType: 'Conexión',
        colorScheme: 'Tema',
        featureFlags: 'Feature flags (clave=valor por línea)',
        navigationHistory: 'Historial de navegación (una URL por línea)',
        lastInteractions: 'Últimas interacciones',
        clearField: 'Limpiar',
        sentryEventId: 'Sentry event ID',
        errorMessage: 'Mensaje de error',
        errorStack: 'Stack trace',
        // Select option labels
        deviceTypeMobile: 'Mobile',
        deviceTypeTablet: 'Tablet',
        deviceTypeDesktop: 'Desktop',
        colorSchemeLight: 'Claro',
        colorSchemeDark: 'Oscuro',
        unspecified: '-- Sin especificar --'
    },

    /** Success state after a report is submitted */
    success: {
        title: '¡Reporte enviado!',
        message: 'Tu reporte fue enviado correctamente.',
        issueLabel: 'Issue',
        fallbackMessage: 'Tu reporte fue enviado por email. Lo revisaremos a la brevedad.',
        thanks: '¡Gracias por ayudarnos a mejorar!'
    },

    /** Error boundary fallback UI */
    errorBoundary: {
        title: 'Algo salió mal',
        message:
            'Ocurrió un error inesperado. Podés reportar este problema para ayudarnos a solucionarlo.'
    },

    /** Form field validation error messages */
    validation: {
        titleMin: 'El título debe tener al menos 5 caracteres',
        titleMax: 'El título no puede superar los 200 caracteres',
        descriptionMin: 'La descripción debe tener al menos 10 caracteres',
        descriptionMax: 'La descripción no puede superar los 5000 caracteres',
        emailRequired: 'El email es obligatorio',
        emailInvalid: 'El email no es válido',
        nameRequired: 'El nombre es obligatorio'
    },

    /** Rate limit error message */
    rateLimit: {
        message: 'Demasiados reportes. Intentá de nuevo más tarde.'
    }
} as const;
