/**
 * Tests for the admin host-trade-category-group routes (HOS-919 T-028).
 *
 * Matrix per route: 403 without the permission, 400 on malformed input
 * (invalid body, `slug` in PATCH, non-UUID id), 404 unknown id, 409
 * CATEGORY_IN_USE on delete, happy path. 401 (no session) is asserted against
 * the real app, since the minimal app injects an actor.
 *
 * @module test/routes/host-trade-category-group/admin
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockAdminList, mockGetById, mockCreate, mockUpdate, mockSoftDelete, mockRestore } =
    vi.hoisted(() => ({
        mockAdminList: vi.fn(),
        mockGetById: vi.fn(),
        mockCreate: vi.fn(),
        mockUpdate: vi.fn(),
        mockSoftDelete: vi.fn(),
        mockRestore: vi.fn()
    }));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        purgeHostTradeCategoriesCache: vi.fn().mockResolvedValue(undefined),
        HostTradeCategoryGroupService: vi.fn().mockImplementation(function () {
            return {
                adminList: mockAdminList,
                getById: mockGetById,
                create: mockCreate,
                update: mockUpdate,
                softDelete: mockSoftDelete,
                restore: mockRestore
            };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { adminHostTradeCategoryGroupRoutes } = await import(
    '../../../src/routes/host-trade-category-group/admin/index.js'
);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date().toISOString();

const GROUP = {
    id: GROUP_ID,
    slug: 'construccion',
    nameI18n: { es: 'Construcción', en: 'Construction', pt: 'Construção' },
    displayWeight: 50,
    lifecycleState: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    createdById: USER_ID,
    updatedById: null,
    deletedById: null
};

const VALID_CREATE = {
    slug: 'gastronomia',
    nameI18n: { es: 'Gastronomía', en: 'Food', pt: 'Gastronomia' },
    displayWeight: 40,
    lifecycleState: 'ACTIVE'
};

const STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.CATEGORY_IN_USE]: 409,
    [ServiceErrorCode.ALREADY_EXISTS]: 409
};

function buildApp(permissions: PermissionEnum[]): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                (STATUS[error.code] ?? 500) as 400 | 401 | 403 | 404 | 409 | 500
            );
        }
        if (error instanceof HTTPException) return error.getResponse();
        return c.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, 500);
    });
    app.use((c, next) => {
        c.set('actor', { id: USER_ID, roles: [RoleEnum.ADMIN], permissions });
        return next();
    });
    app.route('/', adminHostTradeCategoryGroupRoutes);
    return app;
}

const ALL: PermissionEnum[] = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
    PermissionEnum.HOST_TRADE_CATEGORY_CREATE,
    PermissionEnum.HOST_TRADE_CATEGORY_UPDATE,
    PermissionEnum.HOST_TRADE_CATEGORY_DELETE,
    PermissionEnum.HOST_TRADE_CATEGORY_RESTORE
];
const ONLY_PANEL = [PermissionEnum.ACCESS_PANEL_ADMIN];

const json = (body: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
});
const patch = (body: unknown) => ({ ...json(body), method: 'PATCH' });

beforeEach(() => {
    for (const m of [
        mockAdminList,
        mockGetById,
        mockCreate,
        mockUpdate,
        mockSoftDelete,
        mockRestore
    ]) {
        m.mockReset();
    }
    mockAdminList.mockResolvedValue({ data: { items: [GROUP], total: 1 }, error: undefined });
    mockGetById.mockResolvedValue({ data: GROUP, error: undefined });
    mockCreate.mockResolvedValue({ data: GROUP, error: undefined });
    mockUpdate.mockResolvedValue({ data: GROUP, error: undefined });
    mockSoftDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });
    mockRestore.mockResolvedValue({ data: { count: 1 }, error: undefined });
});

describe('GET / (list)', () => {
    it('200 with page/pageSize pagination and forwards the query to adminList', async () => {
        const res = await buildApp(ALL).request('/?page=2&pageSize=5&lifecycleState=ACTIVE');
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.pagination).toMatchObject({ page: 2, pageSize: 5, total: 1 });
        expect(mockAdminList.mock.calls[0]?.[1]).toMatchObject({ lifecycleState: 'ACTIVE' });
    });

    it('403 without HOST_TRADE_CATEGORY_VIEW', async () => {
        expect((await buildApp(ONLY_PANEL).request('/')).status).toBe(403);
        expect(mockAdminList).not.toHaveBeenCalled();
    });

    it('400 on a malformed query', async () => {
        expect((await buildApp(ALL).request('/?pageSize=0')).status).toBe(400);
    });
});

describe('GET /:id', () => {
    it('200 happy path', async () => {
        expect((await buildApp(ALL).request(`/${GROUP_ID}`)).status).toBe(200);
    });
    it('403 without permission, before any lookup', async () => {
        expect((await buildApp(ONLY_PANEL).request(`/${GROUP_ID}`)).status).toBe(403);
        expect(mockGetById).not.toHaveBeenCalled();
    });
    it('400 on a non-UUID id, before any lookup', async () => {
        expect((await buildApp(ALL).request('/not-a-uuid')).status).toBe(400);
        expect(mockGetById).not.toHaveBeenCalled();
    });
    it('404 on an unknown id', async () => {
        mockGetById.mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'not found' }
        });
        expect((await buildApp(ALL).request(`/${GROUP_ID}`)).status).toBe(404);
    });
});

describe('POST / (create)', () => {
    it('201 happy path', async () => {
        const res = await buildApp(ALL).request('/', json(VALID_CREATE));
        expect(res.status).toBe(201);
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });
    it('403 without HOST_TRADE_CATEGORY_CREATE', async () => {
        expect((await buildApp(ONLY_PANEL).request('/', json(VALID_CREATE))).status).toBe(403);
        expect(mockCreate).not.toHaveBeenCalled();
    });
    it('400 on an invalid body', async () => {
        expect((await buildApp(ALL).request('/', json({ slug: 'Bad Slug' }))).status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });
    it('409 on a duplicate slug', async () => {
        mockCreate.mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.ALREADY_EXISTS, message: 'exists' }
        });
        expect((await buildApp(ALL).request('/', json(VALID_CREATE))).status).toBe(409);
    });
});

describe('PATCH /:id', () => {
    it('200 happy path', async () => {
        const res = await buildApp(ALL).request(`/${GROUP_ID}`, patch({ displayWeight: 10 }));
        expect(res.status).toBe(200);
        expect(mockUpdate.mock.calls[0]?.[1]).toBe(GROUP_ID);
    });
    it('403 without HOST_TRADE_CATEGORY_UPDATE', async () => {
        const res = await buildApp(ONLY_PANEL).request(`/${GROUP_ID}`, patch({ displayWeight: 1 }));
        expect(res.status).toBe(403);
    });
    it('400 when the body carries slug (immutable)', async () => {
        const res = await buildApp(ALL).request(`/${GROUP_ID}`, patch({ slug: 'otro' }));
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });
    it('400 on a non-UUID id', async () => {
        const res = await buildApp(ALL).request('/nope', patch({ displayWeight: 1 }));
        expect(res.status).toBe(400);
    });
    it('404 on an unknown id', async () => {
        mockUpdate.mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'nf' }
        });
        const res = await buildApp(ALL).request(`/${GROUP_ID}`, patch({ displayWeight: 1 }));
        expect(res.status).toBe(404);
    });
});

describe('DELETE /:id', () => {
    const del = { method: 'DELETE' };
    it('200 happy path', async () => {
        const res = await buildApp(ALL).request(`/${GROUP_ID}`, del);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockSoftDelete.mock.calls[0]?.[1]).toBe(GROUP_ID);
    });
    it('403 without HOST_TRADE_CATEGORY_DELETE', async () => {
        expect((await buildApp(ONLY_PANEL).request(`/${GROUP_ID}`, del)).status).toBe(403);
        expect(mockSoftDelete).not.toHaveBeenCalled();
    });
    it('400 on a non-UUID id', async () => {
        expect((await buildApp(ALL).request('/nope', del)).status).toBe(400);
    });
    it('404 on an unknown id', async () => {
        mockSoftDelete.mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'nf' }
        });
        expect((await buildApp(ALL).request(`/${GROUP_ID}`, del)).status).toBe(404);
    });
    it('409 CATEGORY_IN_USE when the group still has live categories', async () => {
        mockSoftDelete.mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.CATEGORY_IN_USE, message: 'in use' }
        });
        const res = await buildApp(ALL).request(`/${GROUP_ID}`, del);
        const body = await res.json();
        expect(res.status).toBe(409);
        expect(body.error.code).toBe('CATEGORY_IN_USE');
    });
});

describe('POST /:id/restore', () => {
    const restore = { method: 'POST' };
    it('200 happy path returns the restored row', async () => {
        const res = await buildApp(ALL).request(`/${GROUP_ID}/restore`, restore);
        expect(res.status).toBe(200);
        expect(mockRestore).toHaveBeenCalledTimes(1);
    });
    it('403 without HOST_TRADE_CATEGORY_RESTORE', async () => {
        expect((await buildApp(ONLY_PANEL).request(`/${GROUP_ID}/restore`, restore)).status).toBe(
            403
        );
    });
    it('404 on an unknown id', async () => {
        mockRestore.mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'nf' }
        });
        expect((await buildApp(ALL).request(`/${GROUP_ID}/restore`, restore)).status).toBe(404);
    });
});

describe('401 without a session (real app)', () => {
    it.each([
        ['GET', '/api/v1/admin/host-trade-category-groups'],
        ['GET', `/api/v1/admin/host-trade-category-groups/${GROUP_ID}`],
        ['POST', '/api/v1/admin/host-trade-category-groups'],
        ['PATCH', `/api/v1/admin/host-trade-category-groups/${GROUP_ID}`],
        ['DELETE', `/api/v1/admin/host-trade-category-groups/${GROUP_ID}`],
        ['POST', `/api/v1/admin/host-trade-category-groups/${GROUP_ID}/restore`]
    ])('%s %s answers 401', async (method, path) => {
        const { initApp } = await import('../../../src/app.js');
        const res = await initApp().request(path, {
            method,
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(401);
    });
});
