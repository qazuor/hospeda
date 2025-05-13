import { z } from 'zod';

/**
 * Zod schema for user profile.
 */
export const UserProfileSchema = z.object({
    // TODO: ver como mejorar esto. usamos Url o un image upload?
    avatar: z.string().min(1, 'error:user.profile.avatar.min_lenght').optional(),
    bio: z
        .string()
        .min(10, 'error:user.profile.bio.min_lenght')
        .max(400, 'error:user.profile.bio.max_lenght')
        .optional(),
    website: z
        .string()
        .url('error:user.profile.website.url_invalid')
        .min(10, 'error:user.profile.website.min_lenght')
        .max(100, 'error:user.profile.website.max_lenght')
        .optional(),
    occupation: z
        .string()
        .min(3, 'error:user.profile.occupation.min_lenght')
        .max(100, 'error:user.profile.occupation.max_lenght')
        .optional()
});

export type UserProfileInput = z.infer<typeof UserProfileSchema>;
