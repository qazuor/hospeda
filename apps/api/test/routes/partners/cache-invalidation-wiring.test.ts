/** @module test/routes/partners/cache-invalidation-wiring */
import { readFileSync } from 'node:fs';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { PartnerService } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, createCacheMiddleware } from '../../../src/middlewares/cache.js';
import { mountPartnerCacheInvalidation } from '../../../src/middlewares/partner-cache-invalidation.js';
import { adminPartnerTypeRoutes } from '../../../src/routes/partner-type/index.js';
import { adminUpdatePartnerRoute } from '../../../src/routes/partners/index.js';
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

const { mockTypeUpdate } = vi.hoisted(() => ({ mockTypeUpdate: vi.fn() }));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        purgePartnerTypesCache: vi.fn().mockResolvedValue(undefined),
        PartnerTypeService: vi.fn().mockImplementation(function () {
            return { update: mockTypeUpdate };
        })
    };
});

const ID = '44444444-4444-4444-8444-444444444444';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const HEADERS = { 'Content-Type': 'application/json', 'user-agent': 'vitest' };
const PUBLIC_PATH = '/api/v1/public/partners/acme';

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use('*', createCacheMiddleware());
    app.use('*', async (c, next) => {
        c.set('actor', {
            id: ACTOR_ID,
            roles: [RoleEnum.SUPER_ADMIN],
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.PARTNER_MANAGE,
                PermissionEnum.PARTNER_TYPE_UPDATE
            ]
        });
        await next();
    });
    app.get(PUBLIC_PATH, (c) => c.json({ type: { name: 'Old label' } }));
    mountPartnerCacheInvalidation({ app });
    app.route('/api/v1/admin/partners', adminUpdatePartnerRoute);
    app.route('/api/v1/admin/partner-types', adminPartnerTypeRoutes);
    return app;
}

const partnerRow = {
    id: ID,
    name: 'Acme',
    slug: 'acme',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: ACTOR_ID,
    updatedById: ACTOR_ID,
    lifecycleState: 'ACTIVE'
};

let partnerUpdateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    clearCache();
    partnerUpdateSpy = vi.spyOn(PartnerService.prototype, 'update');
    mockTypeUpdate.mockReset();
});

afterEach(() => {
    clearCache();
    vi.restoreAllMocks();
});

const WRITES = [
    {
        name: 'admin partner PUT',
        url: `/api/v1/admin/partners/${ID}`,
        method: 'PUT',
        body: { name: 'Acme 2' },
        spy: () => partnerUpdateSpy,
        ok: { data: partnerRow }
    },
    {
        name: 'admin partner-type PATCH',
        url: `/api/v1/admin/partner-types/${ID}`,
        method: 'PATCH',
        body: { nameI18n: { es: 'Nuevo', en: 'New', pt: 'Novo' } },
        spy: () => mockTypeUpdate,
        ok: {
            data: {
                id: ID,
                slug: 'media',
                nameI18n: { es: 'Nuevo', en: 'New', pt: 'Novo' },
                displayWeight: 40,
                lifecycleState: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                createdById: ACTOR_ID,
                updatedById: null,
                deletedById: null
            }
        }
    }
] as const;

describe('route registry wiring', () => {
    it('mounts the partner invalidation before the first partner router', () => {
        // Arrange
        const source = readFileSync(
            new URL('../../../src/routes/index.ts', import.meta.url),
            'utf8'
        );

        // Act
        const mountAt = source.indexOf('mountPartnerCacheInvalidation({ app })');
        const firstRouterAt = Math.min(
            source.indexOf("app.route('/api/v1/protected/partners'"),
            source.indexOf("app.route('/api/v1/admin/partners'"),
            source.indexOf("app.route('/api/v1/admin/partner-types'")
        );

        // Assert
        expect(mountAt).toBeGreaterThan(-1);
        expect(mountAt).toBeLessThan(firstRouterAt);
    });
});

describe.each(WRITES)('$name cache invalidation', (write) => {
    it('evicts the cached public partner read after a 2xx write', async () => {
        write.spy().mockResolvedValue(write.ok as never);
        const app = buildApp();
        const first = await app.request(PUBLIC_PATH);
        expect(first.headers.get('x-cache')).toBe('MISS');
        await first.text();

        const res = await app.request(write.url, {
            method: write.method,
            headers: HEADERS,
            body: JSON.stringify(write.body)
        });
        expect(res.status, await res.clone().text()).toBe(200);

        const next = await app.request(PUBLIC_PATH);
        expect(next.headers.get('x-cache')).toBe('MISS');
    });

    it('keeps the cached public partner read after a non-2xx write', async () => {
        write.spy().mockResolvedValue({ error: { code: 'NOT_FOUND', message: 'nope' } } as never);
        const app = buildApp();
        const first = await app.request(PUBLIC_PATH);
        await first.text();

        const res = await app.request(write.url, {
            method: write.method,
            headers: HEADERS,
            body: JSON.stringify(write.body)
        });
        expect(res.status).toBeGreaterThanOrEqual(400);

        const next = await app.request(PUBLIC_PATH);
        expect(next.headers.get('x-cache')).toBe('HIT');
    });
});
