/**
 * The host's review endpoints (HOS-376 T-034).
 *
 * ```
 * POST  /api/v1/protected/host-trades/{id}/reviews
 * PATCH /api/v1/protected/host-trades/reviews/{id}
 * GET   /api/v1/protected/host-trades/{id}/my-review
 * ```
 *
 * Three properties are worth pinning at the REQUEST level, because each of
 * them is invisible from the service's own tests:
 *
 * 1. The four domain refusals reach the client as the numbers spec §7.5 names
 *    (403 NO_CONFIRMED_USAGE, 403 SELF_REVIEW_FORBIDDEN, 409
 *    REVIEW_ALREADY_EXISTS, 422 PROVIDER_REVOKED). The app carries the REAL
 *    `createErrorHandler()`, so this measures the shipped mapping rather than
 *    one invented for the test.
 * 2. The moderation apparatus is not client-settable. The bodies are
 *    `.strict()`, and what that buys is only real if the route factory's
 *    rebuild preserves it — so an injected `moderationState` is asserted to be
 *    REFUSED, not quietly stripped.
 * 3. Reading back a review you never wrote answers `{ review: null }` with 200,
 *    and editing somebody else's answers 404 — never 403, which would confirm
 *    the id exists.
 *
 * @module test/routes/host-trade/reviews
 */

