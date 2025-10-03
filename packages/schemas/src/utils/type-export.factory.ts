/**
 * Type Export Factory - Standardizes type exports and reduces boilerplate
 *
 * This factory creates consistent type export patterns across all entity schemas.
 */
import type { z } from 'zod';

/**
 * Generates all standard type exports for an entity schema set
 */
export function createEntityTypeExports<
    TEntitySchema extends z.ZodSchema,
    TSearchSchema extends z.ZodSchema,
    THttpSearchSchema extends z.ZodSchema,
    TCreateSchema extends z.ZodSchema,
    TUpdateSchema extends z.ZodSchema,
    TListItemSchema extends z.ZodSchema,
    TFiltersSchema extends z.ZodSchema
>(schemas: {
    entity: TEntitySchema;
    search: TSearchSchema;
    httpSearch: THttpSearchSchema;
    create: TCreateSchema;
    update: TUpdateSchema;
    listItem: TListItemSchema;
    filters: TFiltersSchema;
    entityName: string;
}) {
    const { entityName } = schemas;

    // Core entity types
    const types = {
        // Core entity
        [`${entityName}`]: schemas.entity as TEntitySchema,
        [`${entityName}Core`]: schemas.entity as TEntitySchema,

        // Search types
        [`${entityName}Search`]: schemas.search as TSearchSchema,
        [`${entityName}SearchInput`]: schemas.search as TSearchSchema,
        [`Http${entityName}Search`]: schemas.httpSearch as THttpSearchSchema,
        [`${entityName}Filters`]: schemas.filters as TFiltersSchema,

        // CRUD types
        [`${entityName}Create`]: schemas.create as TCreateSchema,
        [`${entityName}CreateInput`]: schemas.create as TCreateSchema,
        [`${entityName}Update`]: schemas.update as TUpdateSchema,
        [`${entityName}UpdateInput`]: schemas.update as TUpdateSchema,

        // Response types
        [`${entityName}ListItem`]: schemas.listItem as TListItemSchema,
        [`${entityName}Response`]: schemas.entity as TEntitySchema
    };

    return types;
}

/**
 * Type-only export generator (for import type statements)
 */
export function generateTypeExports(entityName: string): string {
    return `
// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Core entity types
export type ${entityName} = z.infer<typeof ${entityName}Schema>;
export type ${entityName}Core = z.infer<typeof ${entityName}Schema>;

// Search types  
export type ${entityName}Search = z.infer<typeof ${entityName}SearchSchema>;
export type ${entityName}SearchInput = z.infer<typeof ${entityName}SearchSchema>;
export type Http${entityName}Search = z.infer<typeof Http${entityName}SearchSchema>;
export type ${entityName}Filters = z.infer<typeof ${entityName}FiltersSchema>;

// CRUD operation types
export type ${entityName}Create = z.infer<typeof ${entityName}CreateSchema>;
export type ${entityName}CreateInput = z.infer<typeof ${entityName}CreateSchema>;
export type ${entityName}Update = z.infer<typeof ${entityName}UpdateSchema>;
export type ${entityName}UpdateInput = z.infer<typeof ${entityName}UpdateSchema>;

// Response types
export type ${entityName}ListItem = z.infer<typeof ${entityName}ListItemSchema>;
export type ${entityName}Response = z.infer<typeof ${entityName}Schema>;
export type ${entityName}ListResponse = z.infer<typeof ${entityName}ListResponseSchema>;
export type ${entityName}SearchResponse = z.infer<typeof ${entityName}SearchResponseSchema>;
`.trim();
}

/**
 * Schema export generator (for schema objects)
 */
export function generateSchemaExports(entityName: string): string {
    return `
// ============================================================================
// SCHEMA EXPORTS
// ============================================================================

// Core schemas
export { ${entityName}Schema };
export { ${entityName}CreateSchema };
export { ${entityName}UpdateSchema };

// Query schemas
export { ${entityName}SearchSchema };
export { ${entityName}FiltersSchema };
export { ${entityName}ListItemSchema };

// HTTP schemas
export { Http${entityName}SearchSchema };

// Response schemas
export { ${entityName}ListResponseSchema };
export { ${entityName}SearchResponseSchema };

// Metadata
export { ${entityName.toUpperCase()}_METADATA };
`.trim();
}

/**
 * Complete index file generator for an entity
 */
export function generateEntityIndex(entityName: string): string {
    const entityNameLower = entityName.toLowerCase();

    return `
/**
 * ${entityName} schemas and types - Complete export index
 * Generated with optimized type exports to reduce boilerplate
 */

// Schema imports
export * from './${entityNameLower}.schema.js';
export * from './${entityNameLower}.crud.schema.js';
export * from './${entityNameLower}.query.schema.js';

// Re-export common types for convenience
export type {
  ${entityName},
  ${entityName}Core,
  ${entityName}Search,
  ${entityName}Create,
  ${entityName}Update,
  ${entityName}ListItem,
  Http${entityName}Search
} from './${entityNameLower}.schema.js';
`.trim();
}

/**
 * Helper to create consistent file headers
 */
export function createSchemaFileHeader(config: {
    entityName: string;
    entityNameLower: string;
    description: string;
    phase: string;
}): string {
    return `
/**
 * ${config.entityName} ${config.description}
 * 
 * This file contains ${config.description.toLowerCase()} following the unified standard:
 * - Pagination: page/pageSize pattern
 * - Sorting: sortBy/sortOrder with 'asc'/'desc' values  
 * - Search: 'q' field for text search
 * - Filters: entity-specific filters (flat pattern)
 * 
 * @phase ${config.phase}
 * @entity ${config.entityNameLower}
 */
`.trim();
}
