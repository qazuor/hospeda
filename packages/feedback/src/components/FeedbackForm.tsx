/**
 * @repo/feedback - FeedbackForm component
 *
 * Orchestrates the multi-step feedback form. Manages step navigation,
 * form state for both steps, attachment list, client-side validation,
 * and success/error states after submission.
 */
import { useCallback, useEffect, useState } from 'react';
import { FEEDBACK_CONFIG } from '../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { useAutoCollect } from '../hooks/useAutoCollect.js';
import { useFeedbackSubmit } from '../hooks/useFeedbackSubmit.js';
import type { AppSourceId, FeedbackEnvironment, ReportTypeId } from '../schemas/feedback.schema.js';
import { REPORT_TYPE_IDS, feedbackFormSchema } from '../schemas/feedback.schema.js';
import { buttonPrimaryStyle, buttonSecondaryStyle } from '../styles/shared.js';
import { StepBasic } from './steps/StepBasic.js';
import type { StepBasicData } from './steps/StepBasic.js';
import { StepDetails } from './steps/StepDetails.js';
import type { StepDetailsData } from './steps/StepDetails.js';

/** Which step of the form is currently visible */
type Step = 'basic' | 'details' | 'success';

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
    apiUrl: string;
    /** Application source identifier */
    appSource: AppSourceId;
    /** Git commit hash or release tag for environment context */
    deployVersion?: string;
    /** Authenticated user ID — populates environment.userId */
    userId?: string;
    /** Authenticated user email — pre-fills the email field */
    userEmail?: string;
    /** Authenticated user name — pre-fills the name field */
    userName?: string;
    /** Pre-fill data from an error boundary or query params */
    prefillData?: {
        /** Initial report type */
        type?: ReportTypeId;
        /** Initial title text */
        title?: string;
        /** Initial description text */
        description?: string;
        /** Error info from an ErrorBoundary */
        errorInfo?: { message: string; stack?: string };
    };
    /** Called when the user clicks "Cerrar" on the success screen */
    onClose?: () => void;
}

const styles = {
    container: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '520px',
        width: '100%'
    },
    stepTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid #e5e7eb'
    },
    errorBanner: {
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '6px',
        padding: '10px 14px',
        marginBottom: '16px',
        fontSize: '14px',
        color: '#b91c1c'
    },
    successContainer: {
        textAlign: 'center' as const,
        padding: '24px 16px'
    },
    successIcon: {
        fontSize: '48px',
        color: '#16a34a',
        marginBottom: '12px',
        lineHeight: 1
    },
    successTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '8px'
    },
    successMessage: {
        fontSize: '14px',
        color: '#374151',
        marginBottom: '6px'
    },
    successIssue: {
        fontSize: '13px',
        color: '#6b7280',
        marginBottom: '4px'
    },
    successIssueId: {
        fontWeight: '600',
        color: '#2563eb'
    },
    successIssueLink: {
        color: '#2563eb',
        textDecoration: 'none',
        fontSize: '12px'
    },
    successThanks: {
        fontSize: '13px',
        color: '#6b7280',
        marginTop: '12px',
        marginBottom: '24px'
    },
    successButtonRow: {
        display: 'flex',
        justifyContent: 'center',
        gap: '12px'
    },
    buttonPrimary: buttonPrimaryStyle,
    buttonSecondary: buttonSecondaryStyle
} as const;

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
 * Maps Zod issue paths to human-readable error messages using FEEDBACK_STRINGS.
 *
 * @param path - The Zod issue path array (first element is the field name)
 * @param message - The Zod default message
 * @returns A user-facing error string
 */
function mapZodMessage(path: (string | number)[], message: string): string {
    const field = path[0];
    if (field === 'title') {
        if (message.includes('least')) return FEEDBACK_STRINGS.validation.titleMin;
        if (message.includes('most')) return FEEDBACK_STRINGS.validation.titleMax;
        return FEEDBACK_STRINGS.validation.titleMin;
    }
    if (field === 'description') {
        if (message.includes('least')) return FEEDBACK_STRINGS.validation.descriptionMin;
        if (message.includes('most')) return FEEDBACK_STRINGS.validation.descriptionMax;
        return FEEDBACK_STRINGS.validation.descriptionMin;
    }
    if (field === 'reporterEmail') {
        if (message.includes('Invalid email') || message.includes('invalid')) {
            return FEEDBACK_STRINGS.validation.emailInvalid;
        }
        return FEEDBACK_STRINGS.validation.emailRequired;
    }
    if (field === 'reporterName') {
        return FEEDBACK_STRINGS.validation.nameRequired;
    }
    return message;
}

