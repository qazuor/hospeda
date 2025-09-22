import { faker } from '@faker-js/faker';
import { PermissionEnum, RoleEnum } from '../../src/enums/index.js';

// ============================================================================
// PERMISSION MANAGEMENT FIXTURES
// ============================================================================

/**
 * Creates valid permission management test data
 */
export const createValidPermissionManagementFixtures = () => ({
    rolePermissionInput: {
        role: faker.helpers.arrayElement(Object.values(RoleEnum)),
        permission: faker.helpers.arrayElement(Object.values(PermissionEnum))
    },
    userPermissionInput: {
        userId: faker.string.uuid(),
        permission: faker.helpers.arrayElement(Object.values(PermissionEnum))
    },
    permissionsByRoleInput: {
        role: faker.helpers.arrayElement(Object.values(RoleEnum))
    },
    permissionsByUserInput: {
        userId: faker.string.uuid()
    },
    rolesByPermissionInput: {
        permission: faker.helpers.arrayElement(Object.values(PermissionEnum))
    },
    usersByPermissionInput: {
        permission: faker.helpers.arrayElement(Object.values(PermissionEnum))
    }
});

/**
 * Creates invalid permission management test data
 */
export const createInvalidPermissionManagementFixtures = () => ({
    invalidRolePermissionInput: {
        role: 'INVALID_ROLE',
        permission: faker.helpers.arrayElement(Object.values(PermissionEnum))
    },
    invalidUserPermissionInput: {
        userId: 'not-a-uuid',
        permission: faker.helpers.arrayElement(Object.values(PermissionEnum))
    },
    invalidPermissionInput: {
        role: faker.helpers.arrayElement(Object.values(RoleEnum)),
        permission: 'INVALID_PERMISSION'
    },
    missingFieldsInput: {
        role: faker.helpers.arrayElement(Object.values(RoleEnum))
        // missing permission
    },
    unexpectedFieldsInput: {
        role: faker.helpers.arrayElement(Object.values(RoleEnum)),
        permission: faker.helpers.arrayElement(Object.values(PermissionEnum)),
        unexpectedField: 'should be rejected'
    }
});

/**
 * Creates valid assignment output data
 */
export const createValidAssignmentOutput = () => ({
    assigned: faker.datatype.boolean()
});

/**
 * Creates valid removal output data
 */
export const createValidRemovalOutput = () => ({
    removed: faker.datatype.boolean()
});

/**
 * Creates valid permissions list output data
 */
export const createValidPermissionsListOutput = () => ({
    permissions: faker.helpers.arrayElements(Object.values(PermissionEnum), { min: 0, max: 5 })
});

/**
 * Creates valid roles list output data
 */
export const createValidRolesListOutput = () => ({
    roles: faker.helpers.arrayElements(Object.values(RoleEnum), { min: 0, max: 3 })
});

/**
 * Creates valid users list output data
 */
export const createValidUsersListOutput = () => ({
    users: Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => faker.string.uuid())
});

/**
 * Creates specific role-permission assignment data
 */
export const createRolePermissionAssignment = (role?: RoleEnum, permission?: PermissionEnum) => ({
    role: role ?? faker.helpers.arrayElement(Object.values(RoleEnum)),
    permission: permission ?? faker.helpers.arrayElement(Object.values(PermissionEnum))
});

/**
 * Creates specific user-permission assignment data
 */
export const createUserPermissionAssignment = (userId?: string, permission?: PermissionEnum) => ({
    userId: userId ?? faker.string.uuid(),
    permission: permission ?? faker.helpers.arrayElement(Object.values(PermissionEnum))
});

/**
 * Creates admin role with management permissions
 */
export const createAdminRolePermissions = () => ({
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.USER_CREATE,
        PermissionEnum.POST_CREATE,
        PermissionEnum.ANALYTICS_VIEW,
        PermissionEnum.SYSTEM_MAINTENANCE_MODE
    ]
});

/**
 * Creates editor role with limited permissions
 */
export const createEditorRolePermissions = () => ({
    role: RoleEnum.EDITOR,
    permissions: [PermissionEnum.POST_CREATE, PermissionEnum.ANALYTICS_VIEW]
});

/**
 * Creates user role with basic permissions
 */
export const createUserRolePermissions = () => ({
    role: RoleEnum.USER,
    permissions: [PermissionEnum.USER_VIEW_PROFILE]
});

/**
 * Creates edge case test data
 */
export const createPermissionEdgeCases = () => ({
    emptyPermissionsList: {
        permissions: []
    },
    emptyRolesList: {
        roles: []
    },
    emptyUsersList: {
        users: []
    },
    singlePermission: {
        permissions: [faker.helpers.arrayElement(Object.values(PermissionEnum))]
    },
    singleRole: {
        roles: [faker.helpers.arrayElement(Object.values(RoleEnum))]
    },
    singleUser: {
        users: [faker.string.uuid()]
    },
    maxPermissions: {
        permissions: Object.values(PermissionEnum)
    },
    maxRoles: {
        roles: Object.values(RoleEnum)
    }
});
