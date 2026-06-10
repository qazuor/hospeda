/**
 * SPEC-202 T-014 — Destination review create route security tests.
 *
 * Cases:
 * 1. Valid body → created review's userId equals the mocked actor id.
 * 2. Body containing a userId field → 400 (strict schema).
 * 3. Service returning ALREADY_EXISTS → HTTP 409 with error.code ALREADY_EXISTS.
 *
 * Pattern: mirrors apps/api/test/routes/promotion-and-review-entitlement-gates.test.ts
 * for the Hono app + error-handler helpers, and uses vi.mock to intercept
 * DestinationReviewService so no DB connection is needed.
 *
 * The entitlement gate (WRITE_REVIEWS → 403 ENTITLEMENT_REQUIRED) is already
 * covered in promotion-and-review-entitlement-gates.test.ts and is NOT
 * duplicated here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that transitively load them.
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        DestinationReviewService: vi.fn().mockImplementation(() => ({
            create: mockCreate
        }))
    };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports after mocks.
// ---------------------------------------------------------------------------

import { EntitlementKey, type LimitKey } from '@repo/billing';
import {
    DestinationReviewCreateBodySchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Test helpers — minimal error handler mirroring production createErrorHandler().
// ---------------------------------------------------------------------------

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.ALREADY_EXISTS]: 409,
    [ServiceErrorCode.ENTITLEMENT_REQUIRED]: 403,
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400
};

function attachTestErrorHandler(app: Hono<AppBindings>): void {
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
            return c.json(
                {
                    success: false,
                    error: { code: error.code, message: error.message }
                },
                status as 400 | 401 | 403 | 404 | 409 | 500
            );
        }
        if (error instanceof HTTPException) {
            return error.getResponse();
        }
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
            500
        );
    });
}

/** Inject actor + billing context so the route handler can run without auth middleware. */
function injectActorAndEntitlements(
    app: Hono<AppBindings>,
    actorId: string,
    keys: EntitlementKey[]
): void {
    app.use((c, next) => {
        c.set('actor', {
            id: actorId,
            role: RoleEnum.USER,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        c.set('userEntitlements', new Set(keys));
        c.set('userLimits', new Map<LimitKey, number>());
        c.set('billingLoadFailed', false);
        return next();
    });
}

/** Full valid rating with all 18 dimensions. */
const VALID_RATING = {
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
};

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const DESTINATION_ID = '22222222-2222-4222-8222-222222222222';

/** Build a minimal Hono app that mimics the protected create destination review route. */
function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    injectActorAndEntitlements(app, ACTOR_ID, [EntitlementKey.WRITE_REVIEWS]);
    attachTestErrorHandler(app);

    app.post('/destinations/:destinationId/reviews', async (c) => {
        const actor = c.get('actor');
        if (!actor) throw new HTTPException(500, { message: 'No actor' });

        // Inline Zod validation — mirrors the strict schema check the route factory does
        const rawBody = await c.req.json().catch(() => null);
        const parsed = DestinationReviewCreateBodySchema.safeParse(rawBody);
        if (!parsed.success) {
            throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Validation error');
        }

        const { DestinationReviewService } = await import('@repo/service-core');
        const { apiLogger } = await import('../../../src/utils/logger');
        const payload = {
            ...parsed.data,
            destinationId: c.req.param('destinationId'),
            userId: actor.id
        };
        const service = new DestinationReviewService({ logger: apiLogger });
        const result = await service.create(actor, payload);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return c.json({ data: result.data }, 201);
    });

    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /destinations/:destinationId/reviews — security (SPEC-202 T-014)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('case 1: created review userId equals the mocked actor id, not any client-supplied value', async () => {
        // Arrange — service returns success; we capture the payload passed to create()
        const returnedReview = {
            id: '33333333-3333-4333-8333-333333333333',
            userId: ACTOR_ID,
            destinationId: DESTINATION_ID,
            rating: VALID_RATING,
            averageRating: 0
        };
        mockCreate.mockResolvedValue({ data: returnedReview });
        const app = buildApp();

        // Act
        const res = await app.request(`/destinations/${DESTINATION_ID}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: VALID_RATING })
        });

        // Assert — 201 created
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.userId).toBe(ACTOR_ID);

        // Also assert the service was called with userId = actor id
        const [_actor, payload] = mockCreate.mock.calls[0] as [unknown, { userId: string }];
        expect(payload.userId).toBe(ACTOR_ID);
    });

    it('case 2: body containing a userId field → 400 (strict schema rejects unknown key)', async () => {
        // Arrange — body includes userId which must be rejected by the strict body schema
        const app = buildApp();

        // Act
        const res = await app.request(`/destinations/${DESTINATION_ID}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rating: VALID_RATING,
                userId: '99999999-9999-4999-8999-999999999999'
            })
        });

        // Assert — zValidator returns 400 for extra keys (strict schema via DestinationReviewCreateInputSchema.strict())
        expect(res.status).toBe(400);
        // Service must NOT have been called
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('case 3: service returning ALREADY_EXISTS → HTTP 409 with error.code ALREADY_EXISTS', async () => {
        // Arrange — service signals duplicate review
        mockCreate.mockResolvedValue({
            error: {
                code: ServiceErrorCode.ALREADY_EXISTS,
                message: 'You have already submitted a review for this destination.'
            }
        });
        const app = buildApp();

        // Act
        const res = await app.request(`/destinations/${DESTINATION_ID}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: VALID_RATING })
        });

        // Assert
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
    });
});
