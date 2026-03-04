import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import {
    type CrossFieldRule,
    useCrossFieldValidation
} from '@/lib/validation/hooks/useCrossFieldValidation';
import { AlertCircleIcon, AlertTriangleIcon, CheckIcon, LoaderIcon } from '@repo/icons';
import type React from 'react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Form submission state
 */
export type FormSubmissionState = {
    readonly isSubmitting: boolean;
    readonly hasSubmitted: boolean;
    readonly submitError: string | null;
    readonly submitSuccess: boolean;
};

/**
 * Props for ValidatedForm component
 */
export type ValidatedFormProps<TFormData extends Record<string, unknown>> = {
    /** Form data */
    readonly formData: TFormData;
    /** Cross-field validation rules */
    readonly validationRules?: readonly CrossFieldRule<TFormData>[];
    /** Form submission handler */
    readonly onSubmit: (data: TFormData) => Promise<void> | void;
    /** Form data change handler */
    readonly onChange?: (data: TFormData) => void;
    /** Whether to validate on change or only on submit */
    readonly validateOnChange?: boolean;
    /** Whether to prevent submission if form is invalid */
    readonly preventInvalidSubmission?: boolean;
    /** Custom submit button text */
    readonly submitText?: string;
    /** Whether to show submit button */
    readonly showSubmitButton?: boolean;
    /** Whether submit button should be disabled */
    readonly submitDisabled?: boolean;
    /** Form children */
    readonly children: ReactNode;
    /** Additional CSS classes for form container */
    readonly className?: string;
    /** Additional CSS classes for submit button */
    readonly submitButtonClassName?: string;
    /** Custom submit button component */
    readonly customSubmitButton?: (props: {
        isSubmitting: boolean;
        isValid: boolean;
        hasErrors: boolean;
        onSubmit: () => void;
    }) => ReactNode;
    /** Success message to show after submission */
    readonly successMessage?: string;
    /** Whether to reset form after successful submission */
    readonly resetOnSuccess?: boolean;
    /** Form reset handler */
    readonly onReset?: () => void;
    /** Additional form props */
    readonly formProps?: React.FormHTMLAttributes<HTMLFormElement>;
};

/**
 * Form component with integrated cross-field validation
 *
 * Provides comprehensive form validation with cross-field rules,
 * submission handling, error display, and accessibility features.
 *
 * @example
 * ```tsx
 * type RegistrationForm = {
 *   email: string;
 *   password: string;
 *   confirmPassword: string;
 *   birthDate: string;
 * };
 *
 * const rules: CrossFieldRule<RegistrationForm>[] = [
 *   createPasswordConfirmationRule('password', 'confirmPassword'),
 *   createAgeValidationRule('birthDate', 18)
 * ];
 *
 * <ValidatedForm
 *   formData={formData}
 *   validationRules={rules}
 *   onSubmit={handleSubmit}
 *   onChange={setFormData}
 *   submitText="Create Account"
 * >
 *   <ValidatedInput
 *     label="Email"
 *     type="email"
 *     value={formData.email}
 *     onChange={(value) => setFormData(prev => ({ ...prev, email: value }))}
 *     asyncValidator={emailValidator}
 *   />
 *   <ValidatedInput
 *     label="Password"
 *     type="password"
 *     value={formData.password}
 *     onChange={(value) => setFormData(prev => ({ ...prev, password: value }))}
 *   />
 *   <ValidatedInput
 *     label="Confirm Password"
 *     type="password"
 *     value={formData.confirmPassword}
 *     onChange={(value) => setFormData(prev => ({ ...prev, confirmPassword: value }))}
 *   />
 * </ValidatedForm>
 * ```
 */
