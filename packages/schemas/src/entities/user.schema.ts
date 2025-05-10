import { z } from 'zod';
import {
    AdminInfoSchema,
    BaseEntitySchema,
    ContactInfoSchema,
    LocationSchema,
    SocialNetworkSchema
} from '../common.schema';
import { RoleTypeEnumSchema, StateEnumSchema } from '../enums.schema';

/**
 * Public user profile data.
 */
export const UserProfileSchema = z.object({
    avatar: z.string().url({
        message: 'error:user.avatarInvalid'
    }),
    bio: z.string().optional(),
    website: z.string().url().optional(),
    occupation: z.string().optional()
});

/**
 * Personal account settings and preferences.
 */
export const UserSettingsSchema = z.object({
    darkMode: z.boolean().optional(),
    language: z.string().length(2).optional(), // e.g. "en", "es"
    notificationsEnabled: z.boolean(),
    allowEmails: z.boolean(),
    allowSms: z.boolean(),
    allowPush: z.boolean()
});

/**
 * Represents a permission (can be expanded later).
 */
export const PermissionSchema = z.object({
    id: z.string().uuid()
});

/**
 * Represents a role reference (can be tied to permissions).
 */
export const RoleSchema = z.object({
    id: z.string().uuid()
});

/**
 * Full user account schema.
 */
export const UserSchema = BaseEntitySchema.extend({
    userName: z.string().min(1, {
        message: 'error:user.userNameRequired'
    }),

    passwordHash: z.string().min(60, {
        message: 'error:user.passwordHashRequired'
    }),

    displayName: z.string().min(1, {
        message: 'error:user.displayNameRequired'
    }),

    firstName: z.string().min(1),
    lastName: z.string().min(1),

    brithDate: z.date(),

    location: LocationSchema,
    contactInfo: ContactInfoSchema,
    socialNetworks: SocialNetworkSchema,

    role: RoleTypeEnumSchema,
    state: StateEnumSchema,

    emailVerified: z.boolean(),
    phoneVerified: z.boolean(),

    profile: UserProfileSchema.optional(),
    settings: UserSettingsSchema.optional(),

    bookmarks: z.array(z.string().uuid()).optional(),

    adminInfo: AdminInfoSchema.optional()
});