/**
 * FeedbackForm component.
 *
 * Orchestrates the two-step feedback flow:
 * - Step 1 (basic): type, title, description, optional contact fields
 * - Step 2 (details): severity, reproduction steps, attachments, environment
 * - Success: confirmation with Linear issue ID or fallback message
 *
 * The component calls `feedbackFormSchema.safeParse()` on combined data before
 * submission and maps Zod errors to field-level messages shown on the relevant
 * step. On success it transitions to a success screen with "Enviar otro" and
 * "Cerrar" actions.
 *
 * @param props - See {@link FeedbackFormProps}
 *
 * @example
 * ```tsx
 * <FeedbackForm
 *   apiUrl={import.meta.env.PUBLIC_API_URL}
 *   appSource="web"
 *   userId={session?.userId}
 *   userEmail={session?.email}
 *   userName={session?.name}
 *   onClose={() => setOpen(false)}
 * />
 * ```
 */
export function FeedbackForm({
    apiUrl,
    appSource,
    deployVersion,
    userId,
    userEmail,
    userName,
    prefillData,
    onClose
}: FeedbackFormProps) {
    const [step, setStep] = useState<Step>('basic');
    const [basicData, setBasicData] = useState<StepBasicData>(() =>
        buildInitialBasicData(userEmail, userName, prefillData)
    );
    const [detailsData, setDetailsData] = useState<StepDetailsData>({});
    const [attachments, setAttachments] = useState<File[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [honeypot, setHoneypot] = useState<string>('');

    const { environment, updateField: updateEnvField } = useAutoCollect({
        appSource,
        deployVersion,
        userId,
        userEmail,
        userName,
        errorInfo: prefillData?.errorInfo
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

    /**
     * Validates only step 1 fields (type, title, description, email, name).
     * Only parses the combined data to check step 1 fields, ignoring
     * environment/details errors that belong to step 2.
     */
    const validateStep1 = useCallback((): boolean => {
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

        const step1Fields = new Set([
            'type',
            'title',
            'description',
            'reporterEmail',
            'reporterName'
        ]);

        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
            const key = String(issue.path[0] ?? 'form');
            if (step1Fields.has(key) && !fieldErrors[key]) {
                fieldErrors[key] = mapZodMessage(issue.path, issue.message);
            }
        }

        if (Object.keys(fieldErrors).length === 0) {
            setErrors({});
            return true;
        }

        setErrors(fieldErrors);
        return false;
    }, [basicData, detailsData, attachments, environment]);

    /**
     * Validates the combined form data using feedbackFormSchema.
     * Returns true if valid, false if errors were set.
     */
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

        // Navigate to the step that has errors.
        // Step 1 fields: type, title, description, reporterEmail, reporterName
        const step1Fields = new Set([
            'type',
            'title',
            'description',
            'reporterEmail',
            'reporterName'
        ]);
        const hasStep1Error = Object.keys(fieldErrors).some((k) => step1Fields.has(k));
        if (hasStep1Error && step !== 'basic') {
            setStep('basic');
        }

        return false;
    }, [basicData, detailsData, attachments, environment, step]);

    // ------------------------------------------------------------------ //
    // Submit
    // ------------------------------------------------------------------ //

    const handleSubmit = useCallback(async () => {
        // validate() already runs safeParse and sets errors, so we only
        // need to build the combined data once for submission.
        if (!validate()) return;

        const combined = {
            ...basicData,
            ...detailsData,
            attachments: attachments.length > 0 ? attachments : undefined,
            environment
        };

        // validate() confirmed the data is valid, so use parse() directly
        const parsed = feedbackFormSchema.parse(combined);

        await submit(parsed, attachments.length > 0 ? attachments : undefined, honeypot);
    }, [basicData, detailsData, attachments, environment, validate, submit, honeypot]);

    // ------------------------------------------------------------------ //
    // Reset
    // ------------------------------------------------------------------ //

    const handleReset = useCallback(() => {
        setStep('basic');
        setBasicData(buildInitialBasicData(userEmail, userName));
        setDetailsData({});
        setAttachments([]);
        setErrors({});
        resetSubmit();
    }, [userEmail, userName, resetSubmit]);

    // ------------------------------------------------------------------ //
    // Transition to success step when submit result arrives
    // ------------------------------------------------------------------ //

    useEffect(() => {
        if (submitState.result !== null && step !== 'success') {
            setStep('success');
        }
    }, [submitState.result, step]);

    // ------------------------------------------------------------------ //
    // Success screen
    // ------------------------------------------------------------------ //

    if (step === 'success' && submitState.result) {
        const { linearIssueId, linearIssueUrl } = submitState.result;

        return (
            <div style={styles.container}>
                <div style={styles.successContainer}>
                    <div style={styles.successIcon}>&#10003;</div>

                    <p style={styles.successTitle}>{FEEDBACK_STRINGS.success.title}</p>
                    <p style={styles.successMessage}>{FEEDBACK_STRINGS.success.message}</p>

                    {linearIssueId ? (
                        <p style={styles.successIssue}>
                            {FEEDBACK_STRINGS.success.issueLabel}:{' '}
                            {linearIssueUrl ? (
                                <a
                                    href={linearIssueUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={styles.successIssueLink}
                                >
                                    <span style={styles.successIssueId}>{linearIssueId}</span>
                                </a>
                            ) : (
                                <span style={styles.successIssueId}>{linearIssueId}</span>
                            )}
                        </p>
                    ) : (
                        <p style={styles.successIssue}>
                            {FEEDBACK_STRINGS.success.fallbackMessage}
                        </p>
                    )}

                    <p style={styles.successThanks}>{FEEDBACK_STRINGS.success.thanks}</p>

                    <div style={styles.successButtonRow}>
                        <button
                            type="button"
                            style={styles.buttonSecondary}
                            onClick={handleReset}
                        >
                            {FEEDBACK_STRINGS.buttons.submitAnother}
                        </button>
                        {onClose && (
                            <button
                                type="button"
                                style={styles.buttonPrimary}
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

    // ------------------------------------------------------------------ //
    // Step 2
    // ------------------------------------------------------------------ //

    if (step === 'details') {
        return (
            <div style={styles.container}>
                <p style={styles.stepTitle}>{FEEDBACK_STRINGS.form.step2Title}</p>

                {submitState.error && (
                    <div
                        style={styles.errorBanner}
                        role="alert"
                    >
                        {submitState.error}
                    </div>
                )}

                <StepDetails
                    data={detailsData}
                    onChange={handleDetailsChange}
                    attachments={attachments}
                    onAddAttachments={handleAddAttachments}
                    onRemoveAttachment={handleRemoveAttachment}
                    environment={environment as FeedbackEnvironment}
                    onEnvironmentChange={updateEnvField}
                    onBack={() => setStep('basic')}
                    onSubmit={handleSubmit}
                    isSubmitting={submitState.isSubmitting}
                />
            </div>
        );
    }

    // ------------------------------------------------------------------ //
    // Step 1 (default)
    // ------------------------------------------------------------------ //

    return (
        <div style={styles.container}>
            <p style={styles.stepTitle}>{FEEDBACK_STRINGS.form.title}</p>

            {submitState.error && (
                <div
                    style={styles.errorBanner}
                    role="alert"
                >
                    {submitState.error}
                </div>
            )}

            {/* Honeypot field: hidden from real users, filled by bots */}
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    left: '-9999px',
                    opacity: 0,
                    height: 0,
                    overflow: 'hidden'
                }}
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

            <StepBasic
                data={basicData}
                onChange={handleBasicChange}
                errors={errors as Partial<Record<keyof StepBasicData, string>>}
                showContactFields={!userId}
                onGoToStep2={() => {
                    if (validateStep1()) setStep('details');
                }}
                onSubmit={handleSubmit}
                isSubmitting={submitState.isSubmitting}
            />
        </div>
    );
}
