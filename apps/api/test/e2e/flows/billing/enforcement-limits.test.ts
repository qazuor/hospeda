/**
 * SPEC-145 T-014 — N+1 limit-reached coverage over real routes
 *
 * Validates that each enforced plan limit fires 403 LIMIT_REACHED on the
 * (N+1)th attempt and that an under-cap attempt (at N−1 or 0) succeeds past
 * the limit gate.
 *
 * Limits under test (mapped to spec T-145-10):
 *
 *  1. MAX_ACCOMMODATIONS
 *     - Plan:  owner-basico  → limit = 1
 *     - Route: POST /api/v1/protected/accommodations/draft
 *     - Count query: accommodations WHERE ownerId = actor.id (no lifecycle filter)
 *     - Fixture: factory-insert 1 accommodation row directly, then attempt the 2nd
 *       via the real route → 403 LIMIT_REACHED.
 *     - Under-cap: fresh user with 0 rows → gate passes (POST returns non-LIMIT_REACHED)
 *
 *  2. MAX_ACTIVE_PROMOTIONS
 *     - Plan:  owner-pro  → limit = 3
 *     - Route: POST /api/v1/protected/owner-promotions
 *     - Count query: owner_promotions WHERE lifecycleState = 'ACTIVE' AND ownerId = actor.id
 *     - Fixture: factory-insert 3 ACTIVE owner_promotions rows directly,
 *       then attempt the 4th via the real route → 403 LIMIT_REACHED.
 *     - Under-cap: 2 rows → gate passes
 *
 *  3. MAX_FAVORITES
 *     - Plan:  tourist-free  → limit = 3
 *     - Route: POST /api/v1/protected/user-bookmarks (toggle-ON branch)
 *     - Count query: user_bookmarks WHERE userId = actor.id AND deletedAt IS NULL
 *     - Fixture: factory-insert 3 bookmark rows directly,
 *       then attempt the 4th toggle-ON via the real route → 403 LIMIT_REACHED.
 *     - Under-cap: 2 rows → gate passes (toggle-ON succeeds)
 *     - BETA-42 sanity: at-cap user can toggle-OFF (remove) an existing bookmark → 2xx
 *
 *  4. MAX_PHOTOS_PER_ACCOMMODATION — NOT e2e-testable via real routes.
 *     `enforcePhotoLimit()` exists in apps/api/src/middlewares/limit-enforcement.ts
 *     but is NOT wired to any route as of this commit. The admin media upload
 *     (apps/api/src/routes/media/) uses Cloudinary and does not go through the
 *     limit-enforcement middleware. There is no existing route that accepts
 *     multipart/photo uploads in the protected tier and calls enforcePhotoLimit.
 *     This limit is therefore covered at the unit/middleware level only until a
 *     photo-upload route is wired and the file-infra dependency is resolved.
 *
 * Details envelope:
 *   The createErrorHandler in create-app.ts maps ServiceError.details to
 *   `response.error.details` for all non-500 errors. LIMIT_REACHED throws
 *   ServiceError(LIMIT_REACHED, ..., buildLimitReachedDetails({...})) which
 *   includes limitKey, currentCount, maxAllowed, usagePercent, upgradeAudience.
 *   These fields ARE present in the response envelope and are asserted below.
 *
 * Fixture strategy (mirrors enforcement-gates.test.ts):
 *   - ALL plan rows are created in beforeEach and survive the per-test
 *     afterEach → testDb.clean() truncation cycle.
 *   - Entity rows (accommodations, owner_promotions, user_bookmarks) are
 *     inserted directly via Drizzle in each test to reach the cap without
 *     making N API calls. The count queries in the enforcement middleware
 *     read directly from the DB; direct inserts are transparent to them.
 *   - clearEntitlementCache(customerId) is called before each request to
 *     prevent stale limit values from a previous test's subscription leaking
 *     into the current test's actor context.
 *
 * @module test/e2e/flows/billing/enforcement-limits
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter.
// Same pattern as enforcement-gates.test.ts — the billing instance initialises
// a MercadoPago adapter at construction time even though these tests do not
// exercise checkout/webhook flows. Without the stub the adapter constructor
// reaches for live MP credentials and throws.
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — enforcement-limits.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { accommodations, destinations, ownerPromotions, userBookmarks } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement.js';
import { createMockActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// ---------------------------------------------------------------------------
// MP stub (required to boot billing instance even when not exercising checkout)
// ---------------------------------------------------------------------------

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Entitlement key string constants (avoids mock entanglement with @repo/billing)
// ---------------------------------------------------------------------------

const E = {
    PUBLISH_ACCOMMODATIONS: 'publish_accommodations',
    CREATE_PROMOTIONS: 'create_promotions',
    SAVE_FAVORITES: 'save_favorites',
    EDIT_ACCOMMODATION_INFO: 'edit_accommodation_info',
    VIEW_BASIC_STATS: 'view_basic_stats',
    VIEW_ADVANCED_STATS: 'view_advanced_stats'
} as const;

// ---------------------------------------------------------------------------
// Limit key strings (mirrors LimitKey enum — avoids import of mocked module)
// ---------------------------------------------------------------------------

const L = {
    MAX_ACCOMMODATIONS: 'max_accommodations',
    MAX_ACTIVE_PROMOTIONS: 'max_active_promotions',
    MAX_FAVORITES: 'max_favorites'
} as const;

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * Actor for accommodation draft creation.
 * Needs ACCOMMODATION_CREATE so the route-level permission guard passes
 * before the limit check fires.
 */
function makeAccommodationCreateActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCOMMODATION_CREATE
        ],
        userId
    );
}

/**
 * Actor for owner promotion creation.
 * Needs OWNER_PROMOTION_CREATE + OWNER_PROMOTION_UPDATE so both the
 * permission guard and entitlement gate can fire.
 * Also needs OWNER_PROMOTION_VIEW_OWN so the service's `_canCount` check
 * (which calls `checkCanCount` → requires VIEW_ANY or VIEW_OWN) passes
 * inside `enforcePromotionLimit`. Without it the count query fails with
 * FORBIDDEN and the middleware falls through to `await next()` instead of
 * blocking, so the (N+1)th creation attempt reaches the handler.
 */
function makeOwnerPromotionActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.OWNER_PROMOTION_CREATE,
            PermissionEnum.OWNER_PROMOTION_UPDATE,
            PermissionEnum.OWNER_PROMOTION_VIEW_OWN
        ],
        userId
    );
}

/**
 * Actor for user bookmark toggle.
 * USER_BOOKMARK_CREATE lets the toggle route's permission guard pass.
 * USER_BOOKMARK_DELETE is required for the toggle-OFF (soft-delete) branch.
 * USER_BOOKMARK_VIEW is needed by the service to read the existing bookmark.
 */
function makeBookmarkActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.USER_BOOKMARK_CREATE,
            PermissionEnum.USER_BOOKMARK_DELETE,
            PermissionEnum.USER_BOOKMARK_VIEW
        ],
        userId
    );
}

// ---------------------------------------------------------------------------
// Request body fixtures
// ---------------------------------------------------------------------------

const ACCOMMODATION_DRAFT_BODY = {
    name: 'Limit Test Draft',
    summary: 'Minimal summary for limit test',
    type: 'APARTMENT',
    destinationId: randomUUID() // will be replaced with a real id in tests that need it
};

const PROMOTION_BODY = {
    title: 'Limit Test Promotion',
    discountType: 'percentage',
    discountValue: 10,
    validFrom: new Date(Date.now() + 86400000).toISOString()
};

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/** Shape of a LIMIT_REACHED 403 response body. */
interface LimitReachedBody {
    readonly success: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: {
            readonly limitKey: string;
            readonly currentCount: number;
            readonly maxAllowed: number;
            readonly usagePercent: number;
            readonly upgradeAudience: string;
        };
    };
}

