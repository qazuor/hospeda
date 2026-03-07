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
 * // 'El titulo debe tener al menos 5 caracteres'
 * ```
 */
export const FEEDBACK_STRINGS = {
    /** Floating action button (FAB) strings */
    fab: {
        tooltip: 'Reportar un problema (Ctrl+Shift+F)',
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
        title: 'Titulo',
        titlePlaceholder: 'Resumen breve del problema...',
        description: 'Descripcion',
        descriptionPlaceholder: 'Describe que paso...',
        email: 'Email',
        name: 'Nombre',
        severity: 'Severidad',
        stepsToReproduce: 'Pasos para reproducir',
        stepsPlaceholder: '1. Ir a...\n2. Hacer click en...',
        expectedResult: 'Resultado esperado',
        actualResult: 'Resultado actual',
        emailPlaceholder: 'email@ejemplo.com',
        namePlaceholder: 'Tu nombre',
        attachments: 'Capturas de pantalla',
        uploadButton: 'Subir',
        fileTooBig: 'El archivo supera el tamaño maximo permitido',
        fileTypeInvalid: 'Tipo de archivo no permitido'
    },

    /** Action button labels */
    buttons: {
        submit: 'Enviar',
        addDetails: 'Agregar mas detalles',
        back: 'Volver',
        close: 'Cerrar',
        submitAnother: 'Enviar otro',
        reportError: 'Reportar este error',
        reloadPage: 'Recargar'
    },

    /** Collapsible technical details section (auto-collected environment data) */
    techDetails: {
        title: 'Detalles tecnicos (auto-recolectados)',
        url: 'URL',
        browser: 'Navegador',
        os: 'Sistema operativo',
        viewport: 'Viewport',
        version: 'Version',
        consoleErrors: 'Errores de consola'
    },

    /** Success state after a report is submitted */
    success: {
        title: 'Reporte enviado!',
        message: 'Tu reporte fue enviado correctamente.',
        issueLabel: 'Issue',
        fallbackMessage: 'Tu reporte fue enviado por email. Lo revisaremos a la brevedad.',
        thanks: 'Gracias por ayudarnos a mejorar!'
    },

    /** Error boundary fallback UI */
    errorBoundary: {
        title: 'Algo salio mal',
        message:
            'Ocurrio un error inesperado. Podes reportar este problema para ayudarnos a solucionarlo.'
    },

    /** Form field validation error messages */
    validation: {
        titleMin: 'El titulo debe tener al menos 5 caracteres',
        titleMax: 'El titulo no puede superar los 200 caracteres',
        descriptionMin: 'La descripcion debe tener al menos 10 caracteres',
        descriptionMax: 'La descripcion no puede superar los 5000 caracteres',
        emailRequired: 'El email es obligatorio',
        emailInvalid: 'El email no es valido',
        nameRequired: 'El nombre es obligatorio'
    },

    /** Rate limit error message */
    rateLimit: {
        message: 'Demasiados reportes. Intenta de nuevo mas tarde.'
    }
} as const;
