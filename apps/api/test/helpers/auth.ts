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
        // Granular subscription permissions
        PermissionEnum.SUBSCRIPTION_CREATE,
        PermissionEnum.SUBSCRIPTION_UPDATE,
        PermissionEnum.SUBSCRIPTION_DELETE,
        PermissionEnum.SUBSCRIPTION_VIEW,
        // Granular payment permissions
        PermissionEnum.PAYMENT_CREATE,
        PermissionEnum.PAYMENT_UPDATE,
        PermissionEnum.PAYMENT_DELETE,
        PermissionEnum.PAYMENT_VIEW,
        PermissionEnum.PAYMENT_PROCESS,
        PermissionEnum.PAYMENT_REFUND,
        PermissionEnum.PAYMENT_CANCEL,
        // Granular client permissions
        PermissionEnum.CLIENT_CREATE,
        PermissionEnum.CLIENT_UPDATE,
        PermissionEnum.CLIENT_DELETE,
        PermissionEnum.CLIENT_VIEW,
        // Granular pricing plan permissions
        PermissionEnum.PRICING_PLAN_CREATE,
        PermissionEnum.PRICING_PLAN_UPDATE,
        PermissionEnum.PRICING_PLAN_DELETE,
        PermissionEnum.PRICING_PLAN_VIEW,
        // Granular product permissions
        PermissionEnum.PRODUCT_CREATE,
        PermissionEnum.PRODUCT_UPDATE,
        PermissionEnum.PRODUCT_DELETE,
        PermissionEnum.PRODUCT_VIEW,
        // Granular campaign permissions
        PermissionEnum.CAMPAIGN_CREATE,
        PermissionEnum.CAMPAIGN_UPDATE,
        PermissionEnum.CAMPAIGN_DELETE,
        PermissionEnum.CAMPAIGN_VIEW,
        PermissionEnum.CAMPAIGN_RESTORE,
        PermissionEnum.CAMPAIGN_HARD_DELETE,
        PermissionEnum.CAMPAIGN_STATUS_MANAGE,
        PermissionEnum.CAMPAIGN_BUDGET_MANAGE,
        PermissionEnum.CAMPAIGN_PERFORMANCE_VIEW,
        PermissionEnum.CAMPAIGN_ANALYTICS_VIEW,
        // Granular professional service permissions
        PermissionEnum.PROFESSIONAL_SERVICE_CREATE,
        PermissionEnum.PROFESSIONAL_SERVICE_UPDATE,
        PermissionEnum.PROFESSIONAL_SERVICE_DELETE,
        PermissionEnum.PROFESSIONAL_SERVICE_VIEW,
        PermissionEnum.PROFESSIONAL_SERVICE_RESTORE,
        PermissionEnum.PROFESSIONAL_SERVICE_HARD_DELETE,
        PermissionEnum.PROFESSIONAL_SERVICE_SOFT_DELETE_VIEW,
        PermissionEnum.PROFESSIONAL_SERVICE_STATUS_MANAGE,
        // Granular professional service order permissions
        PermissionEnum.PROFESSIONAL_SERVICE_ORDER_CREATE,
        PermissionEnum.PROFESSIONAL_SERVICE_ORDER_UPDATE,
        PermissionEnum.PROFESSIONAL_SERVICE_ORDER_DELETE,
        PermissionEnum.PROFESSIONAL_SERVICE_ORDER_VIEW,
        PermissionEnum.PROFESSIONAL_SERVICE_ORDER_RESTORE,
        PermissionEnum.PROFESSIONAL_SERVICE_ORDER_HARD_DELETE,
        PermissionEnum.PROFESSIONAL_SERVICE_ORDER_SOFT_DELETE_VIEW,
        PermissionEnum.PROFESSIONAL_SERVICE_ORDER_STATUS_MANAGE,
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
