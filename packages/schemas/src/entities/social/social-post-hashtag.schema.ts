import { z } from 'zod';

/**
 * SocialPostHashtag entity schema.
 * Join table linking social posts to individual hashtag catalog entries.
 * `position` controls the render order in the final hashtag block.
 * Composite UNIQUE (social_post_id, hashtag_id) prevents duplicate links.
 *
 * No soft-delete and no audit FKs by design — managed via cascade
 * from the parent social post.
 */
export const SocialPostHashtagSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialPostHashtag.id.uuid' }),
    socialPostId: z.string().uuid({ message: 'zodError.socialPostHashtag.socialPostId.uuid' }),
    hashtagId: z.string().uuid({ message: 'zodError.socialPostHashtag.hashtagId.uuid' }),
    /** 0-indexed position in the final hashtag block */
    position: z.number().int().min(0).default(0),
    createdAt: z.coerce.date({ message: 'zodError.common.createdAt.required' }),
    updatedAt: z.coerce.date({ message: 'zodError.common.updatedAt.required' })
});

/** TypeScript type inferred from {@link SocialPostHashtagSchema}. */
export type SocialPostHashtag = z.infer<typeof SocialPostHashtagSchema>;
