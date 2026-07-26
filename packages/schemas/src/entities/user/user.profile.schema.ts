import { z } from 'zod';

/**
 * User Profile schema definition using Zod for validation.
 * Represents the profile information for a user.
 *
 * This is the WRITE/entity schema: `UserCreateInputSchema`/`UserUpdateInputSchema`
 * derive from `UserSchema` (which embeds this), so these bounds gate what the
 * admin user-edit form and `PUT/PATCH /api/v1/admin|protected/users/:id` persist.
 * They MUST stay strict. The read⊇write relaxation for the profile RESPONSE
 * lives in {@link UserProfileReadSchema} instead, mirroring the accommodation
 * access-schema pattern — so a legacy value never 500s a GET while writes stay
 * validated (HOS-190).
 */
export const UserProfileSchema = z.object({
    avatar: z.string().url({ message: 'zodError.user.profile.avatar.url' }).optional(),
    bio: z
        .string()
        .min(10, { message: 'zodError.user.profile.bio.min' })
        .max(300, { message: 'zodError.user.profile.bio.max' })
        .optional(),
    website: z.string().url({ message: 'zodError.user.profile.website.url' }).optional(),
    occupation: z
        .string()
        .min(2, { message: 'zodError.user.profile.occupation.min' })
        .max(100, { message: 'zodError.user.profile.occupation.max' })
        .optional()
});

/**
 * Type export for User Profile
 */
export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Lenient READ overlay for the user `profile` JSONB column (HOS-190, HOS-302).
 *
 * Drops the `bio`/`occupation` length bounds; keeps `avatar`/`website` as URLs
 * (read == write there). `users.profile` is an unbounded JSONB column, so a
 * legacy/imported row can legitimately hold a 5-character bio that today's WRITE
 * bounds reject. Every read path that surfaces it — the self/admin access family
 * AND the query family the admin entity-list client re-parses with a fail-closed
 * `safeParse` — must use this shape, or one stored row takes the surface down.
 *
 * Lives next to {@link UserProfileSchema} (the WRITE shape) as the SINGLE
 * definition, mirroring `ContactInfoReadSchema` in `common/contact.schema.ts`.
 * It was module-private inside `user.access.schema.ts` until HOS-302, which is
 * how the query family ended up with a second, stricter idea of "lenient user".
 */
export const UserProfileReadSchema = z.object({
    avatar: z.string().url({ message: 'zodError.user.profile.avatar.url' }).optional(),
    bio: z.string().optional(),
    website: z.string().url({ message: 'zodError.user.profile.website.url' }).optional(),
    occupation: z.string().optional()
});

/**
 * Type export for the lenient READ variant of User Profile
 */
export type UserProfileRead = z.infer<typeof UserProfileReadSchema>;
