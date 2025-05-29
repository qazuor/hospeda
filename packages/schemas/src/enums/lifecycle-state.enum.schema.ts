import { LifecycleStatusEnum } from '@repo/types';
import { z } from 'zod';

export const LifecycleStatusEnumSchema = z.enum(
    Object.values(LifecycleStatusEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.lifecycleStatus.invalid' })
    }
);
