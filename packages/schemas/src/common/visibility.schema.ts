import { z } from 'zod';
import { VisibilityEnumSchema } from '../enums/index.js';

/**
 * Base visibility fields
 */
export const BaseVisibilityFields = {
    visibility: VisibilityEnumSchema
} as const;
export type BaseVisibilityFieldsType = typeof BaseVisibilityFields;

/**
 * Visibility Schema - Complete visibility information
 * Can be used as a standalone schema when needed
 */
export const VisibilitySchema = z.object({
    ...BaseVisibilityFields
});
export type VisibilityType = z.infer<typeof VisibilitySchema>;
