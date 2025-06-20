import { ModerationStatusEnum } from '@repo/types';
import { z } from 'zod';

export const ModerationStatusEnumSchema = z.nativeEnum(ModerationStatusEnum, {
    errorMap: () => ({ message: 'zodError.enums.moderationStatus.invalid' })
});
