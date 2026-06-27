import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

/**
 * SocialHashtag entity schema.
 * Individual normalized hashtag catalog entries.
 * `normalizedHashtag` is the UNIQUE key (lowercase, # prefix).
 * Supports soft-delete and full audit FKs.
 */
export const SocialHashtagSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialHashtag.id.uuid' }),
    /** Raw hashtag as entered, e.g. "#Playa" */
    hashtag: z.string().min(1, { message: 'zodError.socialHashtag.hashtag.required' }),
    /** Normalized form — always lowercase with # prefix, e.g. "#playa" */
    normalizedHashtag: z
        .string()
        .min(1, { message: 'zodError.socialHashtag.normalizedHashtag.required' }),
    /** Category label for grouping (e.g. "nature", "travel", "gastronomy") */
    category: z.string().min(1, { message: 'zodError.socialHashtag.category.required' }),
    /** Optional platform restriction — null means applies to all platforms */
    platform: SocialPlatformEnumSchema.nullable().optional(),
    /** Optional audience association */
    audienceId: z
        .string()
        .uuid({ message: 'zodError.socialHashtag.audienceId.uuid' })
        .nullable()
        .optional(),
    priority: z.number().int().default(0),
    active: z.boolean().default(true),
    notes: z.string().nullable().optional(),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialHashtagSchema}. */
export type SocialHashtag = z.infer<typeof SocialHashtagSchema>;