export const ValidatedForm = <TFormData extends Record<string, unknown>>({
    formData,
    validationRules = [],
    onSubmit,
    validateOnChange = true,
    preventInvalidSubmission = true,
    submitText,
    showSubmitButton = true,
    submitDisabled = false,
    children,
    className,
    submitButtonClassName,
    customSubmitButton,
    successMessage,
    resetOnSuccess = false,
    onReset,
    formProps
}: ValidatedFormProps<TFormData>) => {
    const { t, tPlural } = useTranslations();

    // Form submission state
    const [submissionState, setSubmissionState] = useState<FormSubmissionState>({
        isSubmitting: false,
        hasSubmitted: false,
        submitError: null,
        submitSuccess: false
    });

    // Cross-field validation
    const {
        validate,
        validateImmediate,
        state: validationState,
        isValid,
        isInvalid,
        getAllErrors
    } = useCrossFieldValidation(validationRules, {
        validateOnChange,
        clearErrorsOnChange: true
    });

    // Validate form data when it changes
    useEffect(() => {
        if (validateOnChange) {
            validate(formData);
        }
    }, [formData, validate, validateOnChange]);

    // Handle form submission
    const handleSubmit = useCallback(
        async (event?: React.FormEvent) => {
            event?.preventDefault();

            // Validate immediately before submission
            validateImmediate(formData);

            // Check if form is valid (after immediate validation)
            if (preventInvalidSubmission && isInvalid) {
                setSubmissionState((prev) => ({
                    ...prev,
                    submitError: t('admin-common.validatedForm.fixErrorsBeforeSubmitting')
                }));
                return;
            }

            setSubmissionState({
                isSubmitting: true,
                hasSubmitted: false,
                submitError: null,
                submitSuccess: false
            });

            try {
                await onSubmit(formData);

                setSubmissionState({
                    isSubmitting: false,
                    hasSubmitted: true,
                    submitError: null,
                    submitSuccess: true
                });

                // Reset form if configured
                if (resetOnSuccess && onReset) {
                    onReset();
                }
            } catch (error) {
                setSubmissionState({
                    isSubmitting: false,
                    hasSubmitted: true,
                    submitError: error instanceof Error ? error.message : 'An error occurred',
                    submitSuccess: false
                });
            }
        },
        [
            formData,
            validateImmediate,
            isInvalid,
            preventInvalidSubmission,
            onSubmit,
            resetOnSuccess,
            onReset,
            t
        ]
    );

    // Handle form reset
    const handleReset = useCallback(() => {
        setSubmissionState({
            isSubmitting: false,
            hasSubmitted: false,
            submitError: null,
            submitSuccess: false
        });
        onReset?.();
    }, [onReset]);

    // Get all form errors (validation + submission)
    const allErrors = getAllErrors();

    // Determine if submit should be disabled
    const isSubmitDisabled =
        submitDisabled ||
        submissionState.isSubmitting ||
        (preventInvalidSubmission && isInvalid && validationState.hasValidated);

    return (
        <form
            {...formProps}
            onSubmit={handleSubmit}
            onReset={handleReset}
            className={cn('space-y-6', className)}
            noValidate // We handle validation ourselves
        >
            {/* Form content */}
            <div className="space-y-4">{children}</div>

            {/* Global form errors */}
            {validationState.globalErrors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex">
                        <AlertTriangleIcon
                            className="h-5 w-5 text-destructive"
                            aria-label="Error"
                        />
                        <div className="ml-3">
                            <h3 className="font-medium text-destructive text-sm">
                                {t('admin-common.validatedForm.validationErrors')}
                            </h3>
                            <div className="mt-2 text-destructive text-sm">
                                <ul className="list-disc space-y-1 pl-5">
                                    {validationState.globalErrors.map((error) => (
                                        <li key={error}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Submission error */}
            {submissionState.submitError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex">
                        <AlertCircleIcon
                            className="h-5 w-5 text-destructive"
                            aria-label="Submission Error"
                        />
                        <div className="ml-3">
                            <p className="text-destructive text-sm">
                                {submissionState.submitError}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Success message */}
            {submissionState.submitSuccess && successMessage && (
                <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                    <div className="flex">
                        <CheckIcon
                            className="h-5 w-5 text-green-400 dark:text-green-300"
                            aria-label="Success"
                        />
                        <div className="ml-3">
                            <p className="text-green-700 text-sm dark:text-green-300">
                                {successMessage}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Submit button */}
            {showSubmitButton && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        {customSubmitButton ? (
                            customSubmitButton({
                                isSubmitting: submissionState.isSubmitting,
                                isValid,
                                hasErrors: isInvalid,
                                onSubmit: () => handleSubmit()
                            })
                        ) : (
                            <button
                                type="submit"
                                disabled={isSubmitDisabled}
                                className={cn(
                                    'inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium text-primary-foreground text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
                                    isSubmitDisabled
                                        ? 'cursor-not-allowed bg-muted-foreground/50'
                                        : 'bg-primary hover:bg-primary/90 focus:ring-primary',
                                    submitButtonClassName
                                )}
                            >
                                {submissionState.isSubmitting && (
                                    <LoaderIcon
                                        className="-ml-1 mr-2 h-4 w-4 animate-spin"
                                        aria-label="Loading"
                                    />
                                )}
                                {submissionState.isSubmitting
                                    ? t('admin-common.validatedForm.submitting')
                                    : (submitText ?? t('admin-common.validatedForm.submit'))}
                            </button>
                        )}

                        {onReset && (
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={submissionState.isSubmitting}
                                className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground text-sm shadow-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t('admin-common.validatedForm.reset')}
                            </button>
                        )}
                    </div>

                    {/* Form validation summary */}
                    {validationState.hasValidated && (
                        <div className="text-muted-foreground text-sm">
                            {isValid ? (
                                <span className="text-green-600 dark:text-green-400">
                                    ✓ {t('admin-common.validatedForm.formIsValid')}
                                </span>
                            ) : (
                                <span className="text-destructive">
                                    {tPlural(
                                        'admin-common.validatedForm.errorCount',
                                        allErrors.length
                                    )}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Form state for screen readers */}
            <div
                className="sr-only"
                aria-live="polite"
                aria-atomic="true"
            >
                {submissionState.isSubmitting && t('admin-common.validatedForm.srSubmitting')}
                {submissionState.submitSuccess && t('admin-common.validatedForm.srSuccess')}
                {submissionState.submitError &&
                    t('admin-common.validatedForm.srFailed', {
                        error: submissionState.submitError
                    })}
                {isInvalid &&
                    t('admin-common.validatedForm.srHasErrors', { count: allErrors.length })}
            </div>
        </form>
    );
};
