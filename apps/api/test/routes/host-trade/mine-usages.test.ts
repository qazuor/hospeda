/**
 * The provider's side of the benefit-usage record (HOS-376 T-031).
 *
 * ```
 * POST /api/v1/protected/host-trades/mine/usages
 * GET  /api/v1/protected/host-trades/mine/usages
 * GET  /api/v1/protected/host-trades/mine/linked-hosts
 * ```
 *
 * Two properties carry the weight here.
 *
 * The AUTH SHAPE: all three must work for an actor holding NO host-trade
 * permission, because that is what an approved provider is (HOS-278 AC-7).
 * A reviewer "tidying up" by adding `requiredPermissions` would lock out
 * exactly the people the endpoints exist for, and every host would still get
 * a 200 — so nothing else would look broken.
 *
 * The SELECTOR'S PRIVACY: `/mine/linked-hosts` may say WHO, never how to reach
 * them. An email in that payload turns a dropdown into a contact-list export of
 * every past client.
 *
 * @module test/routes/host-trade/mine-usages
 */

import { type PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockGetOwn, mockDeclareAsProvider, mockListForProvider, mockListLinkedHosts } = vi.hoisted(
    () => ({
        mockGetOwn: vi.fn(),
        mockDeclareAsProvider: vi.fn(),
        mockListForProvider: vi.fn(),
        mockListLinkedHosts: vi.fn()
    })
);

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(function () {
            return { getOwn: mockGetOwn };
        }),
        HostTradeUsageService: vi.fn().mockImplementation(function () {
            return {
                declareAsProvider: mockDeclareAsProvider,
                listForProvider: mockListForProvider,
                listLinkedHosts: mockListLinkedHosts
            };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const {
    protectedDeclareUsageAsProviderRoute,
    protectedListLinkedHostsRoute,
    protectedListOwnUsagesRoute
} = await import('../../../src/routes/host-trade/protected/mine-usages.js');

const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const HT_ID = '22222222-2222-4222-8222-222222222222';
const HOST_ID = '44444444-4444-4444-8444-444444444444';

const MOCK_USAGE = {
    id: '33333333-3333-4333-8333-333333333333',
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy: 'PROVIDER',
    declaredById: OWNER_ID,
    creationChannel: 'LINKED_SELECTOR',
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

/** An app with the REAL error handler, so status assertions measure what ships. */
function buildApp(permissions: PermissionEnum[] = []): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());

    app.use((c, next) => {
        c.set('actor', { id: OWNER_ID, roles: [RoleEnum.USER], permissions });
        return next();
    });

    app.route('/', protectedDeclareUsageAsProviderRoute);
    app.route('/', protectedListOwnUsagesRoute);
    app.route('/', protectedListLinkedHostsRoute);

    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetOwn.mockResolvedValue({ data: { trade: { id: HT_ID, slug: 'plomero-centro' } } });
    mockDeclareAsProvider.mockResolvedValue({ data: { usage: MOCK_USAGE } });
    mockListForProvider.mockResolvedValue({ data: { items: [MOCK_USAGE], total: 1 } });
    mockListLinkedHosts.mockResolvedValue({
        data: { hosts: [{ id: HOST_ID, displayName: 'Casa del Río' }] }
    });
});

