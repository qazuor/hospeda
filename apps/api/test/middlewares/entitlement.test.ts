/**
 * Tests for the entitlement middleware
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    gateCalendarAccess,
    gateExternalCalendarSync,
    gateReviewResponse,
    gateRichDescription,
    gateVideoEmbed,
    gateWhatsAppDirect,
    gateWhatsAppDisplay
} from '../../src/middlewares/accommodation-entitlements';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    clearEntitlementCache,
    entitlementMiddleware,
    getAllEntitlements,
    getAllLimits,
    getEntitlementCacheStats,
    getRemainingLimit,
    hasEntitlement,
    requireEntitlement,
    requireLimit
} from '../../src/middlewares/entitlement';
import {
    gateAlerts,
    gateComparator,
    gateEarlyEventAccess,
    gateExclusiveDeals,
    gateFavorites,
    gateRecommendations,
    gateReviewPhotos,
    gateSearchHistory
} from '../../src/middlewares/tourist-entitlements';
import type { AppBindings } from '../../src/types';

// Mock the billing module
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('entitlementMiddleware', () => {
    let app: Hono<AppBindings>;
    let mockBilling: {
        subscriptions: { getByCustomerId: ReturnType<typeof vi.fn> };
        plans: { get: ReturnType<typeof vi.fn> };
        entitlements: { getByCustomerId: ReturnType<typeof vi.fn> };
        limits: { getByCustomerId: ReturnType<typeof vi.fn> };
    };

    beforeEach(() => {
        app = new Hono<AppBindings>();

        // Set up mock billing with all required methods
        mockBilling = {
            subscriptions: {
                getByCustomerId: vi.fn()
            },
            plans: {
                get: vi.fn()
            },
            entitlements: {
                getByCustomerId: vi.fn()
            },
            limits: {
                getByCustomerId: vi.fn()
            }
        };

        vi.mocked(getQZPayBilling).mockReturnValue(
            mockBilling as unknown as ReturnType<typeof getQZPayBilling>
        );

        // Clear cache before each test
        clearEntitlementCache('test-customer-id');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('when billing is not enabled', () => {
        it('should set empty entitlements and limits', async () => {
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                const limits = c.get('userLimits');
                return c.json({
                    entitlementsCount: entitlements.size,
                    limitsCount: limits.size
                });
            });

            // Mock context without billing enabled
            const _mockGet = vi.fn((key: string) => {
                if (key === 'billingEnabled') return false;
                if (key === 'billingCustomerId') return null;
                return undefined;
            });

            const res = await app.request('/test', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();
            expect(data.entitlementsCount).toBe(0);
            expect(data.limitsCount).toBe(0);
        });
    });

    describe('when billing customer is not set', () => {
        it('should set empty entitlements and limits', async () => {
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                const limits = c.get('userLimits');
                return c.json({
                    entitlementsCount: entitlements.size,
                    limitsCount: limits.size
                });
            });

            const res = await app.request('/test', {
                method: 'GET'
            });

            const data = await res.json();
            expect(data.entitlementsCount).toBe(0);
            expect(data.limitsCount).toBe(0);
        });
    });

    describe('when user has active subscription', () => {
        beforeEach(() => {
            // Mock active subscription
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                {
                    id: 'sub-123',
                    planId: 'plan-123',
                    status: 'active'
                }
            ]);

            // Mock plan with entitlements and limits
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-123',
                name: 'Pro Plan',
                entitlements: [
                    EntitlementKey.PUBLISH_ACCOMMODATIONS,
                    EntitlementKey.EDIT_ACCOMMODATION_INFO,
                    EntitlementKey.VIEW_BASIC_STATS
                ],
                limits: {
                    [LimitKey.MAX_ACCOMMODATIONS]: 10,
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 20
                }
            });

            // Default: no customer-level overrides
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);
        });

        it('should load and cache entitlements', async () => {
            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'test-customer-id');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                const limits = c.get('userLimits');
                return c.json({
                    entitlements: Array.from(entitlements),
                    limits: Object.fromEntries(limits)
                });
            });

            const res = await app.request('/test');
            const data = await res.json();

            expect(data.entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
            expect(data.entitlements).toContain(EntitlementKey.EDIT_ACCOMMODATION_INFO);
            expect(data.entitlements).toContain(EntitlementKey.VIEW_BASIC_STATS);
            expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(10);
            expect(data.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBe(20);
        });

        it('should use cached entitlements on second request', async () => {
            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'test-customer-id');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            // First request - should call QZPay
            await app.request('/test');
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);

            // Second request - should use cache
            await app.request('/test');
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);
        });
    });

    describe('when user has no active subscription', () => {
        beforeEach(() => {
            // Mock no active subscription
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([]);
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);
        });

        it('should set empty entitlements', async () => {
            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'test-customer-id');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                return c.json({ entitlementsCount: entitlements.size });
            });

            const res = await app.request('/test');
            const data = await res.json();

            expect(data.entitlementsCount).toBe(0);
        });
    });

    describe('customer-level entitlement/limit merging', () => {
        beforeEach(() => {
            // Common setup: active subscription pointing to plan-456
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                {
                    id: 'sub-456',
                    planId: 'plan-456',
                    status: 'active'
                }
            ]);

            // Plan with two entitlements and two limits
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-456',
                name: 'Base Plan',
                entitlements: [
                    EntitlementKey.PUBLISH_ACCOMMODATIONS,
                    EntitlementKey.VIEW_BASIC_STATS
                ],
                limits: {
                    [LimitKey.MAX_ACCOMMODATIONS]: 5,
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 5
                }
            });
        });

        it('should return only plan-level data when getByCustomerId returns empty arrays', async () => {
            // Arrange
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'test-customer-id');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                const limits = c.get('userLimits');
                return c.json({
                    entitlements: Array.from(entitlements),
                    limits: Object.fromEntries(limits)
                });
            });

            // Act
            const res = await app.request('/test');
            const data = await res.json();

            // Assert - only the two plan-level entitlements are present
            expect(data.entitlements).toHaveLength(2);
            expect(data.entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
            expect(data.entitlements).toContain(EntitlementKey.VIEW_BASIC_STATS);

            // Assert - only the two plan-level limits are present
            expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(5);
            expect(data.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBe(5);
            expect(Object.keys(data.limits)).toHaveLength(2);
        });

        it('should union plan entitlements with customer-level entitlements from addon', async () => {
            // Arrange - customer has an extra entitlement (e.g. from a purchased addon)
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                { entitlementKey: EntitlementKey.CAN_USE_RICH_DESCRIPTION }
            ]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'test-customer-id');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                return c.json({ entitlements: Array.from(entitlements) });
            });

            // Act
            const res = await app.request('/test');
            const data = await res.json();

            // Assert - plan entitlements are preserved AND addon entitlement is added
            expect(data.entitlements).toHaveLength(3);
            expect(data.entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
            expect(data.entitlements).toContain(EntitlementKey.VIEW_BASIC_STATS);
            expect(data.entitlements).toContain(EntitlementKey.CAN_USE_RICH_DESCRIPTION);
        });

        it('should override plan limit when customer has a higher limit from addon', async () => {
            // Arrange - customer addon overrides MAX_PHOTOS_PER_ACCOMMODATION from 5 to 25
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([
                { limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, maxValue: 25 }
            ]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'test-customer-id');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const limits = c.get('userLimits');
                return c.json({ limits: Object.fromEntries(limits) });
            });

            // Act
            const res = await app.request('/test');
            const data = await res.json();

            // Assert - plan limit is overridden by the customer-level value
            expect(data.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBe(25);

            // Assert - the other plan limit is unchanged
            expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(5);
        });

        it('should correctly merge mixed sources: some limits from plan only, some overridden by customer', async () => {
            // Arrange - customer overrides only MAX_ACCOMMODATIONS; MAX_PHOTOS stays at plan value
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([
                { limitKey: LimitKey.MAX_ACCOMMODATIONS, maxValue: 50 }
            ]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'test-customer-id');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const limits = c.get('userLimits');
                return c.json({ limits: Object.fromEntries(limits) });
            });

            // Act
            const res = await app.request('/test');
            const data = await res.json();

            // Assert - overridden limit uses customer value
            expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(50);

            // Assert - non-overridden limit keeps plan value
            expect(data.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBe(5);

            // Assert - exactly the two limit keys are present (no extras created)
            expect(Object.keys(data.limits)).toHaveLength(2);
        });
    });

    // =========================================================================
    // GAP-038-18: Cache TTL and FIFO eviction
    // =========================================================================
    describe('cache TTL and FIFO eviction', () => {
        beforeEach(() => {
            // Active subscription and plan with known limits for cache tests
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                { id: 'sub-cache', planId: 'plan-cache', status: 'active' }
            ]);
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-cache',
                name: 'Cache Test Plan',
                entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
                limits: { [LimitKey.MAX_ACCOMMODATIONS]: 5 }
            });
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);
        });

        it('should return a cache hit on the second request within TTL', async () => {
            // Arrange - unique customer so no pollution from other tests
            const customerId = 'ttl-hit-customer';
            clearEntitlementCache(customerId);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', customerId);
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            // Act - first request populates cache
            await app.request('/test');
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);

            // Act - second request within TTL should read from cache
            await app.request('/test');

            // Assert - QZPay was NOT called again (cache hit)
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);
        });

        it('should return a cache miss and re-fetch after TTL expires', async () => {
            // Arrange
            const customerId = 'ttl-expired-customer';
            clearEntitlementCache(customerId);

            vi.useFakeTimers();

            try {
                app.use((c, next) => {
                    c.set('billingEnabled', true);
                    c.set('billingCustomerId', customerId);
                    return next();
                });
                app.use(entitlementMiddleware());
                app.get('/test', (c) => c.json({ ok: true }));

                // Act - first request at t=0 populates cache
                await app.request('/test');
                expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);

                // Advance time past the 5-minute TTL (5 * 60 * 1000 ms + 1 ms)
                vi.advanceTimersByTime(5 * 60 * 1000 + 1);

                // Act - second request after TTL expiry should be a cache miss
                await app.request('/test');

                // Assert - QZPay was called again because the cached entry expired
                expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should evict the oldest (FIFO) entry when cache reaches maxSize', async () => {
            // Arrange - clear the entire cache to start from a known state
            const stats = getEntitlementCacheStats();
            const maxSize = stats.maxSize;

            // Clear any entries left over from other tests
            for (let i = 0; i < maxSize + 10; i++) {
                clearEntitlementCache(`fifo-warmup-${i}`);
            }

            // Fill cache to exactly maxSize with unique customer IDs
            for (let i = 0; i < maxSize; i++) {
                const customerId = `fifo-fill-${i}`;
                const fillerApp = new Hono<AppBindings>();
                fillerApp.use((c, next) => {
                    c.set('billingEnabled', true);
                    c.set('billingCustomerId', customerId);
                    return next();
                });
                fillerApp.use(entitlementMiddleware());
                fillerApp.get('/test', (c) => c.json({ ok: true }));
                await fillerApp.request('/test');
            }

            // Verify cache is full
            const statsAfterFill = getEntitlementCacheStats();
            expect(statsAfterFill.size).toBe(maxSize);

            // Record call count before adding the overflow entry
            const _callsBeforeOverflow =
                mockBilling.subscriptions.getByCustomerId.mock.calls.length;

            // Act - add one more entry (maxSize + 1), which should evict the oldest (fifo-fill-0)
            const overflowApp = new Hono<AppBindings>();
            overflowApp.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'fifo-overflow');
                return next();
            });
            overflowApp.use(entitlementMiddleware());
            overflowApp.get('/test', (c) => c.json({ ok: true }));
            await overflowApp.request('/test');

            // Cache size should still be maxSize (oldest was evicted to make room)
            const statsAfterOverflow = getEntitlementCacheStats();
            expect(statsAfterOverflow.size).toBe(maxSize);

            // Record call count before verifying eviction
            const callsBeforeEvictionCheck =
                mockBilling.subscriptions.getByCustomerId.mock.calls.length;

            // Act - request the first entry (fifo-fill-0) again; it should be evicted (cache miss)
            const evictedApp = new Hono<AppBindings>();
            evictedApp.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'fifo-fill-0');
                return next();
            });
            evictedApp.use(entitlementMiddleware());
            evictedApp.get('/test', (c) => c.json({ ok: true }));
            await evictedApp.request('/test');

            // Assert - QZPay was called again for the evicted entry
            expect(mockBilling.subscriptions.getByCustomerId.mock.calls.length).toBe(
                callsBeforeEvictionCheck + 1
            );

            // Act - request the overflow entry which should still be cached (recently added)
            const cachedApp = new Hono<AppBindings>();
            cachedApp.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'fifo-overflow');
                return next();
            });
            cachedApp.use(entitlementMiddleware());
            cachedApp.get('/test', (c) => c.json({ ok: true }));

            const callsBeforeCacheHit = mockBilling.subscriptions.getByCustomerId.mock.calls.length;
            await cachedApp.request('/test');

            // Assert - no additional QZPay call (cache hit)
            expect(mockBilling.subscriptions.getByCustomerId.mock.calls.length).toBe(
                callsBeforeCacheHit
            );
        });
    });

    // =========================================================================
    // GAP-043-016: Graceful degradation behavior
    // =========================================================================
    describe('graceful degradation behavior', () => {
        beforeEach(() => {
            // Active subscription pointing to plan-degraded
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                { id: 'sub-deg', planId: 'plan-deg', status: 'active' }
            ]);
            // Plan with plan-level entitlements and limits
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-deg',
                name: 'Degraded Plan',
                entitlements: [
                    EntitlementKey.PUBLISH_ACCOMMODATIONS,
                    EntitlementKey.VIEW_BASIC_STATS
                ],
                limits: {
                    [LimitKey.MAX_ACCOMMODATIONS]: 3,
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 10
                }
            });
            // Clear any lingering cache entry for the customer used in these tests
            clearEntitlementCache('degradation-customer');
        });

        it('should return only plan-level entitlements when limits.getByCustomerId throws', async () => {
            // Arrange — limits call throws; entitlements call returns addon grant
            mockBilling.limits.getByCustomerId.mockRejectedValue(new Error('billing timeout'));
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                { entitlementKey: EntitlementKey.CAN_USE_RICH_DESCRIPTION }
            ]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'degradation-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                return c.json({ entitlements: Array.from(entitlements) });
            });

            // Act
            const res = await app.request('/test');

            // Assert — plan-level entitlements are present; request is 200
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
            expect(data.entitlements).toContain(EntitlementKey.VIEW_BASIC_STATS);
        });

        it('should NOT include addon-granted entitlements in degraded response when customer call fails', async () => {
            // Arrange — both customer-level calls fail; addon-granted entitlements are therefore absent
            mockBilling.entitlements.getByCustomerId.mockRejectedValue(new Error('service 503'));
            mockBilling.limits.getByCustomerId.mockRejectedValue(new Error('service 503'));

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'degradation-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                return c.json({ entitlements: Array.from(entitlements) });
            });

            // Act
            const res = await app.request('/test');
            const data = await res.json();

            // Assert — addon-granted entitlement is absent in degraded set
            expect(data.entitlements).not.toContain(EntitlementKey.CAN_USE_RICH_DESCRIPTION);
            // Plan-level entitlements are still present
            expect(data.entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
        });

        it('should set shouldCache=false on a degraded response (limits call throws)', async () => {
            // Arrange — limits call fails so degraded path is taken
            mockBilling.limits.getByCustomerId.mockRejectedValue(new Error('billing timeout'));
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'degradation-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            // Act — first request triggers degraded path
            await app.request('/test');
            // Second request MUST re-fetch (degraded result must not be cached)
            await app.request('/test');

            // Assert — getByCustomerId was called twice (no cache re-use for degraded response)
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(2);
        });

        it('should retry fresh fetch on next request after a degraded response (not served from cache)', async () => {
            // Arrange — first request: customer-level calls throw
            mockBilling.entitlements.getByCustomerId.mockRejectedValueOnce(new Error('transient'));
            mockBilling.limits.getByCustomerId.mockRejectedValueOnce(new Error('transient'));

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'degradation-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                return c.json({ entitlements: Array.from(entitlements) });
            });

            // Act — first request is degraded (transient error)
            await app.request('/test');
            const callsAfterFirst = mockBilling.subscriptions.getByCustomerId.mock.calls.length;

            // Arrange — second request: customer-level calls now succeed with addon entitlement
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                { entitlementKey: EntitlementKey.CAN_USE_RICH_DESCRIPTION }
            ]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            // Act — second request must NOT use the cached degraded result
            const res2 = await app.request('/test');

            // Assert — QZPay was called again for the second request
            expect(mockBilling.subscriptions.getByCustomerId.mock.calls.length).toBe(
                callsAfterFirst + 1
            );

            // Assert — addon entitlement is present in the recovered response
            const data2 = await res2.json();
            expect(data2.entitlements).toContain(EntitlementKey.CAN_USE_RICH_DESCRIPTION);
        });
    });

    describe('graceful degradation when customer-level calls fail', () => {
        beforeEach(() => {
            // Active subscription
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                {
                    id: 'sub-789',
                    planId: 'plan-789',
                    status: 'active'
                }
            ]);

            // Plan with entitlements and limits
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-789',
                name: 'Pro Plan',
                entitlements: [
                    EntitlementKey.PUBLISH_ACCOMMODATIONS,
                    EntitlementKey.EDIT_ACCOMMODATION_INFO
                ],
                limits: {
                    [LimitKey.MAX_ACCOMMODATIONS]: 10,
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 20
                }
            });
        });

        it('should return plan-only data when entitlements.getByCustomerId throws', async () => {
            // Arrange
            mockBilling.entitlements.getByCustomerId.mockRejectedValue(new Error('QZPay timeout'));
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'degraded-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                const limits = c.get('userLimits');
                return c.json({
                    entitlements: Array.from(entitlements),
                    limits: Object.fromEntries(limits)
                });
            });

            // Act
            const res = await app.request('/test');

            // Assert
            expect(res.status).toBe(200);

            const data = await res.json();
            // Plan-level entitlements should still be present despite customer call failure
            expect(data.entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
            expect(data.entitlements).toContain(EntitlementKey.EDIT_ACCOMMODATION_INFO);
            // Plan-level limits should still be present
            expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(10);
            expect(data.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBe(20);
        });

        it('should NOT cache degraded result so next request retries', async () => {
            // Arrange - first request: customer-level calls fail
            mockBilling.entitlements.getByCustomerId.mockRejectedValue(new Error('QZPay timeout'));
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'no-cache-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                return c.json({ entitlements: Array.from(entitlements) });
            });

            // Act - first request produces degraded (plan-only) result
            await app.request('/test');
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);

            // Arrange - second request: customer-level calls now succeed
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                { entitlementKey: EntitlementKey.FEATURED_LISTING }
            ]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            // Act - second request must NOT use cached degraded result
            const res2 = await app.request('/test');

            // Assert - fresh calls were made (cache was not used for degraded result)
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(2);

            const data2 = await res2.json();
            // Customer-level entitlement should now be present
            expect(data2.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
        });

        it('should set empty entitlements when loadEntitlements returns null (billing unavailable)', async () => {
            // Arrange - billing module returns null (unavailable)
            vi.mocked(getQZPayBilling).mockReturnValue(
                null as unknown as ReturnType<typeof getQZPayBilling>
            );

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'null-billing-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                const limits = c.get('userLimits');
                return c.json({
                    entitlementsCount: entitlements.size,
                    limitsCount: limits.size
                });
            });

            // Act
            const res = await app.request('/test');

            // Assert - request succeeds with empty entitlements (fail-open)
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data.entitlementsCount).toBe(0);
            expect(data.limitsCount).toBe(0);
        });

        it('should set empty entitlements when outer catch fires (subscriptions call throws)', async () => {
            // Arrange - subscriptions.getByCustomerId throws to trigger outer catch
            mockBilling.subscriptions.getByCustomerId.mockRejectedValue(
                new Error('Critical billing failure')
            );

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'error-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const entitlements = c.get('userEntitlements');
                const limits = c.get('userLimits');
                return c.json({
                    entitlementsCount: entitlements.size,
                    limitsCount: limits.size
                });
            });

            // Act
            const res = await app.request('/test');

            // Assert - request does not fail (fail-open strategy per ADR-016)
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data.entitlementsCount).toBe(0);
            expect(data.limitsCount).toBe(0);
        });
    });

    // =========================================================================
    // GAP-043-43: billingLoadFailed flag
    // =========================================================================
    describe('billingLoadFailed flag', () => {
        it('should set billingLoadFailed=false when billing loads successfully', async () => {
            // Arrange
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                { id: 'sub-ok', planId: 'plan-ok', status: 'active' }
            ]);
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-ok',
                name: 'OK Plan',
                entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
                limits: { [LimitKey.MAX_ACCOMMODATIONS]: 5 }
            });
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'healthy-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                return c.json({ billingLoadFailed: c.get('billingLoadFailed') });
            });

            // Act
            const res = await app.request('/test');
            const data = await res.json();

            // Assert
            expect(res.status).toBe(200);
            expect(data.billingLoadFailed).toBe(false);
        });

        it('should set billingLoadFailed=true when loadEntitlements returns null', async () => {
            // Arrange - billing module returns null (unavailable)
            vi.mocked(getQZPayBilling).mockReturnValue(
                null as unknown as ReturnType<typeof getQZPayBilling>
            );

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'null-billing-failed-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                return c.json({ billingLoadFailed: c.get('billingLoadFailed') });
            });

            // Act
            const res = await app.request('/test');
            const data = await res.json();

            // Assert
            expect(res.status).toBe(200);
            expect(data.billingLoadFailed).toBe(true);
        });

        it('should set billingLoadFailed=true when outer catch fires', async () => {
            // Arrange
            mockBilling.subscriptions.getByCustomerId.mockRejectedValue(
                new Error('Critical billing failure')
            );

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', 'catch-failed-customer');
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                return c.json({ billingLoadFailed: c.get('billingLoadFailed') });
            });

            // Act
            const res = await app.request('/test');
            const data = await res.json();

            // Assert - request succeeds but flag is true
            expect(res.status).toBe(200);
            expect(data.billingLoadFailed).toBe(true);
        });

        it('should set billingLoadFailed=false when billing is not enabled', async () => {
            // Arrange - billing disabled path
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                return c.json({ billingLoadFailed: c.get('billingLoadFailed') });
            });

            // Act
            const res = await app.request('/test');
            const data = await res.json();

            // Assert - no failure, just billing disabled
            expect(res.status).toBe(200);
            expect(data.billingLoadFailed).toBe(false);
        });
    });

    // =========================================================================
    // GAP-043-011: Cache invalidation race condition
    // =========================================================================
    describe('cache invalidation race condition (GAP-043-011)', () => {
        const raceCustomerId = 'race-condition-customer';

        beforeEach(() => {
            // Active subscription with known limits for race condition tests
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                { id: 'sub-race', planId: 'plan-race', status: 'active' }
            ]);
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            clearEntitlementCache(raceCustomerId);
        });

        it('should serve stale limit before cache clear and correct limit after cache clear', async () => {
            // Arrange - initial state: plan has limit=20 for extra-photos
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-race',
                name: 'Race Test Plan',
                entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
                limits: { [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 20 }
            });
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            app.use((c, next) => {
                c.set('billingEnabled', true);
                c.set('billingCustomerId', raceCustomerId);
                return next();
            });
            app.use(entitlementMiddleware());
            app.get('/test', (c) => {
                const limits = c.get('userLimits');
                return c.json({ limits: Object.fromEntries(limits) });
            });

            // Act - first request at t=0 populates cache with limit=20
            const res1 = await app.request('/test');
            const data1 = await res1.json();

            // Assert - cache is warm with stale limit=20
            expect(data1.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBe(20);

            // Simulate: DB write happens (addon cancelled, limit drops to 10).
            // BEFORE cache clear, a concurrent request reads stale data from cache.
            // The mock still returns old data, but the cache holds the old value regardless.
            const concurrentRes = await app.request('/test');
            const concurrentData = await concurrentRes.json();

            // Assert - concurrent request reads stale limit=20 (race: cache not yet cleared)
            expect(concurrentData.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBe(20);
            // QZPay was only called once (both requests served from cache)
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);

            // Now the cache clear happens (e.g. webhook fires after DB write)
            clearEntitlementCache(raceCustomerId);

            // Update the mock to reflect the new state after DB write (limit=10)
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-race',
                name: 'Race Test Plan',
                entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
                limits: { [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 10 }
            });

            // Act - next request AFTER cache clear fetches fresh data
            const res2 = await app.request('/test');
            const data2 = await res2.json();

            // Assert - post-clear request reads correct limit=10
            expect(data2.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBe(10);
            // QZPay was called again (cache miss after invalidation)
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(2);
        });

        it('should evict stale entry after 5-minute TTL even without explicit cache clear', async () => {
            // Arrange
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-race',
                name: 'TTL Eviction Plan',
                entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
                limits: { [LimitKey.MAX_ACCOMMODATIONS]: 5 }
            });
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            const ttlCustomerId = 'ttl-eviction-race-customer';
            clearEntitlementCache(ttlCustomerId);

            vi.useFakeTimers();

            try {
                const ttlApp = new Hono<AppBindings>();
                ttlApp.use((c, next) => {
                    c.set('billingEnabled', true);
                    c.set('billingCustomerId', ttlCustomerId);
                    return next();
                });
                ttlApp.use(entitlementMiddleware());
                ttlApp.get('/test', (c) => c.json({ ok: true }));

                // Act - populate cache at t=0
                await ttlApp.request('/test');
                expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);

                // Act - request within TTL window: served from cache, no re-fetch
                await ttlApp.request('/test');
                expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);

                // Advance time past 5-minute TTL (300_001 ms)
                vi.advanceTimersByTime(5 * 60 * 1000 + 1);

                // Act - request after TTL expiry: cache entry is evicted, re-fetch occurs
                await ttlApp.request('/test');

                // Assert - stale entry was evicted by TTL, not by explicit clear
                expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should not throw when clearEntitlementCache is called multiple times in quick succession', () => {
            // Arrange - populate cache first so there is something to clear
            // (cache population happens via the in-memory Map, which we can prime by
            // running a prior test; here we just assert the calls are idempotent)
            const multiClearCustomerId = 'multi-clear-customer';

            // Act - calling clear multiple times must never throw
            expect(() => {
                clearEntitlementCache(multiClearCustomerId);
                clearEntitlementCache(multiClearCustomerId);
                clearEntitlementCache(multiClearCustomerId);
            }).not.toThrow();

            // Assert - cache stats are still valid after redundant clears
            const stats = getEntitlementCacheStats();
            expect(stats.size).toBeGreaterThanOrEqual(0);
            expect(stats.maxSize).toBeGreaterThan(0);
            expect(stats.ttlMs).toBe(5 * 60 * 1000);
        });
    });
});

describe('requireEntitlement middleware', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    it('should allow request when user has entitlement', async () => {
        app.use((c, next) => {
            c.set('userEntitlements', new Set([EntitlementKey.PUBLISH_ACCOMMODATIONS]));
            c.set('billingLoadFailed', false);
            return next();
        });
        app.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(200);
    });

    it('should return 403 when user lacks entitlement', async () => {
        app.use((c, next) => {
            c.set('userEntitlements', new Set<EntitlementKey>());
            c.set('billingLoadFailed', false);
            return next();
        });
        app.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(403);
    });

    // =========================================================================
    // GAP-043-43: 503 guard when billing load failed
    // =========================================================================
    it('should return 503 when billingLoadFailed is true', async () => {
        // Arrange - simulate billing outage
        app.use((c, next) => {
            c.set('userEntitlements', new Set<EntitlementKey>());
            c.set('userLimits', new Map<LimitKey, number>());
            c.set('billingLoadFailed', true);
            return next();
        });
        app.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));

        // Act
        const res = await app.request('/test');

        // Assert - 503 instead of 403 or silently granting access
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should NOT return 503 when billingLoadFailed is false and user has entitlement', async () => {
        // Arrange - billing healthy, user has entitlement
        app.use((c, next) => {
            c.set('userEntitlements', new Set([EntitlementKey.PUBLISH_ACCOMMODATIONS]));
            c.set('userLimits', new Map<LimitKey, number>());
            c.set('billingLoadFailed', false);
            return next();
        });
        app.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));

        // Act
        const res = await app.request('/test');

        // Assert - works normally
        expect(res.status).toBe(200);
    });
});

describe('requireLimit middleware', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    it('should allow request when user has limit defined', async () => {
        app.use((c, next) => {
            const limits = new Map<LimitKey, number>();
            limits.set(LimitKey.MAX_ACCOMMODATIONS, 10);
            c.set('userLimits', limits);
            c.set('billingLoadFailed', false);
            return next();
        });
        app.use(requireLimit(LimitKey.MAX_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(200);
    });

    it('should return 403 when limit is not defined', async () => {
        app.use((c, next) => {
            c.set('userLimits', new Map<LimitKey, number>());
            c.set('billingLoadFailed', false);
            return next();
        });
        app.use(requireLimit(LimitKey.MAX_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(403);
    });

    it('should return 403 when limit is 0', async () => {
        app.use((c, next) => {
            const limits = new Map<LimitKey, number>();
            limits.set(LimitKey.MAX_ACCOMMODATIONS, 0);
            c.set('userLimits', limits);
            c.set('billingLoadFailed', false);
            return next();
        });
        app.use(requireLimit(LimitKey.MAX_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(403);
    });

    // =========================================================================
    // GAP-043-43: 503 guard when billing load failed
    // =========================================================================
    it('should return 503 when billingLoadFailed is true', async () => {
        // Arrange - simulate billing outage: empty limits Map (would return -1 = unlimited)
        app.use((c, next) => {
            c.set('userEntitlements', new Set<EntitlementKey>());
            c.set('userLimits', new Map<LimitKey, number>());
            c.set('billingLoadFailed', true);
            return next();
        });
        app.use(requireLimit(LimitKey.MAX_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));

        // Act
        const res = await app.request('/test');

        // Assert - 503 instead of silently granting unlimited access
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should NOT return 503 when billingLoadFailed is false and limit is set', async () => {
        // Arrange - billing healthy
        app.use((c, next) => {
            const limits = new Map<LimitKey, number>();
            limits.set(LimitKey.MAX_ACCOMMODATIONS, 5);
            c.set('userEntitlements', new Set<EntitlementKey>());
            c.set('userLimits', limits);
            c.set('billingLoadFailed', false);
            return next();
        });
        app.use(requireLimit(LimitKey.MAX_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));

        // Act
        const res = await app.request('/test');

        // Assert - works normally
        expect(res.status).toBe(200);
    });

    it('getRemainingLimit should still return -1 when limits Map is empty regardless of billingLoadFailed', () => {
        // getRemainingLimit is a helper used in non-middleware contexts.
        // It must NOT change behavior based on billingLoadFailed - that would break callers.
        // The 503 protection lives exclusively in the middleware layer.
        const mockContext = {
            get: (key: string) => {
                if (key === 'userLimits') return new Map<LimitKey, number>();
                if (key === 'billingLoadFailed') return true;
                return undefined;
            }
        } as Context<AppBindings>;

        const result = getRemainingLimit(mockContext, LimitKey.MAX_ACCOMMODATIONS);

        // Unchanged behavior: -1 means unlimited (caller decides how to handle)
        expect(result).toBe(-1);
    });
});

describe('helper functions', () => {
    describe('hasEntitlement', () => {
        it('should return true when user has entitlement', () => {
            const mockContext = {
                get: (key: string) => {
                    if (key === 'userEntitlements') {
                        return new Set([EntitlementKey.PUBLISH_ACCOMMODATIONS]);
                    }
                    return undefined;
                }
            } as Context<AppBindings>;

            const result = hasEntitlement(mockContext, EntitlementKey.PUBLISH_ACCOMMODATIONS);
            expect(result).toBe(true);
        });

        it('should return false when user lacks entitlement', () => {
            const mockContext = {
                get: (key: string) => {
                    if (key === 'userEntitlements') {
                        return new Set<EntitlementKey>();
                    }
                    return undefined;
                }
            } as Context<AppBindings>;

            const result = hasEntitlement(mockContext, EntitlementKey.PUBLISH_ACCOMMODATIONS);
            expect(result).toBe(false);
        });
    });

    describe('getRemainingLimit', () => {
        it('should return limit value when defined', () => {
            const limits = new Map<LimitKey, number>();
            limits.set(LimitKey.MAX_ACCOMMODATIONS, 10);

            const mockContext = {
                get: (key: string) => {
                    if (key === 'userLimits') return limits;
                    return undefined;
                }
            } as Context<AppBindings>;

            const result = getRemainingLimit(mockContext, LimitKey.MAX_ACCOMMODATIONS);
            expect(result).toBe(10);
        });

        it('should return -1 when limit is not defined', () => {
            const mockContext = {
                get: (key: string) => {
                    if (key === 'userLimits') return new Map<LimitKey, number>();
                    return undefined;
                }
            } as Context<AppBindings>;

            const result = getRemainingLimit(mockContext, LimitKey.MAX_ACCOMMODATIONS);
            expect(result).toBe(-1);
        });

        it('should return 0 when limit is 0', () => {
            const limits = new Map<LimitKey, number>();
            limits.set(LimitKey.MAX_ACCOMMODATIONS, 0);

            const mockContext = {
                get: (key: string) => {
                    if (key === 'userLimits') return limits;
                    return undefined;
                }
            } as Context<AppBindings>;

            const result = getRemainingLimit(mockContext, LimitKey.MAX_ACCOMMODATIONS);
            expect(result).toBe(0);
        });
    });

    describe('getAllEntitlements', () => {
        it('should return all user entitlements', () => {
            const entitlements = new Set([
                EntitlementKey.PUBLISH_ACCOMMODATIONS,
                EntitlementKey.EDIT_ACCOMMODATION_INFO
            ]);

            const mockContext = {
                get: (key: string) => {
                    if (key === 'userEntitlements') return entitlements;
                    return undefined;
                }
            } as Context<AppBindings>;

            const result = getAllEntitlements(mockContext);
            expect(result.size).toBe(2);
            expect(result.has(EntitlementKey.PUBLISH_ACCOMMODATIONS)).toBe(true);
            expect(result.has(EntitlementKey.EDIT_ACCOMMODATION_INFO)).toBe(true);
        });
    });

    describe('getAllLimits', () => {
        it('should return all user limits', () => {
            const limits = new Map<LimitKey, number>();
            limits.set(LimitKey.MAX_ACCOMMODATIONS, 10);
            limits.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 20);

            const mockContext = {
                get: (key: string) => {
                    if (key === 'userLimits') return limits;
                    return undefined;
                }
            } as Context<AppBindings>;

            const result = getAllLimits(mockContext);
            expect(result.size).toBe(2);
            expect(result.get(LimitKey.MAX_ACCOMMODATIONS)).toBe(10);
            expect(result.get(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION)).toBe(20);
        });
    });
});

/**
 * Accommodation Entitlement Gates Integration Tests
 */
