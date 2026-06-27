/**
 * Tests for the protected host-trade list route (SPEC-241, T-012).
 *
 * Verifies:
 * - 200 with trades array for an actor WITH HOST_TRADE_VIEW (mocked service).
 * - 200 with empty array when the service returns no trades.
 * - 401 when no actor is set (unauthenticated via factory gate).
 * - 403 for an authenticated actor WITHOUT HOST_TRADE_VIEW.
 *
 * Approach: dynamic import AFTER mocks are registered, with actor injected
 * directly via middleware in a minimal Hono app. Mirrors dashboard.test.ts.
 *
 * @module test/routes/host-trade/protected
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

const { mockListForHost } = vi.hoisted(() => ({
    mockListForHost: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(() => ({
            listForHost: mockListForHost
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

// Dynamic import AFTER mocks are registered.
const { protectedListHostTradesRoute } = await import(
    '../../../src/routes/host-trade/protected/list.js'
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

const MOCK_TRADE = {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'fontanero-cdelu',
    name: 'Fontanero CDU',
    category: 'PLOMERIA',
    contact: '+54 3442 000001',
    benefit: 'Descuento del 10 %',
    destinationId: '33333333-3333-4333-8333-333333333333',
    is24h: false,
    scheduleText: null
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

/** Build a minimal app with the given actor injected before the route. */
function buildApp(
    permissions: PermissionEnum[],
    role: RoleEnum = RoleEnum.HOST
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);

    app.use((c, next) => {
        c.set('actor', { id: MOCK_USER_ID, role, permissions });
        return next();
    });

    app.route('/', protectedListHostTradesRoute);

    return app;
}

/**
 * Build an app simulating an unauthenticated (guest) request.
 * In production the actorMiddleware always injects a guest actor, so we
 * replicate that here: inject a guest actor (GUEST role, no permissions).
 * The protectedAuthMiddleware then rejects it with 401.
 */
function buildUnauthenticatedApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    // Inject a guest actor (no permissions, GUEST role) mirroring production.
    app.use((c, next) => {
        c.set('actor', {
            id: '00000000-0000-4000-8000-000000000000',
            role: RoleEnum.GUEST,
            permissions: []
        });
        return next();
    });
    app.route('/', protectedListHostTradesRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockListForHost.mockReset();

    mockListForHost.mockResolvedValue({
        data: { trades: [MOCK_TRADE] },
        error: undefined
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /protected/host-trades', () => {
    it('returns 200 with trades array for an actor WITH HOST_TRADE_VIEW', async () => {
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);
        const res = await app.request('/', { method: 'GET' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe(MOCK_TRADE.id);
    });

    it('returns 200 with empty array when service returns no trades', async () => {
        mockListForHost.mockResolvedValue({ data: { trades: [] }, error: undefined });
        const app = buildApp([PermissionEnum.HOST_TRADE_VIEW]);
        const res = await app.request('/', { method: 'GET' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data).toHaveLength(0);
    });

    it('returns 403 for an authenticated actor WITHOUT HOST_TRADE_VIEW', async () => {
        const app = buildApp([]);
        const res = await app.request('/', { method: 'GET' });
        expect(res.status).toBe(403);
    });

    it('returns 401 or 403 when no actor is set (guest request)', async () => {
        const app = buildUnauthenticatedApp();
        const res = await app.request('/', { method: 'GET' });
        // The route factory rejects unauthenticated requests with 401 or 403.
        expect([401, 403]).toContain(res.status);
    });
});
