import { z } from 'zod';
import { LifecycleStatusEnumSchema } from '../enums/index.js';

/**
 * Base lifecycle state fields
 */
export const BaseLifecycleFields = {
    lifecycleState: LifecycleStatusEnumSchema
} as const;

/**
 * Lifecycle Schema - Complete lifecycle information
 * Can be used as a standalone schema when needed
 */
export const LifecycleSchema = z.object({
    ...BaseLifecycleFields
});

/**
 * Type exports for lifecycle schemas
 */
export type BaseLifecycleFieldsType = typeof BaseLifecycleFields;
export type Lifecycle = z.infer<typeof LifecycleSchema>;
