import { ModerationStatusEnum } from '@repo/types';
import { z } from 'zod';

export const ModerationStatusEnumSchema = z.nativeEnum(ModerationStatusEnum, {
    error: () => ({ message: 'zodError.enums.moderationStatus.invalid' })
});
