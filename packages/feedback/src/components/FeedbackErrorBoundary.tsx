/**
 * @repo/feedback - FeedbackErrorBoundary component.
 *
 * A React error boundary that catches unhandled render errors and displays
 * a friendly fallback UI with a "Report this error" button. When the user
 * clicks the report button the component first attempts to render the
 * FeedbackModal inline; if that also fails it opens the standalone feedback
 * page in a new tab pre-filled with the error details.
 *
 * React error boundaries MUST be class components because they rely on the
 * lifecycle methods `static getDerivedStateFromError` and `componentDidCatch`.
 * Functional components cannot implement error boundaries.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { serializeFeedbackParams } from '../lib/query-params.js';
import type { AppSourceId, ReportTypeId } from '../schemas/feedback.schema.js';
import { FeedbackModal } from './FeedbackModal.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters kept from the error message when used as the form title */
const MAX_TITLE_LENGTH = 200;

/** Report type pre-selected for errors captured by the error boundary */
const ERROR_REPORT_TYPE: ReportTypeId = 'bug-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the FeedbackErrorBoundary component.
 */
export interface FeedbackErrorBoundaryProps {
    /** Child components to wrap and protect from unhandled errors. */
    children: ReactNode;
    /** Application source identifier (e.g. 'web', 'admin'). */
    appSource: AppSourceId;
    /** Base API URL passed through to the inline FeedbackModal form. */
    apiUrl: string;
    /** Git commit hash or release tag for the current deploy. */
    deployVersion?: string;
    /** Authenticated user's internal ID (pre-fills the form). */
    userId?: string;
    /** Authenticated user's email address (pre-fills the form). */
    userEmail?: string;
    /** Authenticated user's display name (pre-fills the form). */
    userName?: string;
    /**
     * URL of the standalone feedback page.
     *
     * When the inline FeedbackModal cannot be rendered the boundary opens
     * this URL in a new tab with error details appended as query params.
     * If omitted the new-tab fallback is silently skipped.
     */
    feedbackPageUrl?: string;
    /**
     * Optional render-prop for a fully custom fallback UI.
     *
     * When provided this completely replaces the default error card.
     * Receives the caught error, a reset callback, and a report callback.
     */
    fallbackComponent?: (props: {
        error: Error;
        resetError: () => void;
        reportError: () => void;
    }) => ReactNode;
}

/**
 * Internal state for the error boundary.
 */
interface ErrorBoundaryState {
    /** Whether an error has been caught. */
    hasError: boolean;
    /** The caught error instance. */
    error: Error | null;
    /** React's component-tree diagnostic info. */
    errorInfo: ErrorInfo | null;
    /** Whether to show the inline FeedbackModal overlay. */
    showInlineForm: boolean;
}

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------

const styles = {
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        padding: '24px'
    },
    card: {
        backgroundColor: '#ffffff',
        border: '1px solid #fca5a5',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        maxWidth: '560px',
        width: '100%',
        padding: '32px'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px'
    },
    icon: {
        fontSize: '22px',
        lineHeight: 1,
        flexShrink: 0
    },
    title: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 700,
        color: '#b91c1c'
    },
    message: {
        margin: '0 0 24px',
        fontSize: '14px',
        color: '#4b5563',
        lineHeight: 1.6
    },
    actions: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap' as const
    },
    reportButton: {
        padding: '10px 20px',
        backgroundColor: '#b91c1c',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        lineHeight: 1.2
    },
    reloadButton: {
        padding: '10px 20px',
        backgroundColor: '#f3f4f6',
        color: '#374151',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        lineHeight: 1.2
    }
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncates a string to the given maximum length, appending an ellipsis if
 * the original string exceeds the limit.
 *
 * @param text - Input string to truncate
 * @param maxLength - Maximum number of characters to keep
 * @returns Truncated string
 */
function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Opens the standalone feedback page in a new browser tab with the error
 * details serialized as query parameters.
 *
 * @param feedbackPageUrl - Base URL of the standalone feedback page
 * @param error - The caught error
 * @param appSource - App source identifier
 */
