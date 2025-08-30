import type { ZodObject, ZodRawShape, ZodSchema } from 'zod';

/**
 * Extract a field schema from a Zod object schema using dot notation path
 * @param schema - The main Zod object schema
 * @param fieldPath - Dot notation path to the field (e.g., 'user.profile.name')
 * @returns The extracted schema or undefined if not found
 */
export const extractFieldSchema = <T extends ZodRawShape>(
    schema: ZodObject<T>,
    fieldPath: string
): ZodSchema | undefined => {
    const pathParts = fieldPath.split('.');
    // biome-ignore lint/suspicious/noExplicitAny: Zod schema traversal requires dynamic typing
    let currentSchema: any = schema;

    for (const part of pathParts) {
        if (currentSchema?.shape?.[part]) {
            currentSchema = currentSchema.shape[part];
        } else if (currentSchema?._def?.shape?.[part]) {
            // Handle ZodObject with _def structure
            currentSchema = currentSchema._def.shape[part];
        } else {
            console.warn(`Schema field not found: ${fieldPath} at part: ${part}`);
            return undefined;
        }
    }

    return currentSchema as ZodSchema;
};

/**
 * Create a field schema extractor function for a specific entity schema
 * @param mainSchema - The main entity schema
 * @returns Function to extract field schemas by path
 */
export const createFieldSchemaExtractor = <T extends ZodRawShape>(mainSchema: ZodObject<T>) => {
    return (fieldPath: string) => extractFieldSchema(mainSchema, fieldPath);
};

/**
 * Extract multiple field schemas at once
 * @param schema - The main Zod object schema
 * @param fieldPaths - Array of dot notation paths
 * @returns Object mapping field paths to their schemas
 */
export const extractMultipleFieldSchemas = <T extends ZodRawShape>(
    schema: ZodObject<T>,
    fieldPaths: string[]
): Record<string, ZodSchema | undefined> => {
    const result: Record<string, ZodSchema | undefined> = {};

    for (const fieldPath of fieldPaths) {
        result[fieldPath] = extractFieldSchema(schema, fieldPath);
    }

    return result;
};

/**
 * Check if a field exists in the schema
 * @param schema - The main Zod object schema
 * @param fieldPath - Dot notation path to check
 * @returns True if the field exists
 */
export const hasSchemaField = <T extends ZodRawShape>(
    schema: ZodObject<T>,
    fieldPath: string
): boolean => {
    return extractFieldSchema(schema, fieldPath) !== undefined;
};

/**
 * Get all available field paths from a schema (flattened)
 * @param schema - The Zod object schema
 * @param prefix - Current path prefix (for recursion)
 * @returns Array of all available field paths
 */
export const getSchemaFieldPaths = <T extends ZodRawShape>(
    schema: ZodObject<T>,
    prefix = ''
): string[] => {
    const paths: string[] = [];
    const shape = schema.shape || schema._def?.shape;

    if (!shape) return paths;

    for (const [key, value] of Object.entries(shape)) {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        paths.push(currentPath);

        // If this is a nested object, recurse
        if (value && typeof value === 'object' && 'shape' in value) {
            paths.push(...getSchemaFieldPaths(value as ZodObject<ZodRawShape>, currentPath));
        }
    }

    return paths;
};
