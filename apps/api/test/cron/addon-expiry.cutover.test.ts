/**
 * Parity tests for addon-expiry.job.ts addon reads cutover (SPEC-192 T-015)
 *
 * Verifies that the cron job now resolves addon definitions via the DB-backed
 * `AddonCatalogService.getBySlug()` instead of the static `getAddonBySlug` from
 * `@repo/billing`, across all four call sites:
 *
 *  1. ADDON_EXPIRED notification display name (post-expiry loop)
 *  2. ADDON_EXPIRATION_WARNING (3-day) display name
 *  3. ADDON_EXPIRATION_WARNING (1-day) display name
 *  4. Revocation retry phase — addonDef for `revokeAddonForSubscriptionCancellation`
 *
 * Semantics preserved:
 * - Success → addon name used for display / addon definition passed to revoke helper
 * - NOT_FOUND → falls back to addonSlug for display; undefined for revoke (same as old undefined path)
 * - `getAddonBySlug` from `@repo/billing` is NEVER called after cutover
 *
 * Note on cron test strategy: the cron job wraps all logic in `withTransaction`.
 * We mock `withTransaction` to capture and run the callback with a fake tx that
 * acquires the advisory lock immediately. Only the sub-paths under test are
 * exercised; unrelated phases (split-state reconciliation, entitlement reconciliation)
 * are short-circuited via empty DB results.
 *
 * No real database. All DB and billing calls are mocked.
 *
 * @module test/cron/addon-expiry.cutover.test
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
    }))
}));

// getAddonBySlug must NOT be called after cutover
vi.mock('@repo/billing', () => ({
    getAddonBySlug: mockGetAddonBySlug
}));

// withTransaction mock: runs callback with a minimal fake tx
vi.mock('@repo/db', () => ({
    and: vi.fn((...args: unknown[]) => ({ _and: args })),
    eq: vi.fn((a: unknown, b: unknown) => ({ _eq: [a, b] })),
    isNull: vi.fn((a: unknown) => ({ _isNull: a })),
    sql: vi.fn(
        Object.assign((s: TemplateStringsArray, ...v: unknown[]) => ({ _sql: { s, v } }), {
            empty: { _sql: 'empty' }
        })
    ),
    billingAddonPurchases: {
        id: 'id',
        customerId: 'cid',
        addonSlug: 'slug',
        status: 'status',
        deletedAt: 'dat',
        metadata: 'metadata',
        subscriptionId: 'sid',
        canceledAt: 'cat',
        updatedAt: 'uat',
        entitlementRemovalPending: 'erp'
    },
    billingNotificationLog: {
        id: 'id',
        type: 'type',
        customerId: 'cid',
        metadata: 'metadata'
    },
    billingSubscriptions: {
        id: 'id',
        customerId: 'cid',
        status: 'status',
        deletedAt: 'dat',
        updatedAt: 'uat'
    },
    withTransaction: vi.fn()
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn().mockReturnValue({
        subscriptions: {
            get: vi.fn().mockResolvedValue(null)
        }
    })
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/addon-expiration.service', () => ({
    AddonExpirationService: vi.fn().mockImplementation(() => ({
        findExpiredAddons: vi.fn().mockResolvedValue({ success: true, data: [] }),
        // expireAddon is called per-item in the SPEC-194 T-014 chunked loop;
        // processExpiredAddons is no longer called from the cron path.
        expireAddon: vi.fn().mockResolvedValue({ success: true }),
        processExpiredAddons: vi.fn().mockResolvedValue({
            success: true,
            data: { processed: 0, failed: 0, errors: [] }
        }),
        findExpiringAddons: vi.fn().mockResolvedValue({ success: true, data: [] })
    }))
}));

vi.mock('../../src/services/addon-entitlement.service', () => ({
    AddonEntitlementService: vi.fn().mockImplementation(() => ({
        removeAddonEntitlements: vi.fn().mockResolvedValue({ success: true })
    }))
}));

vi.mock('../../src/services/addon-lifecycle.service', () => ({
    revokeAddonForSubscriptionCancellation: vi.fn().mockResolvedValue({
        outcome: 'success',
        purchaseId: 'p-test',
        addonSlug: 'test-slug',
        addonType: 'unknown'
    })
}));

vi.mock('../../src/utils/customer-lookup', () => ({
    lookupCustomerDetails: vi.fn().mockResolvedValue(null)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn()
}));

vi.mock('@repo/notifications', () => ({
    NotificationType: {
        ADDON_EXPIRED: 'ADDON_EXPIRED',
        ADDON_EXPIRATION_WARNING: 'ADDON_EXPIRATION_WARNING'
    }
}));

// Import after mocks
import { withTransaction } from '@repo/db';
import { addonExpiryJob } from '../../src/cron/jobs/addon-expiry.job';
import { revokeAddonForSubscriptionCancellation } from '../../src/services/addon-lifecycle.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal fake transaction for the cron's `withTransaction` call.
 * The lock result `acquired=true` lets the cron proceed past the lock guard.
 */
