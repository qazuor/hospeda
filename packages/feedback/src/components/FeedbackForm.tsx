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
import { SuccessScreen } from './SuccessScreen.js';
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
/**
 * Checks if a Zod validation message indicates a "too big" constraint
 * (maximum length exceeded). Matches both Zod v3 ("at most") and v4
 * ("too_big" code or "maximum" keyword) error messages.
 */
function isTooBig(message: string): boolean {
    return /\b(most|too.?big|maximum|exceed|long)\b/i.test(message);
}

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
     * Uses a lightweight pick of the full schema to avoid validating
     * environment and step 2 fields unnecessarily.
     */
    const validateStep1 = useCallback((): boolean => {
        const step1Schema = feedbackFormSchema.pick({
            type: true,
            title: true,
            description: true,
            reporterEmail: true,
            reporterName: true
        });

        const result = step1Schema.safeParse(basicData);

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
    }, [basicData]);

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
    // Step 2
    // ------------------------------------------------------------------ //

    if (step === 'details') {
        return (
            <div className="w-full max-w-[520px] font-sans">
                <p className="mb-4 border-border border-b pb-3 font-bold text-base text-foreground">
                    {FEEDBACK_STRINGS.form.step2Title}
                </p>

                {submitState.error && (
                    <div
                        className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-destructive text-sm"
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
        <div className="w-full max-w-[520px] font-sans">
            <p className="mb-4 border-border border-b pb-3 font-bold text-base text-foreground">
                {FEEDBACK_STRINGS.form.title}
            </p>

            {submitState.error && (
                <div
                    className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-destructive text-sm"
                    role="alert"
                >
                    {submitState.error}
                </div>
            )}

            {/* Honeypot field: hidden from real users, filled by bots */}
            <div
                aria-hidden="true"
                className="-left-[9999px] absolute h-0 overflow-hidden opacity-0"
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
