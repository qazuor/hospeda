/**
 * Tests for the protected single-provider read route (HOS-376 T-045).
 *
 * ```
 * GET /api/v1/protected/host-trades/{slug}
 * ```
 *
 * This route exists because the QR landing page has to tell a host WHICH
 * provider they are about to record a usage with, and — when the listing is
 * gone — WHY the form is not there. The destination-scoped directory list
 * cannot answer either question: it has no slug filter, and a provider that is
 * revoked is indistinguishable in it from one that simply belongs to another
 * destination. Both read as absent.
 *
 * The two verdicts the page renders separately are therefore asserted here as
 * separate statuses: 404 for "no such listing", 422 PROVIDER_REVOKED for "this
 * listing was taken down".
 *
 * A suspension is deliberately NOT one of them — `declarationSuspended*` is
 * absent from the public read shape on purpose (see `host-trade.http.schema.ts`),
 * so a generic read must not become the place it leaks. It surfaces on the POST,
 * exactly as it does today.
 *
 * @module test/routes/host-trade/get-by-slug
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Service mock — hoisted so the vi.mock factory can reference it.
// ---------------------------------------------------------------------------

const { mockGetByField, mockGetOwn } = vi.hoisted(() => ({
    mockGetByField: vi.fn(),
    mockGetOwn: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(function () {
            return {
                getByField: mockGetByField,
                getOwn: mockGetOwn
            };
        })
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

// Dynamic import AFTER the mocks are registered.
const { protectedGetHostTradeBySlugRoute } = await import(
    '../../../src/routes/host-trade/protected/get-by-slug.js'
);
const { protectedGetMyHostTradeRoute } = await import(
    '../../../src/routes/host-trade/protected/mine.js'
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
const MOCK_SLUG = 'fontanero-cdelu';

/**
 * A full entity row as the service hands it back — audit and internal columns
 * included. The route returns it as-is and lets `HostTradePublicSchema` strip
 * what must not travel, which is the same contract the directory list route
 * relies on. Keeping the internals HERE is what makes the leak assertion below
 * meaningful: if the response schema ever stops stripping, this fixture is
 * carrying something for it to leak.
 */
const MOCK_TRADE_ROW = {
    id: '22222222-2222-4222-8222-222222222222',
    slug: MOCK_SLUG,
    name: 'Fontanero CDU',
    category: 'PLOMERIA',
    contact: '+54 3442 000001',
    benefit: 'Descuento del 10 %',
    destinationId: '33333333-3333-4333-8333-333333333333',
    is24h: false,
    scheduleText: null,
    confirmedUsesCount: 34,
    distinctHostsCount: 21,
    reviewsCount: 12,
    averageRating: 4.6,
    benefitRespectedCount: 11,

    // Internal / audit — must never reach the client.
    isActive: true,
    ownerUserId: '44444444-4444-4444-8444-444444444444',
    revokedAt: null,
    revokeReason: null,
    declarationSuspendedAt: null,
    declarationSuspendReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    createdById: MOCK_USER_ID,
    updatedById: MOCK_USER_ID,
    deletedAt: null,
    deletedById: null
};

// ---------------------------------------------------------------------------
// Minimal error handler
// ---------------------------------------------------------------------------

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.PROVIDER_REVOKED]: 422
};

