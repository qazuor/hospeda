/**
 * The venue's menu QR endpoint — gate, minting and ownership (HOS-1044 §6.2,
 * §6.5, AC-2 / AC-3 and the route half of AC-4).
 *
 * ```
 * GET /api/v1/protected/gastronomies/{id}/menu-qr
 * ```
 *
 * Three properties are pinned:
 *
 * - **AC-2** — the code is provisioned once and REUSED, never re-minted, on a
 *   second call for the same venue.
 * - **AC-3** — the gate is `MENU_QR_ANALYTICS`, granted by `gastronomy-premium`
 *   alone: basic and pro both answer 403, premium answers 200. Asserted per
 *   tier, not once, because a gate that always refused would look identical to
 *   a working one on a single assertion.
 * - **404, never 403, for a foreign listing** — a 403 would confirm the id
 *   exists (`apps/api/docs/error-contract.md`).
 *
 * AC-4 (the public `/carta/` page must mint ZERO `qr_codes` rows) is a
 * property of THAT page, not of this route, and is asserted in its own test
 * suite — this file only proves minting happens exactly HERE.
 *
 * @module test/routes/gastronomy/protected/menu-qr
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

const { mockGetById, mockGetOrCreateForEntity } = vi.hoisted(() => ({
    mockGetById: vi.fn(),
    mockGetOrCreateForEntity: vi.fn()
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
            return { getOrCreateForEntity: mockGetOrCreateForEntity };
        })
    };
});

vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedGetGastronomyMenuQrRoute } = await import(
    '../../../../src/routes/gastronomy/protected/menuQr.js'
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
    app.route('/', protectedGetGastronomyMenuQrRoute);
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
    mockGetOrCreateForEntity.mockImplementation(async (input: { targetUrl: string }) => ({
        data: { id: QR_ID, slug: 'k7Qm2XbT', targetUrl: input.targetUrl }
    }));
});

afterEach(() => {
    _resetCommerceBaseLimitCache();
});

describe('GET /{id}/menu-qr — tier gate (AC-3)', () => {
    it('answers 403 for a gastronomy-basico owner (no subscription at all)', async () => {
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        expect(res.status).toBe(403);
        expect(mockGetOrCreateForEntity).not.toHaveBeenCalled();
    });

    it('answers 403 for a gastronomy-pro owner (plan grants menu management, not the QR)', async () => {
        grantSubscription(['manage_gastronomy_menu', 'manage_gastronomy_events']);
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        expect(res.status).toBe(403);
        expect(mockGetOrCreateForEntity).not.toHaveBeenCalled();
    });

    it('answers 200 for a gastronomy-premium owner (plan grants menu_qr_analytics)', async () => {
        grantSubscription(['manage_gastronomy_menu', 'menu_item_photos', 'menu_qr_analytics']);
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        expect(res.status).toBe(200);
        expect(mockGetOrCreateForEntity).toHaveBeenCalledTimes(1);
    });
});

describe('GET /{id}/menu-qr — minting (AC-2)', () => {
    beforeEach(() => {
        grantSubscription(['menu_qr_analytics']);
    });

    it('returns the SAME row on a second call for the same venue', async () => {
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const first = await (await app.request(`/${GASTRONOMY_ID}/menu-qr`)).json();
        const second = await (await app.request(`/${GASTRONOMY_ID}/menu-qr`)).json();

        expect(first.data.qrSlug).toBe('k7Qm2XbT');
        expect(second.data.qrSlug).toBe('k7Qm2XbT');
        expect(second.data.targetUrl).toBe(first.data.targetUrl);
        // Two GETs, two provisioning calls — idempotency lives in
        // `QrCodeService.getOrCreateForEntity` (covered by
        // `qr-code.entity-provisioning.test.ts`), not in the route calling it
        // only once. What THIS route must never do is skip the call, since
        // that would hide a stale image behind a rename.
        expect(mockGetOrCreateForEntity).toHaveBeenCalledTimes(2);
        expect(mockGetOrCreateForEntity.mock.calls[0]?.[0]).toMatchObject({
            entityId: GASTRONOMY_ID,
            entityType: 'GASTRONOMY',
            purpose: 'MENU'
        });
    });

    it('provisions with the carta URL as the target, never the listing page', async () => {
        const app = buildApp({ billingCustomerId: 'cus-1' });

        await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        const input = mockGetOrCreateForEntity.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(input.targetUrl).toContain('/gastronomia/la-parrilla-del-sur/carta/');
        expect(input.label).toContain('La Parrilla del Sur');
        expect(input.label).toContain('la-parrilla-del-sur');
    });

    it('renders an SVG and reports the platform redirect, not the carta URL, as `url`', async () => {
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);
        const body = await res.json();

        expect(body.data.svg).toContain('<svg');
        expect(body.data.url).toContain('/qr/k7Qm2XbT/');
        expect(body.data.targetUrl).toContain('/carta/');
    });
});

describe('GET /{id}/menu-qr — ownership (404, never 403)', () => {
    beforeEach(() => {
        grantSubscription(['menu_qr_analytics']);
    });

    it('answers 404 for a listing owned by somebody else', async () => {
        const app = buildApp({ actorId: OTHER_USER_ID, billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        expect(res.status).toBe(404);
        expect(mockGetOrCreateForEntity).not.toHaveBeenCalled();
    });

    it('answers 404, never 403, so a caller cannot tell a foreign id from a missing one', async () => {
        mockGetById.mockResolvedValue({ data: null });
        const app = buildApp({ billingCustomerId: 'cus-1' });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        expect(res.status).toBe(404);
        expect(res.status).not.toBe(403);
    });
});
