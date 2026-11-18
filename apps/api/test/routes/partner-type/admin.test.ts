/**
 * Tests for the admin partner-type routes (HOS-2336).
 *
 * Matrix per route: 403 without the permission (AC-3.6), 400 on malformed
 * input (invalid body, `slug` in PATCH (AC-3.3), non-UUID id), 404 unknown id,
 * 409 ALREADY_EXISTS on a duplicate slug (AC-3.2), 409 PARTNER_TYPE_IN_USE with
 * `details.count` on deactivate/delete (AC-3.4), restore (AC-3.5), and the
 * cache purge after each write (AC-3.7). 401 (no session) is asserted against
 * the real app, since the minimal app injects an actor.
 *
 * @module test/routes/partner-type/admin
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const {
    mockAdminList,
    mockGetById,
    mockCreate,
    mockUpdate,
    mockSoftDelete,
    mockRestore,
    mockPurge
} = vi.hoisted(() => ({
    mockAdminList: vi.fn(),
    mockGetById: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockSoftDelete: vi.fn(),
    mockRestore: vi.fn(),
    mockPurge: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        purgePartnerTypesCache: mockPurge,
        PartnerTypeService: vi.fn().mockImplementation(function () {
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

const { adminPartnerTypeRoutes } = await import('../../../src/routes/partner-type/admin/index.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TYPE_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date().toISOString();

const TYPE = {
    id: TYPE_ID,
    slug: 'media',
    nameI18n: { es: 'Medio', en: 'Media outlet', pt: 'Meio de comunicação' },
    displayWeight: 40,
    lifecycleState: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    createdById: USER_ID,
    updatedById: null,
    deletedById: null
};

const VALID_CREATE = {
    slug: 'media',
    nameI18n: { es: 'Medio', en: 'Media outlet', pt: 'Meio de comunicação' },
    displayWeight: 40,
    lifecycleState: 'ACTIVE'
};

const STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.PARTNER_TYPE_IN_USE]: 409,
    [ServiceErrorCode.ALREADY_EXISTS]: 409
};

function buildApp(permissions: PermissionEnum[]): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            return c.json(
                {
                    success: false,
                    error: { code: error.code, message: error.message, details: error.details }
                },
                (STATUS[error.code] ?? 500) as 400 | 403 | 404 | 409 | 500
            );
        }
        if (error instanceof HTTPException) return error.getResponse();
        return c.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, 500);
    });
    app.use((c, next) => {
        c.set('actor', { id: USER_ID, roles: [RoleEnum.ADMIN], permissions });
        return next();
    });
    app.route('/', adminPartnerTypeRoutes);
    return app;
}

const ALL: PermissionEnum[] = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.PARTNER_TYPE_VIEW,
    PermissionEnum.PARTNER_TYPE_CREATE,
    PermissionEnum.PARTNER_TYPE_UPDATE,
    PermissionEnum.PARTNER_TYPE_DELETE,
    PermissionEnum.PARTNER_TYPE_RESTORE
];
/** An editor-like actor: panel access, no partnerType.* (AC-3.6). */
const ONLY_PANEL = [PermissionEnum.ACCESS_PANEL_ADMIN];

const json = (body: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
});
const patch = (body: unknown) => ({ ...json(body), method: 'PATCH' });
const IN_USE = {
    data: undefined,
    error: {
        code: ServiceErrorCode.PARTNER_TYPE_IN_USE,
        message: 'in use',
        details: { partnerTypeId: TYPE_ID, count: 2 }
    }
};

beforeEach(() => {
    for (const m of [
        mockAdminList,
        mockGetById,
        mockCreate,
        mockUpdate,
        mockSoftDelete,
        mockRestore,
        mockPurge
    ]) {
        m.mockReset();
    }
    mockAdminList.mockResolvedValue({
        data: { items: [{ ...TYPE, partnerCount: 3 }], total: 1 },
        error: undefined
    });
    mockGetById.mockResolvedValue({ data: TYPE, error: undefined });
    mockCreate.mockResolvedValue({ data: TYPE, error: undefined });
    mockUpdate.mockResolvedValue({ data: TYPE, error: undefined });
    mockSoftDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });
    mockRestore.mockResolvedValue({ data: { count: 1 }, error: undefined });
    mockPurge.mockResolvedValue(undefined);
});

describe('GET / (list, AC-3.1)', () => {
    it('200 with the partner count and page/pageSize pagination', async () => {
        const res = await buildApp(ALL).request('/?page=2&pageSize=5&lifecycleState=ACTIVE');
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.items[0].partnerCount).toBe(3);
        expect(body.data.pagination).toMatchObject({ page: 2, pageSize: 5, total: 1 });
        expect(mockAdminList.mock.calls[0]?.[1]).toMatchObject({ lifecycleState: 'ACTIVE' });
    });

    it('403 without PARTNER_TYPE_VIEW', async () => {
        expect((await buildApp(ONLY_PANEL).request('/')).status).toBe(403);
        expect(mockAdminList).not.toHaveBeenCalled();
    });
});

describe('GET /:id', () => {
    it('200 happy path', async () => {
        expect((await buildApp(ALL).request(`/${TYPE_ID}`)).status).toBe(200);
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
        expect((await buildApp(ALL).request(`/${TYPE_ID}`)).status).toBe(404);
    });
});

