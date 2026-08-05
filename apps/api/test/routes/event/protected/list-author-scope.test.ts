/**
 * HOS-374 §5.2.2 — GET /api/v1/protected/events is author-scoped from the
 * SESSION, not from the request.
 *
 * The event twin of the protected post listing. It exists because the public
 * `GET /events/author/{id}` cannot serve this purpose: anyone may ask that one
 * for anyone's events, so it carries the public read floor and can never return
 * a draft. Here the session names the author, so the route reads through
 * `service.list`, which carries no floor — and the `authorId` binding is then
 * the only thing keeping one editor's drafts away from another.
 */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';
const SOMEONE_ELSE_ID = '22222222-2222-4222-8222-222222222222';

const { mockList, mockSearch, mockGetByAuthor } = vi.hoisted(() => ({
    mockList: vi.fn(),
    mockSearch: vi.fn(),
    mockGetByAuthor: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        // `function` (not an arrow) — the route calls this with `new`.
        EventService: vi.fn().mockImplementation(function () {
            return { list: mockList, search: mockSearch, getByAuthor: mockGetByAuthor };
        })
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedListOwnEventsRoute } = await import(
    '../../../../src/routes/event/protected/list.js'
);

/** One event row shaped as the service layer returns it. */
function eventRow(id: string, moderationState = 'PENDING') {
    return {
        id,
        slug: `evento-${id.slice(0, 4)}`,
        name: 'Un evento del editor',
        category: 'MUSIC',
        summary: 'Un resumen del evento con la longitud minima que exige el schema.',
        description:
            'Una descripcion del evento con la longitud suficiente para superar el minimo de cincuenta caracteres.',
        authorId: AUTHOR_ID,
        media: {
            featuredImage: { url: 'https://example.com/i.jpg', moderationState: 'APPROVED' }
        },
        date: { start: '2026-12-01T20:00:00.000Z', end: '2026-12-01T23:00:00.000Z' },
        pricing: null,
        locationId: null,
        organizerId: null,
        isFeatured: false,
        visibility: 'PRIVATE',
        lifecycleState: 'ACTIVE',
        moderationState,
        contactInfo: null,
        seo: null,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    };
}

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.INTERNAL_ERROR]: 500
};

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();

    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                status as 400 | 401 | 403 | 404 | 500
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

    app.use((c, next) => {
        // An EDITOR as HOS-374 defines one: own-scoped permissions only, no
        // EVENT_VIEW_ALL. The route must work for exactly this actor.
        c.set('actor', {
            id: AUTHOR_ID,
            roles: [RoleEnum.EDITOR],
            permissions: [PermissionEnum.EVENT_UPDATE_OWN, PermissionEnum.EVENT_VIEW_OWN]
        });
        return next();
    });

    app.route('/', protectedListOwnEventsRoute);
    return app;
}

/** The `where` object the route handed to `service.list`. */
function capturedWhere(): Record<string, unknown> {
    expect(mockList).toHaveBeenCalledTimes(1);
    const options = mockList.mock.calls[0]?.[1] as { where?: Record<string, unknown> };
    return options.where ?? {};
}

beforeEach(() => {
    mockList.mockResolvedValue({
        data: {
            items: [eventRow('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')],
            total: 1
        },
        error: undefined
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/v1/protected/events — author scope (HOS-374 §5.2.2)', () => {
    it('scopes the query to the acting author', async () => {
        const res = await buildApp().request('/');

        expect(res.status).toBe(200);
        expect(capturedWhere().authorId).toBe(AUTHOR_ID);
    });

    it('rejects an authorId supplied by the caller instead of honouring it', async () => {
        // The load-bearing assertion. `authorId` is not a declared query
        // parameter, and the route factory's validator is strict about unknown
        // ones — so the request is refused before the handler runs. Declaring
        // `authorId` in `requestQuery` would turn this 400 into a 200 scoped to
        // whoever the caller named, and this test is what makes that loud.
        const res = await buildApp().request(`/?authorId=${SOMEONE_ELSE_ID}`);

        expect(res.status).toBe(400);
        expect(mockList).not.toHaveBeenCalled();
    });

    it('returns the author’s unapproved content', async () => {
        const res = await buildApp().request('/');

        const body = await res.json();
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0].moderationState).toBe('PENDING');
    });

    it('reads through list(), never through getByAuthor() or the floored search()', async () => {
        // getByAuthor backs the PUBLIC author route and is floored; reaching for
        // it here would silently hide the author's own drafts.
        await buildApp().request('/');

        expect(mockList).toHaveBeenCalledTimes(1);
        expect(mockGetByAuthor).not.toHaveBeenCalled();
        expect(mockSearch).not.toHaveBeenCalled();
    });

    it('forwards a moderationState filter alongside the author scope', async () => {
        const res = await buildApp().request('/?moderationState=REJECTED');

        expect(res.status).toBe(200);
        expect(capturedWhere()).toMatchObject({
            authorId: AUTHOR_ID,
            moderationState: 'REJECTED'
        });
    });

    it('forwards a lifecycleState filter alongside the author scope', async () => {
        const res = await buildApp().request('/?lifecycleState=ARCHIVED');

        expect(res.status).toBe(200);
        expect(capturedWhere()).toMatchObject({
            authorId: AUTHOR_ID,
            lifecycleState: 'ARCHIVED'
        });
    });
});
