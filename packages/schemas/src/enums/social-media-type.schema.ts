import { z } from 'zod';
import { SocialMediaTypeEnum } from './social-media-type.enum.js';

/**
 * Zod schema for {@link SocialMediaTypeEnum} validation.
 * Accepts all 3 media type values.
 */
export const SocialMediaTypeEnumSchema = z.nativeEnum(SocialMediaTypeEnum, {
    error: () => ({ message: 'zodError.enums.socialMediaType.invalid' })
});

/** TypeScript type inferred from {@link SocialMediaTypeEnumSchema}. */
export type SocialMediaType = z.infer<typeof SocialMediaTypeEnumSchema>;
