/**
 * OpenAPI metadata utilities for comprehensive API documentation
 * Provides standardized metadata patterns and validation helpers
 */
import type { ZodSchema } from 'zod';

/**
 * Standard OpenAPI field metadata interface
 * Defines the complete structure for field-level documentation
 */
export interface OpenApiFieldMetadata {
    /** Human-readable description of the field */
    description: string;
    /** Example value for documentation */
    example: unknown;
    /** Data format hint (e.g., 'uuid', 'email', 'date-time') */
    format?: string;
    /** Minimum value for numeric fields */
    minimum?: number;
    /** Maximum value for numeric fields */
    maximum?: number;
    /** Minimum length for string fields */
    minLength?: number;
    /** Maximum length for string fields */
    maxLength?: number;
    /** Pattern regex for string validation */
    pattern?: string;
    /** Enum values for restricted fields */
    enum?: string[];
    /** Whether field is deprecated */
    deprecated?: boolean;
    /** Default value */
    default?: unknown;
    /** Whether field is nullable */
    nullable?: boolean;
    /** Additional OpenAPI extensions */
    [key: `x-${string}`]: unknown;
}

/**
 * Complete OpenAPI schema metadata interface
 * Used for entity-level documentation with comprehensive details
 */
export interface OpenApiSchemaMetadata {
    /** OpenAPI reference name */
    ref: string;
    /** Schema description */
    description: string;
    /** Complete example object */
    example: Record<string, unknown>;
    /** Field-level metadata */
    fields: Record<string, OpenApiFieldMetadata>;
    /** Schema title */
    title?: string;
    /** External documentation URL */
    externalDocs?: {
        url: string;
        description: string;
    };
    /** Schema tags for grouping */
    tags?: string[];
    /** Whether schema is deprecated */
    deprecated?: boolean;
    /** Additional OpenAPI extensions */
    [key: `x-${string}`]: unknown;
}

/**
 * Standard metadata for UUID fields
 * Provides consistent documentation for ID fields across all entities
 */
export const UUID_FIELD_METADATA: OpenApiFieldMetadata = {
    description: 'Unique identifier in UUID v4 format',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
};

/**
 * Standard metadata for slug fields
 * URL-friendly identifier patterns
 */
export const SLUG_FIELD_METADATA: OpenApiFieldMetadata = {
    description: 'URL-friendly identifier (lowercase, hyphen-separated)',
    example: 'luxury-beachfront-villa',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    minLength: 1,
    maxLength: 100
};

/**
 * Standard metadata for name fields
 * Human-readable display names
 */
export const NAME_FIELD_METADATA: OpenApiFieldMetadata = {
    description: 'Human-readable name for display purposes',
    example: 'Luxury Beachfront Villa',
    minLength: 1,
    maxLength: 200
};

/**
 * Standard metadata for description fields
 * Detailed text descriptions
 */
export const DESCRIPTION_FIELD_METADATA: OpenApiFieldMetadata = {
    description: 'Detailed description with rich text support',
    example:
        'A beautiful and spacious villa located directly on the beach with stunning ocean views and modern amenities.',
    minLength: 10,
    maxLength: 2000
};

/**
 * Standard metadata for timestamp fields
 * ISO datetime fields
 */
export const TIMESTAMP_FIELD_METADATA: OpenApiFieldMetadata = {
    description: 'ISO 8601 datetime string in UTC',
    example: '2025-09-25T10:30:00Z',
    format: 'date-time'
};

/**
 * Validation utility for OpenAPI metadata consistency
 * Ensures metadata examples pass schema validation at build time
 */
export const validateOpenApiMetadata = <T extends ZodSchema>(
    schema: T,
    metadata: OpenApiSchemaMetadata
): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate main example against schema
    const mainResult = schema.safeParse(metadata.example);
    if (!mainResult.success) {
        errors.push(`Main example validation failed: ${mainResult.error.message}`);
    }

    // Validate field examples exist in main example
    for (const [fieldName, fieldMeta] of Object.entries(metadata.fields)) {
        if (!(fieldName in metadata.example)) {
            errors.push(`Field "${fieldName}" has metadata but no example in main object`);
        }

        // Validate field example matches main example value
        if (fieldMeta.example !== undefined) {
            const mainValue = metadata.example[fieldName];
            if (mainValue !== fieldMeta.example) {
                errors.push(
                    `Field "${fieldName}" example mismatch: main=${mainValue}, field=${fieldMeta.example}`
                );
            }
        }
    }

    // Check for main example fields without metadata
    for (const fieldName of Object.keys(metadata.example)) {
        if (!(fieldName in metadata.fields)) {
            errors.push(`Field "${fieldName}" in main example but no metadata provided`);
        }
    }

    return { valid: errors.length === 0, errors };
};

/**
 * Utility to apply OpenAPI metadata to a Zod schema
 * Integrates with @hono/zod-openapi for route documentation
 */
export const applyOpenApiMetadata = <
    T extends ZodSchema & { openapi?: (opts: Record<string, unknown>) => T }
>(
    schema: T,
    metadata: OpenApiSchemaMetadata
): T => {
    if ('openapi' in schema && typeof schema.openapi === 'function') {
        return schema.openapi({
            ref: metadata.ref,
            title: metadata.title,
            description: metadata.description,
            example: metadata.example,
            externalDocs: metadata.externalDocs,
            ...Object.fromEntries(Object.entries(metadata).filter(([key]) => key.startsWith('x-')))
        });
    }

    // Return original schema if openapi method not available
    return schema;
};
