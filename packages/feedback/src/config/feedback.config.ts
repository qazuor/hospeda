/**
 * @repo/feedback - Centralized configuration for the feedback system.
 *
 * All configurable values are defined here. Update this file to stay
 * in sync with Linear when team IDs, project IDs, or label IDs change.
 */

/**
 * Report types with Linear label mapping.
 *
 * Each report type maps to a Linear label for automatic categorization.
 * Replace PLACEHOLDER_ values with actual Linear label IDs once the
 * Linear project is created.
 *
 * @example
 * ```ts
 * const bugType = REPORT_TYPES.find(t => t.id === 'bug-js');
 * // { id: 'bug-js', label: 'Error de JavaScript', linearLabelId: 'PLACEHOLDER_LABEL_BUG_JS' }
 * ```
 */
export const REPORT_TYPES = [
    {
        id: 'bug-js',
        label: 'Error de JavaScript',
        linearLabelId: 'f8dc7a89-03c3-42c1-b94a-a1fef4ceaf8f'
    },
    {
        id: 'bug-ui-ux',
        label: 'Error de UI/UX',
        linearLabelId: 'f49088fa-6f44-4f6c-a485-48d79161e838'
    },
    {
        id: 'bug-content',
        label: 'Error de texto/imagen',
        linearLabelId: 'b29af64b-a2ea-40cf-a73b-1403fee93d01'
    },
    {
        id: 'feature-request',
        label: 'Solicitud de funcionalidad',
        linearLabelId: 'b995fd11-5043-4625-8fbb-ba038246255e'
    },
    {
        id: 'improvement',
        label: 'Mejora',
        linearLabelId: '52a305bc-e1a5-4b15-ba70-180022770240'
    },
    {
        id: 'other',
        label: 'Otro',
        linearLabelId: 'f6ead8f8-a46a-4888-bc01-e640497e0625'
    }
] as const;

/**
 * Severity levels with Linear priority mapping.
 *
 * Linear priority values: 1 = Urgent, 2 = High, 3 = Medium, 4 = Low.
 * These map directly to Linear's native priority field on each issue.
 *
 * @example
 * ```ts
 * const critical = SEVERITY_LEVELS.find(s => s.id === 'critical');
 * // { id: 'critical', label: 'Critico', description: '...', linearPriority: 1 }
 * ```
 */
export const SEVERITY_LEVELS = [
    {
        id: 'critical',
        label: 'Critico',
        description: 'La app no funciona / datos perdidos',
        linearPriority: 1
    },
    {
        id: 'high',
        label: 'Alto',
        description: 'Funcionalidad principal rota',
        linearPriority: 2
    },
    {
        id: 'medium',
        label: 'Medio',
        description: 'Funciona pero con problemas',
        linearPriority: 3
    },
    {
        id: 'low',
        label: 'Bajo',
        description: 'Detalle menor / cosmetico',
        linearPriority: 4
    }
] as const;

/**
 * Allowed MIME types for file attachments.
 *
 * Only image formats are accepted. Files are uploaded directly to
 * Linear as issue attachments (no separate storage required).
 */
export const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/**
 * Linear API configuration.
 *
 * Replace all PLACEHOLDER_ values with actual Linear IDs once the
 * Linear team and project are configured. Source labels differentiate
 * issues by originating app (web, admin, standalone page).
 *
 * @example
 * ```ts
 * // After updating placeholders:
 * const teamId = LINEAR_CONFIG.teamId; // 'abc-123-...'
 * const webLabel = LINEAR_CONFIG.labels.source.web; // 'lbl_xyz...'
 * ```
 */
export const LINEAR_CONFIG = {
    teamId: '67d66e22-cd86-4cef-84bd-a6211eb78061',
    projectId: '4348abf8-5e6d-4a48-a3bc-4ca690982424',
    defaultStateId: 'ec585d2a-f8e5-45b9-a0af-4708fda51ea8',
    labels: {
        source: {
            web: '28850d5a-9888-433b-bf0d-2ea405df15a0',
            admin: 'e147bfa5-a519-4f29-9fbc-08b623cf3b79',
            standalone: 'cf0f7a39-0dfa-4d6e-98ae-918a114186d2'
        },
        environment: {
            beta: 'cda1a6d2-eb78-486e-aaf6-7a94b9a49a53'
        }
    }
} as const;

/**
 * Master feedback configuration.
 *
 * Centralizes all configurable values for the feedback system.
 * Edit this file to sync with Linear configuration. The `enabled`
 * flag acts as a kill switch for the entire system.
 *
 * @example
 * ```ts
 * // Check if feedback is enabled before rendering FAB
 * if (FEEDBACK_CONFIG.enabled) {
 *   renderFAB();
 * }
 *
 * // Get max file size for validation
 * const maxBytes = FEEDBACK_CONFIG.maxFileSize; // 10_485_760
 * ```
 */
export const FEEDBACK_CONFIG = {
    /** Linear field mapping (IDs to sync manually with Linear) */
    linear: LINEAR_CONFIG,

    /** Report types with Linear label mapping */
    reportTypes: REPORT_TYPES,

    /** Severity levels with Linear priority mapping */
    severityLevels: SEVERITY_LEVELS,

    /** Fallback email when Linear API fails after retries */
    fallbackEmail: 'feedback@hospeda.com',

    /** Rate limit: max reports per IP per hour */
    rateLimit: 30,

    /** Max retries to Linear API before falling back to email */
    linearMaxRetries: 3,

    /** Max file size for attachments in bytes (10MB) */
    maxFileSize: 10_485_760,

    /** Max number of attachments per report */
    maxAttachments: 5,

    /** Allowed MIME types for attachments */
    allowedFileTypes: ALLOWED_FILE_TYPES,

    /** Keyboard shortcut to open the form */
    keyboardShortcut: { key: 'f', ctrl: true, shift: true },

    /** Kill switch for the entire feedback system */
    enabled: true
} as const;

/**
 * Builds a human-readable keyboard shortcut label from the config.
 * E.g., "Ctrl+Shift+F" or "Cmd+Shift+F" depending on platform.
 *
 * @returns Shortcut label string derived from FEEDBACK_CONFIG.keyboardShortcut
 */
export function getShortcutLabel(): string {
    const { key, ctrl, shift } = FEEDBACK_CONFIG.keyboardShortcut;
    const parts: string[] = [];
    if (ctrl) parts.push('Ctrl');
    if (shift) parts.push('Shift');
    parts.push(key.toUpperCase());
    return parts.join('+');
}
