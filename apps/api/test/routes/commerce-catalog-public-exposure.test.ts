/**
 * @file commerce-catalog-public-exposure.test.ts
 * @description HOS-1072 — the public `getBySlug` routes of both commerce
 * verticals attach the catalog-joined amenities/features AND those survive the
 * response projection.
 *
 * This is the only place the two halves of the bug meet. The schema suite
 * proves `GastronomyPublicSchema` / `ExperiencePublicSchema` DECLARE the fields;
 * this one proves the route actually puts something in them and that
 * `stripWithSchema` — the step that silently discarded every attached relation
 * before this change — lets it through to the wire.
 *
 * The catalog reader is stubbed rather than hit: `@repo/db` is globally mocked
 * in this app's setup, so a real join returns nothing and the assertion would
 * be vacuous. What is under test here is the wiring, not the SQL.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { gastronomySvc, experienceSvc, catalog } = vi.hoisted(() => ({
    gastronomySvc: { getBySlug: vi.fn() },
    experienceSvc: { getBySlug: vi.fn() },
    catalog: {
        fetchGastronomyAmenities: vi.fn(),
        fetchGastronomyFeatures: vi.fn(),
        fetchExperienceAmenities: vi.fn(),
        fetchExperienceFeatures: vi.fn()
    }
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        GastronomyService: vi.fn().mockImplementation(function () {
            return { getBySlug: (...args: unknown[]) => gastronomySvc.getBySlug(...args) };
        }),
        ExperienceService: vi.fn().mockImplementation(function () {
            return { getBySlug: (...args: unknown[]) => experienceSvc.getBySlug(...args) };
        })
    };
});

vi.mock('../../src/utils/commerce-catalog-relations', () => catalog);

import { initApp } from '../../src/app';
import type { AppOpenAPI } from '../../src/types';
import { validateApiEnv } from '../../src/utils/env';

const PUBLIC_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'vitest'
};

const ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DESTINATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const AMENITY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FEATURE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const AMENITY_ROW = { amenityId: AMENITY_ID, slug: 'accepts_cards', icon: 'credit-card' };
const FEATURE_ROW = {
    featureId: FEATURE_ID,
    slug: 'transport_included',
    icon: 'bus',
    hostReWriteName: 'Combi desde el hotel',
    comments: 'Salida 8:00'
};

const minimalGastronomy = {
    id: ENTITY_ID,
    slug: 'test-gastronomy',
    name: 'Test Parrilla',
    type: 'PARRILLA',
    summary: 'A test venue.',
    description: 'A detailed test description for this gastronomy listing.',
    destinationId: DESTINATION_ID,
    lifecycleState: 'ACTIVE',
    visibility: 'PUBLIC',
    averageRating: 4.5,
    reviewsCount: 0,
    isFeatured: false,
    media: null,
    seo: null,
    socialNetworks: null,
    nameI18n: null,
    summaryI18n: null,
    descriptionI18n: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdById: null,
    updatedById: null
};

const minimalExperience = {
    ...minimalGastronomy,
    slug: 'test-experience',
    name: 'Test Experience',
    type: 'TOUR_GUIDE',
    hasActiveSubscription: true,
    priceFrom: 1000,
    priceUnit: 'per_person',
    isPriceOnRequest: false
};

let app: AppOpenAPI;

/** Reads the `data` envelope of a public route response. */
const readData = async (res: Response): Promise<Record<string, unknown>> => {
    const body = (await res.json()) as { data: Record<string, unknown> };
    return body.data;
};

beforeEach(async () => {
    vi.clearAllMocks();
    catalog.fetchGastronomyAmenities.mockResolvedValue([]);
    catalog.fetchGastronomyFeatures.mockResolvedValue([]);
    catalog.fetchExperienceAmenities.mockResolvedValue([]);
    catalog.fetchExperienceFeatures.mockResolvedValue([]);
    validateApiEnv();
    app = await initApp();
});

