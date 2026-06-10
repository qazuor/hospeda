import { z } from 'zod';
import { ModerationCategoryEnum } from './moderation-category.enum.js';

/**
 * Zod schema for moderation category values (SPEC-195).
 * Uses the native enum to ensure type-safe validation.
 */
export const ModerationCategorySchema = z.nativeEnum(ModerationCategoryEnum);

export type ModerationCategoryValue = z.infer<typeof ModerationCategorySchema>;
