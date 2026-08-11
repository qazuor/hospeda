/**
 * Tests for the provider self-service routes (HOS-278 AC-7 .. AC-10).
 *
 * ```
 * GET   /api/v1/protected/host-trades/mine
 * PATCH /api/v1/protected/host-trades/mine
 * ```
 *
 * The point of these tests is the AUTH SHAPE, which is the part most easily
 * broken by a well-meaning change: both routes must work for an actor with NO
 * host-trade permission at all. A reviewer "tidying up" by adding
 * `requiredPermissions: [HOST_TRADE_VIEW]` would be wrong in a way nothing
 * else catches — the route would still respond 200 to every actor who happens
 * to be a host, and only actual providers would be locked out.
 *
 * @module test/routes/host-trade/mine
 */

import { type PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockGetOwn, mockUpdateOwn } = vi.hoisted(() => ({
    mockGetOwn: vi.fn(),
    mockUpdateOwn: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(function () {
            return {
                getOwn: mockGetOwn,
                updateOwn: mockUpdateOwn
            };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedGetMyHostTradeRoute, protectedUpdateMyHostTradeRoute } = await import(
    '../../../src/routes/host-trade/protected/mine.js'
);

const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

const MOCK_OWN_TRADE = {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'plomeria-acme',
    name: 'Plomería Acme',
    category: 'PLOMERIA',
    contact: '+54 3442 000001',
    benefit: 'No acumulable.',
    benefitType: 'PERCENTAGE',
    benefitValue: 15,
    pendingBenefitType: null,
    pendingBenefitValue: null,
    pendingBenefitText: null,
    benefitReviewState: null,
    destinationId: '33333333-3333-4333-8333-333333333333',
    is24h: false,
    scheduleText: null,
    isActive: true,
    revokedAt: null,
    revokeReason: null
};

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
        return c.json({ success: false, error: { message: String(error) } }, 500);
    });
}

/**
 * An app whose actor holds NO host-trade permission — the provider case.
 */
function buildApp(permissions: PermissionEnum[] = []): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);

    app.use((c, next) => {
        c.set('actor', { id: MOCK_USER_ID, roles: [RoleEnum.USER], permissions });
        return next();
    });

    app.route('/', protectedGetMyHostTradeRoute);
    app.route('/', protectedUpdateMyHostTradeRoute);

    return app;
}

describe('GET /mine — AC-7', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return the listing for an actor with NO host-trade permission', async () => {
        // Arrange — this is the whole point: a provider holds none of them.
        mockGetOwn.mockResolvedValue({ data: { trade: MOCK_OWN_TRADE } });
        const app = buildApp([]);

        // Act
        const res = await app.request('/mine');

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.trade.id).toBe(MOCK_OWN_TRADE.id);
    });

    it('should answer 200 with null — not 404 — when the actor owns none', async () => {
        // Arrange — "approved but the listing is not built yet" is an ordinary
        // state; a 404 would render it as a broken page.
        mockGetOwn.mockResolvedValue({ data: { trade: null } });
        const app = buildApp([]);

        // Act
        const res = await app.request('/mine');

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.trade).toBeNull();
    });

    it('should surface a real service failure instead of answering null', async () => {
        // Arrange — a silent null would read as "you have no listing", which is
        // a worse lie than an error on the page whose job is showing it.
        mockGetOwn.mockResolvedValue({
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'db down' }
        });
        const app = buildApp([]);

        // Act
        const res = await app.request('/mine');

        // Assert
        expect(res.status).toBe(500);
    });
});

describe('PATCH /mine — AC-8 / AC-9', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should accept an operational edit from an actor with NO permission', async () => {
        // Arrange
        mockUpdateOwn.mockResolvedValue({ data: { trade: MOCK_OWN_TRADE } });
        const app = buildApp([]);

        // Act
        const res = await app.request('/mine', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact: 'wa.me/5493411111111' })
        });

        // Assert
        expect(res.status).toBe(200);
        expect(mockUpdateOwn).toHaveBeenCalledTimes(1);
    });

    it('should never forward an identity field to the service', async () => {
        // Arrange — the route schema strips them before the handler runs, so
        // the service is never even asked to reject them (AC-9).
        mockUpdateOwn.mockResolvedValue({ data: { trade: MOCK_OWN_TRADE } });
        const app = buildApp([]);

        // Act
        await app.request('/mine', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contact: '+54 9 341 000 0000',
                name: 'Renamed',
                slug: 'renamed',
                isActive: false
            })
        });

        // Assert
        const [, payload] = mockUpdateOwn.mock.calls[0] ?? [];
        expect(payload).not.toHaveProperty('name');
        expect(payload).not.toHaveProperty('slug');
        expect(payload).not.toHaveProperty('isActive');
        expect(payload).toMatchObject({ contact: '+54 9 341 000 0000' });
    });

    it('should map a NOT_FOUND from the service to 404', async () => {
        // Arrange — unlike the GET, editing a listing that does not exist IS a
        // client mistake.
        mockUpdateOwn.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'none' }
        });
        const app = buildApp([]);

        // Act
        const res = await app.request('/mine', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact: '+54 9 341 000 0000' })
        });

        // Assert
        expect(res.status).toBe(404);
    });
});
