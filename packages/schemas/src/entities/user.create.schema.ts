import type { UserType } from '@repo/types';
import { z } from 'zod';

import { ContactInfoSchema, MediaSchema, SeoSchema, SocialNetworkSchema } from '../common.schema';

/**
 * Zod schema for creating a user.
 */
export const UserCreateSchema: z.ZodType<
    Omit<
        UserType,
        | 'id'
        | 'createdAt'
        | 'createdById'
        | 'updatedAt'
        | 'updatedById'
        | 'deletedAt'
        | 'deletedById'
    >
> = z.object({
    name: z.string({ required_error: 'error:user.nameRequired' }),
    displayName: z.string({ required_error: 'error:user.displayNameRequired' }),

    contactInfo: ContactInfoSchema.optional(),
    social: SocialNetworkSchema.optional(),
    media: MediaSchema.optional(),
    seo: SeoSchema.optional(),

    isVerified: z.boolean().optional(),
    isBanned: z.boolean().optional(),
    banReason: z.string().optional(),
    lastLoginAt: z.coerce.date().optional(),

    roleId: z.string().uuid({ message: 'error:user.roleIdInvalid' }),
    permissionIds: z
        .array(z.string().uuid({ message: 'error:user.permissionIdInvalid' }))
        .optional(),

    state: z.nativeEnum(VisibilityEnum, {
        required_error: 'error:user.stateRequired',
        invalid_type_error: 'error:user.stateInvalid'
    })
});
