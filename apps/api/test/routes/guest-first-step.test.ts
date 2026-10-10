/** TEST:V5:19 — real protected review routes reject guests before their handlers. */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { protectedCreateAccommodationReviewRoute } from '../../src/routes/accommodation/reviews/protected/create';
import { protectedCreateGastronomyReviewRoute } from '../../src/routes/gastronomy/protected/createReview';
import type { AppBindings } from '../../src/types';
import { createGuestActor } from '../../src/utils/actor';

const mockServices = vi.hoisted(() => ({
    accommodationCreate: vi.fn(),
    gastronomyCreate: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationReviewService: vi.fn().mockImplementation(function () {
            return { create: mockServices.accommodationCreate };
        }),
        GastronomyReviewService: vi.fn().mockImplementation(function () {
            return { create: mockServices.gastronomyCreate };
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
        route: protectedCreateGastronomyReviewRoute,
        path: `/${listingId}/reviews`,
        body: { overallRating: 5 },
        create: mockServices.gastronomyCreate
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
    mockServices.accommodationCreate.mockReset();
    mockServices.gastronomyCreate.mockReset();
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
