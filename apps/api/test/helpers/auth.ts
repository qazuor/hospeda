/**
 * @fileoverview Test helpers for authentication mocking
 *
 * ==============================================================================
 * WARNING: TEST-ONLY FILE - DO NOT USE IN PRODUCTION CODE
 * ==============================================================================
 *
 * This file contains mock utilities for testing ONLY.
 *
 * IMPORTANT RESTRICTIONS:
 * - NEVER import or use these functions in production code
 * - NEVER use in src/ directory files
 * - NEVER expose these functions via API endpoints
 *
 * These mocks bypass real authentication and should ONLY be used in:
 * - Unit tests (*.test.ts, *.spec.ts)
 * - Integration tests (test/ directory)
 * - Test setup files (test/setup.ts)
 *
 * @module test/helpers/auth
 * @see apps/api/src/middlewares/actor.ts for production actor handling
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';

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
        PermissionEnum.MANAGE_CLIENTS, // Required for invoice service operations
        PermissionEnum.CLIENT_CREATE,
        PermissionEnum.CLIENT_UPDATE, // Used by invoice/payment services for permission checks
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
        // Granular invoice permissions
        PermissionEnum.INVOICE_CREATE,
        PermissionEnum.INVOICE_UPDATE,
        PermissionEnum.INVOICE_DELETE,
        PermissionEnum.INVOICE_VIEW,
        PermissionEnum.INVOICE_RESTORE,
        PermissionEnum.INVOICE_HARD_DELETE,
        PermissionEnum.INVOICE_GENERATE,
        PermissionEnum.INVOICE_SEND,
        PermissionEnum.INVOICE_VOID,
        PermissionEnum.INVOICE_MARK_PAID,
        // Granular invoice line permissions
        PermissionEnum.INVOICE_LINE_CREATE,
        PermissionEnum.INVOICE_LINE_UPDATE,
        PermissionEnum.INVOICE_LINE_DELETE,
        PermissionEnum.INVOICE_LINE_VIEW,
        PermissionEnum.INVOICE_LINE_RESTORE,
        PermissionEnum.INVOICE_LINE_HARD_DELETE,
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
 * Mock session data matching Better Auth session shape.
 * Used for testing middleware and route handlers that read session from context.
 *
 * @param overrides - Optional overrides for session properties
 * @returns Mock session object
 */
export const createMockSession = (
    overrides?: Partial<{
        id: string;
        userId: string;
        token: string;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>
) => {
    const now = new Date();
    return {
        id: overrides?.id || `session-${crypto.randomUUID().slice(0, 8)}`,
        userId: overrides?.userId || crypto.randomUUID(),
        token: overrides?.token || `tok-${crypto.randomUUID().slice(0, 16)}`,
        expiresAt: overrides?.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: overrides?.ipAddress ?? null,
        userAgent: overrides?.userAgent ?? 'vitest',
        createdAt: overrides?.createdAt || now,
        updatedAt: overrides?.updatedAt || now
    };
};

/**
 * Mock user data matching Better Auth user shape.
 * Used for testing middleware and route handlers that read user from context.
 *
 * @param overrides - Optional overrides for user properties
 * @returns Mock user object
 */
export const createMockUser = (
    overrides?: Partial<{
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image: string | null;
        role: string;
        banned: boolean;
        banReason: string | null;
        banExpires: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>
) => {
    const now = new Date();
    return {
        id: overrides?.id || crypto.randomUUID(),
        name: overrides?.name || 'Test User',
        email: overrides?.email || 'test@example.com',
        emailVerified: overrides?.emailVerified ?? true,
        image: overrides?.image ?? null,
        role: overrides?.role || 'USER',
        banned: overrides?.banned ?? false,
        banReason: overrides?.banReason ?? null,
        banExpires: overrides?.banExpires ?? null,
        createdAt: overrides?.createdAt || now,
        updatedAt: overrides?.updatedAt || now
    };
};

/**
 * Creates request options with mock authentication headers.
 * Simulates authenticated request by including actor data via
 * x-mock-actor-* headers processed by actorMiddleware in test mode.
 *
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
        // Mock actor headers (processed by actorMiddleware when ALLOW_MOCK_ACTOR=true)
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions),
        ...additionalHeaders
    }
});
