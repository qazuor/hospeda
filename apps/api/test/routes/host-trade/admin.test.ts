/**
 * Tests for admin host-trade routes (SPEC-241, T-011).
 *
 * Verifies:
 * - Each route requires its HOST_TRADE_* permission (missing permission → 403).
 * - Success paths return the expected HTTP status with mocked service responses.
 * - List route returns paginated shape.
 *
 * Approach: dynamic imports AFTER mocks are registered, with actor injected
 * directly via middleware in a minimal Hono app. Mirrors dashboard.test.ts.
 *
 * @module test/routes/host-trade/admin
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Service mock — hoisted so vi.mock factory can reference them.
// ---------------------------------------------------------------------------

const {
    mockAdminList,
    mockGetById,
    mockCreate,
    mockUpdate,
    mockSoftDelete,
    mockRestore,
    mockHardDelete
} = vi.hoisted(() => ({
    mockAdminList: vi.fn(),
    mockGetById: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockSoftDelete: vi.fn(),
    mockRestore: vi.fn(),
    mockHardDelete: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(() => ({
            adminList: mockAdminList,
            getById: mockGetById,
            create: mockCreate,
            update: mockUpdate,
            softDelete: mockSoftDelete,
            restore: mockRestore,
            hardDelete: mockHardDelete
        }))
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Dynamic imports AFTER mocks are in place.
const { adminListHostTradesRoute } = await import('../../../src/routes/host-trade/admin/list.js');
const { adminGetHostTradeByIdRoute } = await import(
    '../../../src/routes/host-trade/admin/getById.js'
);
const { adminCreateHostTradeRoute } = await import(
    '../../../src/routes/host-trade/admin/create.js'
);
const { adminUpdateHostTradeRoute } = await import(
    '../../../src/routes/host-trade/admin/update.js'
);
const { adminPatchHostTradeRoute } = await import('../../../src/routes/host-trade/admin/patch.js');
const { adminDeleteHostTradeRoute } = await import(
    '../../../src/routes/host-trade/admin/delete.js'
);
const { adminRestoreHostTradeRoute } = await import(
    '../../../src/routes/host-trade/admin/restore.js'
);
const { adminHardDeleteHostTradeRoute } = await import(
    '../../../src/routes/host-trade/admin/hardDelete.js'
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
const MOCK_TRADE_ID = '22222222-2222-4222-8222-222222222222';

/** Minimal host-trade fixture returned by the mocked service. */
const MOCK_TRADE = {
    id: MOCK_TRADE_ID,
    slug: 'fontanero-cdelu',
    name: 'Fontanero CDU',
    category: 'PLOMERIA',
    contact: '+54 3442 000001',
    benefit: 'Descuento del 10 % para hospedadores',
    destinationId: '33333333-3333-4333-8333-333333333333',
    is24h: false,
    scheduleText: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    createdById: MOCK_USER_ID,
    updatedById: null,
    deletedById: null
};

// ---------------------------------------------------------------------------
// Minimal error handler
// ---------------------------------------------------------------------------

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400
};

function attachTestErrorHandler(app: Hono<AppBindings>): void {
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
}

// ---------------------------------------------------------------------------
// App builder helpers
// ---------------------------------------------------------------------------

/** Build a minimal app with the given actor injected before all routes. */
function buildApp(
    permissions: PermissionEnum[],
    role: RoleEnum = RoleEnum.SUPER_ADMIN
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);

    app.use((c, next) => {
        c.set('actor', { id: MOCK_USER_ID, role, permissions });
        return next();
    });

    app.route('/', adminListHostTradesRoute);
    app.route('/', adminGetHostTradeByIdRoute);
    app.route('/', adminCreateHostTradeRoute);
    app.route('/', adminRestoreHostTradeRoute);
    app.route('/', adminUpdateHostTradeRoute);
    app.route('/', adminPatchHostTradeRoute);
    app.route('/', adminDeleteHostTradeRoute);
    app.route('/', adminHardDeleteHostTradeRoute);

    return app;
}

/** All HOST_TRADE_* permissions plus admin panel access. */
const ALL_PERMS: PermissionEnum[] = [
    PermissionEnum.HOST_TRADE_VIEW_ALL,
    PermissionEnum.HOST_TRADE_CREATE,
    PermissionEnum.HOST_TRADE_UPDATE,
    PermissionEnum.HOST_TRADE_DELETE,
    PermissionEnum.HOST_TRADE_RESTORE,
    PermissionEnum.HOST_TRADE_HARD_DELETE,
    PermissionEnum.ACCESS_PANEL_ADMIN
];

