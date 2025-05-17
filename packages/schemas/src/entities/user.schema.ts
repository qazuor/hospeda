import { z } from 'zod';
import {
    BaseEntitySchema,
    ContactInfoSchema,
    FullLocationSchema,
    SocialNetworkSchema
} from '../common.schema.js';
import { omittedBaseEntityFieldsForActions } from '../utils/utils.js';
import { BookmarkSchema } from './bookmark.schema.js';
import { UserProfileSchema } from './user/profile.schema.js';
import { UserSettingsSchema } from './user/settings.schema.js';

/**
 * Zod schema for user entity.
 */
export const UserSchema = BaseEntitySchema.extend({
    userName: z
        .string()
        .min(3, 'error:user.userName.min_lenght')
        .max(100, 'error:user.userName.max_lenght')
        .optional(),
    passwordHash: z
        .string()
        .min(3, 'error:user.userName.min_lenght')
        .max(100, 'error:user.userName.max_lenght')
        .optional(),
    firstName: z
        .string()
        .min(3, 'error:user.userName.min_lenght')
        .max(100, 'error:user.userName.max_lenght')
        .optional(),
    lastName: z
        .string()
        .min(3, 'error:user.userName.min_lenght')
        .max(100, 'error:user.userName.max_lenght')
        .optional(),
    brithDate: z.coerce
        .date({ required_error: 'error:user.brithDate.required' })
        .refine(
            (date) => {
                const min = new Date();
                min.setFullYear(min.getFullYear() - 80);
                return date >= min;
            },
            {
                message: 'error:user.brithDate.min_value'
            }
        )
        .refine(
            (date) => {
                const max = new Date();
                max.setFullYear(max.getFullYear() - 18);
                return date <= max;
            },
            {
                message: 'error:user.brithDate.max_value'
            }
        )
        .optional(),
    location: FullLocationSchema.optional(),
    contactInfo: ContactInfoSchema.optional(),
    socialNetworks: SocialNetworkSchema.optional(),
    emailVerified: z
        .boolean({
            required_error: 'error:user.emailVerified.required',
            invalid_type_error: 'error:user.emailVerified.invalid'
        })
        .optional(),
    phoneVerified: z
        .boolean({
            required_error: 'error:user.phoneVerified.required',
            invalid_type_error: 'error:user.phoneVerified.invalid'
        })
        .optional(),
    profile: UserProfileSchema.optional(),
    settings: UserSettingsSchema.optional(),
    bookmarks: z.array(BookmarkSchema).optional(),
    roleId: z.string().uuid({ message: 'error:user.roleId.invalid' }),
    permissionsIds: z
        .array(z.string().uuid({ message: 'error:user.permissionId.invalid' }))
        .optional()
});

export type UserInput = z.infer<typeof UserSchema>;

export const UserCreateSchema = UserSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof UserSchema.shape,
        true
    >
);

export const UserUpdateSchema = UserSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof UserSchema.shape,
        true
    >
).partial();
