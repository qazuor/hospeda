import { z } from 'zod';
import { WithAuditSchema, WithIdSchema } from '../../common/index.js';
import { PermissionSchema } from './permission.schema.js';

/**
 * Role schema definition using Zod for validation.
 * Each role must have at least one permission.
 */
export const RoleSchema = WithIdSchema.merge(WithAuditSchema).extend({
    /** Role name, 3-50 characters */
    name: z
        .string()
        .min(3, { message: 'zodError.role.name.min' })
        .max(50, { message: 'zodError.role.name.max' }),
    /** Role description, optional, 5-200 characters */
    description: z
        .string()
        .min(5, { message: 'zodError.role.description.min' })
        .max(200, { message: 'zodError.role.description.max' })
        .optional(),
    /** List of permissions, must have at least one */
    permissions: z
        .array(PermissionSchema, {
            required_error: 'zodError.role.permissions.required'
        })
        .min(1, { message: 'zodError.role.permissions.min' })
});
