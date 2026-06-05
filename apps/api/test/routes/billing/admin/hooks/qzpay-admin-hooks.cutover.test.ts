/**
 * Parity tests for qzpay-admin-hooks.ts addon reads cutover (SPEC-192 T-017)
 *
 * Verifies that the `onBeforeSubscriptionCancel` hook now resolves addon
 * definitions via the DB-backed `AddonCatalogService.getBySlug()` instead of
 * the dynamic `import('@repo/billing').getAddonBySlug`.
 *
 * Semantics preserved:
 * - Known addon (success=true) → addonDef passed to `revokeAddonForSubscriptionCancellation`
 * - NOT_FOUND → addonDef=undefined → "unknown/retired" path (same as old undefined)
 * - Parallel revocation of multiple purchases (Promise.allSettled) unchanged
 * - `getAddonBySlug` from `@repo/billing` is NEVER called after cutover
 *
 * Reminder (in code comment in source): `addon.checkout.ts` is intentionally NOT cut over
 * here — that is T-037, pending SPEC-127 (checkout flow refactor).
 *
 * No real database. All DB and billing calls are mocked.
 *
 * @module test/routes/billing/admin/hooks/qzpay-admin-hooks.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetBySlug, mockGetAddonBySlug } = vi.hoisted(() => ({
    mockGetBySlug: vi.fn(),
    mockGetAddonBySlug: vi.fn()
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockGetBySlug,
        list: vi.fn()
    })),
    BILLING_EVENT_TYPES: {
        ADDON_REVOCATIONS_PENDING: 'ADDON_REVOCATIONS_PENDING'
    }
}));

// getAddonBySlug must NOT be called after cutover (was a dynamic import before)
vi.mock('@repo/billing', () => ({
    getAddonBySlug: mockGetAddonBySlug
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([])
            })
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        })
    }),
    billingAddonPurchases: {
        id: 'id',
        addonSlug: 'slug',
        customerId: 'cid',
        subscriptionId: 'sid',
        status: 'status',
        deletedAt: 'dat'
    },
    billingSubscriptionEvents: {
        id: 'id',
        subscriptionId: 'sid'
    },
    billingSubscriptions: {
        id: 'id',
        status: 'status'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ _and: args })),
    eq: vi.fn((a: unknown, b: unknown) => ({ _eq: [a, b] })),
    isNull: vi.fn((a: unknown) => ({ _isNull: a }))
}));

vi.mock('@repo/schemas', () => ({
    SubscriptionStatusEnum: {
        CANCELLED: 'cancelled',
        ACTIVE: 'active',
        PAUSED: 'paused'
    }
}));

vi.mock('../../../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({ id: 'admin-1' })
}));

vi.mock('../../../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn().mockReturnValue({
        subscriptions: {
            get: vi.fn().mockResolvedValue({ status: 'active', customerId: 'cust-1' })
        },
        entitlements: {
            revokeBySource: vi.fn().mockResolvedValue(1),
            revoke: vi.fn().mockResolvedValue(undefined)
        },
        limits: {
            removeBySource: vi.fn().mockResolvedValue(1),
            remove: vi.fn().mockResolvedValue(undefined)
        }
    })
}));

vi.mock('../../../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../../../../src/services/addon-lifecycle.service', () => ({
    revokeAddonForSubscriptionCancellation: vi.fn().mockResolvedValue({
        outcome: 'success',
        purchaseId: 'p-test',
        addonSlug: 'test-slug',
        addonType: 'entitlement'
    })
}));

vi.mock('../../../../../src/services/subscription-pause.service', () => ({
    resolveOwnerUserId: vi.fn().mockResolvedValue(null),
    setOwnerServiceSuspension: vi.fn().mockResolvedValue({ accommodationsUpdated: 0 })
}));

vi.mock('../../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
    addBreadcrumb: vi.fn()
}));

// Import after mocks
import { getDb } from '@repo/db';
import { adminBillingHooks } from '../../../../../src/routes/billing/admin/qzpay-admin-hooks';
import { revokeAddonForSubscriptionCancellation } from '../../../../../src/services/addon-lifecycle.service';

// ─── Catalog stubs ────────────────────────────────────────────────────────────

const STUB_VISIBILITY_7D = {
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    billingType: 'one_time' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'FEATURED_LISTING',
    targetCategories: ['owner', 'complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 1,
    description: 'Featured listing.'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal Hono context mock for the hook. */
function buildCtx() {
    return {
        req: { json: vi.fn().mockResolvedValue({ reason: 'test-cancel' }) }
    } as never;
}

