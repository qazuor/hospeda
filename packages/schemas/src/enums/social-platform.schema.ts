import { z } from 'zod';
import { SocialPlatformEnum } from './social-platform.enum.js';

/**
 * Zod schema for {@link SocialPlatformEnum} validation.
 * Accepts every SocialPlatformEnum value (derived automatically via z.nativeEnum).
 */
export const SocialPlatformEnumSchema = z.nativeEnum(SocialPlatformEnum, {
    error: () => ({ message: 'zodError.enums.socialPlatform.invalid' })
});

/** TypeScript type inferred from {@link SocialPlatformEnumSchema}. */
export type SocialPlatform = z.infer<typeof SocialPlatformEnumSchema>;
