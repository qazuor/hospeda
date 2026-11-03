/** @module test/routes/event-organizer/cache-invalidation-wiring */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { EventOrganizerService } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, createCacheMiddleware } from '../../../src/middlewares/cache.js';
import { clearEntityFetchers, registerEntityFetcher } from '../../../src/middlewares/ownership.js';
import { adminEventOrganizerRoutes } from '../../../src/routes/event-organizer/admin/index.js';
import { protectedEventOrganizerRoutes } from '../../../src/routes/event-organizer/protected/index.js';
import type { AppBindings } from '../../../src/types.js';

vi.mock('../../../src/utils/env.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/env.js')>();
    return {
        ...actual,
        env: { NODE_ENV: 'test' },
        getCacheConfig: () => ({
            enabled: true,
            maxAge: 60,
            staleWhileRevalidate: 30,
            staleIfError: 3600,
            etagEnabled: true,
            lastModifiedEnabled: true
        })
    };
});

vi.mock('../../../src/middlewares/response-validator.js', () => ({
    responseValidatorMiddleware: async (_context: unknown, next: () => Promise<void>) => {
        await next();
    },
    createResponseValidatorMiddleware:
        () => async (_context: unknown, next: () => Promise<void>) => {
            await next();
        }
}));

const ID = '44444444-4444-4444-8444-444444444444';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const HEADERS = { 'Content-Type': 'application/json', 'user-agent': 'vitest' };
let updateSpy: ReturnType<typeof vi.spyOn>;

function buildApp(tier: 'protected' | 'admin'): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use('*', createCacheMiddleware());
    app.use('*', async (c, next) => {
        c.set('actor', {
            id: ACTOR_ID,
            roles: [tier === 'admin' ? RoleEnum.SUPER_ADMIN : RoleEnum.USER],
            permissions: [
                ...(tier === 'admin' ? [PermissionEnum.ACCESS_PANEL_ADMIN] : []),
                PermissionEnum.EVENT_ORGANIZER_UPDATE
            ]
        });
        await next();
    });
    app.get(`/api/v1/public/event-organizers/${ID}`, (c) => c.json({ email: 'stale@example.com' }));
    app.route(
        `/api/v1/${tier}/event-organizers`,
        tier === 'admin' ? adminEventOrganizerRoutes : protectedEventOrganizerRoutes
    );
    return app;
}

beforeEach(() => {
    clearCache();
    registerEntityFetcher('eventOrganizer', async () => ({
        data: { id: ID, createdById: ACTOR_ID }
    }));
    updateSpy = vi.spyOn(EventOrganizerService.prototype, 'update');
});

afterEach(() => {
    clearCache();
    clearEntityFetchers();
    vi.restoreAllMocks();
});

describe.each(['protected', 'admin'] as const)('%s event-organizer cache invalidation', (tier) => {
    it('evicts the cached public detail after a successful PATCH', async () => {
        updateSpy.mockResolvedValue({
            data: {
                id: ID,
                name: 'Updated',
                slug: 'updated-organizer',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: ACTOR_ID,
                updatedById: ACTOR_ID,
                lifecycleState: 'ACTIVE'
            }
        } as never);
        const app = buildApp(tier);
        const first = await app.request(`/api/v1/public/event-organizers/${ID}`);
        expect(first.headers.get('x-cache')).toBe('MISS');
        expect((await first.json()).email).toBe('stale@example.com');

        const write = await app.request(`/api/v1/${tier}/event-organizers/${ID}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ name: 'Updated' })
        });
        expect(write.status, await write.clone().text()).toBe(200);

        const nextRead = await app.request(`/api/v1/public/event-organizers/${ID}`);
        expect(nextRead.headers.get('x-cache')).toBe('MISS');
    });

    it('keeps the cached public detail after a failed PATCH', async () => {
        updateSpy.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'not found' }
        } as never);
        const app = buildApp(tier);
        const first = await app.request(`/api/v1/public/event-organizers/${ID}`);
        expect(first.headers.get('x-cache')).toBe('MISS');
        await first.text();

        const write = await app.request(`/api/v1/${tier}/event-organizers/${ID}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ name: 'Updated' })
        });
        expect(write.status).toBeGreaterThanOrEqual(400);

        const nextRead = await app.request(`/api/v1/public/event-organizers/${ID}`);
        expect(nextRead.headers.get('x-cache')).toBe('HIT');
        expect((await nextRead.json()).email).toBe('stale@example.com');
    });
});
