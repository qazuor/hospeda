import type { AppSourceId, FeedbackEnvironment, ReportTypeId } from '@repo/schemas';
import { REPORT_TYPE_IDS, feedbackFormSchema } from '@repo/schemas';
/**
 * @repo/feedback - FeedbackForm component
 *
 * Renders a single-step feedback form with a collapsible "more details"
 * expander. The visible step always shows type, title, description, and
 * (when unauthenticated) reporter contact fields. The expander reveals
 * severity, reproduction steps, expected/actual result, attachments, and
 * the auto-collected technical environment section.
 */
import { useCallback, useEffect, useState } from 'react';
import { FEEDBACK_CONFIG } from '../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { useAutoCollect } from '../hooks/useAutoCollect.js';
import { useFeedbackSubmit } from '../hooks/useFeedbackSubmit.js';
import { Button } from '../ui/Button.js';
import './FeedbackForm.css';
import { SuccessScreen } from './SuccessScreen.js';
import { StepBasic } from './steps/StepBasic.js';
import type { StepBasicData } from './steps/StepBasic.js';
import { StepDetails } from './steps/StepDetails.js';
import type { StepDetailsData } from './steps/StepDetails.js';
import '../styles/tokens.css';

/** ID of the collapsible details panel, used for aria-controls linkage */
const DETAILS_PANEL_ID = 'feedback-details-panel';

/**
 * Payload passed to the optional Sentry feedback bridge callback after a
 * successful submission to the backend (Linear).
 */
export interface SentryFeedbackBridgePayload {
    /** Reporter display name */
    readonly name: string;
    /** Reporter email */
    readonly email: string;
    /** Free-form description */
    readonly message: string;
    /** Sentry event ID associated with this feedback, if any */
    readonly associatedEventId?: string;
}

/**
 * Props for the FeedbackForm component.
 *
 * @example
 * ```tsx
 * <FeedbackForm
 *   apiUrl="http://localhost:3001"
 *   appSource="web"
 *   deployVersion="abc1234"
 *   userId="usr_123"
 *   userEmail="user@example.com"
 *   userName="Jane Doe"
 *   onClose={() => setOpen(false)}
 * />
 * ```
 */
export interface FeedbackFormProps {
    /** API base URL for submitting feedback (e.g. 'http://localhost:3001') */
    readonly apiUrl: string;
    /** Application source identifier */
    readonly appSource: AppSourceId;
    /** Git commit hash or release tag for environment context */
    readonly deployVersion?: string;
    /** Authenticated user ID — populates environment.userId */
    readonly userId?: string;
    /** Authenticated user email — pre-fills the email field */
    readonly userEmail?: string;
    /** Authenticated user name — pre-fills the name field */
    readonly userName?: string;
    /** Pre-fill data from an error boundary or query params */
    readonly prefillData?: {
        /** Initial report type */
        readonly type?: ReportTypeId;
        /** Initial title text */
        readonly title?: string;
        /** Initial description text */
        readonly description?: string;
        /** Error info from an ErrorBoundary */
        readonly errorInfo?: { readonly message: string; readonly stack?: string };
    };
    /** Optional override for which localStorage prefixes are scanned for feature flags */
    readonly featureFlagPrefixes?: ReadonlyArray<string>;
    /** Most recent Sentry event ID (typically captured when modal opens) */
    readonly sentryEventId?: string;
    /**
     * Optional bridge callback invoked after a successful submission. Used to
     * forward the report to Sentry's `captureFeedback` so it appears in
     * Sentry's User Feedback panel.
     */
    readonly onSentryFeedback?: (payload: SentryFeedbackBridgePayload) => void;
    /** Called when the user clicks "Cerrar" on the success screen */
    readonly onClose?: () => void;
    /**
     * Whether the host modal is currently open. The form remains mounted
     * while the modal is hidden, so this flag drives the refresh of dynamic
     * ring-buffer data (console errors, navigation history, last
     * interactions) on every modal open.
     */
    readonly isOpen?: boolean;
}

/**
 * Builds the initial StepBasicData from props and prefill data.
 *
 * @param userEmail - Pre-filled email from auth context
 * @param userName - Pre-filled name from auth context
 * @param prefillData - Optional pre-fill values from error boundary or query params
 * @returns Initialized StepBasicData
 */
function buildInitialBasicData(
    userEmail?: string,
    userName?: string,
    prefillData?: FeedbackFormProps['prefillData']
): StepBasicData {
    return {
        type: prefillData?.type ?? REPORT_TYPE_IDS[0],
        title: prefillData?.title ?? '',
        description: prefillData?.description ?? '',
        reporterEmail: userEmail ?? '',
        reporterName: userName ?? ''
    };
}

