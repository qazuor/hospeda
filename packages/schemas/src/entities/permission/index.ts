// Permission management schemas
export * from './permission.management.schema.js';

// Re-export related schemas from user entity for convenience
export {
    UserPermissionAssignmentSchema,
    type UserPermissionAssignment
} from '../user/permission.schema.js';

export { RolePermissionAssignmentSchema } from '../user/role.schema.js';
