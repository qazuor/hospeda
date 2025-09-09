import { z } from 'zod';
import { VisibilityEnumSchema } from '../enums/index.js';

/**
 * Base visibility fields
 */
export const BaseVisibilityFields = {
    visibility: VisibilityEnumSchema
} as const;

/**
 * Visibility Schema - Complete visibility information
 * Can be used as a standalone schema when needed
 */
export const VisibilitySchema = z.object({
    ...BaseVisibilityFields
});

/**
 * Type exports for visibility schemas
 */
export type BaseVisibilityFieldsType = typeof BaseVisibilityFields;
export type Visibility = z.infer<typeof VisibilitySchema>;
