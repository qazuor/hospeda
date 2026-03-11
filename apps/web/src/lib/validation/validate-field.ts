/**
 * Lightweight field validation helper for web forms (GAP-009).
 *
 * Returns an i18n translation key (from `validation.json`) when validation
 * fails, or `undefined` when the value passes. No Zod dependency — designed
 * for simple client-side form validation in Astro/React islands.
 *
 * @module validate-field
 */

/** RFC 5322-aligned simplified email regex. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Options for field validation rules.
 *
 * All rules are optional. They are evaluated in order:
 * required → minLength → maxLength → email → pattern.
 */
export interface ValidateFieldOptions {
    /** Whether the field must have a non-empty value. */
    readonly required?: boolean;
    /** Minimum number of characters (inclusive). */
    readonly minLength?: number;
    /** Maximum number of characters (inclusive). */
    readonly maxLength?: number;
    /** Validate value as an email address. */
    readonly email?: boolean;
    /**
     * Custom regex pattern. The value must match.
     * If `patternKey` is not provided, `'validationError.field.invalidFormat'`
     * is used when the pattern fails.
     */
    readonly pattern?: RegExp;
    /**
     * i18n key to return when `pattern` validation fails.
     * Defaults to `'validationError.field.invalidFormat'`.
     */
    readonly patternKey?: string;
}

/**
 * Validates a single form field value against the provided rules.
 *
 * Returns the i18n key for the first failing rule, or `undefined` when all
 * rules pass.
 *
 * @example
 * ```ts
 * const error = validateField('', { required: true });
 * // → 'validationError.field.required'
 *
 * const error2 = validateField('ab@x.com', { email: true });
 * // → 'validationError.field.invalidEmail'
 *
 * const error3 = validateField('hello', { minLength: 10 });
 * // → 'validationError.field.tooSmall'
 * ```
 *
 * @param value   - The raw string value from the form field.
 * @param options - Validation rules to apply.
 * @returns The i18n key for the failing rule, or `undefined` if valid.
 */
export function validateField(value: string, options: ValidateFieldOptions): string | undefined {
    const trimmed = value.trim();

    if (options.required && trimmed.length === 0) {
        return 'validationError.field.required';
    }

    // Skip remaining rules for optional empty fields
    if (trimmed.length === 0) {
        return undefined;
    }

    if (options.minLength !== undefined && trimmed.length < options.minLength) {
        return 'validationError.field.tooSmall';
    }

    if (options.maxLength !== undefined && trimmed.length > options.maxLength) {
        return 'validationError.field.tooBig';
    }

    if (options.email && !EMAIL_RE.test(trimmed)) {
        return 'validationError.field.invalidEmail';
    }

    if (options.pattern && !options.pattern.test(trimmed)) {
        return options.patternKey ?? 'validationError.field.invalidFormat';
    }

    return undefined;
}