describe('POST /mine/usages', () => {
    it('declares against the caller’s own listing, resolved from ownership', async () => {
        const app = buildApp();

        const res = await app.request('/mine/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostUserId: HOST_ID, servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(201);
        // The listing never comes from the body — there is no field for it.
        expect(mockDeclareAsProvider).toHaveBeenCalledWith(
            expect.objectContaining({ hostTradeId: HT_ID, hostUserId: HOST_ID }),
            expect.anything()
        );
    });

    /** AC-7 — an approved provider holds no HOST_TRADE_* permission. */
    it('serves an actor with no host-trade permission', async () => {
        const app = buildApp([]);

        const res = await app.request('/mine/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostEmail: 'ana@example.com', servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(201);
    });

    /**
     * Declaring from a listing that does not exist IS a client mistake, so 404
     * — unlike `GET /mine`, where owning none is an ordinary state answered
     * with null.
     */
    it('answers 404 when the caller owns no listing', async () => {
        mockGetOwn.mockResolvedValue({ data: { trade: null } });
        const app = buildApp();

        const res = await app.request('/mine/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostUserId: HOST_ID, servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(404);
        expect(mockDeclareAsProvider).not.toHaveBeenCalled();
    });

    it('answers 404 HOST_NOT_FOUND for an email that resolves to nobody', async () => {
        mockDeclareAsProvider.mockResolvedValue({
            error: { code: ServiceErrorCode.HOST_NOT_FOUND, message: 'no host' }
        });
        const app = buildApp();

        const res = await app.request('/mine/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostEmail: 'typo@example.com', servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe(ServiceErrorCode.HOST_NOT_FOUND);
    });

    /**
     * Exactly one identifier, not "at least one": both would leave the server
     * picking a winner, and a mismatched pair is a mistake worth surfacing.
     */
    it('rejects a body carrying both identifiers', async () => {
        const app = buildApp();

        const res = await app.request('/mine/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hostUserId: HOST_ID,
                hostEmail: 'ana@example.com',
                servicedAt: '2026-08-01'
            })
        });

        expect(res.status).toBe(400);
        expect(mockDeclareAsProvider).not.toHaveBeenCalled();
    });

    it('rejects a body carrying neither identifier', async () => {
        const app = buildApp();

        const res = await app.request('/mine/usages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicedAt: '2026-08-01' })
        });

        expect(res.status).toBe(400);
        expect(mockDeclareAsProvider).not.toHaveBeenCalled();
    });
});

describe('GET /mine/usages', () => {
    it('lists the caller’s own usages with a pagination envelope', async () => {
        const app = buildApp();

        const res = await app.request('/mine/usages?page=1&pageSize=10');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.pagination.total).toBe(1);
        expect(mockListForProvider).toHaveBeenCalledWith(
            expect.objectContaining({ hostTradeId: HT_ID, page: 1, pageSize: 10 }),
            expect.anything()
        );
    });

    it('passes the status filter through', async () => {
        const app = buildApp();

        await app.request('/mine/usages?status=PENDING');

        expect(mockListForProvider).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'PENDING' }),
            expect.anything()
        );
    });

    it('answers 404 when the caller owns no listing', async () => {
        mockGetOwn.mockResolvedValue({ data: { trade: null } });
        const app = buildApp();

        const res = await app.request('/mine/usages');

        expect(res.status).toBe(404);
        expect(mockListForProvider).not.toHaveBeenCalled();
    });
});

describe('GET /mine/linked-hosts', () => {
    it('returns the scoped selector', async () => {
        const app = buildApp();

        const res = await app.request('/mine/linked-hosts');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.hosts).toEqual([{ id: HOST_ID, displayName: 'Casa del Río' }]);
    });

    /**
     * THE PRIVACY BOUNDARY, asserted on the SERIALISED response rather than on
     * the service call: the response schema is the last thing between a stored
     * address and the wire, and this test fails if anything upstream starts
     * handing emails over.
     */
    it('never serialises an email, even if the service hands one over', async () => {
        mockListLinkedHosts.mockResolvedValue({
            data: {
                hosts: [{ id: HOST_ID, displayName: 'Casa del Río', email: 'ana@example.com' }]
            }
        });
        const app = buildApp();

        const res = await app.request('/mine/linked-hosts');
        const raw = await res.text();

        expect(res.status).toBe(200);
        expect(raw).not.toContain('ana@example.com');
    });

    it('serves an actor with no host-trade permission', async () => {
        const app = buildApp([]);

        const res = await app.request('/mine/linked-hosts');

        expect(res.status).toBe(200);
    });

    it('answers 404 when the caller owns no listing', async () => {
        mockGetOwn.mockResolvedValue({ data: { trade: null } });
        const app = buildApp();

        const res = await app.request('/mine/linked-hosts');

        expect(res.status).toBe(404);
        expect(mockListLinkedHosts).not.toHaveBeenCalled();
    });
});
