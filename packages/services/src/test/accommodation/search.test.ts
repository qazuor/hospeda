import { AccommodationModel } from '@repo/db';
import { type AccommodationType, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mocked, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../accommodation/accommodation.service';
import { createMockAccommodation, getMockAccommodationId } from '../factories/accommodationFactory';
import { getMockAmenityId } from '../factories/amenityFactory';
import { getMockDestinationId } from '../factories/destinationFactory';
import { getMockFeatureId } from '../factories/featureFactory';
import { createMockUser } from '../factories/userFactory';

const mockAdmin = createMockUser({ role: RoleEnum.ADMIN });
const mockPublic = createMockUser({ role: 'GUEST' });

const acc1: AccommodationType = createMockAccommodation({
    id: getMockAccommodationId(),
    name: 'Hotel Search',
    summary: 'Best summary',
    description: 'Nice place',
    destinationId: getMockDestinationId(),
    price: { price: 100 },
    isFeatured: true,
    amenities: [
        {
            amenityId: getMockAmenityId('a1'),
            accommodationId: getMockAccommodationId(),
            isOptional: false
        }
    ],
    features: [{ featureId: getMockFeatureId('f1'), accommodationId: getMockAccommodationId() }],
    visibility: VisibilityEnum.PUBLIC,
    averageRating: 4.5
});
const acc2: AccommodationType = createMockAccommodation({
    id: getMockAccommodationId('acc-2'),
    name: 'Cabin',
    summary: 'Cozy',
    description: 'Mountain',
    destinationId: getMockDestinationId('dest-2'),
    price: { price: 200 },
    isFeatured: false,
    amenities: [
        {
            amenityId: getMockAmenityId('a2'),
            accommodationId: getMockAccommodationId('acc-2'),
            isOptional: false
        }
    ],
    features: [
        { featureId: getMockFeatureId('f2'), accommodationId: getMockAccommodationId('acc-2') }
    ],
    visibility: VisibilityEnum.PRIVATE,
    averageRating: 3.5
});
const accNoPrice: AccommodationType = createMockAccommodation({
    id: getMockAccommodationId('acc-3'),
    price: undefined
});
const acc3: AccommodationType = createMockAccommodation({
    id: getMockAccommodationId('acc-3'),
    name: 'Eco Lodge',
    summary: 'Nature and peace',
    description: 'A beautiful eco lodge in the forest',
    destinationId: getMockDestinationId(),
    price: { price: 300 },
    isFeatured: false,
    amenities: [
        {
            amenityId: getMockAmenityId('a3'),
            accommodationId: getMockAccommodationId('acc-3'),
            isOptional: true
        }
    ],
    features: [
        { featureId: getMockFeatureId('f3'), accommodationId: getMockAccommodationId('acc-3') }
    ],
    visibility: VisibilityEnum.PUBLIC,
    averageRating: 4.9
});
const acc4: AccommodationType = createMockAccommodation({
    id: getMockAccommodationId('acc-4'),
    name: 'Urban Flat',
    summary: 'City center',
    description: 'Modern flat in the heart of the city',
    destinationId: getMockDestinationId('dest-3'),
    price: { price: 150 },
    isFeatured: true,
    amenities: [
        {
            amenityId: getMockAmenityId('a4'),
            accommodationId: getMockAccommodationId('acc-4'),
            isOptional: false
        }
    ],
    features: [
        { featureId: getMockFeatureId('f4'), accommodationId: getMockAccommodationId('acc-4') }
    ],
    visibility: VisibilityEnum.PUBLIC,
    averageRating: 2.8
});
const acc5: AccommodationType = createMockAccommodation({
    id: getMockAccommodationId('acc-5'),
    name: 'Beach House',
    summary: 'Sea breeze',
    description: 'House with direct access to the beach',
    destinationId: getMockDestinationId('dest-2'),
    price: undefined,
    isFeatured: false,
    amenities: [
        {
            amenityId: getMockAmenityId('a5'),
            accommodationId: getMockAccommodationId('acc-5'),
            isOptional: false
        }
    ],
    features: [
        { featureId: getMockFeatureId('f5'), accommodationId: getMockAccommodationId('acc-5') }
    ],
    visibility: VisibilityEnum.PRIVATE,
    averageRating: 3.2
});
const acc6: AccommodationType = createMockAccommodation({
    id: getMockAccommodationId('acc-6'),
    name: 'Mountain Cabin',
    summary: 'Cozy and warm',
    description: 'Cabin with fireplace and mountain view',
    destinationId: getMockDestinationId('dest-4'),
    price: { price: 80 },
    isFeatured: true,
    amenities: [
        {
            amenityId: getMockAmenityId('a6'),
            accommodationId: getMockAccommodationId('acc-6'),
            isOptional: false
        }
    ],
    features: [
        { featureId: getMockFeatureId('f6'), accommodationId: getMockAccommodationId('acc-6') }
    ],
    visibility: VisibilityEnum.PUBLIC,
    averageRating: 4.0
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('AccommodationService.search', () => {
    it('should find by text in name, summary, or description', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([
            acc1,
            acc2,
            acc3,
            acc4,
            acc5,
            acc6
        ]);
        const result = await AccommodationService.search(
            { text: 'Hotel', limit: 10, offset: 0 },
            mockAdmin
        );
        expect(result.accommodations.some((a: AccommodationType) => a.name.includes('Hotel'))).toBe(
            true
        );
        const result2 = await AccommodationService.search(
            { text: 'summary', limit: 10, offset: 0 },
            mockAdmin
        );
        expect(
            result2.accommodations.some((a: AccommodationType) => a.summary.includes('summary'))
        ).toBe(true);
        const result3 = await AccommodationService.search(
            { text: 'place', limit: 10, offset: 0 },
            mockAdmin
        );
        expect(
            result3.accommodations.some((a: AccommodationType) => a.description.includes('place'))
        ).toBe(true);
    });
    it('should filter by destinationId', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([acc1]);
        const result = await AccommodationService.search(
            { destinationId: getMockDestinationId(), limit: 10, offset: 0 },
            mockAdmin
        );
        expect(
            result.accommodations.every(
                (a: AccommodationType) => a.destinationId === getMockDestinationId()
            )
        ).toBe(true);
    });
    it('should filter by minPrice, maxPrice, includeWithoutPrice', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([
            acc1,
            acc2,
            accNoPrice,
            acc3,
            acc4,
            acc5,
            acc6
        ]);
        const min = await AccommodationService.search(
            { minPrice: 150, limit: 10, offset: 0 },
            mockAdmin
        );
        expect(
            min.accommodations.every((a: AccommodationType) =>
                a.price?.price ? a.price.price >= 150 : false
            )
        ).toBe(true);
        const max = await AccommodationService.search(
            { maxPrice: 150, limit: 10, offset: 0 },
            mockAdmin
        );
        expect(
            max.accommodations.every((a: AccommodationType) =>
                a.price?.price ? a.price.price <= 150 : false
            )
        ).toBe(true);
        const withNoPrice = await AccommodationService.search(
            { includeWithoutPrice: true, limit: 10, offset: 0 },
            mockAdmin
        );
        expect(
            withNoPrice.accommodations.some(
                (a: AccommodationType) => !a.price || a.price.price === undefined
            )
        ).toBe(true);
    });
    it('should filter by amenities and features', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([
            acc1,
            acc2,
            acc3,
            acc4,
            acc5,
            acc6
        ]);
        const result = await AccommodationService.search(
            { amenities: ['a1'], features: ['f1'], limit: 10, offset: 0 },
            mockAdmin
        );
        expect(
            result.accommodations.every((a: AccommodationType) =>
                a.amenities?.some((am: { amenityId: string }) => am.amenityId === 'a1')
            )
        ).toBe(true);
        expect(
            result.accommodations.every((a: AccommodationType) =>
                a.features?.some((f: { featureId: string }) => f.featureId === 'f1')
            )
        ).toBe(true);
    });
    it('should only show public for public user', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([
            acc1,
            acc3,
            acc4,
            acc6
        ]);
        const result = await AccommodationService.search({ limit: 10, offset: 0 }, mockPublic);
        expect(
            result.accommodations.every(
                (a: AccommodationType) => a.visibility === VisibilityEnum.PUBLIC
            )
        ).toBe(true);
    });
    it('should show all for admin', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([
            acc1,
            acc2,
            acc3,
            acc4,
            acc5,
            acc6
        ]);
        const result = await AccommodationService.search({ limit: 10, offset: 0 }, mockAdmin);
        expect(result.accommodations.length).toBe(6);
    });
    it('should order by price asc', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([
            acc1,
            acc2,
            acc3,
            acc4,
            acc5,
            acc6
        ]);
        const result = await AccommodationService.search(
            { orderBy: ['price'], limit: 10, offset: 0 },
            mockAdmin
        );
        expect(result.accommodations.length).toBeGreaterThanOrEqual(6);
        expect(result.accommodations[0]?.price?.price ?? 0).toBeLessThanOrEqual(
            result.accommodations[1]?.price?.price ?? Number.POSITIVE_INFINITY
        );
    });
    it('should order by rating desc', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([
            acc1,
            acc2,
            acc3,
            acc4,
            acc5,
            acc6
        ]);
        const result = await AccommodationService.search(
            { orderBy: ['rating'], limit: 10, offset: 0 },
            mockAdmin
        );
        expect(result.accommodations.length).toBeGreaterThanOrEqual(6);
        expect(result.accommodations[0]?.averageRating ?? 0).toBeGreaterThanOrEqual(
            result.accommodations[1]?.averageRating ?? 0
        );
    });
    it('should order isFeatured first', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([
            acc1,
            acc2,
            acc3,
            acc4,
            acc5,
            acc6
        ]);
        const result = await AccommodationService.search(
            { orderBy: ['price'], limit: 10, offset: 0 },
            mockAdmin
        );
        expect(result.accommodations.length).toBeGreaterThanOrEqual(1);
        expect(result.accommodations[0]?.isFeatured ?? false).toBe(true);
    });
    it('should return empty if no results', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([]);
        const result = await AccommodationService.search(
            { text: 'nope', limit: 10, offset: 0 },
            mockAdmin
        );
        expect(result.accommodations).toEqual([]);
    });
    it('should return all if no filters', async () => {
        (AccommodationModel as Mocked<typeof AccommodationModel>).search.mockResolvedValue([
            acc1,
            acc2,
            acc3,
            acc4,
            acc5,
            acc6
        ]);
        const result = await AccommodationService.search({ limit: 10, offset: 0 }, mockAdmin);
        expect(result.accommodations.length).toBe(6);
    });
});
