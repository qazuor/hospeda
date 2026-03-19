/**
 * Role Test Fixtures
 *
 * Mock data for role-related tests.
 * The roles page is read-only and uses the RoleEnum from @repo/schemas.
 * These fixtures represent the role display data as rendered in the admin UI.
 */

import { mockSuccessResponse } from '../mocks/handlers';

/**
 * Role fixture matching the RoleInfo structure used in the roles page.
 * See apps/admin/src/routes/_authed/access/roles.tsx for ROLE_INFO definition.
 */
export interface MockRoleInfo {
    readonly name: string;
    readonly label: string;
    readonly description: string;
    readonly level: 'critical' | 'high' | 'medium' | 'low';
    readonly capabilities: readonly string[];
}

/** Super Admin role fixture */
export const mockRoleSuperAdmin: MockRoleInfo = {
    name: 'SUPER_ADMIN',
    label: 'Super Admin',
    description: 'Full system access with all permissions including system-level actions',
    level: 'critical',
    capabilities: [
        'Complete system control',
        'User and role management',
        'System configuration',
        'Audit log access',
        'All content management'
    ]
} as const;

/** Admin role fixture */
export const mockRoleAdmin: MockRoleInfo = {
    name: 'ADMIN',
    label: 'Admin',
    description: 'Manages platform content, users, and most administrative functions',
    level: 'high',
    capabilities: [
        'Content moderation',
        'User management',
        'Accommodation approval',
        'Event management',
        'Analytics access'
    ]
} as const;

/** Editor role fixture */
export const mockRoleEditor: MockRoleInfo = {
    name: 'EDITOR',
    label: 'Editor',
    description: 'Creates and edits events, posts, and editorial content',
    level: 'medium',
    capabilities: [
        'Create events',
        'Edit posts',
        'Publish content',
        'Manage media',
        'Content scheduling'
    ]
} as const;

/** Host role fixture */
export const mockRoleHost: MockRoleInfo = {
    name: 'HOST',
    label: 'Host',
    description: 'Accommodation owner who manages their own listings',
    level: 'medium',
    capabilities: [
        'Manage own accommodations',
        'Update availability',
        'Upload photos',
        'Respond to reviews',
        'View booking analytics'
    ]
} as const;

/** User role fixture */
export const mockRoleUser: MockRoleInfo = {
    name: 'USER',
    label: 'User',
    description: 'Registered user of the public portal with basic interaction capabilities',
    level: 'low',
    capabilities: [
        'View content',
        'Create reviews',
        'Save favorites',
        'Update profile',
        'Contact hosts'
    ]
} as const;

/** Guest role fixture */
export const mockRoleGuest: MockRoleInfo = {
    name: 'GUEST',
    label: 'Guest',
    description: 'Public visitor without authentication, limited to viewing public content',
    level: 'low',
    capabilities: [
        'View public content',
        'Browse accommodations',
        'Search destinations',
        'View events',
        'Access public information'
    ]
} as const;

/** List of all role fixtures (roles are non-paginated) */
export const mockRoleList: readonly MockRoleInfo[] = [
    mockRoleSuperAdmin,
    mockRoleAdmin,
    mockRoleEditor,
    mockRoleHost,
    mockRoleUser,
    mockRoleGuest
];

/** Success response wrapping the role list */
export const mockRoleListResponse = mockSuccessResponse(mockRoleList);
