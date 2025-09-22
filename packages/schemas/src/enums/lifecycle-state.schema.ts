import { z } from 'zod';
import { LifecycleStatusEnum } from './lifecycle-state.enum.js';

export const LifecycleStatusEnumSchema = z.nativeEnum(LifecycleStatusEnum, {
    error: () => ({ message: 'zodError.enums.lifecycleStatus.invalid' })
});
export type LifecycleStatusSchema = z.infer<typeof LifecycleStatusEnumSchema>;
