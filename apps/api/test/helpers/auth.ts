import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';

/**
 * Test helpers for authentication mocking
 * Provides utilities to create mock actors with different roles and permissions
 */

/**
 * Creates a mock admin actor with all permissions
 * @param overrides - Optional overrides for actor properties
 * @returns Mock admin actor
 */
export const createMockAdminActor = (overrides?: Partial<Actor>): Actor => ({
    id: overrides?.id || crypto.randomUUID(),
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.ACCESS_API_PUBLIC,
        PermissionEnum.ACCESS_API_PRIVATE,
        PermissionEnum.MANAGE_USERS,
        PermissionEnum.MANAGE_CLIENTS,
        PermissionEnum.MANAGE_PRODUCTS,
        PermissionEnum.MANAGE_SUBSCRIPTIONS,
        PermissionEnum.MANAGE_PURCHASES,
        PermissionEnum.ANALYTICS_VIEW,
        PermissionEnum.MANAGE_CONTENT,
        ...(overrides?.permissions || [])
    ],
    ...overrides
});

/**
 * Creates a mock user actor with standard user permissions
 * @param overrides - Optional overrides for actor properties
 * @returns Mock user actor
 */
export const createMockUserActor = (overrides?: Partial<Actor>): Actor => ({
    id: overrides?.id || crypto.randomUUID(),
    role: RoleEnum.USER,
    permissions: [
        PermissionEnum.ACCESS_API_PUBLIC,
        PermissionEnum.ACCESS_API_PRIVATE,
        ...(overrides?.permissions || [])
    ],
    ...overrides
});

/**
 * Creates a mock guest actor with minimal permissions
 * @param overrides - Optional overrides for actor properties
 * @returns Mock guest actor
 */
export const createMockGuestActor = (overrides?: Partial<Actor>): Actor => ({
    id: overrides?.id || '00000000-0000-4000-8000-000000000000',
    role: RoleEnum.GUEST,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC, ...(overrides?.permissions || [])],
    ...overrides
});

/**
 * Creates a mock client manager actor with client management permissions
 * @param overrides - Optional overrides for actor properties
 * @returns Mock client manager actor
 */
export const createMockClientManagerActor = (overrides?: Partial<Actor>): Actor => ({
    id: overrides?.id || crypto.randomUUID(),
    role: RoleEnum.CLIENT_MANAGER,
    permissions: [
        PermissionEnum.ACCESS_API_PUBLIC,
        PermissionEnum.ACCESS_API_PRIVATE,
        PermissionEnum.MANAGE_CLIENTS,
        PermissionEnum.ANALYTICS_VIEW,
        ...(overrides?.permissions || [])
    ],
    ...overrides
});

/**
 * Creates a mock actor with custom role and permissions
 * @param role - The role for the actor
 * @param permissions - Array of permissions
 * @param id - Optional actor ID
 * @returns Mock actor with specified configuration
 */
export const createMockActor = (
    role: RoleEnum,
    permissions: PermissionEnum[],
    id?: string
): Actor => ({
    id: id || crypto.randomUUID(),
    role,
    permissions
});

/**
 * Creates request options with mock authentication headers
 * Simulates authenticated request by including actor data
 * @param actor - The actor to authenticate as
 * @param additionalHeaders - Additional headers to include
 * @returns Request options with authentication
 */
export const createAuthenticatedRequest = (
    actor: Actor,
    additionalHeaders: Record<string, string> = {}
) => ({
    headers: {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        // Mock Clerk authentication headers
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions),
        ...additionalHeaders
    }
});