import type { PermissionEnum } from '@repo/schemas';
import { PermissionEnum as Permissions, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockCreateReview, mockUpdateReview, mockGetMyReview } = vi.hoisted(() => ({
    mockCreateReview: vi.fn(),
    mockUpdateReview: vi.fn(),
    mockGetMyReview: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeReviewService: vi.fn().mockImplementation(function () {
            return {
                createReview: mockCreateReview,
                updateReview: mockUpdateReview,
                getMyReview: mockGetMyReview
            };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedCreateReviewRoute, protectedGetMyReviewRoute, protectedUpdateReviewRoute } =
    await import('../../../src/routes/host-trade/protected/reviews.js');

const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const HOST_ID = '11111111-1111-4111-8111-111111111111';
const HT_ID = '22222222-2222-4222-8222-222222222222';
const REVIEW_ID = '33333333-3333-4333-8333-333333333333';

const MOCK_REVIEW = {
    id: REVIEW_ID,
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    overallRating: 4,
    rating: { workQuality: 5, punctuality: 3 },
    averageRating: 4,
    respectedBenefit: true,
    content: 'Vino el mismo día y respetó el descuento.',
    moderationState: 'APPROVED',
    editedAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-01T00:00:00Z').toISOString()
};

/** A valid create body: the four fields the host authors. */
const validBody = {
    overallRating: 4,
    rating: { workQuality: 5, punctuality: 3 },
    respectedBenefit: true,
    content: 'Vino el mismo día y respetó el descuento.'
};

/**
 * An app carrying the REAL error handler, so a status assertion measures the
 * shipped mapping rather than one invented for the test.
 */
function buildApp(
    permissions: PermissionEnum[] = [Permissions.HOST_TRADE_REVIEW_CREATE]
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());

    app.use((c, next) => {
        c.set('actor', { id: HOST_ID, roles: [RoleEnum.HOST], permissions });
        return next();
    });

    app.route('/', protectedCreateReviewRoute);
    app.route('/', protectedUpdateReviewRoute);
    app.route('/', protectedGetMyReviewRoute);

    return app;
}

const send = (app: Hono<AppBindings>, method: string, path: string, body?: unknown) =>
    app.request(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {})
    });

beforeEach(() => {
    vi.clearAllMocks();
    mockCreateReview.mockResolvedValue({ data: { review: MOCK_REVIEW } });
    mockUpdateReview.mockResolvedValue({
        data: { review: { ...MOCK_REVIEW, overallRating: 5, editedAt: new Date().toISOString() } }
    });
    mockGetMyReview.mockResolvedValue({ data: { review: MOCK_REVIEW } });
});

describe('registration', () => {
    /**
     * Every test below mounts the route objects DIRECTLY, so all twenty would
     * stay green on a route file that `protected/index.ts` never registers —
     * three endpoints that exist in the repo and answer 404 in production. This
     * is the only assertion that touches the real router.
     */
    it('mounts the three review routes on the protected router', async () => {
        const { protectedHostTradeRoutes } = await import(
            '../../../src/routes/host-trade/protected/index.js'
        );
        const registered = (
            protectedHostTradeRoutes as unknown as { routes: { method: string; path: string }[] }
        ).routes.map((route) => `${route.method.toUpperCase()} ${route.path}`);

        expect(registered).toContain('POST /:id/reviews');
        expect(registered).toContain('PATCH /reviews/:id');
        expect(registered).toContain('GET /:id/my-review');
    });
});

describe('POST /{id}/reviews', () => {
    it('creates the review and takes the provider from the path', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', `/${HT_ID}/reviews`, validBody);

        expect(res.status).toBe(201);
        expect(mockCreateReview).toHaveBeenCalledWith(
            { hostTradeId: HT_ID, ...validBody },
            expect.anything()
        );
    });

    /**
     * Gate 1 of spec §6.3. A provider-only account holds no `HOST_TRADE_*`
     * permission at all, and must not be able to review anybody.
     */
    it('refuses an actor without HOST_TRADE_REVIEW_CREATE', async () => {
        const app = buildApp([]);

        const res = await send(app, 'POST', `/${HT_ID}/reviews`, validBody);

        expect(res.status).toBe(403);
        expect(mockCreateReview).not.toHaveBeenCalled();
    });

    /** The four domain refusals of §7.5, each with the number the spec names. */
    it.each([
        [ServiceErrorCode.NO_CONFIRMED_USAGE, 403],
        [ServiceErrorCode.SELF_REVIEW_FORBIDDEN, 403],
        [ServiceErrorCode.REVIEW_ALREADY_EXISTS, 409],
        [ServiceErrorCode.PROVIDER_REVOKED, 422]
    ])('maps %s to HTTP %i', async (code, status) => {
        mockCreateReview.mockResolvedValue({ error: { code, message: 'refused' } });
        const app = buildApp();

        const res = await send(app, 'POST', `/${HT_ID}/reviews`, validBody);

        expect(res.status).toBe(status);
    });

    it('rejects a provider id that is not a uuid', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', '/not-a-uuid/reviews', validBody);

        expect(res.status).toBe(400);
        expect(mockCreateReview).not.toHaveBeenCalled();
    });

    /** `respectedBenefit` is the one answer the directory exists to collect. */
    it('rejects a body with no respectedBenefit answer', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', `/${HT_ID}/reviews`, {
            overallRating: 4,
            content: 'Sin la respuesta del beneficio.'
        });

        expect(res.status).toBe(400);
        expect(mockCreateReview).not.toHaveBeenCalled();
    });

    /**
     * The whole point of the `.strict()` body: a client that could send
     * `moderationState` would publish a review that skipped moderation. Being
     * REFUSED rather than stripped is what makes the attempt visible.
     */
    it('refuses a body carrying moderationState', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', `/${HT_ID}/reviews`, {
            ...validBody,
            moderationState: 'APPROVED'
        });

        expect(res.status).toBe(400);
        expect(mockCreateReview).not.toHaveBeenCalled();
    });
});

