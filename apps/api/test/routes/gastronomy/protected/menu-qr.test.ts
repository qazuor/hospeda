/** Menu QR provisioning, idempotence, and ownership after legacy plan removal. */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

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
    app.route('/', protectedGetGastronomyMenuQrRoute);
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
    mockGetOrCreateForEntity.mockImplementation(async (input: { targetUrl: string }) => ({
        data: { id: QR_ID, slug: 'k7Qm2XbT', targetUrl: input.targetUrl }
    }));
});

describe('GET /{id}/menu-qr — available without the old plan', () => {
    it('serves the menu QR without the old subscription', async () => {
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        expect(res.status).toBe(200);
        expect(mockGetOrCreateForEntity).toHaveBeenCalledTimes(1);
    });
});

describe('GET /{id}/menu-qr — minting (AC-2)', () => {
    it('returns the SAME row on a second call for the same venue', async () => {
        const app = buildApp();

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
        const app = buildApp();

        await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        const input = mockGetOrCreateForEntity.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(input.targetUrl).toContain('/gastronomia/la-parrilla-del-sur/carta/');
        expect(input.label).toContain('La Parrilla del Sur');
        expect(input.label).toContain('la-parrilla-del-sur');
    });

    it('renders an SVG and reports the platform redirect, not the carta URL, as `url`', async () => {
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);
        const body = await res.json();

        expect(body.data.svg).toContain('<svg');
        expect(body.data.url).toContain('/qr/k7Qm2XbT/');
        expect(body.data.targetUrl).toContain('/carta/');
    });
});

describe('GET /{id}/menu-qr — ownership (404, never 403)', () => {
    it('answers 404 for a listing owned by somebody else', async () => {
        const app = buildApp({ actorId: OTHER_USER_ID });

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        expect(res.status).toBe(404);
        expect(mockGetOrCreateForEntity).not.toHaveBeenCalled();
    });

    it('answers 404, never 403, so a caller cannot tell a foreign id from a missing one', async () => {
        mockGetById.mockResolvedValue({ data: null });
        const app = buildApp();

        const res = await app.request(`/${GASTRONOMY_ID}/menu-qr`);

        expect(res.status).toBe(404);
        expect(res.status).not.toBe(403);
    });
});
