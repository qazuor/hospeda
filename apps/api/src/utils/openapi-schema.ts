import { z } from '@hono/zod-openapi';

/**
 * Utility function to convert domain schemas with z.date() fields to OpenAPI-compatible schemas with z.string().datetime()
 *
 * This solves the OpenAPI generation issue where z.date() fields cause "Unrecognized key" errors during startup.
 * The function recursively walks through schema definitions and converts Date fields to string datetime fields
 * for OpenAPI documentation while keeping the original domain schemas pure.
 *
 * @param schema - The original domain schema containing z.date() fields (any Zod type)
 * @returns A new schema with z.date() fields converted to z.string().datetime() for OpenAPI compatibility
 */
export function createOpenAPISchema<T extends z.ZodTypeAny>(schema: T): z.ZodTypeAny {
    // If it's a ZodObject, process its shape
    if (schema instanceof z.ZodObject) {
        const newShape: Record<string, z.ZodTypeAny> = {};

        for (const [key, value] of Object.entries(schema.shape)) {
            newShape[key] = convertDateField(value as z.ZodTypeAny, key);
        }

        return z.object(newShape);
    }

    // For non-object schemas, just convert the field directly
    return convertDateField(schema, 'root');
}

/**
 * Recursively converts date fields to string datetime fields
 */
function convertDateField(field: z.ZodTypeAny, fieldName: string): z.ZodTypeAny {
    // Handle z.date()
    if (field instanceof z.ZodDate) {
        return z
            .string()
            .datetime()
            .openapi({
                description: `Date field: ${fieldName}`,
                example: '2024-07-15T18:00:00Z'
            });
    }

    // Handle z.date().optional()
    if (field instanceof z.ZodOptional) {
        const innerType = field._def.innerType as z.ZodTypeAny;
        if (innerType instanceof z.ZodDate) {
            return z
                .string()
                .datetime()
                .optional()
                .openapi({
                    description: `Optional date field: ${fieldName}`,
                    example: '2024-07-15T18:00:00Z'
                });
        }
        // For other optional types, recursively convert the inner type
        return convertDateField(innerType, fieldName).optional();
    }

    // Handle z.date().nullable()
    if (field instanceof z.ZodNullable) {
        const innerType = field._def.innerType as z.ZodTypeAny;
        if (innerType instanceof z.ZodDate) {
            return z
                .string()
                .datetime()
                .nullable()
                .openapi({
                    description: `Nullable date field: ${fieldName}`,
                    example: '2024-07-15T18:00:00Z'
                });
        }
        // For other nullable types, recursively convert the inner type
        return convertDateField(innerType, fieldName).nullable();
    }

    // Handle nested objects
    if (field instanceof z.ZodObject) {
        return createOpenAPISchema(field);
    }

    // Handle arrays - be more careful here to avoid the 'in' operator issue
    if (field instanceof z.ZodArray) {
        const elementType = field._def.type;
        if (elementType && typeof elementType === 'object') {
            return z.array(convertDateField(elementType, `${fieldName}_item`));
        }
        // If elementType is not a proper Zod type, return the array as-is
        return field;
    }

    // For all other types (string, number, boolean, enums, etc.), return as-is
    return field;
}

/**
 * Utility function to transform API input (with string dates) to domain format (with Date objects)
 * This handles the runtime conversion from OpenAPI string dates to domain Date objects
 *
 * @param input - The input object with string dates from API request
 * @returns The same object but with string dates converted to Date objects
 */
export function transformApiInputToDomain<T extends Record<string, unknown>>(input: T): T {
    const result = { ...input };

    for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'string' && isDateString(value)) {
            // Convert string to Date object
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                (result as Record<string, unknown>)[key] = date;
            }
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively handle nested objects
            (result as Record<string, unknown>)[key] = transformApiInputToDomain(
                value as Record<string, unknown>
            );
        } else if (Array.isArray(value)) {
            // Handle arrays
            (result as Record<string, unknown>)[key] = value.map((item: unknown) =>
                typeof item === 'object' && item !== null
                    ? transformApiInputToDomain(item as Record<string, unknown>)
                    : item
            );
        }
    }

    return result;
}

/**
 * Helper function to detect if a string is likely a date string
 */
function isDateString(str: string): boolean {
    // Check if it matches ISO datetime format
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return isoDateRegex.test(str);
}
