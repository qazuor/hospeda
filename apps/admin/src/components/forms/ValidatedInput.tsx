import { cn } from '@/lib/utils';
import { type AsyncValidator, useAsyncValidation } from '@/lib/validation/hooks/useAsyncValidation';
import { LoaderIcon } from '@repo/icons';
import type React from 'react';
import type { InputHTMLAttributes } from 'react';
import { useEffect, useId } from 'react';

/**
 * Props for ValidatedInput component
 */
export type ValidatedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    /** Input label */
    readonly label?: string;
    /** Help text displayed below the input */
    readonly helpText?: string;
    /** Whether the field is required */
    readonly required?: boolean;
    /** Async validator function */
    readonly asyncValidator?: AsyncValidator;
    /** Sync validation errors from parent form */
    readonly syncErrors?: string[];
    /** Whether to show validation state visually */
    readonly showValidationState?: boolean;
    /** Custom onChange handler */
    readonly onChange?: (value: string) => void;
    /** Custom onBlur handler */
    readonly onBlur?: () => void;
    /** Whether to validate on change or only on blur */
    readonly validateOnChange?: boolean;
    /** Debounce delay for async validation */
    readonly debounceMs?: number;
    /** Additional CSS classes for the container */
    readonly containerClassName?: string;
    /** Additional CSS classes for the label */
    readonly labelClassName?: string;
    /** Additional CSS classes for the input */
    readonly inputClassName?: string;
    /** Additional CSS classes for error messages */
    readonly errorClassName?: string;
    /** Additional CSS classes for help text */
    readonly helpClassName?: string;
};

/**
 * Input component with integrated async validation
 *
 * Provides real-time validation feedback with debouncing, loading states,
 * and error display. Supports both sync and async validation.
 *
 * @example
 * ```tsx
 * const emailValidator = async (email: string) => {
 *   const response = await fetchApi('/api/validate/email', {
 *     method: 'POST',
 *     body: { email }
 *   });
 *   return response.data.isUnique ? null : 'Email already exists';
 * };
 *
 * <ValidatedInput
 *   label="Email Address"
 *   type="email"
 *   required
 *   asyncValidator={emailValidator}
 *   onChange={(value) => setEmail(value)}
 *   helpText="We'll check if this email is available"
 * />
 * ```
 */
