/**
 * The venue's menu QR scan aggregate endpoint — gate, "no code yet" and
 * ownership (HOS-1044 §6.4, §6.5, AC-3).
 *
 * ```
 * GET /api/v1/protected/gastronomies/{id}/menu-qr/scans
 * ```
 *
 * Mirrors `menu-qr.test.ts`'s real-middleware-stack strategy: the gate is
 * exercised through the actual `commerceVerticalEntitlementMiddleware` +
 * `requireEntitlement` pair (not a mocked middleware), with a fake billing
 * provider standing in for MercadoPago/QZPay.
 *
 * - **AC-3** — the gate is `MENU_QR_SCAN_METRICS`, granted by `gastronomy-premium`
 *   alone: basic and pro both answer 403, premium answers 200. Asserted per
 *   tier.
 * - **"No code yet" (§6.4)** — a venue with no `MENU` code answers 200 with an
 *   all-zero aggregate, never a 404, and never mints one (no call reaches
 *   `getOrCreateForEntity`, which this route does not even import).
 * - **404, never 403, for a foreign listing** — same rule as `menu-qr.ts`.
 *
 * @module test/routes/gastronomy/protected/menu-qr-scans
 */

import { getDb } from '@repo/db';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

/** Product domains as actually STORED, keyed by subscription id (HOS-934). */
let fakeStoredProductDomains: Record<string, string | null> = {};
/** Subscriptions the fake billing provider returns for the customer. */
let fakeSubscriptions: Array<Record<string, unknown>> = [];
/** Plans the fake provider resolves by id, `entitlements` being the half this file cares about. */
let fakePlans: Record<string, { limits: Record<string, number>; entitlements?: string[] }> = {};

vi.mock('../../../../src/middlewares/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/middlewares/billing')>();
    return {
        ...actual,
        getQZPayBilling: () => ({
            subscriptions: {
                getByCustomerId: async () => fakeSubscriptions
            },
            plans: {
                get: async (id: string) => fakePlans[id] ?? null
            },
            limits: {
                getByCustomerId: async () => []
            }
        })
    };
});

vi.mock('../../../../src/services/plan.service', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/services/plan.service')>();
    return {
        ...actual,
        PlanService: class {
            async getBySlug(_slug: string) {
                return { success: true as const, data: { limits: { max_gastronomies: 1 } } };
            }
        }
    };
});

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
const { _resetCommerceBaseLimitCache } = await import(
    '../../../../src/middlewares/commerce-entitlement.js'
);

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const GASTRONOMY_ID = '22222222-2222-4222-8222-222222222222';
const QR_ID = '33333333-3333-4333-8333-333333333333';

/** Wires the mocked `getDb()` to answer `hydrateSubscriptionProductDomains`'s recovery SELECT. */
function mockProductDomainRecovery() {
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(
                    Object.entries(fakeStoredProductDomains).map(([id, productDomain]) => ({
                        id,
                        productDomain
                    }))
                )
            })
        })
    } as never);
}

function buildApp(input: { actorId?: string; billingCustomerId?: string } = {}): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((c, next) => {
        c.set('actor', { id: input.actorId ?? OWNER_ID, roles: [], permissions: [] } as never);
        if (input.billingCustomerId) {
            c.set('billingCustomerId', input.billingCustomerId);
        }
        return next();
    });
    app.route('/', protectedGetGastronomyMenuQrScansRoute);
    return app;
}

/** Grants the caller a live gastronomy subscription on the given plan. */
function grantSubscription(entitlements: string[]) {
    fakeSubscriptions = [{ id: 's1', status: 'active', planId: 'p1' }];
    fakeStoredProductDomains = { s1: 'gastronomy' };
    mockProductDomainRecovery();
    fakePlans = { p1: { limits: { max_gastronomies: 5 }, entitlements } };
}

beforeEach(() => {
    vi.clearAllMocks();
    fakeSubscriptions = [];
    fakePlans = {};
    fakeStoredProductDomains = {};
    _resetCommerceBaseLimitCache();
    mockProductDomainRecovery();

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

afterEach(() => {
    _resetCommerceBaseLimitCache();
});

describe('GET /{id}/menu-qr/scans — tier gate (AC-3)', () => {
    it('answers 403 for a gastronomy-basico owner (no subscription at all)', async () => {
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(res.status).toBe(403);
        expect(mockFindLiveCodeForEntity).not.toHaveBeenCalled();
    });

    it('answers 403 for a gastronomy-pro owner (plan grants menu management, not the QR analytics)', async () => {
        grantSubscription(['manage_gastronomy_menu', 'manage_gastronomy_events']);
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(res.status).toBe(403);
        expect(mockFindLiveCodeForEntity).not.toHaveBeenCalled();
    });

    it('answers 200 for a gastronomy-premium owner (plan grants menu_qr_scan_metrics)', async () => {
        grantSubscription(['manage_gastronomy_menu', 'menu_item_photos', 'menu_qr_scan_metrics']);
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(res.status).toBe(200);
        expect(mockFindLiveCodeForEntity).toHaveBeenCalledTimes(1);
    });
});

describe('GET /{id}/menu-qr/scans — no code yet (§6.4)', () => {
    beforeEach(() => {
        grantSubscription(['menu_qr_scan_metrics']);
    });

    it('answers 200 with an all-zero aggregate rather than 404', async () => {
        mockFindLiveCodeForEntity.mockResolvedValue({ data: null });
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.total).toBe(0);
        expect(body.data.byDeviceType).toEqual({});
    });

    it('never calls getScanStatsForCode, and never mints — this route holds no reference to getOrCreateForEntity', async () => {
        mockFindLiveCodeForEntity.mockResolvedValue({ data: null });
        const app = buildApp({ billingCustomerId: 'cus-1' });

        await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(mockGetScanStatsForCode).not.toHaveBeenCalled();
    });

    it('gap-fills a full 30-day zero series when the window is not overridden', async () => {
        mockFindLiveCodeForEntity.mockResolvedValue({ data: null });
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);
        const body = await res.json();

        expect(body.data.dailySeries).toHaveLength(30);
        expect(body.data.dailySeries.every((d: { total: number }) => d.total === 0)).toBe(true);
    });
});

describe('GET /{id}/menu-qr/scans — existing code', () => {
    beforeEach(() => {
        grantSubscription(['menu_qr_scan_metrics']);
        mockFindLiveCodeForEntity.mockResolvedValue({
            data: {
                id: QR_ID,
                slug: 'k7Qm2XbT',
                targetUrl: 'https://hospeda.com.ar/es/gastronomia/x/carta/'
            }
        });
    });

    it('delegates to getScanStatsForCode with the resolved qrCodeId and requested window', async () => {
        const app = buildApp({ billingCustomerId: 'cus-1' });

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
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans?window=7d`);
        const body = await res.json();

        expect(body.data.total).toBe(5);
        expect(body.data.byDeviceType).toEqual({ MOBILE: 5 });
    });
});

describe('GET /{id}/menu-qr/scans — ownership (404, never 403)', () => {
    beforeEach(() => {
        grantSubscription(['menu_qr_scan_metrics']);
    });

    it('answers 404 for a listing owned by somebody else', async () => {
        const app = buildApp({ actorId: OTHER_USER_ID, billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(res.status).toBe(404);
        expect(mockFindLiveCodeForEntity).not.toHaveBeenCalled();
    });

    it('answers 404, never 403, so a caller cannot tell a foreign id from a missing one', async () => {
        mockGetById.mockResolvedValue({ data: null });
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr/scans`);

        expect(res.status).toBe(404);
        expect(res.status).not.toBe(403);
    });
});