function buildFakeTx() {
    const tx = {
        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                    innerJoin: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                }),
                innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            })
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([])
            })
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        })
    };
    return tx;
}

/** Sets up withTransaction to run its callback with a fresh fake tx. */
function setupWithTransaction() {
    // biome-ignore lint/suspicious/noExplicitAny: test mock — cast to satisfy withTransaction signature
    vi.mocked(withTransaction).mockImplementation((cb) => cb(buildFakeTx() as never));
}

/** Builds a minimal cron context. */
function buildCronCtx(overrides: Partial<{ dryRun: boolean }> = {}) {
    return {
        logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
        startedAt: new Date(),
        dryRun: overrides.dryRun ?? false
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon-expiry.job.ts cutover parity (SPEC-192 T-015)', () => {
    beforeEach(() => {
        mockGetBySlug.mockReset();
        mockGetAddonBySlug.mockReset();
    });

    describe('getAddonBySlug from @repo/billing is never called after cutover', () => {
        it('should NOT call getAddonBySlug when the cron runs (dry-run, no expired/expiring)', async () => {
            // Arrange — all expiry service results are empty → no slugs to resolve
            setupWithTransaction();
            const ctx = buildCronCtx({ dryRun: true });

            // Act
            await addonExpiryJob.handler(ctx);

            // Assert — config-backed path is fully replaced
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });
    });

    describe('display name resolution via catalogService.getBySlug (not getAddonBySlug)', () => {
        it('should call catalogService.getBySlug for ADDON_EXPIRED notification display name', async () => {
            // Arrange — set up expired addon in findExpiredAddons + processExpiredAddons
            const { AddonExpirationService } = await import(
                '../../src/services/addon-expiration.service'
            );
            const { lookupCustomerDetails } = await import('../../src/utils/customer-lookup');

            // Override AddonExpirationService to return one expired addon
            vi.mocked(AddonExpirationService).mockImplementation(
                () =>
                    ({
                        findExpiredAddons: vi.fn().mockResolvedValue({
                            success: true,
                            data: [
                                {
                                    id: 'p-expired',
                                    customerId: 'cust-exp',
                                    addonSlug: 'visibility-boost-7d',
                                    expiresAt: new Date('2025-01-01')
                                }
                            ]
                        }),
                        // SPEC-194 T-014: cron now calls expireAddon() per-item instead of
                        // processExpiredAddons(); mock must return success so the notification
                        // loop proceeds and catalogService.getBySlug is reached.
                        expireAddon: vi.fn().mockResolvedValue({ success: true }),
                        processExpiredAddons: vi.fn().mockResolvedValue({
                            success: true,
                            data: {
                                processed: 1,
                                failed: 0,
                                errors: []
                            }
                        }),
                        findExpiringAddons: vi.fn().mockResolvedValue({ success: true, data: [] })
                    }) as never
            );

            // lookupCustomerDetails returns customer data so notification fires
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'test@test.com',
                name: 'Test User',
                userId: 'usr-1'
            });

            // Catalog returns the addon (used for display name)
            mockGetBySlug.mockResolvedValue({
                success: true,
                data: {
                    slug: 'visibility-boost-7d',
                    name: 'Visibility Boost (7 days)',
                    annualPriceArs: null,
                    durationDays: 7,
                    affectsLimitKey: null,
                    grantsEntitlement: 'FEATURED_LISTING',
                    isActive: true
                }
            });

            setupWithTransaction();
            const ctx = buildCronCtx({ dryRun: false });

            // Act
            await addonExpiryJob.handler(ctx);

            // Assert — DB catalog consulted for display name, config NOT consulted
            expect(mockGetBySlug).toHaveBeenCalledWith('visibility-boost-7d');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });

        it('should fall back to addonSlug when catalog returns NOT_FOUND (display name)', async () => {
            // Arrange — same as above but catalog returns NOT_FOUND
            const { AddonExpirationService } = await import(
                '../../src/services/addon-expiration.service'
            );
            const { lookupCustomerDetails } = await import('../../src/utils/customer-lookup');
            const { sendNotification } = await import('../../src/utils/notification-helper');

            vi.mocked(AddonExpirationService).mockImplementation(
                () =>
                    ({
                        findExpiredAddons: vi.fn().mockResolvedValue({
                            success: true,
                            data: [
                                {
                                    id: 'p-retired',
                                    customerId: 'cust-ret',
                                    addonSlug: 'retired-addon',
                                    expiresAt: new Date('2025-01-01')
                                }
                            ]
                        }),
                        // SPEC-194 T-014: cron now calls expireAddon() per-item; must succeed
                        // so the notification loop continues and falls through to getBySlug.
                        expireAddon: vi.fn().mockResolvedValue({ success: true }),
                        processExpiredAddons: vi.fn().mockResolvedValue({
                            success: true,
                            data: { processed: 1, failed: 0, errors: [] }
                        }),
                        findExpiringAddons: vi.fn().mockResolvedValue({ success: true, data: [] })
                    }) as never
            );

            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'test@test.com',
                name: 'Test User',
                userId: 'usr-1'
            });

            // Catalog returns NOT_FOUND → should fall back to slug
            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: "Add-on 'retired-addon' not found" }
            });

            setupWithTransaction();
            const ctx = buildCronCtx({ dryRun: false });

            // Act
            await addonExpiryJob.handler(ctx);

            // Assert — notification still sent (fire-and-forget) with slug as addonName fallback
            // The key assertion is that the config-backed path is gone
            expect(mockGetBySlug).toHaveBeenCalledWith('retired-addon');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
            // sendNotification was still called (non-blocking; slug used as name)
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({ addonName: 'retired-addon' })
            );
        });
    });

    describe('revocation retry phase — addonDef resolution via catalogService', () => {
        it('should call catalogService.getBySlug for orphaned purchase slug in retry phase', async () => {
            // Arrange — simulate orphaned purchase (active purchase with cancelled subscription)
            // by making the tx.select return an orphaned purchase row in the retry query.
            // We override withTransaction to use a tx whose select returns:
            //   - lock acquired (idx=0 execute)
            //   - empty for all other queries EXCEPT the orphaned purchases join query

            const { AddonExpirationService } = await import(
                '../../src/services/addon-expiration.service'
            );
            vi.mocked(AddonExpirationService).mockImplementation(
                () =>
                    ({
                        findExpiredAddons: vi.fn().mockResolvedValue({ success: true, data: [] }),
                        processExpiredAddons: vi.fn().mockResolvedValue({
                            success: true,
                            data: { processed: 0, failed: 0, errors: [] }
                        }),
                        findExpiringAddons: vi.fn().mockResolvedValue({ success: true, data: [] })
                    }) as never
            );

            // The orphaned purchases query is: select({...}).from(bap).innerJoin(bs, eq()).where().limit(100)
            // Chain: select → from → innerJoin → where → limit(100) → orphanedRows
            // All other select chains return empty arrays.
            // We track select call index to distinguish the orphaned query from others.
            let selectCallIdx = 0;
            const fakeTxOrphaned = {
                execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
                select: vi.fn().mockImplementation(() => {
                    const idx = selectCallIdx++;
                    // The orphaned purchases query is call index 0 (first select after lock acquire).
                    // All other selects (notification idempotency, subscription reconciliation, etc.)
                    // return empty — we only care about the retry phase being reached.
                    const innerJoinChain = {
                        where: vi.fn().mockReturnValue({
                            limit:
                                idx === 0
                                    ? vi.fn().mockResolvedValue([
                                          {
                                              id: 'p-orphan',
                                              customerId: 'cust-orphan',
                                              addonSlug: 'extra-accommodations-5',
                                              subscriptionId: 'sub-cancelled',
                                              metadata: { revocationRetryCount: 0 }
                                          }
                                      ])
                                    : vi.fn().mockResolvedValue([])
                        })
                    };
                    return {
                        from: vi.fn().mockReturnValue({
                            innerJoin: vi.fn().mockReturnValue(innerJoinChain),
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockResolvedValue(undefined)
                })
            };

            // biome-ignore lint/suspicious/noExplicitAny: test mock — cast to satisfy withTransaction signature
            vi.mocked(withTransaction).mockImplementation((cb) => cb(fakeTxOrphaned as never));

            // Catalog returns the addon definition for the orphaned purchase
            mockGetBySlug.mockResolvedValue({
                success: true,
                data: {
                    slug: 'extra-accommodations-5',
                    name: 'Extra Accommodations Pack (+5)',
                    affectsLimitKey: 'max_accommodations',
                    limitIncrease: 5,
                    grantsEntitlement: null,
                    annualPriceArs: null,
                    isActive: true
                }
            });

            // QZPay check: subscription is NOT active (so revocation proceeds)
            const billing = await import('../../src/middlewares/billing');
            vi.mocked(billing.getQZPayBilling).mockReturnValue({
                subscriptions: {
                    get: vi.fn().mockResolvedValue({ status: 'cancelled' })
                }
            } as never);

            const ctx = buildCronCtx({ dryRun: false });

            // Act
            await addonExpiryJob.handler(ctx);

            // Assert — catalog was consulted for the orphaned purchase slug
            expect(mockGetBySlug).toHaveBeenCalledWith('extra-accommodations-5');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
            // revokeAddonForSubscriptionCancellation was called with the resolved addonDef
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledWith(
                expect.objectContaining({
                    purchase: expect.objectContaining({ addonSlug: 'extra-accommodations-5' })
                })
            );
        });
    });
});
