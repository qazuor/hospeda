import { z } from 'zod';
import { ModerationStatusEnumSchema } from '../enums/index.js';

/**
 * Base moderation fields
 */
export const BaseModerationFields = {
    moderationState: ModerationStatusEnumSchema
} as const;

/**
 * Moderation Schema - Complete moderation information
 * Can be used as a standalone schema when needed
 */
export const ModerationSchema = z.object({
    ...BaseModerationFields
});

/**
 * Type exports for moderation schemas
 */
export type BaseModerationFieldsType = typeof BaseModerationFields;
export type Moderation = z.infer<typeof ModerationSchema>;
