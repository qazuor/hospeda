/**
 * HOS-1928 regression: every protected conversation route answers 401 to the
 * guest actor BEFORE reaching the handler or the service (error-contract R2).
 *
 * The guest actor carries a real UUID, so the gate must use `isGuestActor`.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { serviceConstructed, serviceMethodCalled } = vi.hoisted(() => ({
    serviceConstructed: vi.fn(),
    serviceMethodCalled: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        ConversationService: vi.fn().mockImplementation(function () {
            serviceConstructed();
            return new Proxy(
                {},
                {
                    get: (_target, prop) => {
                        serviceMethodCalled(String(prop));
                        return vi.fn().mockResolvedValue({ error: { code: 'NOT_FOUND' } });
                    }
                }
            );
        })
    };
});

import { protectedConversationRoutes } from '../../../../src/routes/conversations/protected/index.js';

const GUEST_ACTOR = {
    id: '00000000-0000-4000-8000-000000000000',
    roles: [RoleEnum.GUEST],
    permissions: []
};

const USER_ACTOR = {
    id: '11111111-1111-4111-8111-111111111111',
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.CONVERSATION_VIEW_OWN]
};

const buildApp = (actor: unknown): Hono => {
    const app = new Hono<{ Variables: { actor: unknown } }>({ strict: false });
    app.use('*', async (c, next) => {
        c.set('actor', actor);
        await next();
    });
    app.route('/', protectedConversationRoutes);
    return app as unknown as Hono;
};

const ID = '22222222-2222-4222-8222-222222222222';

const ROUTES: ReadonlyArray<readonly [string, string]> = [
    ['GET', '/unread-count'],
    ['GET', '/'],
    ['POST', '/initiate'],
    ['GET', '/owner/unread-count'],
    ['GET', '/owner'],
    ['GET', `/owner/${ID}`],
    ['POST', `/owner/${ID}/messages`],
    ['GET', `/${ID}`],
    ['POST', `/${ID}/messages`],
    ['PATCH', `/${ID}/archive`]
];

describe('protected conversations auth order (HOS-1928)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(
        ROUTES
    )('%s %s answers 401 to the guest actor without touching the service', async (method, path) => {
        const res = await buildApp(GUEST_ACTOR).request(path, {
            method,
            headers: { 'content-type': 'application/json' },
            body: method === 'GET' ? undefined : '{}'
        });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error.code).toBe('UNAUTHORIZED');
        expect(serviceConstructed).not.toHaveBeenCalled();
        expect(serviceMethodCalled).not.toHaveBeenCalled();
    });

    it('lets an authenticated actor through to the handler (not 401)', async () => {
        const res = await buildApp(USER_ACTOR).request('/unread-count');

        expect(res.status).not.toBe(401);
        expect(serviceConstructed).toHaveBeenCalled();
    });
});
