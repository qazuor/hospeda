import { z } from 'zod';
import { SocialPublishResultStatusEnum } from './social-publish-result-status.enum.js';

/**
 * Zod schema for {@link SocialPublishResultStatusEnum} validation.
 * Accepts all 4 publish result status values.
 */
export const SocialPublishResultStatusEnumSchema = z.nativeEnum(SocialPublishResultStatusEnum, {
    error: () => ({ message: 'zodError.enums.socialPublishResultStatus.invalid' })
});

/** TypeScript type inferred from {@link SocialPublishResultStatusEnumSchema}. */
export type SocialPublishResultStatus = z.infer<typeof SocialPublishResultStatusEnumSchema>;
