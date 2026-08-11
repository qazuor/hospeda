/**
 * Admin usage audit and declaration suspension (HOS-376 T-038).
 *
 * ```
 * GET  /api/v1/admin/host-trades/usages
 * POST /api/v1/admin/host-trades/{id}/declaration-suspension
 * ```
 *
 * Two properties this layer owns. The listing forwards the triage filters
 * untouched — `creationChannel=EMAIL_LOOKUP` is the one that isolates the
 * channel a provider can drive without the host being present (R-5). And ONE
 * endpoint carries both halves of the suspension decision, with the body
 * deciding which, so a screen cannot end up with a "suspend" button that
 * silently lifts.
 *
 * @module test/routes/host-trade/admin-usages
 */

import type { PermissionEnum } from '@repo/schemas';
import { PermissionEnum as Permissions, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockAdminList, mockApplySuspension, mockLiftSuspension } = vi.hoisted(() => ({
    mockAdminList: vi.fn(),
    mockApplySuspension: vi.fn(),
    mockLiftSuspension: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeUsageService: vi.fn().mockImplementation(function () {
            return {
                adminList: mockAdminList,
                applyDeclarationSuspension: mockApplySuspension,
                liftDeclarationSuspension: mockLiftSuspension
            };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { adminListHostTradeUsagesRoute, adminSetDeclarationSuspensionRoute } = await import(
    '../../../src/routes/host-trade/admin/usages.js'
);

const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const HT_ID = '22222222-2222-4222-8222-222222222222';
const USAGE_ID = '33333333-3333-4333-8333-333333333333';

/** A FULL entity: the factory validates responses and 500s on a stub. */
const MOCK_USAGE = {
    id: USAGE_ID,
    hostTradeId: HT_ID,
    hostUserId: ADMIN_ID,
    declaredBy: 'PROVIDER',
    declaredById: ADMIN_ID,
    creationChannel: 'EMAIL_LOOKUP',
    status: 'PENDING',
    servicedAt: '2026-08-01',
    note: null,
    expiresAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    confirmedAt: null,
    rejectedAt: null,
    rejectionNote: null,
    reminderSentAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    createdById: ADMIN_ID,
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

const ALL_PERMISSIONS = [
    Permissions.ACCESS_PANEL_ADMIN,
    Permissions.HOST_TRADE_USAGE_VIEW_ALL,
    Permissions.HOST_TRADE_USAGE_MANAGE
];

function buildApp(permissions: PermissionEnum[] = ALL_PERMISSIONS): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());

    app.use((c, next) => {
        c.set('actor', { id: ADMIN_ID, roles: [RoleEnum.ADMIN], permissions });
        return next();
    });

    app.route('/', adminListHostTradeUsagesRoute);
    app.route('/', adminSetDeclarationSuspensionRoute);

    return app;
}

const post = (app: Hono<AppBindings>, path: string, body?: unknown) =>
    app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {})
    });

beforeEach(() => {
    vi.clearAllMocks();
    mockAdminList.mockResolvedValue({ data: { items: [MOCK_USAGE], total: 1 } });
    mockApplySuspension.mockResolvedValue({ data: { suspended: true } });
    mockLiftSuspension.mockResolvedValue({ data: { lifted: true } });
});

describe('registration', () => {
    it('mounts both routes on the admin router', async () => {
        const { adminHostTradeRoutes } = await import(
            '../../../src/routes/host-trade/admin/index.js'
        );
        const registered = (
            adminHostTradeRoutes as unknown as { routes: { method: string; path: string }[] }
        ).routes.map((route) => `${route.method.toUpperCase()} ${route.path}`);

        expect(registered).toContain('GET /usages');
        expect(registered).toContain('POST /:id/declaration-suspension');
    });
});

describe('GET /usages', () => {
    it('returns the page and its pagination envelope', async () => {
        const app = buildApp();

        const res = await app.request('/usages?page=1&pageSize=10');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.pagination.total).toBe(1);
    });

    /** The abuse-triage filter (R-5). */
    it('forwards creationChannel so the email fallback can be audited', async () => {
        const app = buildApp();

        await app.request('/usages?creationChannel=EMAIL_LOOKUP');

        const query = mockAdminList.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(query.creationChannel).toBe('EMAIL_LOOKUP');
    });

    it('forwards the state filter and the provider', async () => {
        const app = buildApp();

        await app.request(`/usages?status=REJECTED&hostTradeId=${HT_ID}`);

        const query = mockAdminList.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(query.status).toBe('REJECTED');
        expect(query.hostTradeId).toBe(HT_ID);
    });

    it('refuses an actor without HOST_TRADE_USAGE_VIEW_ALL', async () => {
        const app = buildApp([Permissions.ACCESS_PANEL_ADMIN, Permissions.HOST_TRADE_USAGE_MANAGE]);

        const res = await app.request('/usages');

        expect(res.status).toBe(403);
        expect(mockAdminList).not.toHaveBeenCalled();
    });
});

