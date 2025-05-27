import { z } from 'zod';

/**
 * User Profile schema definition using Zod for validation.
 * Represents the profile information for a user.
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