export const ValidatedInput: React.FC<ValidatedInputProps> = ({
    label,
    helpText,
    required = false,
    asyncValidator,
    syncErrors = [],
    showValidationState = true,
    onChange,
    onBlur,
    validateOnChange = true,
    debounceMs = 300,
    containerClassName,
    labelClassName,
    inputClassName,
    errorClassName,
    helpClassName,
    className,
    id: providedId,
    ...inputProps
}) => {
    const generatedId = useId();
    const id = providedId || generatedId;

    // Async validation hook
    const {
        validate,
        validateImmediate,
        clearValidation,
        state: asyncState,
        isValid: isAsyncValid,
        isInvalid: isAsyncInvalid,
        isPending: isAsyncPending
    } = useAsyncValidation(asyncValidator || (() => Promise.resolve(null)), {
        debounceMs,
        enableCache: true
    });

    // Handle input change
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        onChange?.(value);

        // Trigger async validation if enabled
        if (asyncValidator && validateOnChange) {
            validate(value);
        }
    };

    // Handle input blur
    const handleBlur = () => {
        onBlur?.();

        // Trigger immediate validation on blur if not validating on change
        if (asyncValidator && !validateOnChange && inputProps.value) {
            validateImmediate(inputProps.value as string);
        }
    };

    // Clear validation when component unmounts
    useEffect(() => {
        return () => {
            clearValidation();
        };
    }, [clearValidation]);

    // Determine validation state
    const hasAsyncError = isAsyncInvalid && asyncState.error;
    const hasSyncErrors = syncErrors.length > 0;
    const hasAnyError = hasAsyncError || hasSyncErrors;
    const isValidating = isAsyncPending;
    const isValid = isAsyncValid && !hasSyncErrors && asyncState.hasValidated;

    // Combine all errors
    const allErrors = [
        ...syncErrors,
        ...(hasAsyncError && asyncState.error ? [asyncState.error] : [])
    ];

    // Determine input styling based on validation state
    const getInputClassName = () => {
        const baseClasses =
            'block w-full rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

        if (!showValidationState) {
            return cn(
                baseClasses,
                'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
                inputClassName,
                className
            );
        }

        if (hasAnyError) {
            return cn(
                baseClasses,
                'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500',
                inputClassName,
                className
            );
        }

        if (isValid) {
            return cn(
                baseClasses,
                'border-green-300 bg-green-50 focus:border-green-500 focus:ring-green-500',
                inputClassName,
                className
            );
        }

        return cn(
            baseClasses,
            'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
            inputClassName,
            className
        );
    };

    return (
        <div className={cn('space-y-1', containerClassName)}>
            {/* Label */}
            {label && (
                <label
                    htmlFor={id}
                    className={cn('block font-medium text-gray-700 text-sm', labelClassName)}
                >
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}

            {/* Input with validation indicator */}
            <div className="relative">
                <input
                    {...inputProps}
                    id={id}
                    className={getInputClassName()}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={hasAnyError ? 'true' : 'false'}
                    aria-describedby={
                        [
                            helpText ? `${id}-help` : null,
                            allErrors.length > 0 ? `${id}-error` : null
                        ]
                            .filter(Boolean)
                            .join(' ') || undefined
                    }
                />

                {/* Validation state indicator */}
                {showValidationState && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        {isValidating && (
                            <LoaderIcon className="h-4 w-4 animate-spin text-gray-400" />
                        )}
                        {isValid && !isValidating && (
                            <svg
                                className="h-4 w-4 text-green-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <title>Valid</title>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        )}
                        {hasAnyError && !isValidating && (
                            <svg
                                className="h-4 w-4 text-red-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <title>Invalid</title>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        )}
                    </div>
                )}
            </div>

            {/* Error messages */}
            {allErrors.length > 0 && (
                <div
                    id={`${id}-error`}
                    className="space-y-1"
                >
                    {allErrors.map((error) => (
                        <p
                            key={error}
                            className={cn('text-red-600 text-sm', errorClassName)}
                        >
                            {error}
                        </p>
                    ))}
                </div>
            )}

            {/* Help text */}
            {helpText && !hasAnyError && (
                <p
                    id={`${id}-help`}
                    className={cn('text-gray-500 text-sm', helpClassName)}
                >
                    {helpText}
                </p>
            )}

            {/* Validation status for screen readers */}
            <div
                className="sr-only"
                aria-live="polite"
                aria-atomic="true"
            >
                {isValidating && 'Validating input...'}
                {isValid && 'Input is valid'}
                {hasAnyError && `Input has errors: ${allErrors.join(', ')}`}
            </div>
        </div>
    );
};

/**
 * Preset configurations for common input types
 */
export const VALIDATED_INPUT_PRESETS = {
    email: {
        type: 'email' as const,
        autoComplete: 'email' as const,
        placeholder: 'Enter your email address'
    },
    password: {
        type: 'password' as const,
        autoComplete: 'new-password' as const,
        placeholder: 'Enter your password'
    },
    confirmPassword: {
        type: 'password' as const,
        autoComplete: 'new-password' as const,
        placeholder: 'Confirm your password'
    },
    username: {
        type: 'text' as const,
        autoComplete: 'username' as const,
        placeholder: 'Enter your username'
    },
    phone: {
        type: 'tel' as const,
        autoComplete: 'tel' as const,
        placeholder: 'Enter your phone number'
    },
    url: {
        type: 'url' as const,
        autoComplete: 'url' as const,
        placeholder: 'https://example.com'
    }
} as const;
