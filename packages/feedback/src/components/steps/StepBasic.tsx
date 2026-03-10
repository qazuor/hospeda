/**
 * @repo/feedback - StepBasic component
 *
 * Step 1 of the feedback form. Collects the report type, title, description,
 * and optionally the reporter's email and name when the user is not authenticated.
 */
import { REPORT_TYPES } from '../../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../../config/strings.js';
import type { ReportTypeId } from '../../schemas/feedback.schema.js';
import { Button } from '../../ui/Button.js';
import { Input } from '../../ui/Input.js';
import { Label } from '../../ui/Label.js';
import { Select } from '../../ui/Select.js';
import { Textarea } from '../../ui/Textarea.js';

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
    return (
        <div className="space-y-4">
            {/* Report type */}
            <div>
                <Label htmlFor="feedback-type">{FEEDBACK_STRINGS.fields.type}</Label>
                <Select
                    id="feedback-type"
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
                </Select>
                {errors.type && (
                    <p
                        id="feedback-type-error"
                        className="mt-1 text-destructive text-xs"
                        role="alert"
                    >
                        {errors.type}
                    </p>
                )}
            </div>

            {/* Title */}
            <div>
                <Label htmlFor="feedback-title">{FEEDBACK_STRINGS.fields.title}</Label>
                <Input
                    id="feedback-title"
                    type="text"
                    value={data.title}
                    onChange={(e) => onChange('title', e.target.value)}
                    placeholder={FEEDBACK_STRINGS.fields.titlePlaceholder}
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? 'feedback-title-error' : undefined}
                />
                {errors.title && (
                    <p
                        id="feedback-title-error"
                        className="mt-1 text-destructive text-xs"
                        role="alert"
                    >
                        {errors.title}
                    </p>
                )}
            </div>

            {/* Description */}
            <div>
                <Label htmlFor="feedback-description">{FEEDBACK_STRINGS.fields.description}</Label>
                <Textarea
                    id="feedback-description"
                    className="min-h-[100px]"
                    value={data.description}
                    onChange={(e) => onChange('description', e.target.value)}
                    placeholder={FEEDBACK_STRINGS.fields.descriptionPlaceholder}
                    aria-invalid={!!errors.description}
                    aria-describedby={errors.description ? 'feedback-description-error' : undefined}
                />
                {errors.description && (
                    <p
                        id="feedback-description-error"
                        className="mt-1 text-destructive text-xs"
                        role="alert"
                    >
                        {errors.description}
                    </p>
                )}
            </div>

            {/* Contact fields (hidden when authenticated) */}
            {showContactFields && (
                <>
                    <div>
                        <Label htmlFor="feedback-email">{FEEDBACK_STRINGS.fields.email}</Label>
                        <Input
                            id="feedback-email"
                            type="email"
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
                                className="mt-1 text-destructive text-xs"
                                role="alert"
                            >
                                {errors.reporterEmail}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="feedback-name">{FEEDBACK_STRINGS.fields.name}</Label>
                        <Input
                            id="feedback-name"
                            type="text"
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
                                className="mt-1 text-destructive text-xs"
                                role="alert"
                            >
                                {errors.reporterName}
                            </p>
                        )}
                    </div>
                </>
            )}

            {/* Action buttons */}
            <div className="flex justify-between gap-3 pt-2">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onGoToStep2}
                    disabled={isSubmitting}
                >
                    {FEEDBACK_STRINGS.buttons.addDetails}
                </Button>
                <Button
                    type="button"
                    onClick={onSubmit}
                    disabled={isSubmitting}
                >
                    {FEEDBACK_STRINGS.buttons.submit}
                </Button>
            </div>
        </div>
    );
}
