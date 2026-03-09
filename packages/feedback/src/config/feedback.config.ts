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
    { id: 'bug-js', label: 'Error de JavaScript', linearLabelId: 'PLACEHOLDER_LABEL_BUG_JS' },
    { id: 'bug-ui-ux', label: 'Error de UI/UX', linearLabelId: 'PLACEHOLDER_LABEL_BUG_UI_UX' },
    {
        id: 'bug-content',
        label: 'Error de texto/imagen',
        linearLabelId: 'PLACEHOLDER_LABEL_BUG_CONTENT'
    },
    {
        id: 'feature-request',
        label: 'Solicitud de funcionalidad',
        linearLabelId: 'PLACEHOLDER_LABEL_FEATURE_REQUEST'
    },
    { id: 'improvement', label: 'Mejora', linearLabelId: 'PLACEHOLDER_LABEL_IMPROVEMENT' },
    { id: 'other', label: 'Otro', linearLabelId: 'PLACEHOLDER_LABEL_OTHER' }
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
    teamId: 'PLACEHOLDER_TEAM_ID',
    projectId: 'PLACEHOLDER_PROJECT_ID',
    defaultStateId: 'PLACEHOLDER_STATE_TRIAGE',
    labels: {
        source: {
            web: 'PLACEHOLDER_LABEL_SOURCE_WEB',
            admin: 'PLACEHOLDER_LABEL_SOURCE_ADMIN',
            standalone: 'PLACEHOLDER_LABEL_SOURCE_STANDALONE'
        },
        environment: {
            beta: 'PLACEHOLDER_LABEL_ENV_BETA'
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
