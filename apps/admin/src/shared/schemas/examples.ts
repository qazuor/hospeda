/**
 * Shared Admin Schemas - Usage Examples
 *
 * This file demonstrates how to use the shared schemas across different entities
 * in the admin application for consistency and maintainability.
 */

import { z } from 'zod';
import {
    AdminStatusExtensionSchema,
    ClientStateExtensionSchema,
    DestinationExtensionSchema,
    FullAdminExtensionSchema,
    OwnerExtensionSchema
} from './index';

/**
 * Example 1: Entity with Client State
 *
 * Use when you need to track UI state (dirty, new, selected, etc.)
 */
const ExampleEntityWithClientState = z
    .object({
        id: z.string(),
        name: z.string()
    })
    .extend(ClientStateExtensionSchema.shape);

/**
 * Example 2: Entity with Relations
 *
 * Use when entity needs expanded relation information for admin display
 */
const ExampleEntityWithRelations = z
    .object({
        id: z.string(),
        name: z.string()
    })
    .extend(DestinationExtensionSchema.shape) // Adds expanded destination
    .extend(OwnerExtensionSchema.shape); // Adds expanded owner

/**
 * Example 3: Entity with Admin Extensions
 *
 * Use when entity needs admin-specific management fields
 */
const ExampleEntityWithAdminFields = z
    .object({
        id: z.string(),
        name: z.string()
    })
    .extend(AdminStatusExtensionSchema.shape);

/**
 * Example 4: Full Admin Entity
 *
 * Use when entity needs all admin capabilities
 */
const ExampleFullAdminEntity = z
    .object({
        id: z.string(),
        name: z.string()
    })
    .extend(ClientStateExtensionSchema.shape) // UI state
    .extend(DestinationExtensionSchema.shape) // Relations
    .extend(FullAdminExtensionSchema.shape); // Admin management

/**
 * Usage Pattern for Migration
 *
 * Before (manual extension):
 * ```typescript
 * export const EntitySchema = BaseEntitySchema.extend({
 *     destination: z.object({
 *         id: z.string(),
 *         name: z.string(),
 *         slug: z.string()
 *     }).nullable().optional(),
 *     isActive: z.boolean().optional(),
 *     _isDirty: z.boolean().optional()
 * });
 * ```
 *
 * After (using shared schemas):
 * ```typescript
 * export const EntitySchema = BaseEntitySchema
 *     .extend(DestinationExtensionSchema.shape)
 *     .extend(AdminStatusExtensionSchema.shape)
 *     .extend(ClientStateExtensionSchema.shape);
 * ```
 */

// Export examples for documentation purposes
export {
    ExampleEntityWithAdminFields,
    ExampleEntityWithClientState,
    ExampleEntityWithRelations,
    ExampleFullAdminEntity
};
