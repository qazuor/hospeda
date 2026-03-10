import { resolveValidationMessage } from '@repo/i18n';
import type { ZodIssue, ZodSchema } from 'zod';
import { unflattenValues } from '../../components/entity-form/utils/unflatten-values.utils';

/**
 * Extracts interpolation parameters from a ZodIssue for use in translation strings.
 *
 * Maps Zod issue properties to the `{{param}}` placeholders used in validation.json:
 * - `too_small` issues: `{ min: issue.minimum }`
 * - `too_big` issues: `{ max: issue.maximum }`
 * - `invalid_type` issues: `{ expected: issue.expected, received: issue.received }`
 * - `invalid_literal` issues: `{ expected: issue.expected }`
 * - `not_multiple_of` issues: `{ multipleOf: issue.multipleOf }`
 * - `invalid_union_discriminator` / `invalid_enum_value` issues: `{ options: joined string }`
 *
 * @param input - Options object
 * @param input.issue - The ZodIssue to extract parameters from
 * @returns A record of interpolation parameters for use in translation strings
 */
export function extractZodIssueParams({
    issue
}: {
    readonly issue: ZodIssue;
}): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    const raw = issue as unknown as Record<string, unknown>;

    if ('minimum' in issue) params.min = raw.minimum;
    if ('maximum' in issue) params.max = raw.maximum;
    if ('expected' in issue) params.expected = raw.expected;
    if ('received' in issue) params.received = raw.received;
    if ('multipleOf' in issue) params.multipleOf = raw.multipleOf;
    if ('options' in issue) params.options = (raw.options as unknown[])?.join(', ');

    return params;
}

/**
 * Validates entire form data against a Zod schema.
 * Returns a map of `fieldId -> translated error message`.
 *
 * Flow:
 * 1. Unflatten dot-notation form values to nested objects
 * 2. Run `schema.safeParse()` on the nested data
 * 3. For each issue: extract params, resolve translated message
 * 4. Return map of `fieldId -> translated error string`
 *
 * Only the first error per field is kept. Fields with no errors are omitted.
 *
 * @param input - Options object
 * @param input.schema - Zod schema to validate against
 * @param input.data - Flat form values (may contain dot-notation keys)
 * @param input.t - Translation function from `useTranslations()`
 * @returns Record mapping field IDs to translated error messages
 *
 * @example
 * ```ts
 * const errors = validateFormWithZod({
 *     schema: AmenityCreateInputSchema,
 *     data: { name: '', 'price.basePrice': '' },
 *     t: tAny
 * });
 * // { name: "El nombre es obligatorio", "price.basePrice": "El precio base es obligatorio" }
 * ```
 */
export function validateFormWithZod({
    schema,
    data,
    t
}: {
    readonly schema: ZodSchema;
    readonly data: Record<string, unknown>;
    readonly t: (key: string, params?: Record<string, unknown>) => string;
}): Record<string, string> {
    const nestedData = unflattenValues(data);
    const result = schema.safeParse(nestedData);

    if (result.success) return {};

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const fieldId = issue.path.join('.');
        if (fieldId && !errors[fieldId]) {
            const params = extractZodIssueParams({ issue });
            errors[fieldId] = resolveValidationMessage({
                key: issue.message,
                t,
                params
            });
        }
    }
    return errors;
}

/**
 * Validates a single field by running the full schema validation
 * and extracting only the error for the target field.
 *
 * Running the full schema ensures cross-field validations (e.g. `refine`, `superRefine`)
 * still work correctly even when validating a single field in isolation.
 *
 * @param input - Options object
 * @param input.schema - Zod schema to validate against
 * @param input.data - Flat form values (may contain dot-notation keys)
 * @param input.fieldId - Dot-notation field identifier to look up (e.g. `'price.basePrice'`)
 * @param input.t - Translation function from `useTranslations()`
 * @returns Translated error message string, or `undefined` when the field is valid
 *
 * @example
 * ```ts
 * const error = validateFieldWithZod({
 *     schema: AmenityCreateInputSchema,
 *     data: { name: '' },
 *     fieldId: 'name',
 *     t: tAny
 * });
 * // "El nombre es obligatorio"
 * ```
 */
export function validateFieldWithZod({
    schema,
    data,
    fieldId,
    t
}: {
    readonly schema: ZodSchema;
    readonly data: Record<string, unknown>;
    readonly fieldId: string;
    readonly t: (key: string, params?: Record<string, unknown>) => string;
}): string | undefined {
    const nestedData = unflattenValues(data);
    const result = schema.safeParse(nestedData);

    if (result.success) return undefined;

    const fieldPath = fieldId.split('.');
    const issue = result.error.issues.find(
        (iss) =>
            iss.path.length === fieldPath.length &&
            iss.path.every((segment, i) => String(segment) === fieldPath[i])
    );

    if (!issue) return undefined;

    const params = extractZodIssueParams({ issue });
    return resolveValidationMessage({ key: issue.message, t, params });
}