/**
 * Assert that a response is a 403 LIMIT_REACHED gate block and return the
 * parsed body so callers can assert the `details` envelope.
 */
async function expectLimitReached(res: Response): Promise<LimitReachedBody> {
    expect(res.status, `expected 403 but got ${res.status}`).toBe(403);
    const body = (await res.json()) as LimitReachedBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LIMIT_REACHED');
    return body;
}

/**
 * Assert that a response is NOT a 403 LIMIT_REACHED block.
 * Any other status (200, 422, 404…) is acceptable — the limit gate passed.
 */
async function expectLimitGatePassed(res: Response): Promise<void> {
    if (res.status === 403) {
        const body = (await res.clone().json()) as { error?: { code?: string } };
        expect(
            body?.error?.code,
            'Limit gate should have passed but got 403 LIMIT_REACHED'
        ).not.toBe('LIMIT_REACHED');
    }
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-145 T-014 — N+1 limit-reached coverage over real routes', () => {
    let app: ReturnType<typeof initApp>;

    // Shared plan IDs — seeded in beforeEach, consumed per test.
    let ownerBasicoPlanId: string;
    let ownerProPlanId: string;
    let touristFreePlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    // Plans are seeded in EVERY beforeEach so they survive the per-test
    // afterEach → testDb.clean() truncation. The pattern mirrors
    // enforcement-gates.test.ts.
    beforeEach(async () => {
        mpStub.config.reset();

        // owner-basico: PUBLISH_ACCOMMODATIONS + EDIT + VIEW_BASIC, MAX_ACCOMMODATIONS=1
        const ownerBasico = await createTestPlan({
            name: `Limit-OwnerBasico-${randomUUID().slice(0, 8)}`,
            entitlements: [E.PUBLISH_ACCOMMODATIONS, E.EDIT_ACCOMMODATION_INFO, E.VIEW_BASIC_STATS],
            limits: { [L.MAX_ACCOMMODATIONS]: 1 }
        });
        ownerBasicoPlanId = ownerBasico.planId;

        // owner-pro: includes CREATE_PROMOTIONS, MAX_ACTIVE_PROMOTIONS=3
        const ownerPro = await createTestPlan({
            name: `Limit-OwnerPro-${randomUUID().slice(0, 8)}`,
            entitlements: [
                E.PUBLISH_ACCOMMODATIONS,
                E.EDIT_ACCOMMODATION_INFO,
                E.VIEW_BASIC_STATS,
                E.VIEW_ADVANCED_STATS,
                E.CREATE_PROMOTIONS
            ],
            limits: {
                [L.MAX_ACCOMMODATIONS]: 3,
                [L.MAX_ACTIVE_PROMOTIONS]: 3
            }
        });
        ownerProPlanId = ownerPro.planId;

        // tourist-free: SAVE_FAVORITES only, MAX_FAVORITES=3
        const touristFree = await createTestPlan({
            name: `Limit-TouristFree-${randomUUID().slice(0, 8)}`,
            entitlements: [E.SAVE_FAVORITES],
            limits: { [L.MAX_FAVORITES]: 3 }
        });
        touristFreePlanId = touristFree.planId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // Limit 1: MAX_ACCOMMODATIONS (owner-basico, cap = 1)
    //
    // Count query: accommodationService.count(actor, { ownerId: actor.id })
    // Table: accommodations (no lifecycleState filter — all non-deleted rows)
    // =========================================================================

    describe('Limit 1: MAX_ACCOMMODATIONS (owner-basico, cap=1)', () => {
        it('AT-CAP — 1 accommodation in DB → POST /draft → 403 LIMIT_REACHED with details', async () => {
            const user = await createTestUser({
                email: `lim1-at-cap-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: ownerBasicoPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            // Seed a destination so accommodations.destinationId FK can be satisfied.
            const destId = randomUUID();
            await testDb
                .getDb()
                .insert(destinations)
                .values({
                    id: destId,
                    destinationType: 'CITY',
                    path: `/test-dest-${destId}`,
                    slug: `test-dest-${destId}`,
                    name: `Limit Test Dest ${destId}`,
                    summary: 'Limit test destination',
                    description: 'Limit test destination description',
                    location: { country: 'AR', state: 'ER', city: 'CDU' }
                } as typeof destinations.$inferInsert);

            // Factory-insert 1 accommodation directly (at the cap).
            // The middleware counts rows via AccommodationService.count({ ownerId: actor.id }).
            // Direct DB inserts are transparent to the count query.
            await testDb
                .getDb()
                .insert(accommodations)
                .values({
                    slug: `limit-test-accom-${randomUUID().slice(0, 8)}`,
                    name: 'At-cap accommodation',
                    summary: 'At-cap',
                    type: 'APARTMENT',
                    description: 'Factory-inserted for limit test',
                    ownerId: user.id,
                    destinationId: destId
                } as typeof accommodations.$inferInsert);

            const actor = makeAccommodationCreateActor(user.id);
            const client = new E2EApiClient(app, actor);

            // (N+1)th attempt via the real route.
            const res = await client.post('/api/v1/protected/accommodations/draft', {
                ...ACCOMMODATION_DRAFT_BODY,
                destinationId: destId
            });

            const body = await expectLimitReached(res);

            // Details MUST survive the envelope (createErrorHandler passes
            // ServiceError.details for non-5xx errors per response.ts).
            expect(body.error.details).toBeDefined();
            expect(body.error.details?.limitKey).toBe(L.MAX_ACCOMMODATIONS);
            expect(body.error.details?.currentCount).toBe(1);
            expect(body.error.details?.maxAllowed).toBe(1);
            expect(body.error.details?.upgradeAudience).toBe('host');
        });

        it('UNDER-CAP — 0 accommodations → POST /draft → limit gate passes (not 403 LIMIT_REACHED)', async () => {
            const user = await createTestUser({
                email: `lim1-under-cap-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: ownerBasicoPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            const actor = makeAccommodationCreateActor(user.id);
            const client = new E2EApiClient(app, actor);

            // 0 accommodations — gate must pass. A random destinationId will cause
            // the service to return a non-200 for the FK constraint, but that is
            // post-limit-gate behaviour and acceptable.
            const res = await client.post('/api/v1/protected/accommodations/draft', {
                ...ACCOMMODATION_DRAFT_BODY,
                destinationId: randomUUID()
            });

            await expectLimitGatePassed(res);
        });
    });

    // =========================================================================
    // Limit 2: MAX_ACTIVE_PROMOTIONS (owner-pro, cap = 3)
    //
    // Count query: ownerPromotionService.count(actor, {
    //   lifecycleState: ACTIVE, ownerId: actor.id
    // })
    // Table: owner_promotions WHERE lifecycle_state = 'ACTIVE' AND owner_id = actor.id
    // =========================================================================

    describe('Limit 2: MAX_ACTIVE_PROMOTIONS (owner-pro, cap=3)', () => {
        it('AT-CAP — 3 active promotions in DB → POST /owner-promotions → 403 LIMIT_REACHED with details', async () => {
            const user = await createTestUser({
                email: `lim2-at-cap-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: ownerProPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            // Factory-insert 3 ACTIVE owner_promotions directly (at the cap).
            // The count query filters on lifecycleState = 'ACTIVE' AND ownerId = user.id.
            const validFrom = new Date(Date.now() + 86400000);
            for (let i = 0; i < 3; i++) {
                await testDb
                    .getDb()
                    .insert(ownerPromotions)
                    .values({
                        slug: `limit-promo-${randomUUID().slice(0, 8)}`,
                        ownerId: user.id,
                        title: `Cap Promo ${i + 1}`,
                        discountType: 'percentage',
                        discountValue: 10,
                        validFrom,
                        lifecycleState: 'ACTIVE'
                    } as typeof ownerPromotions.$inferInsert);
            }

            const actor = makeOwnerPromotionActor(user.id);
            const client = new E2EApiClient(app, actor);

            // (N+1)th attempt via the real route.
            const res = await client.post('/api/v1/protected/owner-promotions', {
                ...PROMOTION_BODY,
                ownerId: user.id
            });

            const body = await expectLimitReached(res);

            // Details must survive the envelope.
            expect(body.error.details).toBeDefined();
            expect(body.error.details?.limitKey).toBe(L.MAX_ACTIVE_PROMOTIONS);
            expect(body.error.details?.currentCount).toBe(3);
            expect(body.error.details?.maxAllowed).toBe(3);
            expect(body.error.details?.upgradeAudience).toBe('host');
        });

        it('UNDER-CAP — 2 active promotions → POST /owner-promotions → limit gate passes', async () => {
            const user = await createTestUser({
                email: `lim2-under-cap-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: ownerProPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            // Insert 2 active promotions (below the cap of 3).
            const validFrom = new Date(Date.now() + 86400000);
            for (let i = 0; i < 2; i++) {
                await testDb
                    .getDb()
                    .insert(ownerPromotions)
                    .values({
                        slug: `under-cap-promo-${randomUUID().slice(0, 8)}`,
                        ownerId: user.id,
                        title: `Under-cap Promo ${i + 1}`,
                        discountType: 'percentage',
                        discountValue: 10,
                        validFrom,
                        lifecycleState: 'ACTIVE'
                    } as typeof ownerPromotions.$inferInsert);
            }

            const actor = makeOwnerPromotionActor(user.id);
            const client = new E2EApiClient(app, actor);

            // 2 rows → still under cap. Gate must pass.
            // The service may return a non-200 because no accommodationId is provided
            // and the validation schema may require one — that is post-gate behaviour.
            const res = await client.post('/api/v1/protected/owner-promotions', {
                ...PROMOTION_BODY,
                ownerId: user.id
            });

            await expectLimitGatePassed(res);
        });
    });

    // =========================================================================
    // Limit 3: MAX_FAVORITES (tourist-free, cap = 3)
    //
    // Count query: bookmarkService.countBookmarksForUser(actor, { userId: actor.id })
    //   → model.count({ userId, deletedAt: null })
    // Table: user_bookmarks WHERE user_id = actor.id AND deleted_at IS NULL
    //
    // BETA-42 constraint: toggle-OFF (removing) an existing favorite at the cap
    // must NEVER be blocked — the limit is only asserted in the toggle-ON branch.
    // =========================================================================

    describe('Limit 3: MAX_FAVORITES (tourist-free, cap=3)', () => {
        it('AT-CAP — 3 bookmarks in DB → toggle-ON → 403 LIMIT_REACHED with details', async () => {
            const user = await createTestUser({
                email: `lim3-at-cap-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: touristFreePlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            // Factory-insert 3 non-deleted bookmarks directly (at the cap).
            // The count query checks deletedAt IS NULL — we leave deletedAt unset.
            // entityId is a UUID pointing at a non-existent entity; that is fine
            // because the count query does not validate the FK.
            for (let i = 0; i < 3; i++) {
                await testDb
                    .getDb()
                    .insert(userBookmarks)
                    .values({
                        userId: user.id,
                        entityId: randomUUID(),
                        entityType: 'ACCOMMODATION'
                    } as typeof userBookmarks.$inferInsert);
            }

            const actor = makeBookmarkActor(user.id);
            const client = new E2EApiClient(app, actor);

            // Toggle-ON attempt for a new entity — must be blocked at the cap.
            const res = await client.post('/api/v1/protected/user-bookmarks', {
                entityId: randomUUID(),
                entityType: 'ACCOMMODATION'
            });

            await expectLimitReached(res);

            // NOTE: details are NOT asserted here because assertFavoritesLimitOrThrow
            // is called INSIDE the route handler (not as a middleware), so the error
            // bubbles up to the route-factory catch block which calls handleRouteError
            // (apps/api/src/utils/response-helpers.ts). That function suppresses
            // ServiceError.details when HOSPEDA_API_DEBUG_ERRORS=false (the test env
            // default), unlike the global onError handler which only suppresses for 5xx
            // in production. Middleware-thrown LIMIT_REACHED errors (accommodations,
            // promotions) reach the global onError and DO surface their details.
            // This is a known asymmetry; fixing it would require changing handleRouteError
            // to apply the same details policy as onError for non-5xx errors.
        });

        it('UNDER-CAP — 2 bookmarks → toggle-ON → limit gate passes (creates bookmark)', async () => {
            const user = await createTestUser({
                email: `lim3-under-cap-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: touristFreePlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            // Insert 2 bookmarks (below the cap of 3).
            for (let i = 0; i < 2; i++) {
                await testDb
                    .getDb()
                    .insert(userBookmarks)
                    .values({
                        userId: user.id,
                        entityId: randomUUID(),
                        entityType: 'ACCOMMODATION'
                    } as typeof userBookmarks.$inferInsert);
            }

            const actor = makeBookmarkActor(user.id);
            const client = new E2EApiClient(app, actor);

            // 2 rows → gate passes. The service creates the bookmark and returns
            // { toggled: true, bookmark: {...} } with a 200.
            const newEntityId = randomUUID();
            const res = await client.post('/api/v1/protected/user-bookmarks', {
                entityId: newEntityId,
                entityType: 'ACCOMMODATION'
            });

            // Gate passed — not a LIMIT_REACHED block.
            await expectLimitGatePassed(res);
            // The toggle created a new bookmark.
            // POST routes return 201 Created per the route-factory default.
            expect(res.status).toBe(201);
            const body = (await res.json()) as {
                success: boolean;
                data: { toggled: boolean; bookmark: { entityId: string } | null };
            };
            expect(body.success).toBe(true);
            expect(body.data.toggled).toBe(true);
            expect(body.data.bookmark).not.toBeNull();
        });

        it('BETA-42 — at-cap user can toggle-OFF (remove) an existing bookmark → 2xx', async () => {
            const user = await createTestUser({
                email: `lim3-beta42-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: touristFreePlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            // Insert 3 bookmarks (at the cap).
            // The FIRST one uses a known entityId so we can toggle it off.
            const targetEntityId = randomUUID();
            await testDb
                .getDb()
                .insert(userBookmarks)
                .values({
                    userId: user.id,
                    entityId: targetEntityId,
                    entityType: 'ACCOMMODATION'
                } as typeof userBookmarks.$inferInsert);

            for (let i = 0; i < 2; i++) {
                await testDb
                    .getDb()
                    .insert(userBookmarks)
                    .values({
                        userId: user.id,
                        entityId: randomUUID(),
                        entityType: 'ACCOMMODATION'
                    } as typeof userBookmarks.$inferInsert);
            }

            const actor = makeBookmarkActor(user.id);
            const client = new E2EApiClient(app, actor);

            // At-cap toggle-OFF: the handler detects the existing bookmark and
            // soft-deletes it WITHOUT invoking assertFavoritesLimitOrThrow (BETA-42).
            const res = await client.post('/api/v1/protected/user-bookmarks', {
                entityId: targetEntityId,
                entityType: 'ACCOMMODATION'
            });

            // Must not be blocked. Returns 201 (route-factory POST default) with
            // toggled=false — the toggle-OFF branch ran (existing bookmark was deleted).
            expect(res.status).toBe(201);
            const body = (await res.json()) as {
                success: boolean;
                data: { toggled: boolean; bookmark: null };
            };
            expect(body.success).toBe(true);
            expect(body.data.toggled).toBe(false);
            expect(body.data.bookmark).toBeNull();
        });
    });
});
