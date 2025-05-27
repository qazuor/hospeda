import { z } from 'zod';
import { ContactInfoSchema } from '../../common/contact.schema';
import { LocationSchema } from '../../common/location.schema';
import { SocialNetworkSchema } from '../../common/social.schema';
import { PermissionSchema } from './permission.schema';
import { RoleSchema } from './role.schema';
import { UserBookmarkSchema } from './user.bookmark.schema';
import { UserProfileSchema } from './user.profile.schema';
import { UserSettingsSchema } from './user.settings.schema';

/**
 * User Extras schema definition using Zod for validation.
 * Represents additional information for a user.
 */

export const UserProfileSummarySchema = z.object({
    id: z.string(),
    userName: z
        .string()
        .min(3, { message: 'zodError.user.userName.min' })
        .max(50, { message: 'zodError.user.userName.max' }),
    firstName: z
        .string()
        .min(2, { message: 'zodError.user.firstName.min' })
        .max(50, { message: 'zodError.user.firstName.max' })
        .optional(),
    lastName: z
        .string()
        .min(2, { message: 'zodError.user.lastName.min' })
        .max(50, { message: 'zodError.user.lastName.max' })
        .optional(),
    profile: UserProfileSchema.optional(),
    socialNetworks: SocialNetworkSchema.optional()
});

export const UserWithAccessSchema = z.object({
    id: z.string(),
    userName: z
        .string()
        .min(3, { message: 'zodError.user.userName.min' })
        .max(50, { message: 'zodError.user.userName.max' }),
    passwordHash: z
        .string()
        .min(8, { message: 'zodError.user.passwordHash.min' })
        .max(100, { message: 'zodError.user.passwordHash.max' }),
    firstName: z
        .string()
        .min(2, { message: 'zodError.user.firstName.min' })
        .max(50, { message: 'zodError.user.firstName.max' })
        .optional(),
    lastName: z
        .string()
        .min(2, { message: 'zodError.user.lastName.min' })
        .max(50, { message: 'zodError.user.lastName.max' })
        .optional(),
    brithDate: z.string().optional(),
    emailVerified: z.boolean().optional(),
    phoneVerified: z.boolean().optional(),
    contactInfo: ContactInfoSchema.optional(),
    location: LocationSchema.optional(),
    socialNetworks: SocialNetworkSchema.optional(),
    role: RoleSchema.optional(),
    permissions: z.array(PermissionSchema).optional(),
    bookmarks: z.array(UserBookmarkSchema).optional(),
    profile: UserProfileSchema.optional(),
    settings: UserSettingsSchema.optional()
});