describe('PATCH /reviews/{id}', () => {
    it('edits the review and takes its id from the path', async () => {
        const app = buildApp();

        const res = await send(app, 'PATCH', `/reviews/${REVIEW_ID}`, { overallRating: 5 });

        expect(res.status).toBe(200);
        expect(mockUpdateReview).toHaveBeenCalledWith(
            { reviewId: REVIEW_ID, overallRating: 5 },
            expect.anything()
        );
    });

    /**
     * An absent key means "no change" — that is what makes a star-only edit
     * distinguishable from a rewrite, and a rewrite is the only thing that
     * re-runs moderation. If the route padded the untouched fields with
     * `undefined`, a star edit would look like a text edit to the service.
     */
    it('forwards only the fields the host actually sent', async () => {
        const app = buildApp();

        await send(app, 'PATCH', `/reviews/${REVIEW_ID}`, { overallRating: 5 });

        const sent = mockUpdateReview.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(Object.keys(sent).sort()).toEqual(['overallRating', 'reviewId']);
    });

    /**
     * Ownership lives in the service and its refusal is NOT_FOUND, so editing
     * a stranger's review must surface as 404. A 403 would confirm the id
     * exists, following the criterion of `alliance/protected/claim.ts`.
     */
    it('answers 404 for a review that is not the actor’s', async () => {
        mockUpdateReview.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Review not found' }
        });
        const app = buildApp();

        const res = await send(app, 'PATCH', `/reviews/${REVIEW_ID}`, { overallRating: 5 });

        expect(res.status).toBe(404);
    });

    /**
     * Auth + ownership, no permission (§7.5). A host whose directory perk
     * lapsed must still be able to edit what he already published.
     */
    it('serves an actor holding no host-trade permission', async () => {
        const app = buildApp([]);

        const res = await send(app, 'PATCH', `/reviews/${REVIEW_ID}`, { overallRating: 5 });

        expect(res.status).toBe(200);
    });

    /** `editedAt` is the marker that flags the provider's reply (AC-22). */
    it('refuses a body carrying editedAt', async () => {
        const app = buildApp();

        const res = await send(app, 'PATCH', `/reviews/${REVIEW_ID}`, {
            overallRating: 5,
            editedAt: '2026-01-01T00:00:00Z'
        });

        expect(res.status).toBe(400);
        expect(mockUpdateReview).not.toHaveBeenCalled();
    });

    it('rejects a review id that is not a uuid', async () => {
        const app = buildApp();

        const res = await send(app, 'PATCH', '/reviews/not-a-uuid', { overallRating: 5 });

        expect(res.status).toBe(400);
        expect(mockUpdateReview).not.toHaveBeenCalled();
    });
});

describe('GET /{id}/my-review', () => {
    it('returns the review the host wrote for that provider', async () => {
        const app = buildApp();

        const res = await app.request(`/${HT_ID}/my-review`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.review.id).toBe(REVIEW_ID);
        expect(mockGetMyReview).toHaveBeenCalledWith({ hostTradeId: HT_ID }, expect.anything());
    });

    /**
     * ABSENCE IS AN ORDINARY STATE. Most pairs have no review, and the card
     * calling this needs to know whether to offer "write one" or "edit yours";
     * a 404 would make the common case look like a broken page.
     */
    it('answers 200 with a null review when the host has not written one', async () => {
        mockGetMyReview.mockResolvedValue({ data: { review: null } });
        const app = buildApp();

        const res = await app.request(`/${HT_ID}/my-review`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.review).toBeNull();
    });

    /**
     * The response contract says `review` is nullable, and a JSON body that
     * simply OMITS the key is not the same thing: `undefined` disappears from
     * the serialised payload, so a client destructuring `{ review }` cannot
     * tell "no review" from "malformed response". This pins the coalesce that
     * turns an absent value into an explicit null — mocked as a service answer
     * carrying no `review` key at all, which is the only shape that reaches it.
     */
    it('answers an explicit null when the service returns no review key', async () => {
        mockGetMyReview.mockResolvedValue({ data: {} });
        const app = buildApp();

        const res = await app.request(`/${HT_ID}/my-review`);
        const raw = await res.text();

        expect(res.status).toBe(200);
        expect(JSON.parse(raw).data).toHaveProperty('review', null);
    });

    it('serves an actor holding no host-trade permission', async () => {
        const app = buildApp([]);

        const res = await app.request(`/${HT_ID}/my-review`);

        expect(res.status).toBe(200);
    });

    it('rejects a provider id that is not a uuid', async () => {
        const app = buildApp();

        const res = await app.request('/not-a-uuid/my-review');

        expect(res.status).toBe(400);
        expect(mockGetMyReview).not.toHaveBeenCalled();
    });
});