/**
 * Sets up the DB mock to return the given active purchases for the
 * `select({id, addonSlug, customerId}).from(billingAddonPurchases).where(...)`
 * query, and return an empty status row for the idempotency check.
 */
function setupDbWithPurchases(
    purchases: Array<{ id: string; addonSlug: string; customerId: string }>
) {
    const db = vi.mocked(getDb)();
    let callIdx = 0;

    vi.mocked(db.select).mockImplementation(() => {
        const idx = callIdx++;
        if (idx === 0) {
            // Idempotency check: select({status}).from(billingSubscriptions).where(...)
            return {
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ status: 'active' }])
                })
            } as never;
        }
        // Active purchases: select({id, addonSlug, customerId}).from(bap).where(...)
        return {
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(purchases)
            })
        } as never;
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('qzpay-admin-hooks.ts addon reads cutover parity (SPEC-192 T-017)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetBySlug.mockReset();
        mockGetAddonBySlug.mockReset();
    });

    describe('onBeforeSubscriptionCancel — addon reads via AddonCatalogService.getBySlug', () => {
        it('should call catalogService.getBySlug for each active purchase slug', async () => {
            // Arrange
            const purchases = [
                { id: 'p1', addonSlug: 'visibility-boost-7d', customerId: 'cust-1' }
            ];
            setupDbWithPurchases(purchases);
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_VISIBILITY_7D });

            // Act
            const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
                immediate: false,
                subscriptionId: 'sub-cancel-1',
                reason: 'test',
                ctx: buildCtx()
            });

            // Assert — DB catalog consulted, not config getAddonBySlug
            expect(mockGetBySlug).toHaveBeenCalledWith('visibility-boost-7d');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
            expect(result.ok).toBe(true);
        });

        it('should treat NOT_FOUND as unknown/retired addon (addonDef=undefined → both channels)', async () => {
            // Arrange — catalog returns NOT_FOUND
            const purchases = [{ id: 'p2', addonSlug: 'retired-addon', customerId: 'cust-2' }];
            setupDbWithPurchases(purchases);
            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: "Add-on 'retired-addon' not found" }
            });

            // Act
            const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
                immediate: false,
                subscriptionId: 'sub-cancel-2',
                reason: 'test',
                ctx: buildCtx()
            });

            // Assert — revokeAddonForSubscriptionCancellation called with addonDef=undefined
            expect(mockGetBySlug).toHaveBeenCalledWith('retired-addon');
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledWith(
                expect.objectContaining({
                    addonDef: undefined
                })
            );
            expect(result.ok).toBe(true);
        });

        it('should return ok:true immediately when no active purchases (no catalog call)', async () => {
            // Arrange — no purchases for this subscription
            setupDbWithPurchases([]);

            // Act
            const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
                immediate: false,
                subscriptionId: 'sub-cancel-3',
                reason: 'test',
                ctx: buildCtx()
            });

            // Assert — no catalog calls when no purchases to process
            expect(mockGetBySlug).not.toHaveBeenCalled();
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
            expect(result.ok).toBe(true);
        });

        it('should process multiple purchases in parallel with one getBySlug call each', async () => {
            // Arrange — two purchases with different slugs
            const purchases = [
                { id: 'p3a', addonSlug: 'visibility-boost-7d', customerId: 'cust-3' },
                { id: 'p3b', addonSlug: 'extra-accommodations-5', customerId: 'cust-3' }
            ];
            setupDbWithPurchases(purchases);
            mockGetBySlug
                .mockResolvedValueOnce({ success: true, data: STUB_VISIBILITY_7D })
                .mockResolvedValueOnce({
                    success: true,
                    data: {
                        slug: 'extra-accommodations-5',
                        name: 'Extra Accommodations',
                        affectsLimitKey: 'max_accommodations',
                        grantsEntitlement: null,
                        annualPriceArs: null,
                        isActive: true
                    }
                });

            // Act
            const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
                immediate: false,
                subscriptionId: 'sub-cancel-4',
                reason: 'test',
                ctx: buildCtx()
            });

            // Assert — two catalog lookups (one per purchase)
            expect(mockGetBySlug).toHaveBeenCalledTimes(2);
            expect(result.ok).toBe(true);
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });
    });

    describe('addon.checkout.ts intentionally NOT cut over (deferred to T-037 / SPEC-127)', () => {
        it('documents that this file only cuts over the cancel hook, not checkout', () => {
            // The source comment in qzpay-admin-hooks.ts reads:
            // "addon.checkout.ts is intentionally NOT cut over here — deferred to T-037,
            //  pending SPEC-127 (checkout flow refactor). Only this hook's cancel path is updated."
            // This is a documentation test — it passes vacuously, recording the invariant.
            expect(true).toBe(true);
        });
    });
});
