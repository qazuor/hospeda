import { z } from 'zod';

/**
 * SocialPostMedia entity schema.
 * Join table linking social posts to their Cloudinary-hosted assets.
 * `position` determines the display/carousel order (0-indexed).
 *
 * No soft-delete and no audit FKs by design — managed via cascade
 * from the parent social post.
 */
export const SocialPostMediaSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialPostMedia.id.uuid' }),
    socialPostId: z.string().uuid({ message: 'zodError.socialPostMedia.socialPostId.uuid' }),
    assetId: z.string().uuid({ message: 'zodError.socialPostMedia.assetId.uuid' }),
    /** 0-indexed display order within the post (carousel position) */
    position: z.number().int().min(0).default(0),
    createdAt: z.coerce.date({ message: 'zodError.common.createdAt.required' }),
    updatedAt: z.coerce.date({ message: 'zodError.common.updatedAt.required' })
});

/** TypeScript type inferred from {@link SocialPostMediaSchema}. */
export type SocialPostMedia = z.infer<typeof SocialPostMediaSchema>;
