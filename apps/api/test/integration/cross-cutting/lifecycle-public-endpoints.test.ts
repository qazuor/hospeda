/**
 * Cross-cutting integration tests for SPEC-063 T-058.
 *
 * Verifies that all 4 entities with a lifecycleState column behave correctly at
 * the public tier boundary:
 *   1. OwnerPromotion        — public tier exists, strip already covered by
 *                              `apps/api/test/integration/owner-promotion/public-endpoint.test.ts`
 *                              (T-022 per-handler strip). Reference only, no
 *                              duplicate test here.
 *   2. AccommodationReview   — public tier exists (nested under accommodations).
 *                              T-058 adds per-handler strip to the route.
 *   3. DestinationReview     — public tier exists (nested under destinations).
 *                              T-058 adds per-handler strip to the route.
 *   4. Sponsorship           — no public tier exists. Asserted by absence
 *                              (404 on `/api/v1/public/sponsorships`).
 *
 * SPEC-087 tracks the systemic route-factory fix (runtime-parse responseSchema);
 * until then, per-handler strip is the standing decision.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const accommodationReviewMock: { listByAccommodation: ReturnType<typeof vi.fn> } = {
    listByAccommodation: vi.fn()
};

const destinationReviewMock: { list: ReturnType<typeof vi.fn> } = {
    list: vi.fn()
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccommodationReviewService: vi.fn().mockImplementation(() => ({
            listByAccommodation: (...args: unknown[]) =>
                accommodationReviewMock.listByAccommodation(...args)
        })),
        DestinationReviewService: vi.fn().mockImplementation(() => ({
            list: (...args: unknown[]) => destinationReviewMock.list(...args)
        })),
        ServiceError: class ServiceError extends Error {
            constructor(
                public readonly code: string,
                message: string
            ) {
                super(message);
            }
        }
    };
});

// Prevent the accommodation-reviews list handler from hitting the real DB for
// the user enrichment batch query.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    const fromMock = vi.fn().mockReturnThis();
    const whereMock = vi.fn().mockResolvedValue([]);
    return {
        ...actual,
        getDb: () => ({
            select: () => ({ from: fromMock, where: whereMock }),
            from: fromMock,
            where: whereMock
        })
    };
});

import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

const publicHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'vitest'
};

describe('SPEC-063 T-058 — cross-cutting lifecycleState strip on public endpoints', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    // ------------------------------------------------------------------------
    // AccommodationReview — public list
    // ------------------------------------------------------------------------
    describe('AccommodationReview public list (AC-005)', () => {
        const accommodationId = '123e4567-e89b-12d3-a456-426614174000';
        const base = `/api/v1/public/accommodations/${accommodationId}/reviews`;

        const reviewMockItem = {
            id: '223e4567-e89b-12d3-a456-426614174000',
            userId: '323e4567-e89b-12d3-a456-426614174000',
            accommodationId,
            title: 'Great stay',
            content: 'Really enjoyed it. Excellent service and comfortable rooms throughout.',
            rating: {
                cleanliness: 5,
                hospitality: 4,
                services: 5,
                accuracy: 4,
                communication: 5,
                location: 4
            },
            averageRating: 4.5,
            // Admin-only fields that MUST be stripped by the per-handler parse
            lifecycleState: 'ACTIVE',
            createdById: '423e4567-e89b-12d3-a456-426614174000',
            updatedById: '423e4567-e89b-12d3-a456-426614174000',
            deletedAt: null,
            deletedById: null,
            adminInfo: { notes: 'verified guest', favorite: false },
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-15T00:00:00Z')
        };

        beforeEach(() => {
            accommodationReviewMock.listByAccommodation = vi.fn().mockResolvedValue({
                data: { accommodationReviews: [reviewMockItem], total: 1 }
            });
        });

        it('strips lifecycleState and other admin-only fields from response items', async () => {
            const res = await app.request(base, { headers: publicHeaders });
            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                data?: { items: Array<Record<string, unknown>> };
                items?: Array<Record<string, unknown>>;
            };
            const items = body.data?.items ?? body.items ?? [];

            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item).not.toHaveProperty('lifecycleState');
                expect(item).not.toHaveProperty('createdById');
                expect(item).not.toHaveProperty('updatedById');
                expect(item).not.toHaveProperty('deletedAt');
                expect(item).not.toHaveProperty('adminInfo');
            }
        });

        it('preserves public fields in response items', async () => {
            const res = await app.request(base, { headers: publicHeaders });
            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                data?: { items: Array<Record<string, unknown>> };
                items?: Array<Record<string, unknown>>;
            };
            const items = body.data?.items ?? body.items ?? [];

            expect(items.length).toBeGreaterThan(0);
            const [first] = items;
            expect(first).toHaveProperty('id');
            expect(first).toHaveProperty('title');
            expect(first).toHaveProperty('content');
            expect(first).toHaveProperty('rating');
            expect(first).toHaveProperty('averageRating');
            expect(first).toHaveProperty('user');
        });
    });

    // ------------------------------------------------------------------------
    // DestinationReview — public list
    // ------------------------------------------------------------------------
    describe('DestinationReview public list (AC-005)', () => {
        const destinationId = 'd23e4567-e89b-12d3-a456-426614174000';
        const base = `/api/v1/public/destinations/${destinationId}/reviews`;

        const reviewMockItem = {
            id: 'f23e4567-e89b-12d3-a456-426614174000',
            userId: '523e4567-e89b-12d3-a456-426614174000',
            destinationId,
            title: 'Beautiful destination',
            content:
                'Absolutely stunning place with rich culture and friendly locals, would revisit.',
            rating: {
                landscape: 5,
                attractions: 4,
                accessibility: 3,
                safety: 5,
                cleanliness: 4,
                hospitality: 5,
                culturalOffer: 4,
                gastronomy: 5,
                affordability: 3,
                nightlife: 4,
                infrastructure: 4,
                environmentalCare: 5,
                wifiAvailability: 3,
                shopping: 3,
                beaches: 4,
                greenSpaces: 5,
                localEvents: 4,
                weatherSatisfaction: 4
            },
            averageRating: 4.2,
            visitDate: new Date('2026-01-10T00:00:00Z'),
            tripType: 'LEISURE',
            travelSeason: 'SUMMER',
            language: 'es',
            isRecommended: true,
            wouldVisitAgain: true,
            helpfulVotes: 12,
            totalVotes: 15,
            hasOwnerResponse: false,
            isPublished: true,
            isVerified: false,
            // Admin-only fields that MUST be stripped by the per-handler parse
            lifecycleState: 'ACTIVE',
            createdById: '623e4567-e89b-12d3-a456-426614174000',
            updatedById: '623e4567-e89b-12d3-a456-426614174000',
            deletedAt: null,
            deletedById: null,
            adminInfo: { notes: 'verified traveler', favorite: false },
            createdAt: new Date('2026-01-11T00:00:00Z'),
            updatedAt: new Date('2026-01-12T00:00:00Z')
        };

        beforeEach(() => {
            destinationReviewMock.list = vi.fn().mockResolvedValue({
                data: { items: [reviewMockItem], total: 1 }
            });
        });

        it('strips lifecycleState and other admin-only fields from response items', async () => {
            const res = await app.request(base, { headers: publicHeaders });
            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                data?: { items: Array<Record<string, unknown>> };
                items?: Array<Record<string, unknown>>;
            };
            const items = body.data?.items ?? body.items ?? [];

            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item).not.toHaveProperty('lifecycleState');
                expect(item).not.toHaveProperty('createdById');
                expect(item).not.toHaveProperty('updatedById');
                expect(item).not.toHaveProperty('deletedAt');
                expect(item).not.toHaveProperty('adminInfo');
            }
        });

        it('preserves public fields in response items', async () => {
            const res = await app.request(base, { headers: publicHeaders });
            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                data?: { items: Array<Record<string, unknown>> };
                items?: Array<Record<string, unknown>>;
            };
            const items = body.data?.items ?? body.items ?? [];

            expect(items.length).toBeGreaterThan(0);
            const [first] = items;
            expect(first).toHaveProperty('id');
            expect(first).toHaveProperty('title');
            expect(first).toHaveProperty('content');
            expect(first).toHaveProperty('rating');
            expect(first).toHaveProperty('isRecommended');
            expect(first).toHaveProperty('helpfulVotes');
        });
    });

    // ------------------------------------------------------------------------
    // Sponsorship — no public tier
    // ------------------------------------------------------------------------
    describe('Sponsorship has no public tier (by design)', () => {
        it('GET /api/v1/public/sponsorships returns 404 (endpoint does not exist)', async () => {
            const res = await app.request('/api/v1/public/sponsorships', {
                headers: publicHeaders
            });
            expect(res.status).toBe(404);
        });
    });

    // ------------------------------------------------------------------------
    // OwnerPromotion coverage reference
    // ------------------------------------------------------------------------
    describe('OwnerPromotion public list (covered by T-022)', () => {
        it('is covered by owner-promotion/public-endpoint.test.ts (reference)', () => {
            // T-022 added the per-handler strip and integration coverage for the
            // OwnerPromotion public list endpoint. This no-op assertion keeps the
            // cross-cutting narrative complete without duplicating that suite.
            expect(true).toBe(true);
        });
    });
});
