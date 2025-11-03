/**
 * Entity Schema Template
 *
 * This template provides the standardized foundation for all entity schemas
 * following the base-first inheritance pattern established in Phase 0 analysis.
 *
 * Template Usage:
 * 1. Copy this template to your entity directory
 * 2. Replace 'Entity' with your actual entity name (e.g., 'Accommodation', 'User')
 * 3. Define entity-specific fields in EntitySpecificSchema
 * 4. Update search schema with entity-specific search filters
 * 5. Add OpenAPI metadata using openapi.utils.ts helpers
 *
 * Migration Pattern Validation:
 * - ✅ Uses BaseAuditSchema for consistent auditing
 * - ✅ Extends BaseSearchSchema for pagination/sorting
 * - ✅ Follows .js import extension pattern
 * - ✅ Uses zodError.* error key standard
 * - ✅ Supports OpenAPI metadata framework
 * - ✅ Provides create/update/search variations
 */

import { z } from 'zod';
import { BaseAuditSchema, BaseSearchSchema, UuidSchema } from '../common/base.schema.js';
import type { OpenApiSchemaMetadata } from '../utils/openapi.utils.js';
import { applyOpenApiMetadata } from '../utils/openapi.utils.js';

/**
 * Entity-specific fields schema
 * Replace this with your actual entity fields
 *
 * Example for Accommodation:
 * export const AccommodationSpecificSchema = z.object({
 *   name: z.string().min(1, { message: 'zodError.required' }),
 *   description: z.string().optional(),
 *   address: z.string().min(1, { message: 'zodError.required' }),
 *   maxGuests: z.number().int().positive({ message: 'zodError.positive' }),
 *   pricePerNight: z.number().positive({ message: 'zodError.positive' }),
 * });
 */
export const EntitySpecificSchema = z.object({
    // TODO: Replace with actual entity fields
    name: z.string().min(1, { message: 'zodError.required' }).describe('Entity name'),
    description: z.string().optional().describe('Optional entity description')
});

/**
 * Complete entity schema with audit fields
 * This represents the full entity as stored in database
 */
export const EntitySchema = BaseAuditSchema.extend({
    ...EntitySpecificSchema.shape
}).describe('Complete entity with audit fields');

/**
 * Entity creation schema
 * Excludes audit fields that are auto-generated
 */
export const CreateEntitySchema = EntitySpecificSchema.describe('Entity creation data');

/**
 * Entity update schema
 * All fields optional for partial updates
 */
export const UpdateEntitySchema = EntitySpecificSchema.partial().describe('Entity update data');

/**
 * Entity search schema
 * Extends BaseSearchSchema with entity-specific filters
 *
 * Migration Note: This replaces nested filter patterns like:
 * filters: z.object({ status: z.string() }).optional()
 *
 * With flat structure:
 * status: z.string().optional()
 */
export const SearchEntitySchema = BaseSearchSchema.extend({
    // Entity-specific search filters (flat structure)
    name: z.string().optional().describe('Filter by entity name (partial match)')
    // TODO: Add more entity-specific search filters here
    // status: z.string().optional().describe('Filter by status'),
    // category: z.string().optional().describe('Filter by category'),
}).describe('Entity search parameters with filters');

/**
 * Entity ID parameter schema
 * Used for path parameters in REST endpoints
 */
export const EntityIdSchema = z.object({
    id: UuidSchema.describe('Entity ID')
});

// Type exports for TypeScript consumption
export type Entity = z.infer<typeof EntitySchema>;
export type CreateEntity = z.infer<typeof CreateEntitySchema>;
export type UpdateEntity = z.infer<typeof UpdateEntitySchema>;
export type SearchEntity = z.infer<typeof SearchEntitySchema>;
export type EntityId = z.infer<typeof EntityIdSchema>;

/**
 * OpenAPI metadata for the entity schemas
 * Provides comprehensive documentation for API generation
 */
const entityMetadata: OpenApiSchemaMetadata = {
    ref: 'Entity',
    title: 'Entity',
    description: 'Complete entity with audit fields',
    example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Sample Entity',
        description: 'This is a sample entity',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        deletedAt: null
    },
    fields: {
        id: {
            description: 'Unique identifier in UUID v4 format',
            example: '123e4567-e89b-12d3-a456-426614174000',
            format: 'uuid'
        },
        name: {
            description: 'Entity name',
            example: 'Sample Entity',
            minLength: 1
        },
        description: {
            description: 'Optional entity description',
            example: 'This is a sample entity'
        },
        createdAt: {
            description: 'Timestamp when the entity was created',
            example: '2024-01-01T00:00:00.000Z',
            format: 'date-time'
        },
        updatedAt: {
            description: 'Timestamp when the entity was last updated',
            example: '2024-01-01T00:00:00.000Z',
            format: 'date-time'
        },
        deletedAt: {
            description: 'Timestamp when the entity was soft deleted (null if not deleted)',
            example: null,
            format: 'date-time',
            nullable: true
        }
    }
};

