import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { PermissionEnumSchema } from '../../enums/permission.schema.js';

/**
 * Zod schema for the assignment of a permission to a user.
 * The permission is referenced by its enum.
 */
export const UserPermissionAssignmentSchema = z.object({
    userId: UserIdSchema,
    permission: PermissionEnumSchema
});

export type UserPermissionAssignment = z.infer<typeof UserPermissionAssignmentSchema>;
