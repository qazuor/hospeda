/**
 * Deny-by-default guard for the protected billing tier (H-66 / HOS-446).
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * `collection-listing-exposure.test.ts` proves the five listings we FOUND are
 * closed. It cannot prove the sixth one is — it runs against a mocked qzpay
 * router, so it only ever knows about the endpoints the test itself declares.
 *
 * The finding's own conclusion was that the defect lives in the mount rather
 * than in any handler: qzpay is mounted wholesale, so every collection endpoint
 * it ever adds is born reachable. This test is the other half of that fix. It
 * builds the REAL `@qazuor/qzpay-hono` router — no mock — reads its actual route
 * table, and fails if any bare-collection GET is neither blocked nor explicitly
 * exempted with a reason.
 *
 * A dependency bump that introduces `GET /refunds` upstream therefore turns CI
 * red on the bump, instead of shipping an open listing to production.
 *
 * @module test/routes/billing/collection-listing-deny-by-default
 */

import { describe, expect, it, vi } from 'vitest';

// `collection-listing-block.ts` imports `createRouter` from `utils/create-app`,
// whose module scope builds a full app (`const app = createApp()`) and needs the
// entire middleware chain resolvable. This suite only exercises the pure
// resolution functions, so mock the factory away — the same treatment
// `protected-plans-list.test.ts` applies for the same reason.
vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

// @qazuor/qzpay-hono is deliberately NOT mocked — its real surface is the
// subject of this test.

import { createBillingRoutes } from '@qazuor/qzpay-hono';
import {
    BASELINE_BLOCKED_COLLECTIONS,
    findCollectionListingSegments,
    resolveBlockedCollections,
    TIER_EXEMPT_COLLECTIONS
} from '../../../src/routes/billing/collection-listing-block';
import type { AppOpenAPI } from '../../../src/types';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

/**
 * Builds the real qzpay router.
 *
 * `createBillingRoutes` only closes over the billing instance for later handler
 * execution, so a deep proxy satisfies it at construction time and keeps the
 * test free of a database or a MercadoPago client.
 */
function buildRealQZPayRouter(): AppOpenAPI {
    const deepProxy: unknown = new Proxy(function noop() {} as object, {
        get: () => deepProxy,
        apply: () => deepProxy
    });

    return createBillingRoutes({
        billing: deepProxy as never,
        prefix: '',
        authMiddleware: (async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }) as never
    }) as unknown as AppOpenAPI;
}

/** Hospeda routers mounted on the same prefix that must never be blocked. */
const HOSPEDA_SIBLING_SEGMENTS = ['usage', 'addons', 'trial', 'trial-eligibility'] as const;

/**
 * The bare-collection GETs `@qazuor/qzpay-hono` exposes, as reviewed for H-66.
 *
 * This is the pin that makes the guard able to fail. Asserting "every discovered
 * collection is blocked" would be vacuous — the blocked set is DERIVED from the
 * discovered one, so that comparison passes by construction and would stay green
 * through any upstream change. Pinning the surface instead means a qzpay version
 * that adds `GET /refunds` fails CI on the bump, and a human decides whether it
 * gets blocked or exempted.
 *
 * Updating this list is a deliberate act: add the segment here AND decide its
 * fate in `collection-listing-block.ts`.
 */
const REVIEWED_QZPAY_COLLECTION_SURFACE = [
    'customers',
    'invoices',
    'payments',
    'plans',
    'promo-codes',
    'subscriptions'
] as const;

