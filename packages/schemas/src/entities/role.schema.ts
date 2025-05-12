import type { RoleType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema } from '../common.schema';

/**
 * Zod schema for user role entity.
 */
export const RoleSchema: z.ZodType<RoleType> = BaseEntitySchema.extend({
    description: z.string({ required_error: 'error:role.descriptionRequired' }),
    isBuiltin: z.boolean({ required_error: 'error:role.isBuiltinRequired' }),
    permissionIds: z
        .array(z.string().uuid({ message: 'error:role.permissionIdInvalid' }))
        .optional()
});
