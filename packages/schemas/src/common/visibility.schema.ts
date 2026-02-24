import { z } from 'zod';
import { VisibilityEnum } from '../enums/index.js';
import { VisibilityEnumSchema } from '../enums/index.js';

/**
 * Base visibility fields
 */
export const BaseVisibilityFields = {
    visibility: VisibilityEnumSchema.default(VisibilityEnum.PUBLIC)
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
