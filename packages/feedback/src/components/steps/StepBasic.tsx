/**
 * @repo/feedback - StepBasic component
 *
 * Step 1 of the feedback form. Collects the report type, title, description,
 * and optionally the reporter's email and name when the user is not authenticated.
 */
import { REPORT_TYPES } from '../../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../../config/strings.js';
import type { ReportTypeId } from '../../schemas/feedback.schema.js';

/** Data managed by step 1 of the feedback form */
export interface StepBasicData {
    /** Report category ID matching a REPORT_TYPES entry */
    type: ReportTypeId;
    /** Brief summary of the issue */
    title: string;
    /** Detailed description of what happened */
    description: string;
    /** Reporter's email address */
    reporterEmail: string;
    /** Reporter's display name */
    reporterName: string;
}

/** Props for the StepBasic component */
export interface StepBasicProps {
    /** Current form values */
    data: StepBasicData;
    /**
     * Callback to update a single field value.
     * Uses a generic key constraint to keep type safety.
     */
    onChange: <K extends keyof StepBasicData>(field: K, value: StepBasicData[K]) => void;
    /** Validation errors keyed by field name */
    errors: Partial<Record<keyof StepBasicData, string>>;
    /** When true, renders email and name inputs (user not authenticated) */
    showContactFields: boolean;
    /** Called when user clicks "Agregar mas detalles" */
    onGoToStep2: () => void;
    /** Called when user clicks "Enviar" */
    onSubmit: () => void;
    /** Whether form is currently submitting */
    isSubmitting: boolean;
}

const styles = {
    label: {
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '4px'
    },
    input: {
        width: '100%',
        padding: '8px 12px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box' as const
    },
    inputError: {
        borderColor: '#ef4444'
    },
    errorText: {
        fontSize: '12px',
        color: '#ef4444',
        marginTop: '2px'
    },
    textarea: {
        width: '100%',
        padding: '8px 12px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        minHeight: '100px',
        resize: 'vertical' as const,
        boxSizing: 'border-box' as const
    },
    select: {
        width: '100%',
        padding: '8px 12px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        backgroundColor: '#fff',
        boxSizing: 'border-box' as const
    },
    fieldGroup: {
        marginBottom: '16px'
    },
    buttonRow: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        marginTop: '20px'
    },
    buttonPrimary: {
        padding: '8px 20px',
        backgroundColor: '#2563eb',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer'
    },
    buttonPrimaryDisabled: {
        padding: '8px 20px',
        backgroundColor: '#93c5fd',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'not-allowed'
    },
    buttonSecondary: {
        padding: '8px 20px',
        backgroundColor: 'transparent',
        color: '#2563eb',
        border: '1px solid #2563eb',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer'
    },
    buttonSecondaryDisabled: {
        padding: '8px 20px',
        backgroundColor: 'transparent',
        color: '#93c5fd',
        border: '1px solid #93c5fd',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'not-allowed'
    }
} as const;

/**
 * Step 1 of the feedback form.
 *
 * Renders inputs for report type, title, description, and optionally
 * the reporter's contact fields (email and name) when the user is
 * not authenticated. Provides two actions: proceed to step 2 or
 * submit directly.
 *
 * @example
 * ```tsx
 * <StepBasic
 *   data={formData}
 *   onChange={(field, value) => setField(field, value)}
 *   errors={validationErrors}
 *   showContactFields={!isAuthenticated}
 *   onGoToStep2={handleNextStep}
 *   onSubmit={handleSubmit}
 *   isSubmitting={false}
 * />
 * ```
 */
