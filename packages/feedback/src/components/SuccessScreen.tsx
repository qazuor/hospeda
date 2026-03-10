/**
 * @repo/feedback - SuccessScreen component.
 *
 * Shown after a feedback submission completes. Displays a confirmation
 * message with an optional Linear issue link, and buttons to submit
 * another report or close the form.
 */
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { Button } from '../ui/Button.js';

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
        <div className="w-full max-w-[520px] font-sans">
            <div className="px-4 py-6 text-center">
                <div className="mb-3 text-5xl text-green-600 leading-none">&#10003;</div>

                <p className="mb-2 font-bold text-foreground text-lg">
                    {FEEDBACK_STRINGS.success.title}
                </p>
                <p className="mb-1.5 text-foreground/80 text-sm">
                    {FEEDBACK_STRINGS.success.message}
                </p>

                {linearIssueId ? (
                    <p className="mb-1 text-muted-foreground text-xs">
                        {FEEDBACK_STRINGS.success.issueLabel}:{' '}
                        {linearIssueUrl ? (
                            <a
                                href={linearIssueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary no-underline hover:underline"
                            >
                                <span className="font-semibold">{linearIssueId}</span>
                            </a>
                        ) : (
                            <span className="font-semibold text-primary">{linearIssueId}</span>
                        )}
                    </p>
                ) : (
                    <p className="mb-1 text-muted-foreground text-xs">
                        {FEEDBACK_STRINGS.success.fallbackMessage}
                    </p>
                )}

                <p className="mt-3 mb-6 text-muted-foreground text-xs">
                    {FEEDBACK_STRINGS.success.thanks}
                </p>

                <div className="flex justify-center gap-3">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onReset}
                    >
                        {FEEDBACK_STRINGS.buttons.submitAnother}
                    </Button>
                    {onClose && (
                        <Button
                            type="button"
                            onClick={onClose}
                        >
                            {FEEDBACK_STRINGS.buttons.close}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
