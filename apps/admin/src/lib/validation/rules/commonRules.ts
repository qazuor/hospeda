import type { CrossFieldRule } from '../hooks/useCrossFieldValidation';

/**
 * Common form data types for type safety
 */
export type PasswordFormData = {
    readonly password: string;
    readonly confirmPassword: string;
};

export type DateRangeFormData = {
    readonly startDate: string;
    readonly endDate: string;
};

export type ConditionalFieldFormData = {
    readonly [key: string]: unknown;
};

/**
 * Password confirmation validation rule
 *
 * @example
 * ```tsx
 * const rules = [
 *   createPasswordConfirmationRule('password', 'confirmPassword')
 * ];
 * ```
 */
export const createPasswordConfirmationRule = <T extends PasswordFormData>(
    passwordField: keyof T = 'password' as keyof T,
    confirmField: keyof T = 'confirmPassword' as keyof T
): CrossFieldRule<T> => ({
    id: 'password-confirmation',
    dependsOn: [passwordField, confirmField],
    validator: (data) => {
        const password = data[passwordField] as string;
        const confirmPassword = data[confirmField] as string;

        if (!password || !confirmPassword) {
            return null; // Don't validate if either field is empty
        }

        return password !== confirmPassword ? 'Passwords do not match' : null;
    },
    debounceMs: 500
});

/**
 * Date range validation rule
 *
 * @example
 * ```tsx
 * const rules = [
 *   createDateRangeRule('startDate', 'endDate', 'End date must be after start date')
 * ];
 * ```
 */
export const createDateRangeRule = <T extends DateRangeFormData>(
    startDateField: keyof T,
    endDateField: keyof T,
    errorMessage = 'End date must be after start date'
): CrossFieldRule<T> => ({
    id: `date-range-${String(startDateField)}-${String(endDateField)}`,
    dependsOn: [startDateField, endDateField],
    validator: (data) => {
        const startDate = data[startDateField] as string;
        const endDate = data[endDateField] as string;

        if (!startDate || !endDate) {
            return null; // Don't validate if either date is empty
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return 'Invalid date format';
        }

        return start >= end ? errorMessage : null;
    },
    debounceMs: 300
});

/**
 * Minimum date range duration rule
 *
 * @example
 * ```tsx
 * const rules = [
 *   createMinDateRangeDurationRule('startDate', 'endDate', 1, 'days')
 * ];
 * ```
 */
export const createMinDateRangeDurationRule = <T extends DateRangeFormData>(
    startDateField: keyof T,
    endDateField: keyof T,
    minDuration: number,
    unit: 'days' | 'hours' | 'minutes' = 'days',
    errorMessage?: string
): CrossFieldRule<T> => {
    const getMilliseconds = (duration: number, timeUnit: typeof unit): number => {
        switch (timeUnit) {
            case 'minutes':
                return duration * 60 * 1000;
            case 'hours':
                return duration * 60 * 60 * 1000;
            case 'days':
                return duration * 24 * 60 * 60 * 1000;
            default:
                return duration;
        }
    };

    const defaultMessage = `Duration must be at least ${minDuration} ${unit}`;

    return {
        id: `min-date-range-${String(startDateField)}-${String(endDateField)}`,
        dependsOn: [startDateField, endDateField],
        validator: (data) => {
            const startDate = data[startDateField] as string;
            const endDate = data[endDateField] as string;

            if (!startDate || !endDate) {
                return null;
            }

            const start = new Date(startDate);
            const end = new Date(endDate);

            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                return null; // Let date format validation handle this
            }

            const duration = end.getTime() - start.getTime();
            const minDurationMs = getMilliseconds(minDuration, unit);

            return duration < minDurationMs ? errorMessage || defaultMessage : null;
        },
        debounceMs: 300
    };
};

/**
 * Conditional required field rule
 *
 * @example
 * ```tsx
 * const rules = [
 *   createConditionalRequiredRule(
 *     'billingAddress',
 *     'paymentMethod',
 *     (value) => value === 'credit_card',
 *     'Billing address is required for credit card payments'
 *   )
 * ];
 * ```
 */
export const createConditionalRequiredRule = <T extends ConditionalFieldFormData>(
    requiredField: keyof T,
    conditionField: keyof T,
    condition: (value: unknown) => boolean,
    errorMessage?: string
): CrossFieldRule<T> => ({
    id: `conditional-required-${String(requiredField)}-${String(conditionField)}`,
    dependsOn: [requiredField, conditionField],
    validator: (data) => {
        const conditionValue = data[conditionField];
        const requiredValue = data[requiredField];

        if (!condition(conditionValue)) {
            return null; // Condition not met, field not required
        }

        const isEmpty =
            !requiredValue ||
            (typeof requiredValue === 'string' && requiredValue.trim() === '') ||
            (Array.isArray(requiredValue) && requiredValue.length === 0);

        return isEmpty ? errorMessage || `${String(requiredField)} is required` : null;
    },
    debounceMs: 200
});