describe('POST /{id}/declaration-suspension', () => {
    it('suspends with a reason', async () => {
        const app = buildApp();

        const res = await post(app, `/${HT_ID}/declaration-suspension`, {
            suspended: true,
            reason: 'Declaraciones por email sin confirmar.'
        });

        expect(res.status).toBe(200);
        expect(mockApplySuspension).toHaveBeenCalledWith(
            { hostTradeId: HT_ID, reason: 'Declaraciones por email sin confirmar.' },
            expect.anything()
        );
        expect(mockLiftSuspension).not.toHaveBeenCalled();
    });

    it('lifts without one', async () => {
        const app = buildApp();

        const res = await post(app, `/${HT_ID}/declaration-suspension`, { suspended: false });

        expect(res.status).toBe(200);
        expect(mockLiftSuspension).toHaveBeenCalledWith({ hostTradeId: HT_ID }, expect.anything());
        expect(mockApplySuspension).not.toHaveBeenCalled();
    });

    /**
     * A suspension takes away a provider's ability to record work at all, so he
     * is owed an answer when he asks why. The refinement is re-parsed in the
     * handler because the route factory drops it (HOS-425) — without that
     * re-parse this body would reach the service instead of being refused here.
     */
    it('refuses a suspension with no reason', async () => {
        const app = buildApp();

        const res = await post(app, `/${HT_ID}/declaration-suspension`, { suspended: true });

        expect(res.status).toBe(400);
        expect(mockApplySuspension).not.toHaveBeenCalled();
    });

    it('refuses an actor without HOST_TRADE_USAGE_MANAGE', async () => {
        const app = buildApp([
            Permissions.ACCESS_PANEL_ADMIN,
            Permissions.HOST_TRADE_USAGE_VIEW_ALL
        ]);

        const res = await post(app, `/${HT_ID}/declaration-suspension`, {
            suspended: true,
            reason: 'Motivo.'
        });

        expect(res.status).toBe(403);
        expect(mockApplySuspension).not.toHaveBeenCalled();
    });

    it('answers 404 for a listing that does not exist', async () => {
        mockApplySuspension.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Host trade listing not found' }
        });
        const app = buildApp();

        const res = await post(app, `/${HT_ID}/declaration-suspension`, {
            suspended: true,
            reason: 'Motivo.'
        });

        expect(res.status).toBe(404);
    });

    /**
     * Lifting one that is not there is the outcome the admin asked for. An
     * error would make a double-click on the admin screen look like a failure.
     */
    it('succeeds when lifting a suspension that is not there', async () => {
        mockLiftSuspension.mockResolvedValue({ data: { lifted: false } });
        const app = buildApp();

        const res = await post(app, `/${HT_ID}/declaration-suspension`, { suspended: false });

        expect(res.status).toBe(200);
    });
});
