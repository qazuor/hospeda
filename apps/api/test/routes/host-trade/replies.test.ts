/**
 * The provider's right of reply (HOS-376 T-035).
 *
 * ```
 * POST  /api/v1/protected/host-trades/reviews/{id}/reply
 * PATCH /api/v1/protected/host-trades/replies/{id}
 * ```
 *
 * Both are AUTH-ONLY. A provider whose alliance application was approved is an
 * ordinary account holding no `HOST_TRADE_*` permission, so requiring one would
 * lock him out of answering a complaint about his own business (HOS-278 AC-7).
 * What authorises him is owning the reviewed listing, which the service
 * re-derives from the listing rather than trusting the frozen `authorUserId`.
 *
 * ANSWERING SOMEBODY ELSE'S REVIEW IS 404, never 403 — the reply endpoints must
 * not become an oracle for which review ids exist.
 *
 * Both write paths leave the reply in PENDING (§6.4, AC-23). What that state
 * MEANS — that the reply stays out of the directory until an admin clears it —
 * is asserted where the listing lives, in T-036. Here the property is narrower
 * and still worth pinning: the route never overrides what the service decided.
 *
 * @module test/routes/host-trade/replies
 */

import type { PermissionEnum } from '@repo/schemas';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockCreateReply, mockUpdateReply } = vi.hoisted(() => ({
    mockCreateReply: vi.fn(),
    mockUpdateReply: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeReviewReplyService: vi.fn().mockImplementation(function () {
            return {
                createReply: mockCreateReply,
                updateReply: mockUpdateReply
            };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedCreateReplyRoute, protectedUpdateReplyRoute } = await import(
    '../../../src/routes/host-trade/protected/replies.js'
);

const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const REVIEW_ID = '22222222-2222-4222-8222-222222222222';
const REPLY_ID = '33333333-3333-4333-8333-333333333333';

const MOCK_REPLY = {
    id: REPLY_ID,
    reviewId: REVIEW_ID,
    content: 'Fuimos el mismo día y aplicamos el descuento acordado.',
    moderationState: 'PENDING',
    reviewEditedAfterReply: false,
    createdAt: new Date('2026-08-02T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-02T00:00:00Z').toISOString()
};

const validBody = { content: 'Fuimos el mismo día y aplicamos el descuento acordado.' };

/** An app carrying the REAL error handler, so a status means the shipped one. */
function buildApp(permissions: PermissionEnum[] = []): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());

    app.use((c, next) => {
        c.set('actor', { id: OWNER_ID, roles: [RoleEnum.USER], permissions });
        return next();
    });

    app.route('/', protectedCreateReplyRoute);
    app.route('/', protectedUpdateReplyRoute);

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
    mockCreateReply.mockResolvedValue({ data: { reply: MOCK_REPLY } });
    mockUpdateReply.mockResolvedValue({
        data: { reply: { ...MOCK_REPLY, content: 'Texto corregido.' } }
    });
});

describe('registration', () => {
    /**
     * Every test below mounts the route objects directly, so all of them would
     * stay green on a route file `protected/index.ts` never registers. This is
     * the only assertion that touches the real router.
     */
    it('mounts both reply routes on the protected router', async () => {
        const { protectedHostTradeRoutes } = await import(
            '../../../src/routes/host-trade/protected/index.js'
        );
        const registered = (
            protectedHostTradeRoutes as unknown as { routes: { method: string; path: string }[] }
        ).routes.map((route) => `${route.method.toUpperCase()} ${route.path}`);

        expect(registered).toContain('POST /reviews/:id/reply');
        expect(registered).toContain('PATCH /replies/:id');
    });

    /**
     * `POST /reviews/{id}/reply` and `POST /{id}/reviews` share a verb and
     * differ only in shape. A request to answer a review must not be read as
     * "publish a review about the provider whose id is `reviews`".
     */
    it('routes POST /reviews/{id}/reply to the reply handler', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', `/reviews/${REVIEW_ID}/reply`, validBody);

        expect(res.status).toBe(201);
        expect(mockCreateReply).toHaveBeenCalled();
    });
});