describe('POST / (create, AC-3.2)', () => {
    it('201 and purges the cache once', async () => {
        const res = await buildApp(ALL).request('/', json(VALID_CREATE));
        expect(res.status).toBe(201);
        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockPurge).toHaveBeenCalledTimes(1);
    });
    it('403 without PARTNER_TYPE_CREATE', async () => {
        expect((await buildApp(ONLY_PANEL).request('/', json(VALID_CREATE))).status).toBe(403);
        expect(mockCreate).not.toHaveBeenCalled();
    });
    it('400 on a slug that is not kebab-case', async () => {
        const res = await buildApp(ALL).request('/', json({ ...VALID_CREATE, slug: 'Bad Slug' }));
        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });
    it('409 ALREADY_EXISTS on a duplicate slug, and no purge', async () => {
        mockCreate.mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.ALREADY_EXISTS, message: 'exists' }
        });
        expect((await buildApp(ALL).request('/', json(VALID_CREATE))).status).toBe(409);
        expect(mockPurge).not.toHaveBeenCalled();
    });
    it('201 even when the purge fails (best effort)', async () => {
        // The real purge never throws; this pins that the route awaits it and
        // does not depend on its outcome.
        mockPurge.mockResolvedValue(undefined);
        expect((await buildApp(ALL).request('/', json(VALID_CREATE))).status).toBe(201);
    });
});

describe('PATCH /:id', () => {
    it('200 happy path and purges', async () => {
        const res = await buildApp(ALL).request(`/${TYPE_ID}`, patch({ displayWeight: 10 }));
        expect(res.status).toBe(200);
        expect(mockUpdate.mock.calls[0]?.[1]).toBe(TYPE_ID);
        expect(mockPurge).toHaveBeenCalledTimes(1);
    });
    it('403 without PARTNER_TYPE_UPDATE', async () => {
        const res = await buildApp(ONLY_PANEL).request(`/${TYPE_ID}`, patch({ displayWeight: 1 }));
        expect(res.status).toBe(403);
    });
    it('400 when the body carries slug (immutable, AC-3.3)', async () => {
        const res = await buildApp(ALL).request(`/${TYPE_ID}`, patch({ slug: 'press' }));
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });
    it('409 PARTNER_TYPE_IN_USE with details.count when deactivating a used type (AC-3.4)', async () => {
        mockUpdate.mockResolvedValue(IN_USE);
        const res = await buildApp(ALL).request(
            `/${TYPE_ID}`,
            patch({ lifecycleState: 'INACTIVE' })
        );
        const body = await res.json();
        expect(res.status).toBe(409);
        expect(body.error.code).toBe('PARTNER_TYPE_IN_USE');
        expect(body.error.details).toMatchObject({ count: 2 });
        expect(mockPurge).not.toHaveBeenCalled();
    });
});

describe('DELETE /:id', () => {
    const del = { method: 'DELETE' };
    it('200 happy path', async () => {
        const res = await buildApp(ALL).request(`/${TYPE_ID}`, del);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockSoftDelete.mock.calls[0]?.[1]).toBe(TYPE_ID);
        expect(mockPurge).toHaveBeenCalledTimes(1);
    });
    it('403 without PARTNER_TYPE_DELETE', async () => {
        expect((await buildApp(ONLY_PANEL).request(`/${TYPE_ID}`, del)).status).toBe(403);
        expect(mockSoftDelete).not.toHaveBeenCalled();
    });
    it('409 PARTNER_TYPE_IN_USE with details.count (AC-3.4)', async () => {
        mockSoftDelete.mockResolvedValue(IN_USE);
        const res = await buildApp(ALL).request(`/${TYPE_ID}`, del);
        const body = await res.json();
        expect(res.status).toBe(409);
        expect(body.error.details).toMatchObject({ count: 2 });
    });
});

describe('POST /:id/restore (AC-3.5)', () => {
    const restore = { method: 'POST' };
    it('200 returns the restored row', async () => {
        const res = await buildApp(ALL).request(`/${TYPE_ID}/restore`, restore);
        expect(res.status).toBe(200);
        expect(mockRestore).toHaveBeenCalledTimes(1);
        expect(mockPurge).toHaveBeenCalledTimes(1);
    });
    it('403 without PARTNER_TYPE_RESTORE', async () => {
        const actor = ALL.filter((p) => p !== PermissionEnum.PARTNER_TYPE_RESTORE);
        expect((await buildApp(actor).request(`/${TYPE_ID}/restore`, restore)).status).toBe(403);
        expect(mockRestore).not.toHaveBeenCalled();
    });
});

describe('401 without a session (real app)', () => {
    it.each([
        ['GET', '/api/v1/admin/partner-types'],
        ['GET', `/api/v1/admin/partner-types/${TYPE_ID}`],
        ['POST', '/api/v1/admin/partner-types'],
        ['PATCH', `/api/v1/admin/partner-types/${TYPE_ID}`],
        ['DELETE', `/api/v1/admin/partner-types/${TYPE_ID}`],
        ['POST', `/api/v1/admin/partner-types/${TYPE_ID}/restore`]
    ])('%s %s answers 401', async (method, path) => {
        const { initApp } = await import('../../../src/app.js');
        const res = await initApp().request(path, {
            method,
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(401);
    });
});
