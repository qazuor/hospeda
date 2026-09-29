/**
 * HOS-972 regression: GET /admin/conversations/unread-count must answer 401 to
 * an anonymous caller (never 403), 403 to an authenticated actor without
 * CONVERSATION_VIEW_OWN, and 200 with it (error-contract R2).
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const mockGetUnreadCount = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        ConversationService: vi.fn().mockImplementation(function () {
            return { getUnreadCount: mockGetUnreadCount };
        })
    };
});

import { adminConversationsRouter } from '../../../../src/routes/conversations/admin/index.js';

const GUEST_ACTOR = {
    id: '00000000-0000-4000-8000-000000000000',
    roles: [RoleEnum.GUEST],
    permissions: []
};

const buildApp = (actor: unknown): Hono => {
    const app = new Hono<{ Variables: { actor: unknown } }>({ strict: false });
    app.use('*', async (c, next) => {
        c.set('actor', actor);
        await next();
    });
    app.route('/', adminConversationsRouter);
    return app as unknown as Hono;
};

const ID = '22222222-2222-4222-8222-222222222222';

const ANONYMOUS_ROUTES: ReadonlyArray<readonly [string, string, string]> = [
    ['GET', '/unread-count', 'unread-count'],
    ['GET', '/', 'list'],
    ['GET', `/${ID}`, 'thread'],
    ['POST', `/${ID}/messages`, 'reply'],
    ['PATCH', `/${ID}/status`, 'status'],
    ['PATCH', `/${ID}/archive`, 'archive'],
    ['DELETE', `/${ID}`, 'delete']
];

describe('admin conversations auth order (HOS-972)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(ANONYMOUS_ROUTES)('%s %s (%s) answers 401 to the guest actor', async (method, path) => {
        const res = await buildApp(GUEST_ACTOR).request(path, {
            method,
            headers: { 'content-type': 'application/json' },
            body: method === 'GET' || method === 'DELETE' ? undefined : '{}'
        });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('answers 401 UNAUTHORIZED to the guest actor, without touching the service', async () => {
        const res = await buildApp(GUEST_ACTOR).request('/unread-count');
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error.code).toBe('UNAUTHORIZED');
        expect(mockGetUnreadCount).not.toHaveBeenCalled();
    });

    it('answers 403 FORBIDDEN to an authenticated actor without CONVERSATION_VIEW_OWN', async () => {
        const app = buildApp({
            id: '11111111-1111-4111-8111-111111111111',
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.ACCOMMODATION_CREATE]
        });
        const res = await app.request('/unread-count');
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.error.code).toBe('FORBIDDEN');
        expect(mockGetUnreadCount).not.toHaveBeenCalled();
    });

    it('answers 200 with the count when the actor holds CONVERSATION_VIEW_OWN', async () => {
        mockGetUnreadCount.mockResolvedValueOnce({ data: { count: 3 } });
        const app = buildApp({
            id: '11111111-1111-4111-8111-111111111111',
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.CONVERSATION_VIEW_OWN]
        });
        const res = await app.request('/unread-count');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toStrictEqual({ count: 3 });
    });
});
