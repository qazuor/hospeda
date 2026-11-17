/**
 * Cache purge on admin catalog writes (HOS-919 T-030).
 *
 * Every create, update (PATCH), delete and restore on BOTH catalog tables must
 * purge the host-trade-categories tag exactly once, after the write succeeded.
 * Reads never purge, and a failed write (the service refused it) never purges.
 *
 * @module test/routes/host-trade-category/cache-purge
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockPurge, group, category } = vi.hoisted(() => {
    const makeService = () => ({
        adminList: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
        restore: vi.fn()
    });
    return { mockPurge: vi.fn(), group: makeService(), category: makeService() };
});

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        purgeHostTradeCategoriesCache: mockPurge,
        HostTradeCategoryGroupService: vi.fn().mockImplementation(function () {
            return group;
        }),
        HostTradeCategoryService: vi.fn().mockImplementation(function () {
            return category;
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { adminHostTradeCategoryGroupRoutes } = await import(
    '../../../src/routes/host-trade-category-group/admin/index.js'
);
const { adminHostTradeCategoryRoutes } = await import(
    '../../../src/routes/host-trade-category/admin/index.js'
);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const GROUP_ID = '44444444-4444-4444-8444-444444444444';
const NOW = new Date().toISOString();
const NAME = { es: 'Nombre', en: 'Name', pt: 'Nome' };
const ROW = {
    id: ID,
    slug: 'fixture-slug',
    nameI18n: NAME,
    displayWeight: 1,
    lifecycleState: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    createdById: USER_ID,
    updatedById: null,
    deletedById: null
};
const CATEGORY_ROW = { ...ROW, groupId: GROUP_ID, keywordsI18n: {} };

const ALL: PermissionEnum[] = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
    PermissionEnum.HOST_TRADE_CATEGORY_CREATE,
    PermissionEnum.HOST_TRADE_CATEGORY_UPDATE,
    PermissionEnum.HOST_TRADE_CATEGORY_DELETE,
    PermissionEnum.HOST_TRADE_CATEGORY_RESTORE
];

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = error.code === ServiceErrorCode.CATEGORY_IN_USE ? 409 : 404;
            return c.json({ success: false, error: { code: error.code } }, status);
        }
        if (error instanceof HTTPException) return error.getResponse();
        return c.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, 500);
    });
    app.use((c, next) => {
        c.set('actor', { id: USER_ID, roles: [RoleEnum.ADMIN], permissions: ALL });
        return next();
    });
    app.route('/groups', adminHostTradeCategoryGroupRoutes);
    app.route('/categories', adminHostTradeCategoryRoutes);
    return app;
}

const body = (method: string, payload?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload)
});

interface WriteCase {
    readonly name: string;
    readonly path: string;
    readonly init: RequestInit;
    readonly svc: typeof group;
    readonly method: 'create' | 'update' | 'softDelete' | 'restore';
}

const GROUP_CREATE = { slug: 'grupo', nameI18n: NAME, displayWeight: 1, lifecycleState: 'ACTIVE' };
const CATEGORY_CREATE = { ...GROUP_CREATE, slug: 'cat', groupId: GROUP_ID, keywordsI18n: {} };

const WRITES: readonly WriteCase[] = [
    {
        name: 'group create',
        path: '/groups',
        init: body('POST', GROUP_CREATE),
        svc: group,
        method: 'create'
    },
    {
        name: 'group update',
        path: `/groups/${ID}`,
        init: body('PATCH', { displayWeight: 2 }),
        svc: group,
        method: 'update'
    },
    {
        name: 'group delete',
        path: `/groups/${ID}`,
        init: body('DELETE'),
        svc: group,
        method: 'softDelete'
    },
    {
        name: 'group restore',
        path: `/groups/${ID}/restore`,
        init: body('POST'),
        svc: group,
        method: 'restore'
    },
    {
        name: 'category create',
        path: '/categories',
        init: body('POST', CATEGORY_CREATE),
        svc: category,
        method: 'create'
    },
    {
        name: 'category update',
        path: `/categories/${ID}`,
        init: body('PATCH', { displayWeight: 2 }),
        svc: category,
        method: 'update'
    },
    {
        name: 'category delete',
        path: `/categories/${ID}`,
        init: body('DELETE'),
        svc: category,
        method: 'softDelete'
    },
    {
        name: 'category restore',
        path: `/categories/${ID}/restore`,
        init: body('POST'),
        svc: category,
        method: 'restore'
    }
];

beforeEach(() => {
    mockPurge.mockReset();
    mockPurge.mockResolvedValue(undefined);
    for (const [svc, row] of [
        [group, ROW],
        [category, CATEGORY_ROW]
    ] as const) {
        for (const fn of Object.values(svc)) fn.mockReset();
        svc.adminList.mockResolvedValue({ data: { items: [row], total: 1 }, error: undefined });
        svc.getById.mockResolvedValue({ data: row, error: undefined });
        svc.create.mockResolvedValue({ data: row, error: undefined });
        svc.update.mockResolvedValue({ data: row, error: undefined });
        svc.softDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });
        svc.restore.mockResolvedValue({ data: { count: 1 }, error: undefined });
    }
});

describe('admin catalog writes purge the catalog cache tag', () => {
    it.each(WRITES)('$name purges exactly once, as the acting admin', async (c) => {
        const res = await buildApp().request(c.path, c.init);
        expect(res.status).toBeLessThan(300);
        expect(mockPurge).toHaveBeenCalledTimes(1);
        expect(mockPurge).toHaveBeenCalledWith({ triggeredBy: USER_ID });
    });

    it.each(WRITES)('$name does NOT purge when the service refuses the write', async (c) => {
        c.svc[c.method].mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.CATEGORY_IN_USE, message: 'in use' }
        });
        const res = await buildApp().request(c.path, c.init);
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(mockPurge).not.toHaveBeenCalled();
    });

    it('a rejected request body (400) does not purge', async () => {
        const res = await buildApp().request('/categories', body('POST', { slug: 'Bad Slug' }));
        expect(res.status).toBe(400);
        expect(mockPurge).not.toHaveBeenCalled();
    });

    it.each([
        '/groups',
        `/groups/${ID}`,
        '/categories',
        `/categories/${ID}`
    ])('GET %s never purges', async (path) => {
        const res = await buildApp().request(path);
        expect(res.status).toBe(200);
        expect(mockPurge).not.toHaveBeenCalled();
    });
});
