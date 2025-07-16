import { BaseSearchSchema } from '@repo/schemas/common/search.schemas';
import { PostSponsorSchema } from '@repo/schemas/entities/post/post.sponsor.schema';
import { ClientTypeEnumSchema } from '@repo/schemas/enums';
import { z } from 'zod';

/**
 * Schema for creating a new PostSponsor. Omits audit/id/lifecycle fields.
 */
export const CreatePostSponsorSchema = PostSponsorSchema.omit({
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
export type CreatePostSponsorInput = z.infer<typeof CreatePostSponsorSchema>;

/**
 * Schema for updating a PostSponsor. All fields optional.
 */
export const UpdatePostSponsorSchema = CreatePostSponsorSchema.partial();
export type UpdatePostSponsorInput = z.infer<typeof UpdatePostSponsorSchema>;

/**
 * Schema for searching PostSponsors. Permite filtrar por nombre, tipo, etc.
 */
export const SearchPostSponsorSchema = BaseSearchSchema.extend({
    filters: z
        .object({
            name: z.string().min(1).optional(),
            type: ClientTypeEnumSchema.optional(),
            q: z.string().optional() // texto libre
        })
        .optional()
});
export type SearchPostSponsorInput = z.infer<typeof SearchPostSponsorSchema>;
