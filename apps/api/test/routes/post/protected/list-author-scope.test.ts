/**
 * HOS-374 §5.2.2 — GET /api/v1/protected/posts is author-scoped from the
 * SESSION, not from the request.
 *
 * This route exists to show an editor their own unpublished work, so it
 * deliberately reads through `service.list`, which carries no public read
 * floor. That makes the `authorId` binding the only thing standing between an
 * editor's drafts and anyone who asks for them: if the scope could be widened
 * from the query string, this endpoint would hand out every author's
 * unapproved content to any authenticated caller.
 */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';
const SOMEONE_ELSE_ID = '22222222-2222-4222-8222-222222222222';

const { mockList, mockSearch } = vi.hoisted(() => ({
    mockList: vi.fn(),
    mockSearch: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        // `function` (not an arrow) — the route calls this with `new`.
        PostService: vi.fn().mockImplementation(function () {
            return { list: mockList, search: mockSearch };
        })
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedListOwnPostsRoute } = await import(
    '../../../../src/routes/post/protected/list.js'
);

/** One post row shaped as the service layer returns it. */
function postRow(id: string, moderationState = 'PENDING') {
    return {
        id,
        slug: `nota-${id.slice(0, 4)}`,
        title: 'Una nota del editor',
        summary: 'Un resumen suficientemente largo para el schema de lectura de posts.',
        // The read schema enforces a 100-character minimum on `content`.
        content:
            'Contenido de la nota del editor, con la longitud suficiente para superar el minimo de cien caracteres que exige el schema de lectura.',
        category: 'GENERAL',
        authorId: AUTHOR_ID,
        media: {
            featuredImage: { url: 'https://example.com/i.jpg', moderationState: 'APPROVED' }
        },
        visibility: 'PRIVATE',
        lifecycleState: 'ACTIVE',
        moderationState,
        isFeatured: false,
        isNews: false,
        likes: 0,
        comments: 0,
        shares: 0,
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
        // POST_VIEW_ALL. The route must work for exactly this actor.
        c.set('actor', {
            id: AUTHOR_ID,
            roles: [RoleEnum.EDITOR],
            permissions: [PermissionEnum.POST_UPDATE_OWN, PermissionEnum.POST_VIEW_OWN]
        });
        return next();
    });

    app.route('/', protectedListOwnPostsRoute);
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
            items: [postRow('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')],
            total: 1
        },
        error: undefined
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/v1/protected/posts — author scope (HOS-374 §5.2.2)', () => {
    it('scopes the query to the acting author', async () => {
        const res = await buildApp().request('/');

        expect(res.status).toBe(200);
        expect(capturedWhere().authorId).toBe(AUTHOR_ID);
    });

    it('rejects an authorId supplied by the caller instead of honouring it', async () => {
        // The load-bearing assertion. `authorId` is not a declared query
        // parameter, and the route factory's validator is strict about unknown
        // ones — so the request is refused before the handler runs, which is
        // stronger than silently overriding it. Declaring `authorId` in
        // `requestQuery` would turn this 400 into a 200 scoped to whoever the
        // caller named, and this test is what makes that regression loud.
        const res = await buildApp().request(`/?authorId=${SOMEONE_ELSE_ID}`);

        expect(res.status).toBe(400);
        expect(mockList).not.toHaveBeenCalled();
    });

    it('returns the author’s unapproved content', async () => {
        // The reason this route does not go through `search`: an editor has to
        // see the PENDING post they just wrote.
        const res = await buildApp().request('/');

        const body = await res.json();
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0].moderationState).toBe('PENDING');
    });

    it('reads through list(), never through the floored search() path', async () => {
        await buildApp().request('/');

        expect(mockList).toHaveBeenCalledTimes(1);
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
