import { z } from 'zod';

/**
 * User Profile schema definition using Zod for validation.
 * Represents the profile information for a user.
 *
 * This is the WRITE/entity schema: `UserCreateInputSchema`/`UserUpdateInputSchema`
 * derive from `UserSchema` (which embeds this), so these bounds gate what the
 * admin user-edit form and `PUT/PATCH /api/v1/admin|protected/users/:id` persist.
 * They MUST stay strict. The read⊇write relaxation for the profile RESPONSE
 * lives in the access overlays instead (`UserProfileReadSchema` in
 * `user.access.schema.ts`), mirroring the accommodation access-schema pattern —
 * so a legacy value never 500s a GET while writes stay validated (HOS-190).
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