/**
 * Email confirmation rule
 *
 * @example
 * ```tsx
 * const rules = [
 *   createEmailConfirmationRule('email', 'confirmEmail')
 * ];
 * ```
 */
export const createEmailConfirmationRule = <T extends Record<string, unknown>>(
    emailField: keyof T,
    confirmEmailField: keyof T
): CrossFieldRule<T> => ({
    id: `email-confirmation-${String(emailField)}-${String(confirmEmailField)}`,
    dependsOn: [emailField, confirmEmailField],
    validator: (data) => {
        const email = data[emailField] as string;
        const confirmEmail = data[confirmEmailField] as string;

        if (!email || !confirmEmail) {
            return null;
        }

        return email !== confirmEmail ? 'Email addresses do not match' : null;
    },
    debounceMs: 500
});

/**
 * Numeric range validation rule
 *
 * @example
 * ```tsx
 * const rules = [
 *   createNumericRangeRule('minPrice', 'maxPrice', 'Maximum price must be greater than minimum price')
 * ];
 * ```
 */
export const createNumericRangeRule = <T extends Record<string, unknown>>(
    minField: keyof T,
    maxField: keyof T,
    errorMessage = 'Maximum value must be greater than minimum value'
): CrossFieldRule<T> => ({
    id: `numeric-range-${String(minField)}-${String(maxField)}`,
    dependsOn: [minField, maxField],
    validator: (data) => {
        const minValue = data[minField];
        const maxValue = data[maxField];

        if (
            minValue === undefined ||
            maxValue === undefined ||
            minValue === '' ||
            maxValue === ''
        ) {
            return null;
        }

        const min = Number(minValue);
        const max = Number(maxValue);

        if (Number.isNaN(min) || Number.isNaN(max)) {
            return 'Invalid numeric values';
        }

        return min >= max ? errorMessage : null;
    },
    debounceMs: 300
});

/**
 * Age validation rule (birth date vs minimum age)
 *
 * @example
 * ```tsx
 * const rules = [
 *   createAgeValidationRule('birthDate', 18, 'You must be at least 18 years old')
 * ];
 * ```
 */
export const createAgeValidationRule = <T extends Record<string, unknown>>(
    birthDateField: keyof T,
    minAge: number,
    errorMessage?: string
): CrossFieldRule<T> => ({
    id: `age-validation-${String(birthDateField)}`,
    dependsOn: [birthDateField],
    validator: (data) => {
        const birthDate = data[birthDateField] as string;

        if (!birthDate) {
            return null;
        }

        const birth = new Date(birthDate);
        if (Number.isNaN(birth.getTime())) {
            return 'Invalid birth date';
        }

        const today = new Date();
        const age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        const actualAge =
            monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()) ? age - 1 : age;

        return actualAge < minAge
            ? errorMessage || `You must be at least ${minAge} years old`
            : null;
    },
    debounceMs: 500
});

/**
 * File size validation rule
 *
 * @example
 * ```tsx
 * const rules = [
 *   createFileSizeRule('profileImage', 5 * 1024 * 1024, 'Image must be smaller than 5MB')
 * ];
 * ```
 */
export const createFileSizeRule = <T extends Record<string, unknown>>(
    fileField: keyof T,
    maxSizeBytes: number,
    errorMessage?: string
): CrossFieldRule<T> => ({
    id: `file-size-${String(fileField)}`,
    dependsOn: [fileField],
    validator: (data) => {
        const file = data[fileField] as File | null;

        if (!file) {
            return null;
        }

        const maxSizeMB = Math.round((maxSizeBytes / (1024 * 1024)) * 100) / 100;
        const defaultMessage = `File must be smaller than ${maxSizeMB}MB`;

        return file.size > maxSizeBytes ? errorMessage || defaultMessage : null;
    },
    immediate: true
});

/**
 * Predefined common validation rules
 */
export const COMMON_CROSS_FIELD_RULES = {
    passwordConfirmation: createPasswordConfirmationRule,
    dateRange: createDateRangeRule,
    minDateRangeDuration: createMinDateRangeDurationRule,
    conditionalRequired: createConditionalRequiredRule,
    emailConfirmation: createEmailConfirmationRule,
    numericRange: createNumericRangeRule,
    ageValidation: createAgeValidationRule,
    fileSize: createFileSizeRule
} as const;
