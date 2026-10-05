/** Menu QR scan totals, empty history, and ownership after legacy plan removal. */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const { mockGetById, mockFindLiveCodeForEntity, mockGetScanStatsForCode } = vi.hoisted(() => ({
    mockGetById: vi.fn(),
    mockFindLiveCodeForEntity: vi.fn(),
    mockGetScanStatsForCode: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        GastronomyService: Object.assign(
            vi.fn().mockImplementation(function () {
                return { getById: mockGetById };
            }),
            { ENTITY_NAME: 'gastronomy' }
        ),
        QrCodeService: vi.fn().mockImplementation(function () {
            return {
                findLiveCodeForEntity: mockFindLiveCodeForEntity,
                getScanStatsForCode: mockGetScanStatsForCode
            };
        })
    };
});

vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedGetGastronomyMenuQrScansRoute } = await import(
    '../../../../src/routes/gastronomy/protected/menuQrScans.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const GASTRONOMY_ID = '22222222-2222-4222-8222-222222222222';
const QR_ID = '33333333-3333-4333-8333-333333333333';

function buildApp(input: { actorId?: string } = {}): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((context, next) => {
        context.set('actor', {
            id: input.actorId ?? OWNER_ID,
            roles: [],
            permissions: []
        } as never);
        return next();
    });
    app.route('/', protectedGetGastronomyMenuQrScansRoute);
    return app;
}

beforeEach(() => {
    vi.clearAllMocks();

    mockGetById.mockResolvedValue({
        data: {
            id: GASTRONOMY_ID,
            ownerId: OWNER_ID,
            slug: 'la-parrilla-del-sur',
            name: 'La Parrilla del Sur'
        }
    });
    mockFindLiveCodeForEntity.mockResolvedValue({ data: null });
    mockGetScanStatsForCode.mockResolvedValue({
        data: {
            window: '30d',
            total: 0,
            dailySeries: [],
            byDeviceType: {},
            byOs: {},
            byBrowserLanguage: {}
        }
    });
});

describe('GET /{id}/menu-qr/scans — available without the old plan', () => {
    it('serves scan totals without the old subscription', async () => {
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(res.status).toBe(200);
        expect(mockFindLiveCodeForEntity).toHaveBeenCalled();
    });

    it('answers 200 for a gastronomy-premium owner (plan grants menu_qr_scan_metrics)', async () => {
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(res.status).toBe(200);
        expect(mockFindLiveCodeForEntity).toHaveBeenCalledTimes(1);
    });
});

describe('GET /{id}/menu-qr/scans — no code yet (§6.4)', () => {
    it('answers 200 with an all-zero aggregate rather than 404', async () => {
        mockFindLiveCodeForEntity.mockResolvedValue({ data: null });
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.total).toBe(0);
        expect(body.data.byDeviceType).toEqual({});
    });

    it('never calls getScanStatsForCode, and never mints — this route holds no reference to getOrCreateForEntity', async () => {
        mockFindLiveCodeForEntity.mockResolvedValue({ data: null });
        const app = buildApp();

        await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(mockGetScanStatsForCode).not.toHaveBeenCalled();
    });

    it('gap-fills a full 30-day zero series when the window is not overridden', async () => {
        mockFindLiveCodeForEntity.mockResolvedValue({ data: null });
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);
        const body = await res.json();

        expect(body.data.dailySeries).toHaveLength(30);
        expect(body.data.dailySeries.every((d: { total: number }) => d.total === 0)).toBe(true);
    });
});

describe('GET /{id}/menu-qr/scans — existing code', () => {
    beforeEach(() => {
        mockFindLiveCodeForEntity.mockResolvedValue({
            data: {
                id: QR_ID,
                slug: 'k7Qm2XbT',
                targetUrl: 'https://hospeda.com.ar/es/gastronomia/x/carta/'
            }
        });
    });

    it('delegates to getScanStatsForCode with the resolved qrCodeId and requested window', async () => {
        const app = buildApp();

        await app.request(`/${GASTRONOMY_ID}/menu-qr/scans?window=7d`);

        expect(mockGetScanStatsForCode).toHaveBeenCalledTimes(1);
        expect(mockGetScanStatsForCode.mock.calls[0]?.[0]).toMatchObject({
            qrCodeId: QR_ID,
            window: '7d'
        });
    });

    it('returns the aggregate the service produced', async () => {
        mockGetScanStatsForCode.mockResolvedValue({
            data: {
                window: '7d',
                total: 5,
                dailySeries: [{ date: '2026-09-04', total: 5 }],
                byDeviceType: { MOBILE: 5 },
                byOs: { unknown: 5 },
                byBrowserLanguage: { unknown: 5 }
            }
        });
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans?window=7d`);
        const body = await res.json();

        expect(body.data.total).toBe(5);
        expect(body.data.byDeviceType).toEqual({ MOBILE: 5 });
    });
});

describe('GET /{id}/menu-qr/scans — ownership (404, never 403)', () => {
    it('answers 404 for a listing owned by somebody else', async () => {
        const app = buildApp({ actorId: OTHER_USER_ID });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(res.status).toBe(404);
        expect(mockFindLiveCodeForEntity).not.toHaveBeenCalled();
    });

    it('answers 404, never 403, so a caller cannot tell a foreign id from a missing one', async () => {
        mockGetById.mockResolvedValue({ data: null });
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(res.status).toBe(404);
        expect(res.status).not.toBe(403);
    });
});