// ---------------------------------------------------------------------------
// Setup — mirrors dashboard.test.ts: reset individually in beforeEach,
// clearAllMocks in afterEach.
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockAdminList.mockReset();
    mockGetById.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockSoftDelete.mockReset();
    mockRestore.mockReset();
    mockHardDelete.mockReset();

    mockAdminList.mockResolvedValue({
        data: { items: [MOCK_TRADE], total: 1 },
        error: undefined
    });
    mockGetById.mockResolvedValue({ data: MOCK_TRADE, error: undefined });
    mockCreate.mockResolvedValue({ data: MOCK_TRADE, error: undefined });
    mockUpdate.mockResolvedValue({ data: MOCK_TRADE, error: undefined });
    mockSoftDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });
    mockRestore.mockResolvedValue({ data: MOCK_TRADE, error: undefined });
    mockHardDelete.mockResolvedValue({ data: undefined, error: undefined });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET / — list
// ---------------------------------------------------------------------------

describe('GET /admin/host-trades', () => {
    it('returns 200 with paginated shape for an actor WITH HOST_TRADE_VIEW_ALL', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request('/', { method: 'GET' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        // createListRoute wraps items + pagination under data.
        expect(Array.isArray(body.data.items)).toBe(true);
        expect(body.data.pagination).toBeDefined();
        expect(body.data.pagination.total).toBe(1);
    });

    it('returns 403 for an actor WITHOUT HOST_TRADE_VIEW_ALL', async () => {
        const app = buildApp([PermissionEnum.ACCESS_PANEL_ADMIN]);
        const res = await app.request('/', { method: 'GET' });
        expect(res.status).toBe(403);
    });

    /**
     * Regression: SPEC-241 — before the fix, `_executeAdminSearch` in HostTradeService
     * delegated to the base class WITHOUT passing entity-specific filters (category,
     * destinationId, isActive, is24h), so `?category=PLOMERIA` was silently dropped
     * and the full table was returned instead of the filtered subset.
     *
     * This test verifies that query parameters are forwarded to the service via
     * `adminList()`, which the service is responsible for handing to `_executeAdminSearch`.
     * The service mock captures whatever the route passes — if the route strips or ignores
     * query params before calling adminList(), the mock call args will not contain them.
     */
    it('forwards ?category= filter to adminList() — regression SPEC-241', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request('/?category=PLOMERIA', { method: 'GET' });
        expect(res.status).toBe(200);

        // The route must have called adminList() with the category param
        expect(mockAdminList).toHaveBeenCalledTimes(1);
        const [_actor, queryArg] = mockAdminList.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(queryArg).toMatchObject({ category: 'PLOMERIA' });
    });

    it('forwards ?destinationId= filter to adminList() — regression SPEC-241', async () => {
        const app = buildApp(ALL_PERMS);
        const destId = '33333333-3333-4333-8333-333333333333';
        const res = await app.request(`/?destinationId=${destId}`, { method: 'GET' });
        expect(res.status).toBe(200);

        expect(mockAdminList).toHaveBeenCalledTimes(1);
        const [_actor, queryArg] = mockAdminList.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(queryArg).toMatchObject({ destinationId: destId });
    });

    it('forwards ?isActive=true filter to adminList() — regression SPEC-241', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request('/?isActive=true', { method: 'GET' });
        expect(res.status).toBe(200);

        expect(mockAdminList).toHaveBeenCalledTimes(1);
        const [_actor, queryArg] = mockAdminList.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        // queryBooleanParam() coerces "true" → boolean true before reaching the service
        expect(queryArg).toMatchObject({ isActive: true });
    });
});

// ---------------------------------------------------------------------------
// GET /:id — getById
// ---------------------------------------------------------------------------