describe('GET /public/gastronomies/slug/:slug — catalog exposure (HOS-1072)', () => {
    it('publishes the amenities the owner ticked', async () => {
        // Arrange
        gastronomySvc.getBySlug.mockResolvedValue({ data: minimalGastronomy });
        catalog.fetchGastronomyAmenities.mockResolvedValue([AMENITY_ROW]);

        // Act
        const res = await app.request('/api/v1/public/gastronomies/slug/test-gastronomy', {
            headers: PUBLIC_HEADERS
        });

        // Assert
        expect(res.status).toBe(200);
        expect((await readData(res)).amenities).toEqual([AMENITY_ROW]);
    });

    it('publishes the features, relabel and comment included', async () => {
        // Arrange
        gastronomySvc.getBySlug.mockResolvedValue({ data: minimalGastronomy });
        catalog.fetchGastronomyFeatures.mockResolvedValue([FEATURE_ROW]);

        // Act
        const res = await app.request('/api/v1/public/gastronomies/slug/test-gastronomy', {
            headers: PUBLIC_HEADERS
        });

        // Assert
        expect(res.status).toBe(200);
        expect((await readData(res)).features).toEqual([FEATURE_ROW]);
    });

    it('reads the catalog for the listing that was actually resolved', async () => {
        // Arrange
        gastronomySvc.getBySlug.mockResolvedValue({ data: minimalGastronomy });

        // Act
        await app.request('/api/v1/public/gastronomies/slug/test-gastronomy', {
            headers: PUBLIC_HEADERS
        });

        // Assert
        expect(catalog.fetchGastronomyAmenities).toHaveBeenCalledWith(ENTITY_ID);
        expect(catalog.fetchGastronomyFeatures).toHaveBeenCalledWith(ENTITY_ID);
    });

    it('omits both keys entirely when the listing has none', async () => {
        // Arrange
        gastronomySvc.getBySlug.mockResolvedValue({ data: minimalGastronomy });

        // Act
        const res = await app.request('/api/v1/public/gastronomies/slug/test-gastronomy', {
            headers: PUBLIC_HEADERS
        });

        // Assert
        const data = await readData(res);
        expect('amenities' in data).toBe(false);
        expect('features' in data).toBe(false);
    });

    it('does not touch the catalog when the slug resolves to nothing', async () => {
        // Arrange
        gastronomySvc.getBySlug.mockResolvedValue({ data: null });

        // Act
        const res = await app.request('/api/v1/public/gastronomies/slug/missing', {
            headers: PUBLIC_HEADERS
        });

        // Assert
        expect(res.status).toBe(200);
        expect(catalog.fetchGastronomyAmenities).not.toHaveBeenCalled();
    });
});

describe('GET /public/experiences/slug/:slug — catalog exposure (HOS-1072)', () => {
    it('publishes the "qué incluye" amenities the provider ticked', async () => {
        // Arrange
        experienceSvc.getBySlug.mockResolvedValue({ data: minimalExperience });
        catalog.fetchExperienceAmenities.mockResolvedValue([
            { amenityId: AMENITY_ID, slug: 'transport_included', icon: 'bus' }
        ]);

        // Act
        const res = await app.request('/api/v1/public/experiences/slug/test-experience', {
            headers: PUBLIC_HEADERS
        });

        // Assert
        expect(res.status).toBe(200);
        expect((await readData(res)).amenities).toEqual([
            { amenityId: AMENITY_ID, slug: 'transport_included', icon: 'bus' }
        ]);
    });

    it('publishes the features, relabel and comment included', async () => {
        // Arrange
        experienceSvc.getBySlug.mockResolvedValue({ data: minimalExperience });
        catalog.fetchExperienceFeatures.mockResolvedValue([FEATURE_ROW]);

        // Act
        const res = await app.request('/api/v1/public/experiences/slug/test-experience', {
            headers: PUBLIC_HEADERS
        });

        // Assert
        expect(res.status).toBe(200);
        expect((await readData(res)).features).toEqual([FEATURE_ROW]);
    });

    it('reads the catalog for the listing that was actually resolved', async () => {
        // Arrange
        experienceSvc.getBySlug.mockResolvedValue({ data: minimalExperience });

        // Act
        await app.request('/api/v1/public/experiences/slug/test-experience', {
            headers: PUBLIC_HEADERS
        });

        // Assert
        expect(catalog.fetchExperienceAmenities).toHaveBeenCalledWith(ENTITY_ID);
        expect(catalog.fetchExperienceFeatures).toHaveBeenCalledWith(ENTITY_ID);
    });

    it('does not touch the catalog when the slug resolves to nothing', async () => {
        // Arrange
        experienceSvc.getBySlug.mockResolvedValue({ data: null });

        // Act
        const res = await app.request('/api/v1/public/experiences/slug/missing', {
            headers: PUBLIC_HEADERS
        });

        // Assert
        expect(res.status).toBe(200);
        expect(catalog.fetchExperienceAmenities).not.toHaveBeenCalled();
    });
});
