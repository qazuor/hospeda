/**
 * FormError — Accessible field error message component (GAP-009, GAP-039).
 *
 * Renders a validation error message with full ARIA compliance:
 * - `role="alert"` announces errors to assistive technology immediately
 * - `aria-live="polite"` avoids interrupting in-progress announcements
 * - Stable `id` derived from `fieldName` for use in `aria-describedby` on the
 *   associated input
 *
 * Only renders when `error` is a non-empty string. Returns `null` otherwise
 * so callers do not need to guard the render.
 *
 * @example
 * ```tsx
 * <input
 *   id="email"
 *   name="email"
 *   aria-describedby={errors.email ? `${email}-error` : undefined}
 * />
 * <FormError fieldName="email" error={errors.email} />
 * ```
 */

interface FormErrorProps {
    /** The field name used to generate a stable `id` (`{fieldName}-error`). */
    readonly fieldName: string;
    /** The translated error message to display. Renders nothing when falsy. */
    readonly error?: string;
    /** Optional additional CSS class names. */
    readonly className?: string;
}

/**
 * Accessible field-level error message component.
 *
 * @param props - See {@link FormErrorProps}
 */
export function FormError({ fieldName, error, className }: FormErrorProps) {
    if (!error) return null;

    return (
        <p
            id={`${fieldName}-error`}
            role="alert"
            aria-live="polite"
            className={`mt-1 text-red-600 text-sm dark:text-red-400 ${className ?? ''}`.trim()}
        >
            {error}
        </p>
    );
}
