import { z } from 'zod';
import { SocialPublishFormatEnum } from './social-publish-format.enum.js';

/**
 * Zod schema for {@link SocialPublishFormatEnum} validation.
 * Accepts all 8 publish format values.
 */
export const SocialPublishFormatEnumSchema = z.nativeEnum(SocialPublishFormatEnum, {
    error: () => ({ message: 'zodError.enums.socialPublishFormat.invalid' })
});

/** TypeScript type inferred from {@link SocialPublishFormatEnumSchema}. */
export type SocialPublishFormat = z.infer<typeof SocialPublishFormatEnumSchema>;