describe('POST /reviews/{id}/reply', () => {
    it('creates the reply and takes the review from the path', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', `/reviews/${REVIEW_ID}/reply`, validBody);

        expect(res.status).toBe(201);
        expect(mockCreateReply).toHaveBeenCalledWith(
            { reviewId: REVIEW_ID, content: validBody.content },
            expect.anything()
        );
    });

    /**
     * AC-21, as far as this layer can see it: the reply comes back PENDING
     * because the service said so and the route did not touch it. Whether a
     * PENDING reply stays out of the public listing is T-036's assertion.
     */
    it('returns the reply awaiting moderation, unmodified', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', `/reviews/${REVIEW_ID}/reply`, validBody);
        const body = await res.json();

        expect(body.data.reply.moderationState).toBe('PENDING');
    });

    /**
     * The provider holds NO host-trade permission — that is the whole point of
     * HOS-278 AC-7. Requiring one would silence him on his own listing.
     */
    it('serves a provider holding no host-trade permission', async () => {
        const app = buildApp([]);

        const res = await send(app, 'POST', `/reviews/${REVIEW_ID}/reply`, validBody);

        expect(res.status).toBe(201);
    });

    it('answers 404 when the review is not on the actor’s listing', async () => {
        mockCreateReply.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Review not found' }
        });
        const app = buildApp();

        const res = await send(app, 'POST', `/reviews/${REVIEW_ID}/reply`, validBody);

        expect(res.status).toBe(404);
    });

    /** One reply per review, not a thread. */
    it('answers 409 when the review already has a reply', async () => {
        mockCreateReply.mockResolvedValue({
            error: { code: ServiceErrorCode.ALREADY_EXISTS, message: 'Already replied' }
        });
        const app = buildApp();

        const res = await send(app, 'POST', `/reviews/${REVIEW_ID}/reply`, validBody);

        expect(res.status).toBe(409);
    });

    it('rejects a review id that is not a uuid', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', '/reviews/not-a-uuid/reply', validBody);

        expect(res.status).toBe(400);
        expect(mockCreateReply).not.toHaveBeenCalled();
    });

    it('rejects a body with no text', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', `/reviews/${REVIEW_ID}/reply`, {});

        expect(res.status).toBe(400);
        expect(mockCreateReply).not.toHaveBeenCalled();
    });

    /**
     * A client that could name `moderationState` would publish straight past
     * the doxxing check the PENDING default exists for (§6.4).
     */
    it('refuses a body carrying moderationState', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', `/reviews/${REVIEW_ID}/reply`, {
            ...validBody,
            moderationState: 'APPROVED'
        });

        expect(res.status).toBe(400);
        expect(mockCreateReply).not.toHaveBeenCalled();
    });

    /**
     * The AC-22 marker. A provider who could clear it would erase the notice
     * saying his reply answers an older version of the review.
     */
    it('refuses a body carrying reviewEditedAfterReply', async () => {
        const app = buildApp();

        const res = await send(app, 'POST', `/reviews/${REVIEW_ID}/reply`, {
            ...validBody,
            reviewEditedAfterReply: false
        });

        expect(res.status).toBe(400);
        expect(mockCreateReply).not.toHaveBeenCalled();
    });
});

describe('PATCH /replies/{id}', () => {
    it('edits the reply and takes its id from the path', async () => {
        const app = buildApp();

        const res = await send(app, 'PATCH', `/replies/${REPLY_ID}`, {
            content: 'Texto corregido.'
        });

        expect(res.status).toBe(200);
        expect(mockUpdateReply).toHaveBeenCalledWith(
            { replyId: REPLY_ID, content: 'Texto corregido.' },
            expect.anything()
        );
    });

    /** AC-23: an edited reply leaves the directory until it is cleared again. */
    it('returns the edited reply back in PENDING', async () => {
        const app = buildApp();

        const res = await send(app, 'PATCH', `/replies/${REPLY_ID}`, {
            content: 'Texto corregido.'
        });
        const body = await res.json();

        expect(body.data.reply.moderationState).toBe('PENDING');
    });

    it('answers 404 for a reply that is not the actor’s', async () => {
        mockUpdateReply.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Reply not found' }
        });
        const app = buildApp();

        const res = await send(app, 'PATCH', `/replies/${REPLY_ID}`, { content: 'Otra cosa.' });

        expect(res.status).toBe(404);
    });

    /**
     * `content` is REQUIRED here, unlike the review's partial PATCH: this
     * resource has one editable field, so an empty body carries no change and
     * would still send a published answer back to PENDING for nothing.
     */
    it('rejects an empty body instead of re-moderating for nothing', async () => {
        const app = buildApp();

        const res = await send(app, 'PATCH', `/replies/${REPLY_ID}`, {});

        expect(res.status).toBe(400);
        expect(mockUpdateReply).not.toHaveBeenCalled();
    });

    it('serves a provider holding no host-trade permission', async () => {
        const app = buildApp([]);

        const res = await send(app, 'PATCH', `/replies/${REPLY_ID}`, { content: 'Texto nuevo.' });

        expect(res.status).toBe(200);
    });

    it('rejects a reply id that is not a uuid', async () => {
        const app = buildApp();

        const res = await send(app, 'PATCH', '/replies/not-a-uuid', { content: 'Texto nuevo.' });

        expect(res.status).toBe(400);
        expect(mockUpdateReply).not.toHaveBeenCalled();
    });
});
