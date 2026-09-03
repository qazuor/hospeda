/**
 * The provider's printable QR (HOS-376 T-032, HOS-981 PR 4).
 *
 * ```
 * GET /api/v1/protected/host-trades/mine/qr
 * ```
 *
 * The property under test used to be "the code points at the CALLER'S OWN
 * slug". Since PR 4 the symbol no longer carries a listing slug at all, so the
 * property split in two and both halves are pinned here: the image is derived
 * from the QR code provisioned for the caller's own LISTING ID, and the
 * response tells apart what the symbol encodes (`url`) from where that redirect
 * lands (`targetUrl`). A code that encoded the wrong listing would send every
 * scan to another provider's page, and nothing in the image would say so.
 *
 * @module test/routes/host-trade/mine-qr
 */

import { RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockGetOwn, mockGetOrCreateForEntity } = vi.hoisted(() => ({
    mockGetOwn: vi.fn(),
    mockGetOrCreateForEntity: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(function () {
            return { getOwn: mockGetOwn };
        }),
        QrCodeService: vi.fn().mockImplementation(function () {
            return { getOrCreateForEntity: mockGetOrCreateForEntity };
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
const QR_ID = '33333333-3333-4333-8333-333333333333';

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
    mockGetOwn.mockResolvedValue({
        data: { trade: { id: HT_ID, slug: 'plomero-centro', name: 'Plomero Centro' } }
    });
    mockGetOrCreateForEntity.mockImplementation(async (input: { targetUrl: string }) => ({
        data: {
            id: QR_ID,
            slug: 'k7Qm2XbT',
            targetUrl: input.targetUrl
        }
    }));
});

describe('GET /mine/qr', () => {
    it('encodes the platform’s own redirect and reports where it lands', async () => {
        const app = buildApp();

        const res = await app.request('/mine/qr');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.qrSlug).toBe('k7Qm2XbT');
        expect(body.data.url).toContain('/qr/k7Qm2XbT/');
        // The listing's URL is where the redirect goes, never what is printed.
        expect(body.data.url).not.toContain('registrar-uso');
        expect(body.data.targetUrl).toContain('/plomero-centro/registrar-uso');
        expect(body.data.slug).toBe('plomero-centro');
        expect(body.data.svg).toContain('<svg');
    });

    /**
     * The code is provisioned against the caller's own LISTING ID, never
     * against anything the request carries — the path has no id. Getting this
     * wrong would hand a provider somebody else's sticker.
     */
    it('provisions the code for the caller’s own listing', async () => {
        const app = buildApp();

        await app.request('/mine/qr');

        expect(mockGetOrCreateForEntity).toHaveBeenCalledTimes(1);
        const input = mockGetOrCreateForEntity.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(input.entityId).toBe(HT_ID);
        expect(input.entityType).toBe('HOST_TRADE');
        expect(input.targetUrl).toBe(
            'http://localhost:4321/mi-cuenta/directorio-proveedores/plomero-centro/registrar-uso'
        );
        // The operator has to be able to find this code in the panel next year.
        expect(input.label).toContain('Plomero Centro');
        expect(input.label).toContain('plomero-centro');
    });

    /**
     * The image follows the QR code, not the listing. Renaming the listing
     * changes `targetUrl` and leaves the printed symbol exactly as it was.
     */
    it('renders the same symbol after the listing is renamed', async () => {
        const app = buildApp();
        const before = await (await buildApp().request('/mine/qr')).json();

        mockGetOwn.mockResolvedValue({
            data: {
                trade: { id: HT_ID, slug: 'plomero-del-centro', name: 'Plomero Del Centro' }
            }
        });
        const after = await (await app.request('/mine/qr')).json();

        expect(after.data.svg).toBe(before.data.svg);
        expect(after.data.url).toBe(before.data.url);
        expect(after.data.targetUrl).not.toBe(before.data.targetUrl);
        expect(after.data.targetUrl).toContain('/plomero-del-centro/registrar-uso');
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
        expect(mockGetOrCreateForEntity).not.toHaveBeenCalled();
    });

    /**
     * A provisioning failure must surface, not degrade into a blank panel: a
     * provider staring at "no QR" with no error has nothing to report.
     */
    it('propagates a provisioning failure instead of answering an empty code', async () => {
        mockGetOrCreateForEntity.mockResolvedValue({
            error: { code: 'INTERNAL_ERROR', message: 'boom' }
        });
        const app = buildApp();

        const res = await app.request('/mine/qr');

        expect(res.status).toBeGreaterThanOrEqual(500);
    });
});