const createEntityMetadata: OpenApiSchemaMetadata = {
    ref: 'CreateEntity',
    title: 'Create Entity',
    description: 'Data required to create a new entity',
    example: {
        name: 'New Entity',
        description: 'Description for the new entity'
    },
    fields: {
        name: {
            description: 'Entity name',
            example: 'New Entity',
            minLength: 1
        },
        description: {
            description: 'Optional entity description',
            example: 'Description for the new entity'
        }
    }
};

const updateEntityMetadata: OpenApiSchemaMetadata = {
    ref: 'UpdateEntity',
    title: 'Update Entity',
    description: 'Data for updating an existing entity',
    example: {
        name: 'Updated Entity Name',
        description: 'Updated description'
    },
    fields: {
        name: {
            description: 'Entity name',
            example: 'Updated Entity Name',
            minLength: 1
        },
        description: {
            description: 'Optional entity description',
            example: 'Updated description'
        }
    }
};

const searchEntityMetadata: OpenApiSchemaMetadata = {
    ref: 'SearchEntity',
    title: 'Search Entities',
    description: 'Parameters for searching and filtering entities',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'name',
        sortDirection: 'asc',
        q: 'search term',
        name: 'filter by name'
    },
    fields: {
        page: {
            description: 'Page number for pagination',
            example: 1,
            minimum: 1
        },
        pageSize: {
            description: 'Number of items per page',
            example: 20,
            minimum: 1,
            maximum: 100
        },
        sortBy: {
            description: 'Field to sort by',
            example: 'name'
        },
        sortDirection: {
            description: 'Sort direction',
            example: 'asc',
            enum: ['asc', 'desc']
        },
        q: {
            description: 'General search term',
            example: 'search term'
        },
        name: {
            description: 'Filter by entity name (partial match)',
            example: 'filter by name'
        }
    }
};

export const EntityOpenApiMetadata = {
    Entity: entityMetadata,
    CreateEntity: createEntityMetadata,
    UpdateEntity: updateEntityMetadata,
    SearchEntity: searchEntityMetadata
} as const;

// Apply OpenAPI metadata to schemas
applyOpenApiMetadata(EntitySchema, EntityOpenApiMetadata.Entity);
applyOpenApiMetadata(CreateEntitySchema, EntityOpenApiMetadata.CreateEntity);
applyOpenApiMetadata(UpdateEntitySchema, EntityOpenApiMetadata.UpdateEntity);
applyOpenApiMetadata(SearchEntitySchema, EntityOpenApiMetadata.SearchEntity);

/**
 * Schema validation utilities
 * These provide compile-time verification that schemas follow expected patterns
 *
 * Based on Phase 0 analysis findings:
 * - Ensures audit fields are present in main schema
 * - Validates search schema extends BaseSearchSchema
 * - Confirms create schema excludes audit fields
 * - Verifies all required patterns are implemented
 */

// Compile-time validation that Entity schema includes audit fields
type EntityHasAuditFields = Entity extends {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}
    ? true
    : false;

// Compile-time validation that Create schema excludes audit fields
type CreateEntityExcludesAudit = 'id' extends keyof CreateEntity
    ? false
    : 'createdAt' extends keyof CreateEntity
      ? false
      : 'updatedAt' extends keyof CreateEntity
        ? false
        : 'deletedAt' extends keyof CreateEntity
          ? false
          : true;

// Compile-time validation that Search schema has pagination
type SearchEntityHasPagination = SearchEntity extends {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: string;
}
    ? true
    : false;

// Export validation types for template verification
export type EntityTemplateValidation = {
    hasAuditFields: EntityHasAuditFields;
    createExcludesAudit: CreateEntityExcludesAudit;
    searchHasPagination: SearchEntityHasPagination;
};

// Compile-time assertions - will cause TypeScript errors if validation fails
const _templateValidation: EntityTemplateValidation = {
    hasAuditFields: true as EntityHasAuditFields,
    createExcludesAudit: true as CreateEntityExcludesAudit,
    searchHasPagination: true as SearchEntityHasPagination
};

// Suppress unused variable warning for validation
void _templateValidation;
