/**
 * @repo/feedback - SuccessScreen component.
 *
 * Shown after a feedback submission completes. Displays a confirmation
 * message with an optional Linear issue link, and buttons to submit
 * another report or close the form.
 */
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { buttonPrimaryStyle, buttonSecondaryStyle } from '../styles/shared.js';

/** Props for the SuccessScreen component */
export interface SuccessScreenProps {
    /** Linear issue identifier (e.g. "HOS-123"), undefined if fallback path used */
    readonly linearIssueId?: string;
    /** URL to the Linear issue, undefined if not available */
    readonly linearIssueUrl?: string;
    /** Called when user clicks "Enviar otro reporte" */
    readonly onReset: () => void;
    /** Called when user clicks "Cerrar" (only shown when provided) */
    readonly onClose?: () => void;
}

const styles = {
    container: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '520px',
        width: '100%'
    },
    successContainer: {
        textAlign: 'center' as const,
        padding: '24px 16px'
    },
    icon: {
        fontSize: '48px',
        color: '#16a34a',
        marginBottom: '12px',
        lineHeight: 1
    },
    title: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '8px'
    },
    message: {
        fontSize: '14px',
        color: '#374151',
        marginBottom: '6px'
    },
    issue: {
        fontSize: '13px',
        color: '#6b7280',
        marginBottom: '4px'
    },
    issueId: {
        fontWeight: '600',
        color: '#2563eb'
    },
    issueLink: {
        color: '#2563eb',
        textDecoration: 'none',
        fontSize: '12px'
    },
    thanks: {
        fontSize: '13px',
        color: '#6b7280',
        marginTop: '12px',
        marginBottom: '24px'
    },
    buttonRow: {
        display: 'flex',
        justifyContent: 'center',
        gap: '12px'
    }
} as const;

/**
 * Renders the post-submission success screen.
 *
 * Shows a checkmark, thank-you copy, an optional Linear issue link,
 * and action buttons. Used by FeedbackForm after a successful submit.
 *
 * @param props - See {@link SuccessScreenProps}
 */
export function SuccessScreen({
    linearIssueId,
    linearIssueUrl,
    onReset,
    onClose
}: SuccessScreenProps) {
    return (
        <div style={styles.container}>
            <div style={styles.successContainer}>
                <div style={styles.icon}>&#10003;</div>

                <p style={styles.title}>{FEEDBACK_STRINGS.success.title}</p>
                <p style={styles.message}>{FEEDBACK_STRINGS.success.message}</p>

                {linearIssueId ? (
                    <p style={styles.issue}>
                        {FEEDBACK_STRINGS.success.issueLabel}:{' '}
                        {linearIssueUrl ? (
                            <a
                                href={linearIssueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={styles.issueLink}
                            >
                                <span style={styles.issueId}>{linearIssueId}</span>
                            </a>
                        ) : (
                            <span style={styles.issueId}>{linearIssueId}</span>
                        )}
                    </p>
                ) : (
                    <p style={styles.issue}>{FEEDBACK_STRINGS.success.fallbackMessage}</p>
                )}

                <p style={styles.thanks}>{FEEDBACK_STRINGS.success.thanks}</p>

                <div style={styles.buttonRow}>
                    <button
                        type="button"
                        style={buttonSecondaryStyle}
                        onClick={onReset}
                    >
                        {FEEDBACK_STRINGS.buttons.submitAnother}
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            style={buttonPrimaryStyle}
                            onClick={onClose}
                        >
                            {FEEDBACK_STRINGS.buttons.close}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
