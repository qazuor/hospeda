import { z } from 'zod';
import { SocialSourceEnum } from './social-source.enum.js';

/**
 * Zod schema for {@link SocialSourceEnum} validation.
 * Accepts all 4 content origin source values.
 */
export const SocialSourceEnumSchema = z.nativeEnum(SocialSourceEnum, {
    error: () => ({ message: 'zodError.enums.socialSource.invalid' })
});

/** TypeScript type inferred from {@link SocialSourceEnumSchema}. */
export type SocialSource = z.infer<typeof SocialSourceEnumSchema>;
