import { cn } from '@/lib/utils';
import {
    type CrossFieldRule,
    useCrossFieldValidation
} from '@/lib/validation/hooks/useCrossFieldValidation';
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
    submitText = 'Submit',
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
                    submitError: 'Please fix the errors above before submitting.'
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
            onReset
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
                <div className="rounded-md border border-red-200 bg-red-50 p-4">
                    <div className="flex">
                        <svg
                            className="h-5 w-5 text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <title>Error</title>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                        </svg>
                        <div className="ml-3">
                            <h3 className="font-medium text-red-800 text-sm">
                                Form Validation Errors
                            </h3>
                            <div className="mt-2 text-red-700 text-sm">
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
                <div className="rounded-md border border-red-200 bg-red-50 p-4">
                    <div className="flex">
                        <svg
                            className="h-5 w-5 text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <title>Submission Error</title>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <div className="ml-3">
                            <p className="text-red-700 text-sm">{submissionState.submitError}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Success message */}
            {submissionState.submitSuccess && successMessage && (
                <div className="rounded-md border border-green-200 bg-green-50 p-4">
                    <div className="flex">
                        <svg
                            className="h-5 w-5 text-green-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <title>Success</title>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        <div className="ml-3">
                            <p className="text-green-700 text-sm">{successMessage}</p>
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
                                    'inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium text-sm text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
                                    isSubmitDisabled
                                        ? 'cursor-not-allowed bg-gray-400'
                                        : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
                                    submitButtonClassName
                                )}
                            >
                                {submissionState.isSubmitting && (
                                    <svg
                                        className="-ml-1 mr-2 h-4 w-4 animate-spin"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <title>Loading</title>
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                )}
                                {submissionState.isSubmitting ? 'Submitting...' : submitText}
                            </button>
                        )}

                        {onReset && (
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={submissionState.isSubmitting}
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Form validation summary */}
                    {validationState.hasValidated && (
                        <div className="text-gray-500 text-sm">
                            {isValid ? (
                                <span className="text-green-600">✓ Form is valid</span>
                            ) : (
                                <span className="text-red-600">
                                    {allErrors.length} error{allErrors.length !== 1 ? 's' : ''}
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
                {submissionState.isSubmitting && 'Form is being submitted...'}
                {submissionState.submitSuccess && 'Form submitted successfully'}
                {submissionState.submitError &&
                    `Form submission failed: ${submissionState.submitError}`}
                {isInvalid && `Form has ${allErrors.length} validation errors`}
            </div>
        </form>
    );
};
