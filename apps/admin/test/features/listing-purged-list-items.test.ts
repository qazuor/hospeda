/**
 * HOS-1748: the admin client re-validates every list response with the
 * config's `listItemSchema`. A PURGED listing keeps its row with blank
 * `summary` / `description`; it must reach the grid instead of emptying the
 * whole page with `API response validation failed`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEntityApi } from '@/components/entity-list/api/createEntityApi';
import { accommodationsConfig } from '@/features/accommodations/config/accommodations.config';
import { meAccommodationsConfig } from '@/features/accommodations/config/me-accommodations.config';
import { experienceListConfig } from '@/features/experience/config/experience.config';
import { gastronomyListConfig } from '@/features/gastronomy/config/gastronomy.config';
import { fetchApi } from '@/lib/api/client';
import { mockAccommodation } from '../fixtures/accommodation.fixture';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const UUID_A = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const UUID_B = '0b6f1d0e-53a1-4f0e-9b57-6a1c2d3e4f50';
const UUID_C = '6d1c9a52-3f4b-4e8e-8a47-1b2c3d4e5f60';
const ISO = '2026-01-01T00:00:00.000Z';

const BLANKED = {
    summary: '',
    description: '',
    publicationStatus: 'PURGED',
    richDescription: null,
    contactInfo: null,
    socialNetworks: null,
    videos: null,
    seo: null
} as const;

const commonRow = {
    name: 'Listing',
    slug: 'listing',
    destinationId: UUID_B,
    ownerId: UUID_C,
    isFeatured: false,
    reviewsCount: 0,
    averageRating: 0,
    createdAt: ISO,
    updatedAt: ISO,
    createdById: null,
    updatedById: null
};

const gastronomyNormal = {
    ...commonRow,
    id: UUID_A,
    summary: 'A summary that is long enough',
    description: 'A description that is long enough to publish this listing.',
    type: 'PARRILLA',
    publicationStatus: 'PUBLISHED'
};

const experienceNormal = {
    ...commonRow,
    id: UUID_A,
    summary: 'A summary that is long enough',
    description: 'A description that is long enough to publish this listing.',
    type: 'EXCURSION',
    priceFrom: 1000,
    priceUnit: 'per_person',
    isPriceOnRequest: false,
    publicationStatus: 'PUBLISHED'
};

const accommodationNormal = {
    ...mockAccommodation,
    id: UUID_A,
    destinationId: UUID_B,
    ownerId: UUID_C
};

const cases = [
    {
        name: 'accommodationsConfig',
        schema: accommodationsConfig.listItemSchema,
        endpoint: '/api/v1/admin/accommodations',
        normal: accommodationNormal,
        purged: {
            ...accommodationNormal,
            ...BLANKED,
            id: UUID_B,
            price: null,
            location: null
        }
    },
    {
        name: 'meAccommodationsConfig',
        schema: meAccommodationsConfig.listItemSchema,
        endpoint: '/api/v1/protected/accommodations',
        normal: accommodationNormal,
        purged: {
            ...accommodationNormal,
            ...BLANKED,
            id: UUID_B,
            price: null,
            location: null
        }
    },
    {
        name: 'gastronomyListConfig',
        schema: gastronomyListConfig.listItemSchema,
        endpoint: '/api/v1/admin/gastronomies',
        normal: gastronomyNormal,
        purged: {
            ...gastronomyNormal,
            ...BLANKED,
            id: UUID_B,
            menuUrl: null,
            openingHours: null,
            priceRange: null
        }
    },
    {
        name: 'experienceListConfig',
        schema: experienceListConfig.listItemSchema,
        endpoint: '/api/v1/admin/experiences',
        normal: experienceNormal,
        purged: {
            ...experienceNormal,
            ...BLANKED,
            id: UUID_B,
            priceFrom: 0,
            priceUnit: null,
            isPriceOnRequest: true,
            openingHours: null
        }
    }
] as const;

const pagination = {
    page: 1,
    pageSize: 20,
    total: 2,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
};

describe('TEST:1748:3 admin list clients keep PURGED rows', () => {
    beforeEach(() => {
        vi.mocked(fetchApi).mockReset();
    });

    it.each(cases)('$name resolves a page that holds a PURGED row', async (c) => {
        // Arrange
        vi.mocked(fetchApi).mockResolvedValue({
            data: { success: true, data: { items: [c.purged, c.normal], pagination } },
            status: 200
        } as never);
        const api = createEntityApi({
            endpoint: c.endpoint,
            itemSchema: c.schema as never
        });

        // Act
        const result = await api.getEntities({ page: 1, pageSize: 20 });

        // Assert
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toMatchObject({ summary: '', publicationStatus: 'PURGED' });
        expect(result.data[1]).toMatchObject({ id: UUID_A });
    });
});
