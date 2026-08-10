/**
 * The provider's printable QR (HOS-376 T-032).
 *
 * ```
 * GET /api/v1/protected/host-trades/mine/qr
 * ```
 *
 * The property under test is that the code points at the CALLER'S OWN slug.
 * A QR is printed once and lives on a van; one that encodes the wrong listing
 * sends every scan to another provider's page, and nothing in the image says so.
 *
 * @module test/routes/host-trade/mine-qr
 */

import { RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockGetOwn } = vi.hoisted(() => ({ mockGetOwn: vi.fn() }));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(function () {
            return { getOwn: mockGetOwn };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedGetMyQrRoute } = await import(
    '../../../src/routes/host-trade/protected/mine-qr.js'
);
const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const HT_ID = '22222222-2222-4222-8222-222222222222';

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((c, next) => {
        c.set('actor', { id: OWNER_ID, roles: [RoleEnum.USER], permissions: [] });
        return next();
    });
    app.route('/', protectedGetMyQrRoute);
    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetOwn.mockResolvedValue({ data: { trade: { id: HT_ID, slug: 'plomero-centro' } } });
});

describe('GET /mine/qr', () => {
    it('returns an SVG whose URL carries the caller’s own slug', async () => {
        const app = buildApp();

        const res = await app.request('/mine/qr');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.slug).toBe('plomero-centro');
        expect(body.data.url).toContain('/plomero-centro/registrar-uso');
        expect(body.data.svg).toContain('<svg');
    });

    /**
     * The slug comes from the caller's OWN listing, never from anything the
     * request carries — the path has no id, and this pins that the response
     * follows the listing rather than a fixed value.
     */
    it('follows the caller’s listing when the slug differs', async () => {
        mockGetOwn.mockResolvedValue({
            data: { trade: { id: HT_ID, slug: 'electricista-norte' } }
        });
        const app = buildApp();

        const res = await app.request('/mine/qr');
        const body = await res.json();

        expect(body.data.slug).toBe('electricista-norte');
        expect(body.data.url).toContain('/electricista-norte/registrar-uso');
        expect(body.data.url).not.toContain('plomero-centro');
    });

    /** AC-7 — an approved provider holds no HOST_TRADE_* permission. */
    it('serves an actor with no host-trade permission', async () => {
        const app = buildApp();

        const res = await app.request('/mine/qr');

        expect(res.status).toBe(200);
    });

    it('answers 404 when the caller owns no listing', async () => {
        mockGetOwn.mockResolvedValue({ data: { trade: null } });
        const app = buildApp();

        const res = await app.request('/mine/qr');

        expect(res.status).toBe(404);
    });
});
