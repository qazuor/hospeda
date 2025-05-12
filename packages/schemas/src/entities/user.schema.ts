import type { UserType } from '@repo/types';
import { z } from 'zod';

import {
    BaseEntitySchema,
    ContactInfoSchema,
    MediaSchema,
    SeoSchema,
    SocialNetworkSchema
} from '../common.schema';

/**
 * Zod schema for full user entity.
 */
export const UserSchema: z.ZodType<UserType> = BaseEntitySchema.extend({
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
        .optional()
});
