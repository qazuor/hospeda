import { LifecycleStatusEnum } from '@repo/types';
import { z } from 'zod';

export const LifecycleStatusEnumSchema = z.nativeEnum(LifecycleStatusEnum, {
    errorMap: () => ({ message: 'zodError.enums.lifecycleStatus.invalid' })
});
