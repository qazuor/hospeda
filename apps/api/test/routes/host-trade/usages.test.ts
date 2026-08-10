/**
 * The host's side of the benefit-usage record (HOS-376 T-030).
 *
 * ```
 * POST /api/v1/protected/host-trades/{slug}/usages
 * GET  /api/v1/protected/host-trades/usages/pending
 * GET  /api/v1/protected/host-trades/usages/pending-count
 * ```
 *
 * Two things here are worth more than the happy paths.
 *
 * The ROUTING: `/usages/pending` and `/{slug}/usages` overlap, and when the
 * wrong one wins the failure is a 404-shaped mystery rather than a crash — the
 * inbox request gets read as "declare a usage on the provider whose slug is
 * `usages`". The guarantee is the REQUEST-level test below; the registration
 * order is only defence in depth, and its test says exactly that.
 *
 * The STATUS MAPPING: these routes carry the domain's own error codes, and the
 * spec names the numbers (422 PROVIDER_REVOKED, 403 DECLARATION_SUSPENDED, 409
 * USAGE_PENDING_EXISTS). The app's REAL error handler is installed here, so the
 * assertions measure the mapping that ships instead of one written for the test.
 *
 * @module test/routes/host-trade/usages
 */

import {
    type PermissionEnum,
    PermissionEnum as Permissions,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockGetByField, mockDeclareAsHost, mockListPending, mockCountPending } = vi.hoisted(() => ({
    mockGetByField: vi.fn(),
    mockDeclareAsHost: vi.fn(),
    mockListPending: vi.fn(),
    mockCountPending: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(function () {
            return { getByField: mockGetByField };
        }),
        HostTradeUsageService: vi.fn().mockImplementation(function () {
            return {
                declareAsHost: mockDeclareAsHost,
                listPendingForHost: mockListPending,
                countPendingForHost: mockCountPending
            };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const {
    protectedCountPendingUsagesRoute,
    protectedDeclareUsageRoute,
    protectedListPendingUsagesRoute
} = await import('../../../src/routes/host-trade/protected/usages.js');

const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const HOST_ID = '11111111-1111-4111-8111-111111111111';
const HT_ID = '22222222-2222-4222-8222-222222222222';
const USAGE_ID = '33333333-3333-4333-8333-333333333333';

const MOCK_USAGE = {
    id: USAGE_ID,
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy: 'HOST',
    declaredById: HOST_ID,
    creationChannel: 'QR',
    status: 'PENDING',
    servicedAt: '2026-08-01',
    note: null,
    expiresAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    confirmedAt: null,
    rejectedAt: null,
    rejectionNote: null,
    createdAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-01T00:00:00Z').toISOString()
};

/**
 * An app carrying the REAL error handler, so a status assertion measures the
 * shipped mapping rather than one invented for the test.
 */
function buildApp(
    permissions: PermissionEnum[] = [Permissions.HOST_TRADE_VIEW]
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());

    app.use((c, next) => {
        c.set('actor', { id: HOST_ID, roles: [RoleEnum.USER], permissions });
        return next();
    });

    app.route('/', protectedListPendingUsagesRoute);
    app.route('/', protectedCountPendingUsagesRoute);
    app.route('/', protectedDeclareUsageRoute);

    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetByField.mockResolvedValue({ data: { id: HT_ID, slug: 'plomero-centro' } });
    mockDeclareAsHost.mockResolvedValue({ data: { usage: MOCK_USAGE } });
    mockListPending.mockResolvedValue({ data: { items: [MOCK_USAGE], total: 1 } });
    mockCountPending.mockResolvedValue({ data: { count: 3 } });
});

describe('routing — the inbox must not be read as a slug', () => {
    /**
     * DEFENCE IN DEPTH, and labelled as such because it was measured: inverting
     * this order does NOT break the behavioural test underneath — Hono's
     * selected router gives a static segment precedence over `:slug` whatever
     * the registration sequence. The order is still pinned because which router
     * `SmartRouter` picks is Hono's decision and not a contract we hold; a
     * first-match-wins router would resolve `/usages/pending` to the
     * declaration. If this test ever fails on its own while the request test
     * below still passes, nothing is broken yet — the safety margin is.
     */
    it('keeps /usages/pending registered before /{slug}/usages', async () => {
        const { protectedHostTradeRoutes } = await import(
            '../../../src/routes/host-trade/protected/index.js'
        );
        const paths = (
            protectedHostTradeRoutes as unknown as { routes: { path: string }[] }
        ).routes.map((route) => route.path);

        const pendingAt = paths.indexOf('/usages/pending');
        const countAt = paths.indexOf('/usages/pending-count');
        const slugAt = paths.indexOf('/:slug/usages');

        expect(pendingAt).toBeGreaterThanOrEqual(0);
        expect(countAt).toBeGreaterThanOrEqual(0);
        expect(slugAt).toBeGreaterThanOrEqual(0);
        expect(pendingAt).toBeLessThan(slugAt);
        expect(countAt).toBeLessThan(slugAt);
    });

    /**
     * THE ACTUAL GUARANTEE: a real request for the inbox reaches the inbox
     * handler and not the declaration one. This is the test that would catch a
     * routing regression; the order assertion above would not.
     */
    it('routes GET /usages/pending to the inbox, not to the declaration', async () => {
        const app = buildApp();

        const res = await app.request('/usages/pending');

        expect(res.status).toBe(200);
        expect(mockListPending).toHaveBeenCalled();
        expect(mockDeclareAsHost).not.toHaveBeenCalled();
    });
});

describe('POST /{slug}/usages', () => {
    it('declares a usage against the provider the slug names', async () => {
        const app = buildApp();

        const res = await app.request('/plomero-centro/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicedAt: '2026-08-01', note: 'Destapación' })
        });

        // 201: the route factory maps a POST that created something.
        expect(res.status).toBe(201);
        expect(mockGetByField).toHaveBeenCalledWith(expect.anything(), 'slug', 'plomero-centro');
        // The service takes an id — the slug hop is this route's only job.
        expect(mockDeclareAsHost).toHaveBeenCalledWith(
            expect.objectContaining({ hostTradeId: HT_ID, servicedAt: '2026-08-01' }),
            expect.anything()
        );
    });

    it('answers 404 for a slug nobody owns, without calling the service', async () => {
        mockGetByField.mockResolvedValue({ data: null });
        const app = buildApp();

        const res = await app.request('/no-existe/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(404);
        expect(mockDeclareAsHost).not.toHaveBeenCalled();
    });

    /**
     * AC-28 — and the number matters. A revoked listing is not "not found": the
     * row is deliberately kept, so 422 says "this request was well formed and
     * the thing exists, its state just makes the action meaningless".
     */
    it('answers 422 PROVIDER_REVOKED, not 404, for a delisted provider', async () => {
        mockDeclareAsHost.mockResolvedValue({
            error: { code: ServiceErrorCode.PROVIDER_REVOKED, message: 'no longer listed' }
        });
        const app = buildApp();

        const res = await app.request('/plomero-centro/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(422);
    });

    it('answers 403 for a suspended provider', async () => {
        mockDeclareAsHost.mockResolvedValue({
            error: { code: ServiceErrorCode.DECLARATION_SUSPENDED, message: 'suspended' }
        });
        const app = buildApp();

        const res = await app.request('/plomero-centro/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(403);
    });

    it('answers 409 when the pair already has a pending usage', async () => {
        mockDeclareAsHost.mockResolvedValue({
            error: { code: ServiceErrorCode.USAGE_PENDING_EXISTS, message: 'already pending' }
        });
        const app = buildApp();

        const res = await app.request('/plomero-centro/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(409);
    });

    /**
     * The gate that makes the weakly-verified host-declared branch safe: a
     * passer-by who scans the sticker on a van is not a host (spec §6.5).
     */
    it('refuses an actor without HOST_TRADE_VIEW', async () => {
        const app = buildApp([]);

        const res = await app.request('/plomero-centro/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(403);
        expect(mockDeclareAsHost).not.toHaveBeenCalled();
    });

    it('rejects a body with no service date', async () => {
        const app = buildApp();

        const res = await app.request('/plomero-centro/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: 'sin fecha' })
        });

        expect(res.status).toBe(400);
        expect(mockDeclareAsHost).not.toHaveBeenCalled();
    });
});

describe('GET /usages/pending', () => {
    it('returns the page and its pagination envelope', async () => {
        const app = buildApp();

        const res = await app.request('/usages/pending?page=1&pageSize=10');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.pagination.total).toBe(1);
        expect(mockListPending).toHaveBeenCalledWith({ page: 1, pageSize: 10 }, expect.anything());
    });

    /**
     * Auth-only, deliberately. The rows are already scoped to the caller, so a
     * `HOST_TRADE_VIEW` requirement would only decide whether a host may read
     * his own inbox — and it would lock out anyone whose perk lapsed while
     * confirmations were still waiting on them.
     */
    it('serves an actor holding no host-trade permission', async () => {
        const app = buildApp([]);

        const res = await app.request('/usages/pending');

        expect(res.status).toBe(200);
    });
});

describe('GET /usages/pending-count', () => {
    it('returns the badge count', async () => {
        const app = buildApp();

        const res = await app.request('/usages/pending-count');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.count).toBe(3);
    });

    it('serves an actor holding no host-trade permission', async () => {
        const app = buildApp([]);

        const res = await app.request('/usages/pending-count');

        expect(res.status).toBe(200);
    });
});
