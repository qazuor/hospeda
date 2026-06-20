import { z } from 'zod';
import { SocialAssetSourceEnum } from './social-asset-source.enum.js';

/**
 * Zod schema for {@link SocialAssetSourceEnum} validation.
 * Accepts all 4 asset origin source values.
 */
export const SocialAssetSourceEnumSchema = z.nativeEnum(SocialAssetSourceEnum, {
    error: () => ({ message: 'zodError.enums.socialAssetSource.invalid' })
});

/** TypeScript type inferred from {@link SocialAssetSourceEnumSchema}. */
export type SocialAssetSource = z.infer<typeof SocialAssetSourceEnumSchema>;