export function StepBasic({
    data,
    onChange,
    errors,
    showContactFields,
    onGoToStep2,
    onSubmit,
    isSubmitting
}: StepBasicProps) {
    const getInputStyle = (field: keyof StepBasicData) => ({
        ...styles.input,
        ...(errors[field] ? styles.inputError : {})
    });

    return (
        <div>
            {/* Report type */}
            <div style={styles.fieldGroup}>
                <label
                    htmlFor="feedback-type"
                    style={styles.label}
                >
                    {FEEDBACK_STRINGS.fields.type}
                </label>
                <select
                    id="feedback-type"
                    style={{
                        ...styles.select,
                        ...(errors.type ? styles.inputError : {})
                    }}
                    value={data.type}
                    onChange={(e) => onChange('type', e.target.value as ReportTypeId)}
                    aria-invalid={!!errors.type}
                    aria-describedby={errors.type ? 'feedback-type-error' : undefined}
                >
                    {REPORT_TYPES.map((reportType) => (
                        <option
                            key={reportType.id}
                            value={reportType.id}
                        >
                            {reportType.label}
                        </option>
                    ))}
                </select>
                {errors.type && (
                    <p
                        id="feedback-type-error"
                        style={styles.errorText}
                        role="alert"
                    >
                        {errors.type}
                    </p>
                )}
            </div>

            {/* Title */}
            <div style={styles.fieldGroup}>
                <label
                    htmlFor="feedback-title"
                    style={styles.label}
                >
                    {FEEDBACK_STRINGS.fields.title}
                </label>
                <input
                    id="feedback-title"
                    type="text"
                    style={getInputStyle('title')}
                    value={data.title}
                    onChange={(e) => onChange('title', e.target.value)}
                    placeholder={FEEDBACK_STRINGS.fields.titlePlaceholder}
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? 'feedback-title-error' : undefined}
                />
                {errors.title && (
                    <p
                        id="feedback-title-error"
                        style={styles.errorText}
                        role="alert"
                    >
                        {errors.title}
                    </p>
                )}
            </div>

            {/* Description */}
            <div style={styles.fieldGroup}>
                <label
                    htmlFor="feedback-description"
                    style={styles.label}
                >
                    {FEEDBACK_STRINGS.fields.description}
                </label>
                <textarea
                    id="feedback-description"
                    style={{
                        ...styles.textarea,
                        ...(errors.description ? styles.inputError : {})
                    }}
                    value={data.description}
                    onChange={(e) => onChange('description', e.target.value)}
                    placeholder={FEEDBACK_STRINGS.fields.descriptionPlaceholder}
                    aria-invalid={!!errors.description}
                    aria-describedby={errors.description ? 'feedback-description-error' : undefined}
                />
                {errors.description && (
                    <p
                        id="feedback-description-error"
                        style={styles.errorText}
                        role="alert"
                    >
                        {errors.description}
                    </p>
                )}
            </div>

            {/* Contact fields (hidden when authenticated) */}
            {showContactFields && (
                <>
                    <div style={styles.fieldGroup}>
                        <label
                            htmlFor="feedback-email"
                            style={styles.label}
                        >
                            {FEEDBACK_STRINGS.fields.email}
                        </label>
                        <input
                            id="feedback-email"
                            type="email"
                            style={getInputStyle('reporterEmail')}
                            value={data.reporterEmail}
                            onChange={(e) => onChange('reporterEmail', e.target.value)}
                            placeholder={FEEDBACK_STRINGS.fields.emailPlaceholder}
                            aria-invalid={!!errors.reporterEmail}
                            aria-describedby={
                                errors.reporterEmail ? 'feedback-email-error' : undefined
                            }
                        />
                        {errors.reporterEmail && (
                            <p
                                id="feedback-email-error"
                                style={styles.errorText}
                                role="alert"
                            >
                                {errors.reporterEmail}
                            </p>
                        )}
                    </div>

                    <div style={styles.fieldGroup}>
                        <label
                            htmlFor="feedback-name"
                            style={styles.label}
                        >
                            {FEEDBACK_STRINGS.fields.name}
                        </label>
                        <input
                            id="feedback-name"
                            type="text"
                            style={getInputStyle('reporterName')}
                            value={data.reporterName}
                            onChange={(e) => onChange('reporterName', e.target.value)}
                            placeholder={FEEDBACK_STRINGS.fields.namePlaceholder}
                            aria-invalid={!!errors.reporterName}
                            aria-describedby={
                                errors.reporterName ? 'feedback-name-error' : undefined
                            }
                        />
                        {errors.reporterName && (
                            <p
                                id="feedback-name-error"
                                style={styles.errorText}
                                role="alert"
                            >
                                {errors.reporterName}
                            </p>
                        )}
                    </div>
                </>
            )}

            {/* Action buttons */}
            <div style={styles.buttonRow}>
                <button
                    type="button"
                    style={isSubmitting ? styles.buttonSecondaryDisabled : styles.buttonSecondary}
                    onClick={onGoToStep2}
                    disabled={isSubmitting}
                >
                    {FEEDBACK_STRINGS.buttons.addDetails}
                </button>
                <button
                    type="button"
                    style={isSubmitting ? styles.buttonPrimaryDisabled : styles.buttonPrimary}
                    onClick={onSubmit}
                    disabled={isSubmitting}
                >
                    {FEEDBACK_STRINGS.buttons.submit}
                </button>
            </div>
        </div>
    );
}
