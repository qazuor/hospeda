/**
 * HOS-146 — public destination points-of-interest endpoint.
 *
 * Route-level tests mock only the `DestinationService` and actor resolution,
 * mounting the real `publicGetDestinationPointsOfInterestRoute` (built with
 * the real `createPublicRoute` factory, so the real response-schema strip —
 * `stripWithSchema` — actually runs). This is the regression coverage for
 * the bug this spec fixes: `relation` must survive the strip because
 * `DestinationPointOfInterestSummarySchema` declares it, unlike the bare
 * `PointOfInterestSummarySchema`.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const mockGetPointsOfInterest = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        DestinationService: vi.fn().mockImplementation(function () {
            return {
                getPointsOfInterest: mockGetPointsOfInterest
            };
        }),
        ServiceError: class ServiceError extends Error {
            public readonly code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
    };
});

vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        getActorFromContext: vi.fn(() => ({
            id: '00000000-0000-4000-8000-000000000000',
            role: 'GUEST',
            permissions: []
        }))
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ── fixtures ─────────────────────────────────────────────────────────────────

const DEST_ID = 'dddddddd-0000-4000-8000-000000000010';

const POI_PRIMARY = {
    id: '11111111-0000-4000-8000-000000000001',
    slug: 'autodromo',
    lat: -32.48,
    long: -58.24,
    type: 'STADIUM',
    nameI18n: null,
    description: null,
    descriptionI18n: null,
    icon: null,
    hasOwnPage: false,
    isFeatured: false,
    isBuiltin: false,
    displayWeight: 80,
    relation: 'PRIMARY',
    // HOS-182: always present on a real POI summary row (object or null).
    primaryCategory: null
};

const POI_NEARBY = {
    ...POI_PRIMARY,
    id: '22222222-0000-4000-8000-000000000002',
    slug: 'termas',
    relation: 'NEARBY'
};

async function buildApp() {
    vi.resetModules();
    const { publicGetDestinationPointsOfInterestRoute } = await import(
        '../../../../src/routes/destination/public/getPointsOfInterest'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetDestinationPointsOfInterestRoute);
    return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('publicGetDestinationPointsOfInterestRoute — HOS-146', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is registered and responds without auth (public tier)', async () => {
        mockGetPointsOfInterest.mockResolvedValue({
            data: { pointsOfInterest: [] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${DEST_ID}/points-of-interest`);

        expect(res.status).not.toBe(404);
        expect(res.status).not.toBe(401);
        expect(res.status).toBe(200);
    });

    it('preserves the `relation` field on every item (survives stripWithSchema)', async () => {
        mockGetPointsOfInterest.mockResolvedValue({
            data: { pointsOfInterest: [POI_PRIMARY, POI_NEARBY] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${DEST_ID}/points-of-interest`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.data as Array<Record<string, unknown>>;
        expect(items).toHaveLength(2);
        expect(items[0]).toMatchObject({ slug: 'autodromo', relation: 'PRIMARY' });
        expect(items[1]).toMatchObject({ slug: 'termas', relation: 'NEARBY' });
    });

    it('preserves a non-null primaryCategory on an item (HOS-182, survives stripWithSchema)', async () => {
        const nameI18n = { es: 'Recinto deportivo', en: 'Sports venue', pt: 'Recinto esportivo' };
        const poiWithCategory = {
            ...POI_PRIMARY,
            primaryCategory: { slug: 'sports_venue', nameI18n }
        };
        mockGetPointsOfInterest.mockResolvedValue({
            data: { pointsOfInterest: [poiWithCategory] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${DEST_ID}/points-of-interest`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.data as Array<Record<string, unknown>>;
        expect(items[0]?.primaryCategory).toEqual({ slug: 'sports_venue', nameI18n });
    });

    it('returns primaryCategory: null when the POI has no primary category (HOS-182)', async () => {
        mockGetPointsOfInterest.mockResolvedValue({
            data: { pointsOfInterest: [POI_PRIMARY] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${DEST_ID}/points-of-interest`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.data as Array<Record<string, unknown>>;
        expect(items[0]?.primaryCategory).toBeNull();
    });

    it('returns an empty array when the destination has no points of interest', async () => {
        mockGetPointsOfInterest.mockResolvedValue({
            data: { pointsOfInterest: [] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${DEST_ID}/points-of-interest`);
        const body = await res.json();

        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data).toEqual([]);
    });

    it('forwards an explicit relation=PRIMARY query param to the service', async () => {
        mockGetPointsOfInterest.mockResolvedValue({
            data: { pointsOfInterest: [POI_PRIMARY] },
            error: null
        });

        const app = await buildApp();
        await app.request(`/${DEST_ID}/points-of-interest?relation=PRIMARY`);

        expect(mockGetPointsOfInterest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ destinationId: DEST_ID, relation: 'PRIMARY' })
        );
    });

    it('forwards an explicit relation=NEARBY query param to the service', async () => {
        mockGetPointsOfInterest.mockResolvedValue({
            data: { pointsOfInterest: [POI_NEARBY] },
            error: null
        });

        const app = await buildApp();
        await app.request(`/${DEST_ID}/points-of-interest?relation=NEARBY`);

        expect(mockGetPointsOfInterest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ destinationId: DEST_ID, relation: 'NEARBY' })
        );
    });

    it('forwards an explicit relation=ALL query param to the service', async () => {
        mockGetPointsOfInterest.mockResolvedValue({
            data: { pointsOfInterest: [POI_PRIMARY, POI_NEARBY] },
            error: null
        });

        const app = await buildApp();
        await app.request(`/${DEST_ID}/points-of-interest?relation=ALL`);

        expect(mockGetPointsOfInterest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ destinationId: DEST_ID, relation: 'ALL' })
        );
    });

    it('leaves relation undefined when the query param is omitted (service applies its own ALL default)', async () => {
        mockGetPointsOfInterest.mockResolvedValue({
            data: { pointsOfInterest: [POI_PRIMARY, POI_NEARBY] },
            error: null
        });

        const app = await buildApp();
        await app.request(`/${DEST_ID}/points-of-interest`);

        expect(mockGetPointsOfInterest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ destinationId: DEST_ID, relation: undefined })
        );
    });

    it('rejects an invalid relation value with a validation error', async () => {
        const app = await buildApp();
        const res = await app.request(`/${DEST_ID}/points-of-interest?relation=BOGUS`);

        expect(res.status).not.toBe(200);
        expect(mockGetPointsOfInterest).not.toHaveBeenCalled();
    });
});