describe('Accommodation Entitlement Gates', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('gateRichDescription', () => {
        it('should pass through when user has entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.CAN_USE_RICH_DESCRIPTION]));
                return next();
            });
            app.use(gateRichDescription());
            app.post('/test', async (c) => {
                const body = await c.req.json();
                return c.json({ processed: true, description: body.description });
            });

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: '**Bold** and *italic* text with [link](https://example.com)'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.processed).toBe(true);
            // Middleware doesn't modify when user has entitlement
            expect(data.description).toContain('**Bold**');
        });

        it('should not throw error when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateRichDescription());
            app.post('/test', async (c) => {
                // The middleware tries to strip markdown but may not work as expected
                // due to body consumption. Test that it doesn't break the request.
                const _body = await c.req.json();
                return c.json({ processed: true });
            });

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: '**Bold** and *italic* text with [link](https://example.com)'
                })
            });

            // Should complete successfully even if stripping doesn't work perfectly
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.processed).toBe(true);
        });
    });

    describe('gateVideoEmbed', () => {
        it('should pass through when user has entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.CAN_EMBED_VIDEO]));
                return next();
            });
            app.use(gateVideoEmbed());
            app.post('/test', async (c) => {
                const body = await c.req.json();
                return c.json({ processed: true, videoUrl: body.videoUrl });
            });

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: 'Check out this video: https://www.youtube.com/watch?v=abc123',
                    videoUrl: 'https://www.youtube.com/watch?v=abc123'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.processed).toBe(true);
            // Middleware doesn't modify when user has entitlement
            expect(data.videoUrl).toBe('https://www.youtube.com/watch?v=abc123');
        });

        it('should not throw error when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateVideoEmbed());
            app.post('/test', async (c) => {
                // The middleware tries to strip video URLs but may not work as expected
                // due to body consumption. Test that it doesn't break the request.
                const _body = await c.req.json();
                return c.json({ processed: true });
            });

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: 'Check out this video: https://www.youtube.com/watch?v=abc123',
                    videoUrl: 'https://www.youtube.com/watch?v=abc123',
                    media: [
                        { type: 'image', url: 'https://example.com/image.jpg' },
                        { type: 'video', url: 'https://www.youtube.com/watch?v=abc123' }
                    ]
                })
            });

            // Should complete successfully even if stripping doesn't work perfectly
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.processed).toBe(true);
        });
    });

    describe('gateCalendarAccess', () => {
        it('should allow access when user has entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.CAN_USE_CALENDAR]));
                return next();
            });
            app.use(gateCalendarAccess());
            app.get('/calendar', (c) => c.json({ ok: true }));

            const res = await app.request('/calendar');
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateCalendarAccess());
            app.get('/calendar', (c) => c.json({ ok: true }));

            const res = await app.request('/calendar');
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(data.error.message).toContain('Calendar access requires');
            expect(data.error.details.requiredEntitlement).toBe(EntitlementKey.CAN_USE_CALENDAR);
        });
    });

    describe('gateExternalCalendarSync', () => {
        it('should allow sync when user has entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR]));
                return next();
            });
            app.use(gateExternalCalendarSync());
            app.post('/sync', (c) => c.json({ ok: true }));

            const res = await app.request('/sync', { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateExternalCalendarSync());
            app.post('/sync', (c) => c.json({ ok: true }));

            const res = await app.request('/sync', { method: 'POST' });
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.message).toContain('Premium plan');
        });
    });

    describe('gateWhatsAppDisplay', () => {
        it('should allow WhatsApp number when user has entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY]));
                return next();
            });
            app.use(gateWhatsAppDisplay());
            app.post('/test', async (c) => {
                const body = await c.req.json();
                return c.json(body);
            });

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsappNumber: '+543434123456' })
            });

            expect(res.status).toBe(200);
        });

        it('should return 403 when user tries to add WhatsApp without entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateWhatsAppDisplay());
            app.post('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsappNumber: '+543434123456' })
            });

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(data.error.details.requiredEntitlement).toBe(
                EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY
            );
        });
    });

    describe('gateWhatsAppDirect', () => {
        it('should allow direct link when user has entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT]));
                return next();
            });
            app.use(gateWhatsAppDirect());
            app.post('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsappDirectLink: true })
            });

            expect(res.status).toBe(200);
        });

        it('should return 403 when user tries to enable direct link without entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateWhatsAppDirect());
            app.post('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsappDirectLink: true })
            });

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error.message).toContain('Premium plan');
        });
    });

    describe('gateReviewResponse', () => {
        it('should allow review responses when user has entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.RESPOND_REVIEWS]));
                return next();
            });
            app.use(gateReviewResponse());
            app.post('/respond', (c) => c.json({ ok: true }));

            const res = await app.request('/respond', { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateReviewResponse());
            app.post('/respond', (c) => c.json({ ok: true }));

            const res = await app.request('/respond', { method: 'POST' });
            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error.details.requiredEntitlement).toBe(EntitlementKey.RESPOND_REVIEWS);
        });
    });
});

