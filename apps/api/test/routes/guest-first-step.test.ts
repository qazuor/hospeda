/** TEST:V5:19 — real protected review routes reject guests before their handlers. */
import { PermissionEnum, RoleEnum, ServiceErrorCode, type VerticalEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { protectedCreateAccommodationReviewRoute } from '../../src/routes/accommodation/reviews/protected/create';
import { protectedCreateVenueReviewRoute } from '../../src/routes/venue/protected/createReview';
import type { AppBindings } from '../../src/types';
import { createGuestActor } from '../../src/utils/actor';

const mockEffectiveSet = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mockEffectiveSet })
}));

const mockServices = vi.hoisted(() => ({
    accommodationCreate: vi.fn(),
    venueCreate: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationReviewService: vi.fn().mockImplementation(function () {
            return { create: mockServices.accommodationCreate };
        }),
        VenueReviewService: vi.fn().mockImplementation(function () {
            return { create: mockServices.venueCreate };
        })
    };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

const listingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const authenticatedActor: Actor = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE],
    emailVerified: true
};

const routes = [
    {
        name: 'accommodation review',
        route: protectedCreateAccommodationReviewRoute,
        path: `/${listingId}/reviews`,
        body: {
            rating: {
                cleanliness: 5,
                hospitality: 5,
                services: 5,
                accuracy: 5,
                communication: 5,
                location: 5
            }
        },
        create: mockServices.accommodationCreate
    },
    {
        name: 'gastronomy review',
        route: protectedCreateVenueReviewRoute,
        path: `/${listingId}/reviews`,
        body: { overallRating: 5 },
        create: mockServices.venueCreate
    }
] as const;

function buildApp(actor: Actor, route: (typeof routes)[number]['route']): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof HTTPException) {
            return c.json(
                {
                    error: {
                        code:
                            error.status === 401
                                ? ServiceErrorCode.UNAUTHORIZED
                                : ServiceErrorCode.FORBIDDEN,
                        message: error.message
                    }
                },
                error.status
            );
        }
        throw error;
    });
    app.use((c, next) => {
        c.set('actor', actor);
        return next();
    });
    app.route('/', route);
    return app;
}

async function postReview(actor: Actor, testCase: (typeof routes)[number]) {
    return buildApp(actor, testCase.route).request(testCase.path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(testCase.body)
    });
}

beforeEach(() => {
    mockEffectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [{ key: 'write_reviews', value: 1, strategy: 'MAX' }]
            })
    );
    mockServices.accommodationCreate.mockReset();
    mockServices.venueCreate.mockReset();
});

describe('TEST:V5:19 protected review routes', () => {
    it.each(routes)('rejects a guest on $name before the service', async (testCase) => {
        const response = await postReview(createGuestActor(), testCase);

        expect(response.status).toBe(401);
        expect((await response.json()).error.code).toBe(ServiceErrorCode.UNAUTHORIZED);
        expect(testCase.create).not.toHaveBeenCalled();
    });

    it.each(routes)('rejects unverified email on $name before the service', async (testCase) => {
        const response = await postReview(
            { ...authenticatedActor, emailVerified: false },
            testCase
        );

        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe(ServiceErrorCode.EMAIL_NOT_VERIFIED);
        expect(testCase.create).not.toHaveBeenCalled();
    });

    it('lets an authenticated user reach the accommodation review service', async () => {
        mockServices.accommodationCreate.mockResolvedValue({
            error: { code: ServiceErrorCode.ALREADY_EXISTS, message: 'Review already exists' }
        });

        const response = await postReview(authenticatedActor, routes[0]);

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(mockServices.accommodationCreate).toHaveBeenCalledOnce();
        expect(mockServices.accommodationCreate).toHaveBeenCalledWith(
            authenticatedActor,
            expect.objectContaining({ accommodationId: listingId, userId: authenticatedActor.id })
        );
    });
});
