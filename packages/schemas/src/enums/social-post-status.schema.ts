import { z } from 'zod';
import { SocialPostStatusEnum } from './social-post-status.enum.js';

/**
 * Zod schema for {@link SocialPostStatusEnum} validation.
 * Accepts all 10 social post lifecycle status values.
 */
export const SocialPostStatusEnumSchema = z.nativeEnum(SocialPostStatusEnum, {
    error: () => ({ message: 'zodError.enums.socialPostStatus.invalid' })
});

/** TypeScript type inferred from {@link SocialPostStatusEnumSchema}. */
export type SocialPostStatus = z.infer<typeof SocialPostStatusEnumSchema>;
