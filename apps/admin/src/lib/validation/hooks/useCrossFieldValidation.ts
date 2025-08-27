import { adminLogger } from '@/utils/logger';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cross-field validation rule
 */
export type CrossFieldRule<TFormData = Record<string, unknown>> = {
    /** Unique identifier for the rule */
    readonly id: string;
    /** Fields that this rule depends on */
    readonly dependsOn: readonly (keyof TFormData)[];
    /** Validation function */
    readonly validator: (formData: TFormData) => string | null;
    /** Error message when validation fails */
    readonly message?: string;
    /** Whether to run validation immediately or wait for user interaction */
    readonly immediate?: boolean;
    /** Debounce delay in milliseconds */
    readonly debounceMs?: number;
};

/**
 * Cross-field validation state
 */
export type CrossFieldValidationState = {
    /** Field-specific errors */
    readonly fieldErrors: Record<string, string[]>;
    /** Global form errors */
    readonly globalErrors: string[];
    /** Whether any validation is in progress */
    readonly isValidating: boolean;
    /** Whether the form has been validated at least once */
    readonly hasValidated: boolean;
    /** Whether the form is currently valid */
    readonly isValid: boolean;
};

/**
 * Configuration for cross-field validation
 */
export type CrossFieldValidationConfig = {
    /** Default debounce delay for all rules */
    readonly defaultDebounceMs?: number;
    /** Whether to validate on every change or only on blur/submit */
    readonly validateOnChange?: boolean;
    /** Whether to clear errors when fields change */
    readonly clearErrorsOnChange?: boolean;
};

/**
 * Hook for cross-field form validation
 *
 * Manages validation rules that depend on multiple form fields,
 * such as password confirmation, date ranges, conditional fields, etc.
 *
 * @example
 * ```tsx
 * type FormData = {
 *   password: string;
 *   confirmPassword: string;
 *   startDate: string;
 *   endDate: string;
 * };
 *
 * const rules: CrossFieldRule<FormData>[] = [
 *   {
 *     id: 'password-match',
 *     dependsOn: ['password', 'confirmPassword'],
 *     validator: (data) =>
 *       data.password !== data.confirmPassword ? 'Passwords do not match' : null
 *   },
 *   {
 *     id: 'date-range',
 *     dependsOn: ['startDate', 'endDate'],
 *     validator: (data) =>
 *       new Date(data.startDate) >= new Date(data.endDate)
 *         ? 'End date must be after start date' : null
 *   }
 * ];
 *
 * const { validate, state, clearErrors } = useCrossFieldValidation(rules);
 *
 * // Validate when form data changes
 * useEffect(() => {
 *   validate(formData);
 * }, [formData, validate]);
 * ```
 */