/**
 * Checks if a Zod validation message indicates a "too big" constraint
 * (maximum length exceeded). Matches both Zod v3 ("at most") and v4
 * ("too_big" code or "maximum" keyword) error messages.
 */
function isTooBig(message: string): boolean {
    return /\b(most|too.?big|maximum|exceed|long)\b/i.test(message);
}

/**
 * Maps Zod issue paths to human-readable error messages using FEEDBACK_STRINGS.
 *
 * @param path - The Zod issue path array (first element is the field name)
 * @param message - The Zod default message
 * @returns A user-facing error string
 */
function mapZodMessage(path: PropertyKey[], message: string): string {
    const field = path[0];
    if (field === 'title') {
        if (isTooBig(message)) return FEEDBACK_STRINGS.validation.titleMax;
        return FEEDBACK_STRINGS.validation.titleMin;
    }
    if (field === 'description') {
        if (isTooBig(message)) return FEEDBACK_STRINGS.validation.descriptionMax;
        return FEEDBACK_STRINGS.validation.descriptionMin;
    }
    if (field === 'reporterEmail') {
        return FEEDBACK_STRINGS.validation.emailInvalid;
    }
    if (field === 'reporterName') {
        return FEEDBACK_STRINGS.validation.nameRequired;
    }
    return message;
}

/**
 * FeedbackForm component.
 *
 * Renders a single-step form with an inline collapsible expander for
 * optional detail fields:
 * - Always visible: type, title, description, reporter contact fields
 *   (email/name shown only when unauthenticated)
 * - Collapsible expander ("Agregar más detalles"): severity, steps to
 *   reproduce, expected/actual result, attachments, and the technical
 *   environment section
 * - One submit button at the bottom
 * - Success screen after a successful submission
 *
 * The honeypot `website` field is always present but hidden from real users.
 *
 * @param props - See {@link FeedbackFormProps}
 */
