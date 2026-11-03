/**
 * AC:3:13 (HOS-1842 / 3.10) — review-dimension validation over the real
 * protected venue-review HTTP route.
 *
 * The route boots the real app, resolves the actor from the mock-auth headers,
 * and runs the REAL `VenueReviewService._beforeCreate`: existence 404 first,
 * then the listing-section presence rule (DEC-FAC-065). Only the DB models are
 * stubbed — that is what lets the test observe the HTTP boundary instead of the
 * service internals.
 *
 * Cases:
 * - BOLICHE ({nightlife}) voting `food` → 400 DIMENSION_NOT_APPLICABLE on rating.food
 * - BOLICHE without `food` → 2xx
 * - RESTAURANT ({food}) with `food` and `menu` locked → 2xx
 * - `food: 0` → 400 by shape
 * - nonexistent venue with `food` → 404, not 400
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const VENUE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MISSING_VENUE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const REVIEW_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BASE = '/api/v1/protected/venues';

const fixtures = vi.hoisted(() => ({
    venue: null as Record<string, unknown> | null
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();

    const reviewModel = {
        findOne: async () => null,
        findAll: async () => ({ items: [], total: 0 }),
        findOneWithRelations: async () => null,
        create: async (data: Record<string, unknown>) => ({
            ...data,
            id: REVIEW_ID,
            moderationState: 'PENDING',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date()
        })
    };
    const venueModel = { findById: async () => fixtures.venue };
    const venueService = { recomputeRating: async () => undefined };

    class VenueReviewService extends orig.VenueReviewService {
        constructor(config: ConstructorParameters<typeof orig.VenueReviewService>[0]) {
            super(config);
            const self = this as unknown as {
                model: unknown;
                _venueModel: unknown;
                _venueService: unknown;
            };
            self.model = reviewModel;
            self._venueModel = venueModel;
            self._venueService = venueService;
        }
    }

    return { ...orig, VenueReviewService };
});

const actorHeaders = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-role': 'USER',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-permissions': '[]'
};

function setVenue(overrides: Record<string, unknown> = {}) {
    fixtures.venue = {
        id: VENUE_ID,
        ownerId: OWNER_ID,
        publicationStatus: 'PUBLISHED',
        businessLines: ['nightlife'],
        ...overrides
    };
}

function postReview(app: AppOpenAPI, venueId: string, body: Record<string, unknown>) {
    return app.request(`${BASE}/${venueId}/reviews`, {
        method: 'POST',
        headers: actorHeaders,
        body: JSON.stringify(body)
    });
}

describe('AC:3:13 — venue review dimension validation over HTTP', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        setVenue();
    });

    it('rejects a BOLICHE (nightlife) review that votes food', async () => {
        const res = await postReview(app, VENUE_ID, {
            overallRating: 4,
            rating: { food: 5, service: 4 }
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.reason).toBe('DIMENSION_NOT_APPLICABLE');
        expect(body.error.details).toMatchObject({
            field: 'rating.food',
            reason: 'DIMENSION_NOT_APPLICABLE'
        });
    });

    it('accepts a BOLICHE review without the food dimension', async () => {
        const res = await postReview(app, VENUE_ID, {
            overallRating: 4,
            rating: { service: 4, ambiance: 3, value: 5 }
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('accepts a RESTAURANT review with food even when the menu is locked', async () => {
        setVenue({ businessLines: ['food'] });

        const res = await postReview(app, VENUE_ID, {
            overallRating: 5,
            rating: { food: 5, service: 4, ambiance: 4, value: 4 }
        });

        expect(res.status).toBe(201);
    });

    it('rejects food: 0 by shape (votedOnly dimensions are 1-5)', async () => {
        const res = await postReview(app, VENUE_ID, {
            overallRating: 4,
            rating: { food: 0 }
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 (not 400) for a nonexistent venue carrying food', async () => {
        fixtures.venue = null;

        const res = await postReview(app, MISSING_VENUE_ID, {
            overallRating: 4,
            rating: { food: 5 }
        });

        expect(res.status).toBe(404);
    });
});
