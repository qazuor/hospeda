/**
 * HOS-1924 item 3 (defence in depth behind the HOS-1923 cache bypass).
 *
 * `/api/v1/public/posts` and `/api/v1/public/events` are in
 * `PUBLIC_CACHE_ENDPOINTS`, so their answers are stored under a key with NO
 * actor in it. `checkCanViewPost` / `checkCanViewEvent` branch on the actor
 * (drafts for an author or a `*_VIEW_DRAFT` holder), so a handler that forwards
 * the REQUEST actor makes the stored body depend on whoever filled the slot.
 *
 * Each case asserts on the actor handed to the service, not on the rows that
 * come back, the same shape as `accommodation/public/actor-blind-cache.test.ts`.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';

const PRIVILEGED_ACTOR = {
    id: '11111111-0000-4000-8000-000000001924',
    roles: ['USER', 'SUPER_ADMIN'],
    permissions: ['POST_VIEW_DRAFT', 'POST_VIEW_ALL', 'EVENT_VIEW_DRAFT', 'EVENT_VIEW_ALL']
};

const mockPostGetBySlug = vi.fn();
const mockPostGetById = vi.fn();
const mockEventGetBySlug = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PostService: vi.fn().mockImplementation(function () {
            return { getBySlug: mockPostGetBySlug, getById: mockPostGetById };
        }),
        EventService: vi.fn().mockImplementation(function () {
            return { getBySlug: mockEventGetBySlug };
        })
    };
});

// The REAL createGuestActor is kept: it is the thing under test.
vi.mock('../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/actor')>();
    return { ...actual, getActorFromContext: vi.fn(() => PRIVILEGED_ACTOR) };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/utils/route-factory', () => {
    const build = (options: {
        method: 'get';
        path: string;
        handler: (c: unknown, params: Record<string, unknown>) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        app[options.method](options.path.replace(/\{([^}]+)\}/g, ':$1'), async (c) =>
            c.json({ success: true, data: await options.handler(c, c.req.param()) })
        );
        return app;
    };
    return { createPublicRoute: build, createPublicListRoute: build };
});

/** Exactly GUEST, nothing else: "contains GUEST" would pass for a hybrid actor. */
function expectGuestActor(actor: unknown): void {
    const a = actor as { roles?: readonly string[]; permissions?: readonly string[] };
    expect(a.roles).toEqual(['GUEST']);
    expect(a.permissions ?? []).not.toContain('POST_VIEW_DRAFT');
    expect(a.permissions ?? []).not.toContain('EVENT_VIEW_DRAFT');
}

async function buildApp(modulePath: string, exportName: string) {
    vi.resetModules();
    const mod = (await import(modulePath)) as Record<string, unknown>;
    const app = new Hono<AppBindings>();
    app.route('/', mod[exportName] as Parameters<typeof app.route>[1]);
    return app;
}

describe('HOS-1924 — cached public post and event handlers resolve as a guest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPostGetBySlug.mockResolvedValue({ data: null, error: null });
        mockPostGetById.mockResolvedValue({ data: null, error: null });
        mockEventGetBySlug.mockResolvedValue({ data: null, error: null });
    });

    it('posts/slug/:slug hands a guest actor to the service for a draft-viewing caller', async () => {
        const app = await buildApp(
            '../../src/routes/post/public/getBySlug',
            'publicGetPostBySlugRoute'
        );
        expect((await app.request('/slug/a-draft')).status).toBe(200);
        expect(mockPostGetBySlug).toHaveBeenCalledTimes(1);
        expectGuestActor((mockPostGetBySlug.mock.calls[0] as [unknown])[0]);
    });

    it('posts/:id hands a guest actor to the service for a draft-viewing caller', async () => {
        const app = await buildApp(
            '../../src/routes/post/public/getById',
            'publicGetPostByIdRoute'
        );
        expect((await app.request('/aaaaaaaa-0000-4000-8000-000000001924')).status).toBe(200);
        expect(mockPostGetById).toHaveBeenCalledTimes(1);
        expectGuestActor((mockPostGetById.mock.calls[0] as [unknown])[0]);
    });

    it('events/slug/:slug hands a guest actor to the service for a draft-viewing caller', async () => {
        const app = await buildApp(
            '../../src/routes/event/public/getBySlug',
            'publicGetEventBySlugRoute'
        );
        expect((await app.request('/slug/a-draft-event')).status).toBe(200);
        expect(mockEventGetBySlug).toHaveBeenCalledTimes(1);
        expectGuestActor((mockEventGetBySlug.mock.calls[0] as [unknown])[0]);
    });
});
