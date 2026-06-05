/**
 * Tests for Admin Customer Entitlement Grant/Revoke Routes
 *
 * Covers:
 * - Permission registration (BILLING_MANAGE for both mutations)
 * - Grant happy path — billing.entitlements.grant() called + cache cleared
 * - Revoke happy path — billing.entitlements.revoke() called + cache cleared
 * - Invalid entitlementKey → 400 (Zod .refine rejection before billing call)
 * - Missing customerId → 400
 * - Billing service unavailable → 503
 *
 * Strategy: mock the billing module, clearEntitlementCache, route-factory,
 * actor, and audit-logger — then call the extracted handler functions
 * directly (same pattern as customer-addons.test.ts).
 *
 * @module test/routes/billing/admin/customer-entitlements
 */

import { EntitlementKey } from '@repo/billing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports (vi.hoisted ordering)
// ---------------------------------------------------------------------------

const {
    mockGrant,
    mockRevoke,
    mockCustomersGet,
    mockClearEntitlementCache,
    mockGetQZPayBilling,
    mockCreateAdminRoute,
    mockAuditLog
} = vi.hoisted(() => ({
    mockGrant: vi.fn(),
    mockRevoke: vi.fn(),
    mockCustomersGet: vi.fn(),
    mockClearEntitlementCache: vi.fn(),
    mockGetQZPayBilling: vi.fn(),
    mockCreateAdminRoute: vi.fn(),
    mockAuditLog: vi.fn()
}));

// Mock billing module
vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

// Mock @repo/billing — preserve isEntitlementKey + EntitlementKey but stub createMercadoPagoAdapter
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return { ...actual }; // full pass-through; no runtime adapter needed for unit tests
});

// Mock clearEntitlementCache from entitlement middleware
vi.mock('../../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: mockClearEntitlementCache
}));

// Mock @repo/schemas — preserve actual, override PermissionEnum
vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/schemas')>();
    return {
        ...actual,
        PermissionEnum: {
            BILLING_READ_ALL: 'billing:read_all',
            BILLING_MANAGE: 'billing:manage'
        }
    };
});

// Capture route factory calls for permission verification
vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: mockCreateAdminRoute
}));

// Mock create-app router
vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ route: vi.fn() }))
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Mock audit logger
vi.mock('../../../../src/utils/audit-logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/audit-logger')>();
    return { ...actual, auditLog: mockAuditLog };
});

// Mock actor
vi.mock('../../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({
        id: 'admin-actor-00000000-0000-0000-0000-000000000001',
        role: 'SUPER_ADMIN',
        permissions: ['billing:read_all', 'billing:manage']
    })
}));

// Mock @repo/service-core (ServiceError used inside the route)
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Import the module — this triggers all route factory calls at module load
import '../../../../src/routes/billing/admin/customer-entitlements';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTOR_ID = 'admin-actor-00000000-0000-0000-0000-000000000001';

const SAMPLE_CUSTOMER_ID = 'customer-00000000-0000-0000-0000-000000000010';

const SAMPLE_GRANT_RESPONSE = {
    customerId: SAMPLE_CUSTOMER_ID,
    entitlementKey: EntitlementKey.FEATURED_LISTING,
    grantedAt: new Date('2026-06-01T00:00:00.000Z'),
    expiresAt: null,
    source: 'manual',
    sourceId: ACTOR_ID
};

/**
 * Creates a minimal Hono-like context for handler calls.
 */
const createMockContext = () => ({
    json: vi.fn((body: unknown, status?: number) => ({ body, status: status ?? 200 }))
});

/**
 * Finds a route factory call by method + path.
 */
function findRouteCall(method: string, path: string): Record<string, unknown> | undefined {
    const call = mockCreateAdminRoute.mock.calls.find(
        (args: unknown[]) =>
            (args[0] as Record<string, unknown>)?.method === method &&
            (args[0] as Record<string, unknown>)?.path === path
    );
    return call ? (call[0] as Record<string, unknown>) : undefined;
}

// ---------------------------------------------------------------------------
// Permission registration tests
// ---------------------------------------------------------------------------

describe('route registration — permissions', () => {
    it('POST /grant should require BILLING_MANAGE', () => {
        const config = findRouteCall('post', '/grant');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:manage');
    });

    it('POST /revoke should require BILLING_MANAGE', () => {
        const config = findRouteCall('post', '/revoke');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:manage');
    });
});

// ---------------------------------------------------------------------------
// Grant handler tests
// ---------------------------------------------------------------------------

