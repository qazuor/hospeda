/**
 * HOS-687 / HOS-589 AC-27 — the ROUTE half.
 *
 * A signed-in account holding NO commerce permission must receive a 2xx from
 * `POST /api/v1/protected/commerce/listings/{gastronomy,experience}`, through a
 * real request that traverses the whole middleware stack (actor resolution,
 * authorization, validation, response stripping) — not through a hand-called
 * handler.
 *
 * ## Why this file exists alongside `protected-routes-gate.test.ts`
 *
 * That file asserts "not 401/403". This one asserts an actual **201**, which is
 * a different claim: a route can stop refusing and still never succeed. The DB
 * is globally mocked in this suite, so the SERVICE is stubbed here to make a
 * real 201 reachable without one.
 *
 * ## Why the assertion is duplicated at the service predicate
 *
 * The same door was bolted at the route (`requiredPermissions`) AND in the
 * service (`_canCreate` → `checkCanCreateCommerce`). Both answer 403 and are
 * indistinguishable from outside, so removing one alone would look exactly like
 * removing both. The service half is asserted directly in
 * `packages/service-core/test/services/commerce/commerce.permissions.test.ts`.
 * Neither assertion is sufficient on its own.
 *
 * @module test/commerce/owner-create-open-gate
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Service stub (hoisted above `initApp`'s import graph).
// ──────────────────────────────────────────────────────────────────────────

const { mockGastronomyCreateForOwner, mockExperienceCreateForOwner } = vi.hoisted(() => ({
    mockGastronomyCreateForOwner: vi.fn(),
    mockExperienceCreateForOwner: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    class MockGastronomyService extends actual.GastronomyService {
        createForOwner = mockGastronomyCreateForOwner;
    }
    class MockExperienceService extends actual.ExperienceService {
        createForOwner = mockExperienceCreateForOwner;
    }
    return {
        ...actual,
        GastronomyService: MockGastronomyService,
        ExperienceService: MockExperienceService
    };
});

import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const DESTINATION_ID = '00000000-0000-4000-a000-000000000002';
const LISTING_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/**
 * The account this whole spec exists for: authenticated, `USER` hat only, zero
 * commerce permissions. Before HOS-687 every one of the three gates turned it
 * away.
 */
const permissionlessHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'USER',
    'x-mock-actor-permissions': JSON.stringify([]),
    'content-type': 'application/json'
};

const GASTRONOMY_BODY = {
    name: 'La Parrilla del Puerto',
    summary: 'A riverside parrilla with fresh grilled fish and steak.',
    description:
        'La Parrilla del Puerto has served the waterfront for over a decade, specializing in grilled fish.',
    type: 'PARRILLA',
    destinationId: DESTINATION_ID
};

const EXPERIENCE_BODY = {
    name: 'Kayak tour on the Uruguay river',
    summary: 'A guided two-hour kayak tour along the riverside.',
    description: 'Explore the Uruguay river coastline by kayak with a certified local guide.',
    type: 'TOUR_GUIDE',
    priceFrom: 1500000,
    priceUnit: 'per_person',
    isPriceOnRequest: false,
    destinationId: DESTINATION_ID
};

/** A persisted listing as the protected read tier describes it. */
const listingFixture = (overrides: Record<string, unknown>) => ({
    id: LISTING_ID,
    slug: 'la-parrilla-del-puerto',
    name: 'La Parrilla del Puerto',
    summary: 'A riverside parrilla with fresh grilled fish and steak.',
    description:
        'La Parrilla del Puerto has served the waterfront for over a decade, specializing in grilled fish.',
    isFeatured: false,
    destinationId: DESTINATION_ID,
    ownerId: OWNER_ID,
    averageRating: 0,
    reviewsCount: 0,
    visibility: 'PRIVATE',
    lifecycleState: 'DRAFT',
    createdAt: new Date('2026-08-20T00:00:00.000Z'),
    updatedAt: new Date('2026-08-20T00:00:00.000Z'),
    ...overrides
});

describe('Owner commerce create — the gate is open for a permission-less account (AC-27)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockGastronomyCreateForOwner.mockResolvedValue({
            data: listingFixture({ type: 'PARRILLA' })
        });
        mockExperienceCreateForOwner.mockResolvedValue({
            data: listingFixture({
                type: 'TOUR_GUIDE',
                name: 'Kayak tour on the Uruguay river',
                slug: 'kayak-tour-on-the-uruguay-river',
                summary: 'A guided two-hour kayak tour along the riverside.',
                description:
                    'Explore the Uruguay river coastline by kayak with a certified local guide.',
                priceFrom: 1500000,
                priceUnit: 'per_person',
                isPriceOnRequest: false,
                hasActiveSubscription: false
            })
        });
    });

    it('returns 201 for gastronomy (AC-27)', async () => {
        const res = await app.request('/api/v1/protected/commerce/listings/gastronomy', {
            method: 'POST',
            headers: permissionlessHeaders,
            body: JSON.stringify(GASTRONOMY_BODY)
        });

        expect(res.status).toBe(201);
        expect(mockGastronomyCreateForOwner).toHaveBeenCalledTimes(1);
        // The owner is the caller, never the body's claim.
        const [, createInput] = mockGastronomyCreateForOwner.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(createInput.ownerId).toBe(OWNER_ID);
    });

    it('returns 201 for experience (AC-27)', async () => {
        const res = await app.request('/api/v1/protected/commerce/listings/experience', {
            method: 'POST',
            headers: permissionlessHeaders,
            body: JSON.stringify(EXPERIENCE_BODY)
        });

        expect(res.status).toBe(201);
        expect(mockExperienceCreateForOwner).toHaveBeenCalledTimes(1);
        const [, createInput] = mockExperienceCreateForOwner.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(createInput.ownerId).toBe(OWNER_ID);
    });

    // AC-8 is a REGRESSION criterion: authentication has to stay a FACTORY
    // concern. Asserting the 401 alone would not show that — an in-handler
    // check would answer 401 too. What separates them is that the handler is
    // never entered, so the service is never reached.
    it('refuses the anonymous caller before the handler runs, both verticals (AC-8)', async () => {
        const gastronomy = await app.request('/api/v1/protected/commerce/listings/gastronomy', {
            method: 'POST',
            headers: { ...USER_AGENT, 'content-type': 'application/json' },
            body: JSON.stringify(GASTRONOMY_BODY)
        });
        const experience = await app.request('/api/v1/protected/commerce/listings/experience', {
            method: 'POST',
            headers: { ...USER_AGENT, 'content-type': 'application/json' },
            body: JSON.stringify(EXPERIENCE_BODY)
        });

        expect(gastronomy.status).toBe(401);
        expect(experience.status).toBe(401);
        expect(mockGastronomyCreateForOwner).not.toHaveBeenCalled();
        expect(mockExperienceCreateForOwner).not.toHaveBeenCalled();
    });
});
