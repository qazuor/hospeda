import { z } from 'zod';
import { ModerationStatusEnum } from './moderation-status.enum.js';

export const ModerationStatusEnumSchema = z.nativeEnum(ModerationStatusEnum, {
    error: () => ({ message: 'zodError.enums.moderationStatus.invalid' })
});
export type ModerationStatusSchema = z.infer<typeof ModerationStatusEnumSchema>;