function openFeedbackTab(feedbackPageUrl: string, error: Error, appSource: AppSourceId): void {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : undefined;

    const qs = serializeFeedbackParams({
        type: ERROR_REPORT_TYPE,
        error: truncate(error.message, MAX_TITLE_LENGTH),
        stack: error.stack,
        source: appSource,
        url: currentUrl
    });

    const separator = feedbackPageUrl.includes('?') ? '&' : '?';
    window.open(`${feedbackPageUrl}${separator}${qs}`, '_blank', 'noopener,noreferrer');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FeedbackErrorBoundary — React error boundary with integrated report UI.
 *
 * Wraps any subtree and catches uncaught render/lifecycle errors. When an
 * error is caught the boundary renders a friendly fallback card with two
 * action buttons: "Reportar este error" (opens the inline FeedbackModal or a
 * new-tab fallback) and "Recargar" (calls `window.location.reload()`).
 *
 * The inline FeedbackModal is pre-filled with:
 * - `type`: 'bug-js'
 * - `title`: The error message (truncated to 200 chars)
 * - `errorInfo.message` and `errorInfo.stack` from the caught error
 *
 * If the modal itself throws during render the boundary falls back to opening
 * a new browser tab instead of crashing again.
 *
 * @example
 * ```tsx
 * <FeedbackErrorBoundary
 *   appSource="web"
 *   apiUrl="http://localhost:3001"
 *   feedbackPageUrl="https://example.com/feedback"
 *   userId={session?.userId}
 * >
 *   <App />
 * </FeedbackErrorBoundary>
 * ```
 */
export class FeedbackErrorBoundary extends Component<
    FeedbackErrorBoundaryProps,
    ErrorBoundaryState
> {
    constructor(props: FeedbackErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showInlineForm: false
        };
    }

    // -----------------------------------------------------------------------
    // Static lifecycle: populate error state from thrown error
    // -----------------------------------------------------------------------

    /**
     * Updates the component state when a descendant throws during rendering.
     *
     * React calls this method during the "render" phase so it must be pure
     * and side-effect free. Actual logging should happen in `componentDidCatch`.
     *
     * @param error - The error that was thrown
     * @returns Partial state to merge (hasError + error)
     */
    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    // -----------------------------------------------------------------------
    // Instance lifecycle: capture diagnostic info and log
    // -----------------------------------------------------------------------

    /**
     * Called after a descendant throws. Stores the React component tree info
     * alongside the error for potential inclusion in the bug report.
     *
     * @param error - The error that was thrown
     * @param info - React diagnostic info including `componentStack`
     */
    componentDidCatch(_error: Error, info: ErrorInfo): void {
        this.setState({ errorInfo: info });
    }

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    /**
     * Resets the error state so the boundary re-renders its children.
     * Binds to "try again" or post-report actions.
     */
    readonly resetError = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            showInlineForm: false
        });
    };

    /**
     * Handles the "Reportar este error" button click.
     *
     * First attempts to show the FeedbackModal inline by setting
     * `showInlineForm: true`. The modal rendering is wrapped in an error
     * handler inside `renderInlineModal`; if it fails the boundary falls
     * back to opening a new tab (when `feedbackPageUrl` is configured).
     */
    readonly handleReportClick = (): void => {
        this.setState({ showInlineForm: true });
    };

    /**
     * Handles the "Recargar" button click by reloading the current page.
     */
    readonly handleReloadClick = (): void => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    /**
     * Closes the inline form without resetting the error state.
     */
    readonly handleModalClose = (): void => {
        this.setState({ showInlineForm: false });
    };

    // -----------------------------------------------------------------------
    // Render helpers
    // -----------------------------------------------------------------------

    /**
     * Attempts to render the inline FeedbackModal.
     *
     * If any exception is thrown while constructing the modal props or the
     * component itself fails the method falls back to opening the standalone
     * feedback page in a new tab.
     *
     * @returns The FeedbackModal element, or null if a fallback was triggered
     */
    private renderInlineModal(): ReactNode {
        const { apiUrl, appSource, deployVersion, userId, userEmail, userName, feedbackPageUrl } =
            this.props;
        const { error } = this.state;

        if (!error) return null;

        try {
            const prefillTitle = truncate(error.message, MAX_TITLE_LENGTH);

            return (
                <FeedbackModal
                    isOpen={true}
                    onClose={this.handleModalClose}
                    formProps={{
                        apiUrl,
                        appSource,
                        deployVersion,
                        userId,
                        userEmail,
                        userName,
                        prefillData: {
                            type: ERROR_REPORT_TYPE,
                            title: prefillTitle,
                            errorInfo: {
                                message: error.message,
                                stack: error.stack
                            }
                        }
                    }}
                />
            );
        } catch {
            // FeedbackModal failed to render — open new-tab fallback
            if (feedbackPageUrl) {
                openFeedbackTab(feedbackPageUrl, error, appSource);
            }
            this.setState({ showInlineForm: false });
            return null;
        }
    }

    /**
     * Renders the default error fallback card.
     *
     * Shows the error title and message from FEEDBACK_STRINGS, a "Report"
     * button, and a "Reload" button.
     */
    private renderDefaultFallback(): ReactNode {
        return (
            <div style={styles.container}>
                <div
                    style={styles.card}
                    role="alert"
                    aria-live="assertive"
                >
                    <div style={styles.header}>
                        <span
                            style={styles.icon}
                            aria-hidden="true"
                        >
                            ⚠️
                        </span>
                        <h2 style={styles.title}>{FEEDBACK_STRINGS.errorBoundary.title}</h2>
                    </div>

                    <p style={styles.message}>{FEEDBACK_STRINGS.errorBoundary.message}</p>

                    <div style={styles.actions}>
                        <button
                            type="button"
                            style={styles.reportButton}
                            onClick={this.handleReportClick}
                            data-testid="error-boundary-report-button"
                        >
                            {FEEDBACK_STRINGS.buttons.reportError}
                        </button>

                        <button
                            type="button"
                            style={styles.reloadButton}
                            onClick={this.handleReloadClick}
                            data-testid="error-boundary-reload-button"
                        >
                            {FEEDBACK_STRINGS.buttons.reloadPage}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    render(): ReactNode {
        const { hasError, error, showInlineForm } = this.state;
        const { children, fallbackComponent } = this.props;

        if (!hasError || !error) {
            return children;
        }

        // Render custom fallback if provided
        if (fallbackComponent) {
            return fallbackComponent({
                error,
                resetError: this.resetError,
                reportError: this.handleReportClick
            });
        }

        return (
            <>
                {this.renderDefaultFallback()}
                {showInlineForm && this.renderInlineModal()}
            </>
        );
    }
}
