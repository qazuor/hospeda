/**
 * Helper for validating API response data against Zod access schemas.
 *
 * Used by GAP-031 tests to verify that getById responses with populated
 * relation fields pass the corresponding Zod access schema validation.
 *
 * @module test/helpers/relation-schema-validator
 */

import type { z } from 'zod';

/**
 * Result of validating response data against a Zod access schema.
 */
export interface SchemaValidationResult {
    /** Whether the validation passed. */
    readonly success: boolean;
    /** Formatted error messages when validation fails. */
    readonly errors: readonly string[];
    /** The parsed data when validation succeeds. */
    readonly data: unknown;
}

/**
 * Validates API response `data` field against a Zod access schema.
 *
 * @param responseData - The `data` field from the API response body
 * @param schema - The Zod access schema to validate against
 * @returns Validation result with success status and detailed error messages
 */
export function validateResponseAgainstSchema({
    responseData,
    schema
}: {
    readonly responseData: unknown;
    readonly schema: z.ZodTypeAny;
}): SchemaValidationResult {
    const result = schema.safeParse(responseData);

    if (result.success) {
        return {
            success: true,
            errors: [],
            data: result.data
        };
    }

    const errors = result.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return `[${path || 'root'}] ${issue.message} (code: ${issue.code})`;
    });

    return {
        success: false,
        errors,
        data: undefined
    };
}
