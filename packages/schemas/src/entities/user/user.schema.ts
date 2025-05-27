import { z } from 'zod';
import { ContactInfoSchema } from '../../common/contact.schema';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithSoftDeleteSchema
} from '../../common/helpers.schema';
import { LocationSchema } from '../../common/location.schema';
import { SocialNetworkSchema } from '../../common/social.schema';
import { StrongPasswordRegex } from '../../utils/utils';
import { PermissionSchema } from './permission.schema';
import { RoleSchema } from './role.schema';
import { UserBookmarkSchema } from './user.bookmark.schema';
import { UserExtrasSchema } from './user.extras.schema';
import { UserProfileSchema } from './user.profile.schema';
import { UserSettingsSchema } from './user.settings.schema';

/**
 * User schema definition using Zod for validation.
 * Includes profile, settings, permissions, and role references.
 * Password validation is for user input, not for storage.
 */
export const UserSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithSoftDeleteSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        /** User email, must be valid format */
        email: z.string().email({ message: 'zodError.user.email.invalid' }),
        /** User profile information */
        profile: UserProfileSchema,
        /** User settings, optional */
        settings: UserSettingsSchema.optional(),
        /** List of user bookmarks, optional */
        bookmarks: z.array(UserBookmarkSchema).optional(),
        /** Additional user data, optional */
        extras: UserExtrasSchema.optional(),
        /** Username, 3-50 characters */
        userName: z
            .string()
            .min(3, { message: 'zodError.user.userName.min' })
            .max(50, { message: 'zodError.user.userName.max' }),
        /**
         * User password (input only, not stored as plain text).
         * Must be 8-20 characters, include uppercase, lowercase, number, and special character.
         */
        password: z
            .string()
            .min(8, { message: 'zodError.user.password.min' })
            .max(20, { message: 'zodError.user.password.max' })
            .regex(StrongPasswordRegex, { message: 'zodError.user.password.strong' }),
        /** First name, optional */
        firstName: z
            .string()
            .min(2, { message: 'zodError.user.firstName.min' })
            .max(50, { message: 'zodError.user.firstName.max' })
            .optional(),
        /** Last name, optional */
        lastName: z
            .string()
            .min(2, { message: 'zodError.user.lastName.min' })
            .max(50, { message: 'zodError.user.lastName.max' })
            .optional(),
        /** Birth date as string, optional */
        birthDate: z.string().optional(),
        /** Email verification status, optional */
        emailVerified: z.boolean().optional(),
        /** Phone verification status, optional */
        phoneVerified: z.boolean().optional(),
        /** Contact info, optional */
        contactInfo: ContactInfoSchema.optional(),
        /** User location, optional */
        location: LocationSchema.optional(),
        /** Social networks, optional */
        socialNetworks: SocialNetworkSchema.optional(),
        /** User role (required) */
        role: RoleSchema,
        /** List of permissions, optional */
        permissions: z.array(PermissionSchema).optional()
    });
