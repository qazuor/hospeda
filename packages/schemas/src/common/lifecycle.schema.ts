import { z } from 'zod';
import { LifecycleStatusEnum, LifecycleStatusEnumSchema } from '../enums/index.js';

/**
 * Base lifecycle state fields
 */
export const BaseLifecycleFields = {
    lifecycleState: LifecycleStatusEnumSchema.default(LifecycleStatusEnum.ACTIVE)
} as const;
export type BaseLifecycleFieldsType = typeof BaseLifecycleFields;

/**
 * Lifecycle Schema - Complete lifecycle information
 * Can be used as a standalone schema when needed
 */
export const LifecycleSchema = z.object({
    ...BaseLifecycleFields
});
export type LifecycleType = z.infer<typeof LifecycleSchema>;