/** The only exemption reviewed for H-66 — see `TIER_EXEMPT_COLLECTIONS`. */
const REVIEWED_EXEMPTIONS = ['plans'] as const;

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('Billing collection listings — deny by default (H-66)', () => {
    describe('against the real @qazuor/qzpay-hono surface', () => {
        it('registers at least one collection listing (instrument check)', () => {
            // Arrange: if the real router ever built empty, every assertion
            // below would pass vacuously.
            const qzpayRoutes = buildRealQZPayRouter();

            // Act.
            const discovered = findCollectionListingSegments(
                (qzpayRoutes as unknown as { routes: Array<{ method: string; path: string }> })
                    .routes
            );

            // Assert.
            expect(discovered.length).toBeGreaterThan(0);
        });

        it('exposes exactly the collection surface reviewed for H-66', () => {
            // Arrange.
            const qzpayRoutes = buildRealQZPayRouter();

            // Act.
            const discovered = findCollectionListingSegments(
                (qzpayRoutes as unknown as { routes: Array<{ method: string; path: string }> })
                    .routes
            );

            // Assert — a qzpay version that adds a collection endpoint fails
            // here, on the dependency bump, instead of shipping it open.
            expect(discovered).toEqual([...REVIEWED_QZPAY_COLLECTION_SURFACE]);
        });

        it('exempts nothing beyond what was reviewed', () => {
            // Arrange & Act: the exemption list is the one way a listing gets
            // back onto the user tier, so it growing silently is the failure
            // mode this asserts against.
            const exemptions = [...TIER_EXEMPT_COLLECTIONS].sort();

            // Assert.
            expect(exemptions).toEqual([...REVIEWED_EXEMPTIONS]);
        });

        it('keeps the baseline constant honest — every entry is a real qzpay collection', () => {
            // Arrange: the baseline exists so the block survives a qzpay router
            // that fails to build. If upstream drops one of these, the constant
            // becomes a claim about something that no longer exists.
            const qzpayRoutes = buildRealQZPayRouter();
            const discovered = new Set(
                findCollectionListingSegments(
                    (qzpayRoutes as unknown as { routes: Array<{ method: string; path: string }> })
                        .routes
                )
            );

            // Act.
            const stale = [...BASELINE_BLOCKED_COLLECTIONS].filter(
                (segment) => !discovered.has(segment)
            );

            // Assert.
            expect(stale).toEqual([]);
        });

        it('blocks the five listings measured in production', () => {
            // Arrange.
            const blocked = new Set(resolveBlockedCollections(buildRealQZPayRouter()));

            // Assert — named explicitly so a refactor that quietly empties the
            // resolver cannot keep this suite green.
            expect(blocked).toContain('customers');
            expect(blocked).toContain('subscriptions');
            expect(blocked).toContain('invoices');
            expect(blocked).toContain('payments');
            expect(blocked).toContain('promo-codes');
        });

        it('leaves the plans catalog exempt so its own override still serves it', () => {
            // Arrange.
            const blocked = resolveBlockedCollections(buildRealQZPayRouter());

            // Assert.
            expect(TIER_EXEMPT_COLLECTIONS.has('plans')).toBe(true);
            expect(blocked).not.toContain('plans');
        });

        it('does not reach Hospeda routers mounted on the same prefix', () => {
            // Arrange: over-reach here would 404 `/usage`, `/addons` and the
            // trial routes, which are live user-facing features.
            const blocked = new Set(resolveBlockedCollections(buildRealQZPayRouter()));

            // Assert.
            for (const segment of HOSPEDA_SIBLING_SEGMENTS) {
                expect(blocked.has(segment)).toBe(false);
            }
        });
    });

    describe('findCollectionListingSegments', () => {
        it('detects a collection endpoint it has never seen before', () => {
            // Arrange: the whole point of deriving the block from the route
            // table. Without this, "future-proof" is an untested claim.
            const routes = [
                { method: 'GET', path: '/refunds' },
                { method: 'GET', path: '/refunds/:id' }
            ];

            // Act.
            const segments = findCollectionListingSegments(routes);

            // Assert.
            expect(segments).toEqual(['refunds']);
        });

        it('ignores resource-scoped, nested and non-GET routes', () => {
            // Arrange: paths carrying an id are already covered by
            // billingOwnershipMiddleware; writes are covered by the admin guard.
            const routes = [
                { method: 'GET', path: '/customers/:id' },
                { method: 'GET', path: '/customers/:customerId/entitlements' },
                { method: 'POST', path: '/customers' },
                { method: 'GET', path: '/:id' },
                { method: 'ALL', path: '/*' }
            ];

            // Act.
            const segments = findCollectionListingSegments(routes);

            // Assert.
            expect(segments).toEqual([]);
        });

        it('de-duplicates and sorts', () => {
            // Arrange.
            const routes = [
                { method: 'GET', path: '/payments' },
                { method: 'get', path: '/payments' },
                { method: 'GET', path: '/customers' }
            ];

            // Act & Assert.
            expect(findCollectionListingSegments(routes)).toEqual(['customers', 'payments']);
        });
    });
});
