import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

/**
 * SocialHashtagSet entity schema.
 * Named collections of hashtags used as base sets for posts.
 * Supports soft-delete and full audit FKs.
 */
export const SocialHashtagSetSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialHashtagSet.id.uuid' }),
    name: z.string().min(1, { message: 'zodError.socialHashtagSet.name.required' }),
    slug: z.string().min(1, { message: 'zodError.socialHashtagSet.slug.required' }),
    /** Optional platform restriction — null means applies to all platforms */
    platform: SocialPlatformEnumSchema.optional(),
    /** Space-separated hashtag string, e.g. "#playa #verano #hospeda" */
    hashtagsText: z.string().min(1, { message: 'zodError.socialHashtagSet.hashtagsText.required' }),
    priority: z.number().int().default(0),
    active: z.boolean().default(true),
    notes: z.string().optional(),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialHashtagSetSchema}. */
export type SocialHashtagSet = z.infer<typeof SocialHashtagSetSchema>;
