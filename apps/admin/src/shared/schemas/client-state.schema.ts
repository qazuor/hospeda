import { z } from 'zod';

/**
 * Client State Extension Schema
 *
 * Common client-side state fields for admin entities.
 * Used for tracking UI state across different entity types.
 *
 * Usage:
 * ```typescript
 * const MyEntitySchema = BaseEntitySchema.extend(ClientStateExtensionSchema.shape);
 * ```
 */
export const ClientStateExtensionSchema = z.object({
    _isDirty: z.boolean().optional(),
    _hasUnsavedChanges: z.boolean().optional(),
    _isNew: z.boolean().optional(),
    _isSelected: z.boolean().optional(),
    _isExpanded: z.boolean().optional()
});

/**
 * Type for client state extension
 */
export type ClientStateExtension = z.infer<typeof ClientStateExtensionSchema>;

/**
 * Helper to add client state to any entity type
 */
export type WithClientState<T> = T & ClientStateExtension;