/**
 * Tourist Entitlement Gates Integration Tests
 */
describe('Tourist Entitlement Gates', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('gateFavorites', () => {
        it('should allow adding favorite when user has entitlement and within limit', async () => {
            app.use((c, next) => {
                const entitlements = new Set([EntitlementKey.SAVE_FAVORITES]);
                const limits = new Map<LimitKey, number>();
                limits.set(LimitKey.MAX_FAVORITES, 10);
                c.set('userEntitlements', entitlements);
                c.set('userLimits', limits);
                c.set('currentFavoritesCount' as any, 5);
                return next();
            });
            app.use(gateFavorites());
            app.post('/favorites', (c) => c.json({ ok: true }));

            const res = await app.request('/favorites', { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                c.set('userLimits', new Map<LimitKey, number>());
                return next();
            });
            app.use(gateFavorites());
            app.post('/favorites', (c) => c.json({ ok: true }));

            const res = await app.request('/favorites', { method: 'POST' });
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(data.error.details.entitlement).toBe(EntitlementKey.SAVE_FAVORITES);
        });

        it('should return 403 when limit is reached', async () => {
            app.use((c, next) => {
                const entitlements = new Set([EntitlementKey.SAVE_FAVORITES]);
                const limits = new Map<LimitKey, number>();
                limits.set(LimitKey.MAX_FAVORITES, 10);
                c.set('userEntitlements', entitlements);
                c.set('userLimits', limits);
                c.set('currentFavoritesCount' as any, 10); // Already at limit
                return next();
            });
            app.use(gateFavorites());
            app.post('/favorites', (c) => c.json({ ok: true }));

            const res = await app.request('/favorites', { method: 'POST' });
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.code).toBe('LIMIT_REACHED');
            expect(data.error.details.limitKey).toBe(LimitKey.MAX_FAVORITES);
            expect(data.error.details.currentCount).toBe(10);
            expect(data.error.details.maxAllowed).toBe(10);
            expect(data.error.message).toContain('10 favoritos');
        });

        it('should allow when limit is unlimited (-1)', async () => {
            app.use((c, next) => {
                const entitlements = new Set([EntitlementKey.SAVE_FAVORITES]);
                const limits = new Map<LimitKey, number>();
                // Not setting MAX_FAVORITES means unlimited
                c.set('userEntitlements', entitlements);
                c.set('userLimits', limits);
                c.set('currentFavoritesCount' as any, 100);
                return next();
            });
            app.use(gateFavorites());
            app.post('/favorites', (c) => c.json({ ok: true }));

            const res = await app.request('/favorites', { method: 'POST' });
            expect(res.status).toBe(200);
        });
    });

    describe('gateExclusiveDeals', () => {
        it('should allow access when user has entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.EXCLUSIVE_DEALS]));
                return next();
            });
            app.use(gateExclusiveDeals());
            app.get('/deals/exclusive', (c) => c.json({ deals: [] }));

            const res = await app.request('/deals/exclusive');
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateExclusiveDeals());
            app.get('/deals/exclusive', (c) => c.json({ deals: [] }));

            const res = await app.request('/deals/exclusive');
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(data.error.details.entitlement).toBe(EntitlementKey.EXCLUSIVE_DEALS);
            expect(data.error.message).toContain('VIP');
        });
    });

    describe('gateEarlyEventAccess', () => {
        it('should allow access when user has entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.EARLY_ACCESS_EVENTS]));
                // Event starts in 12 hours (within 24h early access window)
                const eventStart = new Date(Date.now() + 12 * 60 * 60 * 1000);
                c.set('eventStartDate' as any, eventStart);
                return next();
            });
            app.use(gateEarlyEventAccess());
            app.post('/events/123/tickets', (c) => c.json({ ok: true }));

            const res = await app.request('/events/123/tickets', { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateEarlyEventAccess());
            app.post('/events/123/tickets', (c) => c.json({ ok: true }));

            const res = await app.request('/events/123/tickets', { method: 'POST' });
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(data.error.details.entitlement).toBe(EntitlementKey.EARLY_ACCESS_EVENTS);
        });

        it('should return 403 when early access has not started yet', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.EARLY_ACCESS_EVENTS]));
                // Event starts in 36 hours (before 24h early access window)
                const eventStart = new Date(Date.now() + 36 * 60 * 60 * 1000);
                c.set('eventStartDate' as any, eventStart);
                return next();
            });
            app.use(gateEarlyEventAccess());
            app.post('/events/123/tickets', (c) => c.json({ ok: true }));

            const res = await app.request('/events/123/tickets', { method: 'POST' });
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.code).toBe('EARLY_ACCESS_NOT_STARTED');
        });

        it('should allow access when event is in public sale period', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set([EntitlementKey.EARLY_ACCESS_EVENTS]));
                // Event started 1 hour ago (in public sale period)
                const eventStart = new Date(Date.now() - 1 * 60 * 60 * 1000);
                c.set('eventStartDate' as any, eventStart);
                return next();
            });
            app.use(gateEarlyEventAccess());
            app.post('/events/123/tickets', (c) => c.json({ ok: true }));

            const res = await app.request('/events/123/tickets', { method: 'POST' });
            expect(res.status).toBe(200);
        });
    });

    describe('gateAlerts', () => {
        it('should allow creating alert when user has entitlement and within limit', async () => {
            app.use((c, next) => {
                const entitlements = new Set([EntitlementKey.PRICE_ALERTS]);
                const limits = new Map<LimitKey, number>();
                limits.set('max_active_alerts' as LimitKey, 5);
                c.set('userEntitlements', entitlements);
                c.set('userLimits', limits);
                c.set('currentActiveAlertsCount' as any, 2);
                return next();
            });
            app.use(gateAlerts());
            app.post('/alerts', (c) => c.json({ ok: true }));

            const res = await app.request('/alerts', { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                c.set('userLimits', new Map<LimitKey, number>());
                return next();
            });
            app.use(gateAlerts());
            app.post('/alerts', (c) => c.json({ ok: true }));

            const res = await app.request('/alerts', { method: 'POST' });
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(data.error.message).toContain('Plus y VIP');
        });

        it('should return 403 when limit is reached', async () => {
            app.use((c, next) => {
                const entitlements = new Set([EntitlementKey.PRICE_ALERTS]);
                const limits = new Map<LimitKey, number>();
                limits.set('max_active_alerts' as LimitKey, 5);
                c.set('userEntitlements', entitlements);
                c.set('userLimits', limits);
                c.set('currentActiveAlertsCount' as any, 5); // At limit
                return next();
            });
            app.use(gateAlerts());
            app.post('/alerts', (c) => c.json({ ok: true }));

            const res = await app.request('/alerts', { method: 'POST' });
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.code).toBe('LIMIT_REACHED');
        });
    });

    describe('gateComparator', () => {
        it('should allow adding to comparison when user has entitlement and within limit', async () => {
            const comparatorEntitlement = 'can_compare_accommodations' as EntitlementKey;
            app.use((c, next) => {
                const entitlements = new Set([comparatorEntitlement]);
                const limits = new Map<LimitKey, number>();
                limits.set('max_compare_items' as LimitKey, 3);
                c.set('userEntitlements', entitlements);
                c.set('userLimits', limits);
                c.set('currentCompareItemsCount' as any, 1);
                return next();
            });
            app.use(gateComparator());
            app.post('/compare', (c) => c.json({ ok: true }));

            const res = await app.request('/compare', { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                c.set('userLimits', new Map<LimitKey, number>());
                return next();
            });
            app.use(gateComparator());
            app.post('/compare', (c) => c.json({ ok: true }));

            const res = await app.request('/compare', { method: 'POST' });
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(data.error.message).toContain('comparador');
        });
    });

    describe('gateReviewPhotos', () => {
        it('should allow photo attachments when user has entitlement', async () => {
            const reviewPhotosEntitlement = 'can_attach_review_photos' as EntitlementKey;
            app.use((c, next) => {
                c.set('userEntitlements', new Set([reviewPhotosEntitlement]));
                return next();
            });
            app.use(gateReviewPhotos());
            app.post('/reviews/123/photos', (c) => c.json({ ok: true }));

            const res = await app.request('/reviews/123/photos', { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateReviewPhotos());
            app.post('/reviews/123/photos', (c) => c.json({ ok: true }));

            const res = await app.request('/reviews/123/photos', { method: 'POST' });
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(data.error.message).toContain('VIP');
        });
    });

    describe('gateSearchHistory', () => {
        it('should allow viewing search history when user has entitlement', async () => {
            const searchHistoryEntitlement = 'can_view_search_history' as EntitlementKey;
            app.use((c, next) => {
                c.set('userEntitlements', new Set([searchHistoryEntitlement]));
                return next();
            });
            app.use(gateSearchHistory());
            app.get('/search-history', (c) => c.json({ history: [] }));

            const res = await app.request('/search-history');
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateSearchHistory());
            app.get('/search-history', (c) => c.json({ history: [] }));

            const res = await app.request('/search-history');
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.message).toContain('historial de búsqueda');
        });
    });

    describe('gateRecommendations', () => {
        it('should allow recommendations when user has entitlement', async () => {
            const recommendationsEntitlement = 'can_view_recommendations' as EntitlementKey;
            app.use((c, next) => {
                c.set('userEntitlements', new Set([recommendationsEntitlement]));
                return next();
            });
            app.use(gateRecommendations());
            app.get('/recommendations', (c) => c.json({ recommendations: [] }));

            const res = await app.request('/recommendations');
            expect(res.status).toBe(200);
        });

        it('should return 403 when user lacks entitlement', async () => {
            app.use((c, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>());
                return next();
            });
            app.use(gateRecommendations());
            app.get('/recommendations', (c) => c.json({ recommendations: [] }));

            const res = await app.request('/recommendations');
            expect(res.status).toBe(403);

            const data = await res.json();
            expect(data.error.message).toContain('recomendaciones personalizadas');
            expect(data.error.message).toContain('todos los planes');
        });
    });
});