describe('GET /admin/host-trades/:id', () => {
    it('returns 200 for an actor WITH HOST_TRADE_VIEW_ALL', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request(`/${MOCK_TRADE_ID}`, { method: 'GET' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('returns 403 for an actor WITHOUT HOST_TRADE_VIEW_ALL', async () => {
        const app = buildApp([PermissionEnum.ACCESS_PANEL_ADMIN]);
        const res = await app.request(`/${MOCK_TRADE_ID}`, { method: 'GET' });
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// POST / — create
// ---------------------------------------------------------------------------

describe('POST /admin/host-trades', () => {
    const createBody = {
        name: 'Electricista local',
        category: 'ELECTRICIDAD',
        contact: '+54 3442 000002',
        benefit: 'Tarifa preferencial',
        destinationId: '33333333-3333-4333-8333-333333333333',
        is24h: false
    };

    it('returns 201 for an actor WITH HOST_TRADE_CREATE', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createBody)
        });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('returns 403 for an actor WITHOUT HOST_TRADE_CREATE', async () => {
        const app = buildApp([PermissionEnum.ACCESS_PANEL_ADMIN]);
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createBody)
        });
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// PUT /:id — update
// ---------------------------------------------------------------------------

describe('PUT /admin/host-trades/:id', () => {
    const updateBody = { name: 'Fontanero actualizado', contact: '+54 3442 999999' };

    it('returns 200 for an actor WITH HOST_TRADE_UPDATE', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request(`/${MOCK_TRADE_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateBody)
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('returns 403 for an actor WITHOUT HOST_TRADE_UPDATE', async () => {
        const app = buildApp([PermissionEnum.ACCESS_PANEL_ADMIN]);
        const res = await app.request(`/${MOCK_TRADE_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateBody)
        });
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// PATCH /:id — patch
// ---------------------------------------------------------------------------

describe('PATCH /admin/host-trades/:id', () => {
    const patchBody = { name: 'Fontanero parcheado' };

    it('returns 200 for an actor WITH HOST_TRADE_UPDATE', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request(`/${MOCK_TRADE_ID}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchBody)
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('returns 403 for an actor WITHOUT HOST_TRADE_UPDATE', async () => {
        const app = buildApp([PermissionEnum.ACCESS_PANEL_ADMIN]);
        const res = await app.request(`/${MOCK_TRADE_ID}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchBody)
        });
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// DELETE /:id — soft-delete
// ---------------------------------------------------------------------------

describe('DELETE /admin/host-trades/:id', () => {
    it('returns 200 for an actor WITH HOST_TRADE_DELETE', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request(`/${MOCK_TRADE_ID}`, { method: 'DELETE' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('returns 403 for an actor WITHOUT HOST_TRADE_DELETE', async () => {
        const app = buildApp([PermissionEnum.ACCESS_PANEL_ADMIN]);
        const res = await app.request(`/${MOCK_TRADE_ID}`, { method: 'DELETE' });
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// POST /:id/restore — restore
// ---------------------------------------------------------------------------

describe('POST /admin/host-trades/:id/restore', () => {
    it('returns 200 for an actor WITH HOST_TRADE_RESTORE', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request(`/${MOCK_TRADE_ID}/restore`, { method: 'POST' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('returns 403 for an actor WITHOUT HOST_TRADE_RESTORE', async () => {
        const app = buildApp([PermissionEnum.ACCESS_PANEL_ADMIN]);
        const res = await app.request(`/${MOCK_TRADE_ID}/restore`, { method: 'POST' });
        expect(res.status).toBe(403);
    });

    /**
     * Regression: SPEC-241 — before the fix, the restore route returned the
     * raw `restore()` service result ({count: N}), which does NOT satisfy
     * HostTradeAdminSchema validation and caused a 500 on the real endpoint.
     * The fix re-fetches the entity via `getById` after restoring and returns
     * its body. This test pins the contract: `data` must be the entity object,
     * NOT a count-shaped object.
     */
    it('returns the restored entity body (not {count}) — regression SPEC-241', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request(`/${MOCK_TRADE_ID}/restore`, { method: 'POST' });
        expect(res.status).toBe(200);
        const body = await res.json();

        // Must be the entity shape, not { count: N }
        expect(body.data).not.toHaveProperty('count');

        // Entity fields from MOCK_TRADE must be present
        expect(body.data.id).toBe(MOCK_TRADE_ID);
        expect(body.data.name).toBe(MOCK_TRADE.name);
        expect(body.data.category).toBe(MOCK_TRADE.category);
        expect(body.data.slug).toBe(MOCK_TRADE.slug);
    });

    it('calls service.restore() then service.getById() — regression SPEC-241', async () => {
        const app = buildApp(ALL_PERMS);
        await app.request(`/${MOCK_TRADE_ID}/restore`, { method: 'POST' });

        // Both service methods must be invoked in the correct order
        expect(mockRestore).toHaveBeenCalledTimes(1);
        expect(mockGetById).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// DELETE /:id/hard — hard-delete
// ---------------------------------------------------------------------------

describe('DELETE /admin/host-trades/:id/hard', () => {
    it('returns 200 for an actor WITH HOST_TRADE_HARD_DELETE', async () => {
        const app = buildApp(ALL_PERMS);
        const res = await app.request(`/${MOCK_TRADE_ID}/hard`, { method: 'DELETE' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.success).toBe(true);
    });

    it('returns 403 for an actor WITHOUT HOST_TRADE_HARD_DELETE', async () => {
        const app = buildApp([PermissionEnum.ACCESS_PANEL_ADMIN]);
        const res = await app.request(`/${MOCK_TRADE_ID}/hard`, { method: 'DELETE' });
        expect(res.status).toBe(403);
    });
});
