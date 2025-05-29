import { z } from 'zod';
import { WithAuditSchema, WithIdSchema } from '../../common/index.js';

/**
 * Permission schema definition using Zod for validation.
 * Represents a single permission that can be assigned to a role.
 */
export const PermissionSchema = WithIdSchema.merge(WithAuditSchema).extend({
    /** Permission name, 3-50 characters */
    name: z
        .string()
        .min(3, { message: 'zodError.permission.name.min' })
        .max(50, { message: 'zodError.permission.name.max' }),
    /** Permission description, optional, 5-200 characters */
    description: z
        .string()
        .min(5, { message: 'zodError.permission.description.min' })
        .max(200, { message: 'zodError.permission.description.max' })
        .optional()
});
