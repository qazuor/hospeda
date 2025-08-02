import { BaseSearchSchema, PostSponsorshipSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for creating a new PostSponsorship. Omits audit/id/lifecycle fields.
 */
export const CreatePostSponsorshipSchema = PostSponsorshipSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true,
    lifecycleState: true
});

/**
 * Schema for updating a PostSponsorship. All fields optional.
 */
export const UpdatePostSponsorshipSchema = CreatePostSponsorshipSchema.partial();

/**
 * Schema for searching PostSponsorships. Filters by sponsorId, postId, date range, etc.
 */
export const SearchPostSponsorshipSchema = BaseSearchSchema.extend({
    sponsorId: z.string().uuid().optional(),
    postId: z.string().uuid().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    isHighlighted: z.boolean().optional()
});

export type CreatePostSponsorshipInput = z.infer<typeof CreatePostSponsorshipSchema>;
export type UpdatePostSponsorshipInput = z.infer<typeof UpdatePostSponsorshipSchema>;
export type SearchPostSponsorshipInput = z.infer<typeof SearchPostSponsorshipSchema>;