export const useCrossFieldValidation = <TFormData extends Record<string, unknown>>(
    rules: readonly CrossFieldRule<TFormData>[],
    config: CrossFieldValidationConfig = {}
) => {
    const { defaultDebounceMs = 300, validateOnChange = true, clearErrorsOnChange = true } = config;

    // Validation state
    const [state, setState] = useState<CrossFieldValidationState>({
        fieldErrors: {},
        globalErrors: [],
        isValidating: false,
        hasValidated: false,
        isValid: true
    });

    // Refs for debouncing
    const debounceTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const lastFormDataRef = useRef<TFormData | null>(null);

    // Clear debounce timeout for a specific rule
    const clearDebounceTimeout = useCallback((ruleId: string) => {
        const timeout = debounceTimeoutsRef.current.get(ruleId);
        if (timeout) {
            clearTimeout(timeout);
            debounceTimeoutsRef.current.delete(ruleId);
        }
    }, []);

    // Clear all debounce timeouts
    const clearAllDebounceTimeouts = useCallback(() => {
        for (const timeout of debounceTimeoutsRef.current.values()) {
            clearTimeout(timeout);
        }
        debounceTimeoutsRef.current.clear();
    }, []);

    // Check if form data has changed for specific fields
    const hasFieldsChanged = useCallback(
        (
            currentData: TFormData,
            previousData: TFormData | null,
            fields: readonly (keyof TFormData)[]
        ): boolean => {
            if (!previousData) return true;

            return fields.some((field) => currentData[field] !== previousData[field]);
        },
        []
    );

    // Validate a single rule
    const validateRule = useCallback(
        (rule: CrossFieldRule<TFormData>, formData: TFormData): string | null => {
            try {
                return rule.validator(formData);
            } catch (error) {
                adminLogger.error(
                    `Cross-field validation error for rule ${rule.id}:`,
                    error instanceof Error ? error.message : 'Unknown error'
                );
                return rule.message || 'Validation error occurred';
            }
        },
        []
    );

    // Perform validation for all rules
    const performValidation = useCallback(
        (formData: TFormData) => {
            setState((prev) => ({ ...prev, isValidating: true }));

            const newFieldErrors: Record<string, string[]> = {};
            const newGlobalErrors: string[] = [];

            // Validate each rule
            for (const rule of rules) {
                const error = validateRule(rule, formData);

                if (error) {
                    // Determine if this is a field-specific or global error
                    if (rule.dependsOn.length === 1) {
                        // Single field error
                        const fieldName = String(rule.dependsOn[0]);
                        if (!newFieldErrors[fieldName]) {
                            newFieldErrors[fieldName] = [];
                        }
                        newFieldErrors[fieldName].push(error);
                    } else {
                        // Multi-field or global error
                        newGlobalErrors.push(error);
                    }
                }
            }

            // Update state
            setState((prev) => ({
                ...prev,
                fieldErrors: newFieldErrors,
                globalErrors: newGlobalErrors,
                isValidating: false,
                hasValidated: true,
                isValid: Object.keys(newFieldErrors).length === 0 && newGlobalErrors.length === 0
            }));

            // Store current form data for comparison
            lastFormDataRef.current = formData;
        },
        [rules, validateRule]
    );

    // Debounced validation
    const validate = useCallback(
        (formData: TFormData, immediate = false) => {
            if (!validateOnChange && !immediate) {
                return;
            }

            // Clear errors on change if configured
            if (clearErrorsOnChange && lastFormDataRef.current) {
                const hasAnyFieldChanged = hasFieldsChanged(
                    formData,
                    lastFormDataRef.current,
                    rules.flatMap((rule) => rule.dependsOn)
                );

                if (hasAnyFieldChanged) {
                    setState((prev) => ({
                        ...prev,
                        fieldErrors: {},
                        globalErrors: [],
                        isValid: true
                    }));
                }
            }

            // Process each rule
            for (const rule of rules) {
                // Check if any dependent fields have changed
                const fieldsChanged = hasFieldsChanged(
                    formData,
                    lastFormDataRef.current,
                    rule.dependsOn
                );

                if (!fieldsChanged && !immediate) {
                    continue;
                }

                // Clear existing timeout for this rule
                clearDebounceTimeout(rule.id);

                // Determine debounce delay
                const debounceMs = immediate ? 0 : (rule.debounceMs ?? defaultDebounceMs);

                if (debounceMs > 0) {
                    // Set up debounced validation
                    const timeout = setTimeout(() => {
                        performValidation(formData);
                        debounceTimeoutsRef.current.delete(rule.id);
                    }, debounceMs);

                    debounceTimeoutsRef.current.set(rule.id, timeout);
                } else {
                    // Immediate validation
                    performValidation(formData);
                }
            }
        },
        [
            validateOnChange,
            clearErrorsOnChange,
            hasFieldsChanged,
            rules,
            clearDebounceTimeout,
            defaultDebounceMs,
            performValidation
        ]
    );

    // Validate immediately (no debounce)
    const validateImmediate = useCallback(
        (formData: TFormData) => {
            clearAllDebounceTimeouts();
            performValidation(formData);
        },
        [clearAllDebounceTimeouts, performValidation]
    );

    // Clear all errors
    const clearErrors = useCallback(() => {
        clearAllDebounceTimeouts();
        setState({
            fieldErrors: {},
            globalErrors: [],
            isValidating: false,
            hasValidated: false,
            isValid: true
        });
        lastFormDataRef.current = null;
    }, [clearAllDebounceTimeouts]);

    // Clear errors for specific fields
    const clearFieldErrors = useCallback((fieldNames: string[]) => {
        setState((prev) => {
            const newFieldErrors = { ...prev.fieldErrors };
            for (const fieldName of fieldNames) {
                delete newFieldErrors[fieldName];
            }

            const hasErrors =
                Object.keys(newFieldErrors).length > 0 || prev.globalErrors.length > 0;

            return {
                ...prev,
                fieldErrors: newFieldErrors,
                isValid: !hasErrors
            };
        });
    }, []);

    // Get errors for a specific field
    const getFieldErrors = useCallback(
        (fieldName: string): string[] => {
            return state.fieldErrors[fieldName] || [];
        },
        [state.fieldErrors]
    );

    // Check if a specific field has errors
    const hasFieldError = useCallback(
        (fieldName: string): boolean => {
            return (state.fieldErrors[fieldName]?.length || 0) > 0;
        },
        [state.fieldErrors]
    );

    // Get all errors as a flat array
    const getAllErrors = useCallback((): string[] => {
        const fieldErrorsFlat = Object.values(state.fieldErrors).flat();
        return [...fieldErrorsFlat, ...state.globalErrors];
    }, [state.fieldErrors, state.globalErrors]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearAllDebounceTimeouts();
        };
    }, [clearAllDebounceTimeouts]);

    return {
        // Validation functions
        validate,
        validateImmediate,
        clearErrors,
        clearFieldErrors,

        // State
        state,

        // Utility functions
        getFieldErrors,
        hasFieldError,
        getAllErrors,

        // Computed properties
        isValid: state.isValid,
        isInvalid: !state.isValid,
        isPending: state.isValidating,
        hasErrors: !state.isValid,
        errorCount: getAllErrors().length
    };
};
