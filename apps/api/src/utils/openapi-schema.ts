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
    // Handle ZodEffects (schemas with .refine(), .transform(), etc.)
    // biome-ignore lint/suspicious/noExplicitAny: Need to access internal Zod structure
    if ((schema as any)._def?.typeName === 'ZodEffects') {
        // biome-ignore lint/suspicious/noExplicitAny: Need to access internal Zod structure
        const innerSchema = (schema as any)._def.schema;
        // Convert the inner schema and preserve the effects
        const _convertedInner = createOpenAPISchema(innerSchema);
        // Return the original schema since we can't easily reconstruct ZodEffects
        // The validation will happen at runtime, OpenAPI docs just won't show the refinement
        return schema;
    }

    // If it's a ZodObject, process its shape
    if (schema instanceof z.ZodObject) {
        try {
            const newShape: Record<string, z.ZodTypeAny> = {};

            // In Zod v4, .pick()/.omit() schemas have a Proxy shape that may throw
            // "Unrecognized key" errors when the picked keys don't exist in the base schema.
            // This happens when access schemas pick flattened field names (e.g., "city")
            // that are actually nested inside composite objects (e.g., "location.city").
            // biome-ignore lint/suspicious/noExplicitAny: Zod internals access
            const def = (schema as any)._def;

            // Try to get shape as a plain object (works for non-pick/omit schemas)
            let shapeObj: Record<string, z.ZodTypeAny> | null = null;

            if (typeof def.shape === 'function') {
                // Zod v3 style: _def.shape is a function
                shapeObj = def.shape();
            } else if (def.shape && typeof def.shape === 'object') {
                // Zod v4 style: _def.shape is an object/Proxy - copy it safely
                const keys = Object.keys(def.shape);
                shapeObj = {};
                for (const key of keys) {
                    shapeObj[key] = def.shape[key];
                }
            }

            if (!shapeObj) {
                // Cannot access shape, return a passthrough object for OpenAPI
                return createFallbackObjectSchema();
            }

            for (const [key, value] of Object.entries(shapeObj)) {
                newShape[key] = convertDateField(value as z.ZodTypeAny, key);
            }

            return z.object(newShape);
        } catch {
            // If shape access fails (e.g., Zod v4 .pick()/.omit() Proxy with invalid keys),
            // return a generic passthrough object schema that OpenAPI can process without errors.
            // This preserves API functionality (runtime validation still works with the original schema)
            // while preventing zod-to-openapi from crashing on Proxy introspection.
            return createFallbackObjectSchema();
        }
    }

    // For non-object schemas, just convert the field directly
    return convertDateField(schema, 'root');
}

/**
 * Creates a fallback OpenAPI schema for cases where the original schema cannot be introspected.
 * This happens with Zod v4 .pick()/.omit() schemas that use Proxy shapes with keys
 * that don't exist in the base schema. Returns a permissive object schema that
 * zod-to-openapi can safely process for documentation generation.
 */
function createFallbackObjectSchema(): z.ZodTypeAny {
    return z.record(z.string(), z.unknown()).openapi({
        description: 'Entity response object (schema details omitted due to Zod v4 compatibility)'
    });
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
        // If value is already a Date, keep it as-is
        if (value instanceof Date) {
            continue;
        }

        if (typeof value === 'string' && isDateString(value)) {
            // Convert string to Date object
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                (result as Record<string, unknown>)[key] = date;
            }
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively handle nested objects (but not Date objects)
            (result as Record<string, unknown>)[key] = transformApiInputToDomain(
                value as Record<string, unknown>
            );
        } else if (Array.isArray(value)) {
            // Handle arrays
            (result as Record<string, unknown>)[key] = value.map((item: unknown) =>
                typeof item === 'object' && item !== null && !(item instanceof Date)
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