export function FeedbackForm({
    apiUrl,
    appSource,
    deployVersion,
    userId,
    userEmail,
    userName,
    prefillData,
    featureFlagPrefixes,
    sentryEventId,
    onSentryFeedback,
    onClose,
    isOpen
}: FeedbackFormProps) {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [basicData, setBasicData] = useState<StepBasicData>(() =>
        buildInitialBasicData(userEmail, userName, prefillData)
    );
    const [detailsData, setDetailsData] = useState<StepDetailsData>({});
    const [attachments, setAttachments] = useState<File[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [honeypot, setHoneypot] = useState<string>('');
    const [hasNotifiedSentry, setHasNotifiedSentry] = useState<boolean>(false);

    const { environment, updateField: updateEnvField } = useAutoCollect({
        appSource,
        deployVersion,
        userId,
        userEmail,
        userName,
        errorInfo: prefillData?.errorInfo,
        featureFlagPrefixes,
        sentryEventId,
        isOpen
    });

    const { state: submitState, submit, reset: resetSubmit } = useFeedbackSubmit({ apiUrl });

    // ------------------------------------------------------------------ //
    // Field change handlers
    // ------------------------------------------------------------------ //

    const handleBasicChange = useCallback(
        <K extends keyof StepBasicData>(field: K, value: StepBasicData[K]) => {
            setBasicData((prev) => ({ ...prev, [field]: value }));
            setErrors((prev) => {
                if (!prev[field]) return prev;
                const next = { ...prev };
                delete next[field];
                return next;
            });
        },
        []
    );

    const handleDetailsChange = useCallback(
        <K extends keyof StepDetailsData>(field: K, value: StepDetailsData[K]) => {
            setDetailsData((prev) => ({ ...prev, [field]: value }));
        },
        []
    );

    const handleAddAttachments = useCallback((files: File[]) => {
        setAttachments((prev) => {
            const remaining = FEEDBACK_CONFIG.maxAttachments - prev.length;
            return [...prev, ...files.slice(0, remaining)];
        });
    }, []);

    const handleRemoveAttachment = useCallback((index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // ------------------------------------------------------------------ //
    // Validation
    // ------------------------------------------------------------------ //

    const validate = useCallback((): boolean => {
        const combined = {
            ...basicData,
            ...detailsData,
            attachments: attachments.length > 0 ? attachments : undefined,
            environment
        };

        const result = feedbackFormSchema.safeParse(combined);

        if (result.success) {
            setErrors({});
            return true;
        }

        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
            const key = String(issue.path[0] ?? 'form');
            if (!fieldErrors[key]) {
                fieldErrors[key] = mapZodMessage(issue.path, issue.message);
            }
        }
        setErrors(fieldErrors);

        return false;
    }, [basicData, detailsData, attachments, environment]);

    // ------------------------------------------------------------------ //
    // Submit
    // ------------------------------------------------------------------ //

    const handleSubmit = useCallback(async () => {
        if (!validate()) return;

        const combined = {
            ...basicData,
            ...detailsData,
            attachments: attachments.length > 0 ? attachments : undefined,
            environment
        };

        const parsed = feedbackFormSchema.parse(combined);

        await submit(parsed, attachments.length > 0 ? attachments : undefined, honeypot);
    }, [basicData, detailsData, attachments, environment, validate, submit, honeypot]);

    // ------------------------------------------------------------------ //
    // Reset
    // ------------------------------------------------------------------ //

    const handleReset = useCallback(() => {
        setDetailsOpen(false);
        setBasicData(buildInitialBasicData(userEmail, userName));
        setDetailsData({});
        setAttachments([]);
        setErrors({});
        setHasNotifiedSentry(false);
        resetSubmit();
    }, [userEmail, userName, resetSubmit]);

    // ------------------------------------------------------------------ //
    // Mirror to Sentry when submit result arrives
    // ------------------------------------------------------------------ //

    useEffect(() => {
        // Mirror the report into Sentry's User Feedback channel (best-effort).
        // The package never imports a Sentry SDK directly — the consumer
        // (web/admin) provides the bridge callback. Wrapped in try/catch so
        // any SDK failure cannot break the success flow.
        if (submitState.result !== null && !hasNotifiedSentry && onSentryFeedback) {
            try {
                onSentryFeedback({
                    name: basicData.reporterName,
                    email: basicData.reporterEmail,
                    message: basicData.description,
                    associatedEventId: environment.sentryEventId
                });
            } catch {
                // Intentionally swallow — Sentry mirroring must never break Linear
            }
            setHasNotifiedSentry(true);
        }
    }, [
        submitState.result,
        hasNotifiedSentry,
        onSentryFeedback,
        basicData.reporterName,
        basicData.reporterEmail,
        basicData.description,
        environment.sentryEventId
    ]);

    // ------------------------------------------------------------------ //
    // Success screen
    // ------------------------------------------------------------------ //

    if (submitState.result !== null) {
        return (
            <SuccessScreen
                linearIssueId={submitState.result.linearIssueId ?? undefined}
                linearIssueUrl={submitState.result.linearIssueUrl ?? undefined}
                onReset={handleReset}
                onClose={onClose}
            />
        );
    }

    // ------------------------------------------------------------------ //
    // Single-step form with collapsible details expander
    // ------------------------------------------------------------------ //

    return (
        <div className="formRoot">
            <p className="formTitle">{FEEDBACK_STRINGS.form.title}</p>

            {submitState.error && (
                <div
                    className="errorAlert"
                    role="alert"
                >
                    {submitState.error}
                </div>
            )}

            {/* Honeypot field: hidden from real users, filled by bots */}
            <div
                aria-hidden="true"
                className="honeypot"
            >
                <label htmlFor="feedback-website">Website</label>
                <input
                    id="feedback-website"
                    type="text"
                    name="website"
                    autoComplete="off"
                    tabIndex={-1}
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                />
            </div>

            {/* Always-visible basic fields */}
            <StepBasic
                data={basicData}
                onChange={handleBasicChange}
                errors={errors as Partial<Record<keyof StepBasicData, string>>}
                showContactFields={!userId}
            />

            {/* Collapsible "agregar más detalles" expander toggle */}
            <button
                type="button"
                className="detailsToggle"
                aria-expanded={detailsOpen}
                aria-controls={DETAILS_PANEL_ID}
                onClick={() => setDetailsOpen((prev) => !prev)}
                disabled={submitState.isSubmitting}
            >
                <span>
                    {detailsOpen
                        ? FEEDBACK_STRINGS.buttons.hideDetails
                        : FEEDBACK_STRINGS.buttons.addDetails}
                </span>
                <span
                    className="detailsToggleChevron"
                    aria-hidden="true"
                >
                    {detailsOpen ? '▲' : '▼'}
                </span>
            </button>

            {/* Collapsible details panel — only rendered when open so fields are
                absent from the accessibility tree (and DOM) when collapsed */}
            {detailsOpen && (
                <div
                    id={DETAILS_PANEL_ID}
                    className="detailsPanel"
                >
                    <StepDetails
                        data={detailsData}
                        onChange={handleDetailsChange}
                        attachments={attachments}
                        onAddAttachments={handleAddAttachments}
                        onRemoveAttachment={handleRemoveAttachment}
                        environment={environment as FeedbackEnvironment}
                        onEnvironmentChange={updateEnvField}
                    />
                </div>
            )}

            {/* Single submit button */}
            <div className="actions">
                <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitState.isSubmitting}
                >
                    {FEEDBACK_STRINGS.buttons.submit}
                </Button>
            </div>
        </div>
    );
}