/** Minimal stub for a billing customer returned by billing.customers.get() */
const SAMPLE_BILLING_CUSTOMER = {
    customerId: SAMPLE_CUSTOMER_ID,
    externalId: 'user-00000000-0000-0000-0000-000000000010',
    email: 'customer@example.com'
};

describe('adminGrantCustomerEntitlementRoute handler', () => {
    let mockBilling: {
        entitlements: { grant: typeof mockGrant; revoke: typeof mockRevoke };
        customers: { get: typeof mockCustomersGet };
    };

    beforeEach(() => {
        mockGrant.mockReset();
        mockRevoke.mockReset();
        mockCustomersGet.mockReset();
        mockClearEntitlementCache.mockReset();
        mockGetQZPayBilling.mockReset();
        mockAuditLog.mockReset();
        mockBilling = {
            entitlements: { grant: mockGrant, revoke: mockRevoke },
            customers: { get: mockCustomersGet }
        };
        mockGetQZPayBilling.mockReturnValue(mockBilling);
        // Default: customer exists
        mockCustomersGet.mockResolvedValue(SAMPLE_BILLING_CUSTOMER);
    });

    it('grant happy path — calls billing.entitlements.grant and clears cache', async () => {
        // Arrange
        mockGrant.mockResolvedValue(SAMPLE_GRANT_RESPONSE);
        const config = findRouteCall('post', '/grant');
        const handler = config?.handler as (c: unknown, p: unknown, b: unknown) => Promise<unknown>;
        const c = createMockContext();
        const body = {
            customerId: SAMPLE_CUSTOMER_ID,
            entitlementKey: EntitlementKey.FEATURED_LISTING
        };

        // Act
        const result = await handler(c, {}, body);

        // Assert — billing.entitlements.grant called with correct shape
        expect(mockGrant).toHaveBeenCalledWith({
            customerId: SAMPLE_CUSTOMER_ID,
            entitlementKey: EntitlementKey.FEATURED_LISTING,
            expiresAt: undefined,
            source: 'manual',
            sourceId: ACTOR_ID
        });

        // Assert — cache cleared for the customer
        expect(mockClearEntitlementCache).toHaveBeenCalledWith(SAMPLE_CUSTOMER_ID);

        // Assert — response matches grant result
        expect(result).toMatchObject({
            customerId: SAMPLE_CUSTOMER_ID,
            entitlementKey: EntitlementKey.FEATURED_LISTING,
            source: 'manual'
        });
    });

    it('grant with expiresAt — passes date to billing', async () => {
        // Arrange
        const expiresAt = new Date('2026-12-31T23:59:59.000Z');
        mockGrant.mockResolvedValue({ ...SAMPLE_GRANT_RESPONSE, expiresAt });
        const config = findRouteCall('post', '/grant');
        const handler = config?.handler as (c: unknown, p: unknown, b: unknown) => Promise<unknown>;
        const c = createMockContext();

        // Act
        await handler(
            c,
            {},
            {
                customerId: SAMPLE_CUSTOMER_ID,
                entitlementKey: EntitlementKey.PRIORITY_SUPPORT,
                expiresAt: expiresAt.toISOString()
            }
        );

        // Assert — expiresAt forwarded to billing
        expect(mockGrant).toHaveBeenCalledWith(expect.objectContaining({ expiresAt }));
    });

    it('invalid entitlementKey → Zod throws before billing is called (400)', async () => {
        // Arrange
        const config = findRouteCall('post', '/grant');
        const handler = config?.handler as (c: unknown, p: unknown, b: unknown) => Promise<unknown>;
        const c = createMockContext();

        // Act & Assert — Zod .refine rejects unknown key; billing.grant must NOT be called
        await expect(
            handler(
                c,
                {},
                {
                    customerId: SAMPLE_CUSTOMER_ID,
                    entitlementKey: 'BOGUS_KEY_NOT_IN_ENUM'
                }
            )
        ).rejects.toThrow();

        expect(mockGrant).not.toHaveBeenCalled();
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });

    it('billing service unavailable → throws HTTPException 503', async () => {
        // Arrange — billing not configured
        mockGetQZPayBilling.mockReturnValue(null);
        const config = findRouteCall('post', '/grant');
        const handler = config?.handler as (c: unknown, p: unknown, b: unknown) => Promise<unknown>;
        const c = createMockContext();

        // Act & Assert
        await expect(
            handler(
                c,
                {},
                {
                    customerId: SAMPLE_CUSTOMER_ID,
                    entitlementKey: EntitlementKey.FEATURED_LISTING
                }
            )
        ).rejects.toMatchObject({ status: 503 });

        expect(mockGrant).not.toHaveBeenCalled();
    });

    it('unknown customerId (customers.get returns null) → throws HTTPException 404', async () => {
        // Arrange — customer does not exist in billing
        mockCustomersGet.mockResolvedValue(null);
        const config = findRouteCall('post', '/grant');
        const handler = config?.handler as (c: unknown, p: unknown, b: unknown) => Promise<unknown>;
        const c = createMockContext();

        // Act & Assert
        await expect(
            handler(
                c,
                {},
                {
                    customerId: '00000000-0000-0000-0000-000000000099',
                    entitlementKey: EntitlementKey.FEATURED_LISTING
                }
            )
        ).rejects.toMatchObject({ status: 404 });

        // billing.entitlements.grant must NOT have been called
        expect(mockGrant).not.toHaveBeenCalled();
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });

    it('past expiresAt → Zod refine rejects with 400 before any billing call', async () => {
        // Arrange — expiresAt in the past
        const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
        const config = findRouteCall('post', '/grant');
        const handler = config?.handler as (c: unknown, p: unknown, b: unknown) => Promise<unknown>;
        const c = createMockContext();

        // Act & Assert — Zod .refine on expiresAt rejects past dates
        await expect(
            handler(
                c,
                {},
                {
                    customerId: SAMPLE_CUSTOMER_ID,
                    entitlementKey: EntitlementKey.FEATURED_LISTING,
                    expiresAt: pastDate.toISOString()
                }
            )
        ).rejects.toThrow();

        expect(mockGrant).not.toHaveBeenCalled();
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Revoke handler tests
// ---------------------------------------------------------------------------

describe('adminRevokeCustomerEntitlementRoute handler', () => {
    let mockBilling: {
        entitlements: { grant: typeof mockGrant; revoke: typeof mockRevoke };
        customers: { get: typeof mockCustomersGet };
    };

    beforeEach(() => {
        mockGrant.mockReset();
        mockRevoke.mockReset();
        mockCustomersGet.mockReset();
        mockClearEntitlementCache.mockReset();
        mockGetQZPayBilling.mockReset();
        mockAuditLog.mockReset();
        mockBilling = {
            entitlements: { grant: mockGrant, revoke: mockRevoke },
            customers: { get: mockCustomersGet }
        };
        mockGetQZPayBilling.mockReturnValue(mockBilling);
    });

    it('revoke happy path — calls billing.entitlements.revoke and clears cache', async () => {
        // Arrange
        mockRevoke.mockResolvedValue(undefined);
        const config = findRouteCall('post', '/revoke');
        const handler = config?.handler as (c: unknown, p: unknown, b: unknown) => Promise<unknown>;
        const c = createMockContext();

        // Act
        const result = await handler(
            c,
            {},
            {
                customerId: SAMPLE_CUSTOMER_ID,
                entitlementKey: EntitlementKey.FEATURED_LISTING
            }
        );

        // Assert — billing.entitlements.revoke(customerId, entitlementKey) shape
        expect(mockRevoke).toHaveBeenCalledWith(
            SAMPLE_CUSTOMER_ID,
            EntitlementKey.FEATURED_LISTING
        );

        // Assert — cache cleared for the customer
        expect(mockClearEntitlementCache).toHaveBeenCalledWith(SAMPLE_CUSTOMER_ID);

        // Assert — null response (204-style body)
        expect(result).toBeNull();
    });

    it('invalid entitlementKey → Zod throws before billing is called', async () => {
        // Arrange
        const config = findRouteCall('post', '/revoke');
        const handler = config?.handler as (c: unknown, p: unknown, b: unknown) => Promise<unknown>;
        const c = createMockContext();

        // Act & Assert
        await expect(
            handler(
                c,
                {},
                {
                    customerId: SAMPLE_CUSTOMER_ID,
                    entitlementKey: 'COMPLETELY_UNKNOWN_KEY'
                }
            )
        ).rejects.toThrow();

        expect(mockRevoke).not.toHaveBeenCalled();
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });

    it('billing service unavailable → throws HTTPException 503', async () => {
        // Arrange
        mockGetQZPayBilling.mockReturnValue(null);
        const config = findRouteCall('post', '/revoke');
        const handler = config?.handler as (c: unknown, p: unknown, b: unknown) => Promise<unknown>;
        const c = createMockContext();

        // Act & Assert
        await expect(
            handler(
                c,
                {},
                {
                    customerId: SAMPLE_CUSTOMER_ID,
                    entitlementKey: EntitlementKey.FEATURED_LISTING
                }
            )
        ).rejects.toMatchObject({ status: 503 });

        expect(mockRevoke).not.toHaveBeenCalled();
    });
});
