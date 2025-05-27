import { LifecycleStateEnum } from '@repo/types/src/enums/lifecycle-state.enum';
import { z } from 'zod';

export const LifecycleStateEnumSchema = z.enum(
    Object.values(LifecycleStateEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.lifecycleState.invalid' })
    }
);
