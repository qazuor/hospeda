import { ModerationStatusEnum } from '@repo/types';
import { z } from 'zod';

export const ModerationStatusEnumSchema = z.enum(
    Object.values(ModerationStatusEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.moderationStatus.invalid' })
    }
);
