/**
 * Tests for Admin Customer Add-on Purchases Handler
 *
 * Covers:
 * - T-018: Soft-delete exclusion — listCustomerAddonsHandler() uses isNull(deletedAt)
 *   in the WHERE clause so soft-deleted records are invisible to the admin list endpoint.
 *
 * @module test/routes/billing/admin/customer-addons
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

// Mock drizzle-orm helpers so we can inspect which conditions were built
vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    ilike: vi.fn((col: unknown, val: unknown) => ({ type: 'ilike', col, val })),
    desc: vi.fn((col: unknown) => ({ type: 'desc', col })),
    count: vi.fn(() => ({ type: 'count' })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col }))
}));

// Mock @repo/db — provide a chainable DB mock and table schema identifiers
vi.mock('@repo/db', () => {
    const mockWhere = vi.fn().mockReturnThis();
    const mockOffset = vi.fn().mockResolvedValue([]);
    const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere, innerJoin: mockInnerJoin });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    // Count sub-chain used by totalResult query
    mockWhere.mockImplementation(() => ({
        ...mockWhere,
        orderBy: mockOrderBy,
        limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([]) })
    }));

    return {
        getDb: vi.fn().mockReturnValue({ select: mockSelect }),
        billingAddonPurchases: {
            id: 'id',
            customerId: 'customer_id',
            addonSlug: 'addon_slug',
            addonId: 'addon_id',
            status: 'status',
            subscriptionId: 'subscription_id',
            purchasedAt: 'purchased_at',
            expiresAt: 'expires_at',
            canceledAt: 'canceled_at',
            deletedAt: 'deleted_at',
            paymentId: 'payment_id',
            limitAdjustments: 'limit_adjustments',
            entitlementAdjustments: 'entitlement_adjustments',
            metadata: 'metadata',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        billingCustomers: {
            id: 'id',
            email: 'email',
            name: 'name'
        }
    };
});

// Mock @repo/schemas (only the PermissionEnum is used by the route factory)
vi.mock('@repo/schemas', () => ({
    PermissionEnum: { BILLING_READ_ALL: 'billing:read_all' }
}));

// Mock the route factory so createAdminRoute does not run its real logic
vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn()
}));

// Mock the logger
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { isNull } from 'drizzle-orm';
import { listCustomerAddonsHandler } from '../../../../src/routes/billing/admin/customer-addons';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('listCustomerAddonsHandler — soft-delete exclusion (T-018)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should include isNull(deletedAt) condition in every query regardless of other filters', async () => {
        // Arrange: call the handler with no extra filters (status defaults to 'all')
        // Act
        try {
            await listCustomerAddonsHandler(null, null, null, {});
        } catch {
            // The handler may throw because the mock DB chain does not fully resolve
            // (e.g., the count sub-query resolves to undefined). That is expected —
            // we only care that isNull() was called with the deletedAt column identifier.
        }

        // Assert: isNull() must have been called with the deletedAt column identifier
        // from the mock schema ('deleted_at'), proving the soft-delete filter is always present.
        expect(isNull).toHaveBeenCalledWith('deleted_at');
    });

    it('should include isNull(deletedAt) condition when filtering by status=active', async () => {
        // Arrange
        try {
            await listCustomerAddonsHandler(null, null, null, { status: 'active' });
        } catch {
            // Partial mock chain — see comment above
        }

        // Assert: the isNull filter must be present regardless of status filter
        expect(isNull).toHaveBeenCalledWith('deleted_at');
    });

    it('should include isNull(deletedAt) condition when filtering by addonSlug', async () => {
        // Arrange
        try {
            await listCustomerAddonsHandler(null, null, null, { addonSlug: 'boost-7' });
        } catch {
            // Partial mock chain — see comment above
        }

        // Assert
        expect(isNull).toHaveBeenCalledWith('deleted_at');
    });

    it('should include isNull(deletedAt) condition when filtering by customerEmail', async () => {
        // Arrange
        try {
            await listCustomerAddonsHandler(null, null, null, {
                customerEmail: 'owner@example.com'
            });
        } catch {
            // Partial mock chain — see comment above
        }

        // Assert
        expect(isNull).toHaveBeenCalledWith('deleted_at');
    });
});