function attachTestErrorHandler(app: Hono<AppBindings>): void {
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                status as 400 | 401 | 403 | 404 | 422 | 500
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
// App builders
// ---------------------------------------------------------------------------

function buildApp(permissions: PermissionEnum[], role: RoleEnum = RoleEnum.HOST) {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    app.use((c, next) => {
        c.set('actor', { id: MOCK_USER_ID, roles: [role], permissions });
        return next();
    });
    app.route('/', protectedGetHostTradeBySlugRoute);
    return app;
}

function buildGuestApp() {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    app.use((c, next) => {
        c.set('actor', {
            id: '00000000-0000-4000-8000-000000000000',
            roles: [RoleEnum.GUEST],
            permissions: []
        });
        return next();
    });
    app.route('/', protectedGetHostTradeBySlugRoute);
    return app;
}

/**
 * Both routes, in the production registration order: `/mine` first, the
 * parameterised `/{slug}` last.
 */
function buildAppWithMine() {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    app.use((c, next) => {
        c.set('actor', {
            id: MOCK_USER_ID,
            roles: [RoleEnum.HOST],
            permissions: [PermissionEnum.HOST_TRADE_VIEW]
        });
        return next();
    });
    app.route('/', protectedGetMyHostTradeRoute);
    app.route('/', protectedGetHostTradeBySlugRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockGetByField.mockReset();
    mockGetOwn.mockReset();
    mockGetByField.mockResolvedValue({ data: MOCK_TRADE_ROW, error: undefined });
    mockGetOwn.mockResolvedValue({ data: { trade: null }, error: undefined });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /protected/host-trades/{slug}', () => {
    it('returns 200 with the provider the QR names, addressed by slug', async () => {
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);

        const res = await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.hostTrade.id).toBe(MOCK_TRADE_ROW.id);
        expect(body.data.hostTrade.slug).toBe(MOCK_SLUG);
        expect(body.data.hostTrade.name).toBe('Fontanero CDU');
        expect(body.data.hostTrade.benefit).toBe('Descuento del 10 %');
    });

    it('resolves the listing by slug, not by id', async () => {
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);

        await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        expect(mockGetByField).toHaveBeenCalledTimes(1);
        expect(mockGetByField).toHaveBeenCalledWith(
            expect.objectContaining({ id: MOCK_USER_ID }),
            'slug',
            MOCK_SLUG
        );
    });

    it('carries the directory stats the card renders', async () => {
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);

        const res = await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        const { hostTrade } = (await res.json()).data;
        expect(hostTrade.confirmedUsesCount).toBe(34);
        expect(hostTrade.distinctHostsCount).toBe(21);
        expect(hostTrade.reviewsCount).toBe(12);
    });

    it('strips every internal and audit column from the response', async () => {
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);

        const res = await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        const { hostTrade } = (await res.json()).data;

        // The complementary half of the assertion: the payload IS populated, so
        // an empty body can never make the exclusions below pass vacuously.
        expect(hostTrade.name).toBe('Fontanero CDU');

        for (const leaked of [
            'ownerUserId',
            'isActive',
            'revokedAt',
            'revokeReason',
            'declarationSuspendedAt',
            'declarationSuspendReason',
            'createdById',
            'updatedById',
            'deletedAt',
            'deletedById'
        ]) {
            expect(hostTrade).not.toHaveProperty(leaked);
        }
    });

    it('returns 404 when no listing carries that slug', async () => {
        mockGetByField.mockResolvedValue({ data: null, error: undefined });
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);

        const res = await app.request('/no-existe', { method: 'GET' });

        expect(res.status).toBe(404);
    });

    it('returns 422 PROVIDER_REVOKED for a listing that was taken down', async () => {
        mockGetByField.mockResolvedValue({
            data: { ...MOCK_TRADE_ROW, revokedAt: new Date('2026-06-01T00:00:00.000Z') },
            error: undefined
        });
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);

        const res = await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.error.code).toBe(ServiceErrorCode.PROVIDER_REVOKED);
    });

    it('returns 404 for a soft-deleted listing, which was never published', async () => {
        mockGetByField.mockResolvedValue({
            data: { ...MOCK_TRADE_ROW, deletedAt: new Date('2026-06-01T00:00:00.000Z') },
            error: undefined
        });
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);

        const res = await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        expect(res.status).toBe(404);
    });

    it('does NOT refuse a suspended provider — a suspension is not public', async () => {
        mockGetByField.mockResolvedValue({
            data: {
                ...MOCK_TRADE_ROW,
                declarationSuspendedAt: new Date('2026-06-01T00:00:00.000Z'),
                declarationSuspendReason: 'three rejections in 90 days'
            },
            error: undefined
        });
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);

        const res = await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        expect(res.status).toBe(200);
        const { hostTrade } = (await res.json()).data;
        expect(hostTrade).not.toHaveProperty('declarationSuspendedAt');
        expect(hostTrade).not.toHaveProperty('declarationSuspendReason');
    });

    it('returns 403 for an authenticated actor WITHOUT HOST_TRADE_VIEW', async () => {
        const app = buildApp([]);

        const res = await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        expect(res.status).toBe(403);
        expect(mockGetByField).not.toHaveBeenCalled();
    });

    it('rejects a guest request', async () => {
        const app = buildGuestApp();

        const res = await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        expect([401, 403]).toContain(res.status);
    });
});

describe('GET /protected/host-trades/{slug} — routing against the literal siblings', () => {
    it('does not swallow GET /mine as a provider whose slug is "mine"', async () => {
        const app = buildAppWithMine();

        const res = await app.request('/mine', { method: 'GET' });

        expect(res.status).toBe(200);
        // The proof is WHICH service method ran: `/mine` must reach the
        // own-listing handler, and the slug reader must never have been asked
        // for a provider called "mine".
        expect(mockGetOwn).toHaveBeenCalledTimes(1);
        expect(mockGetByField).not.toHaveBeenCalled();
    });

    it('still resolves a real slug when /mine is registered alongside', async () => {
        const app = buildAppWithMine();

        const res = await app.request(`/${MOCK_SLUG}`, { method: 'GET' });

        expect(res.status).toBe(200);
        expect(mockGetByField).toHaveBeenCalledTimes(1);
        expect(mockGetOwn).not.toHaveBeenCalled();
    });
});
