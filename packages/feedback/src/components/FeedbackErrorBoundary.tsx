import type { AppSourceId, ReportTypeId } from '@repo/schemas';
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
import { Button } from '../ui/Button.js';
import './FeedbackErrorBoundary.css';
import { FeedbackModal } from './FeedbackModal.js';
import '../styles/tokens.css';

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
    readonly children: ReactNode;
    /** Application source identifier (e.g. 'web', 'admin'). */
    readonly appSource: AppSourceId;
    /** Base API URL passed through to the inline FeedbackModal form. */
    readonly apiUrl: string;
    /** Git commit hash or release tag for the current deploy. */
    readonly deployVersion?: string;
    /** Authenticated user's internal ID (pre-fills the form). */
    readonly userId?: string;
    /** Authenticated user's email address (pre-fills the form). */
    readonly userEmail?: string;
    /** Authenticated user's display name (pre-fills the form). */
    readonly userName?: string;
    /**
     * URL of the standalone feedback page.
     *
     * When the inline FeedbackModal cannot be rendered the boundary opens
     * this URL in a new tab with error details appended as query params.
     * If omitted the new-tab fallback is silently skipped.
     */
    readonly feedbackPageUrl?: string;
    /**
     * Optional render-prop for a fully custom fallback UI.
     *
     * When provided this completely replaces the default error card.
     * Receives the caught error, a reset callback, and a report callback.
     */
    readonly fallbackComponent?: (props: {
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
     * Called after a descendant throws. Stores the React component tree info.
     *
     * @param _error - The error that was thrown
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
            // FeedbackModal failed to render — open new-tab fallback.
            if (feedbackPageUrl) {
                openFeedbackTab(feedbackPageUrl, error, appSource);
            }
            Promise.resolve().then(() => {
                this.setState({ showInlineForm: false });
            });
            return null;
        }
    }

    /**
     * Renders the default error fallback card.
     */
    private renderDefaultFallback(): ReactNode {
        return (
            <div className="feedback-root errorContainer">
                <div
                    className="errorCard"
                    role="alert"
                    aria-live="assertive"
                >
                    <div className="errorHeader">
                        <span
                            className="errorIcon"
                            aria-hidden="true"
                        >
                            ⚠️
                        </span>
                        <h2 className="errorTitle">{FEEDBACK_STRINGS.errorBoundary.title}</h2>
                    </div>

                    <p className="errorMessage">{FEEDBACK_STRINGS.errorBoundary.message}</p>

                    <div className="errorActions">
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={this.handleReportClick}
                            data-testid="error-boundary-report-button"
                        >
                            {FEEDBACK_STRINGS.buttons.reportError}
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={this.handleReloadClick}
                            data-testid="error-boundary-reload-button"
                        >
                            {FEEDBACK_STRINGS.buttons.reloadPage}
                        </Button>
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
