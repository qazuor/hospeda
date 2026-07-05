// Permission management schemas

// Re-export related schemas from user entity for convenience
export {
    type UserPermissionAssignment,
    UserPermissionAssignmentSchema
} from '../user/permission.schema.js';
export { RolePermissionAssignmentSchema } from '../user/role.schema.js';
// Access level schemas (public, protected, admin)
export * from './permission.access.schema.js';
// HTTP operations
export * from './permission.http.schema.js';
export * from './permission.management.schema.js';
