import { AccommodationModel } from '@repo/db';
import type { AccommodationId, AmenityId, DestinationId, FeatureId } from '@repo/types';
import { type AccommodationType, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mocked, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../accommodation/accommodation.service';
import {
    getMockAccommodation,
    getMockAccommodationId,
    getMockDestinationId,
    getMockPublicUser,
    getMockUser
} from '../mockData';

vi.mock('@repo/db');

const mockAdmin = getMockUser({ role: RoleEnum.ADMIN });
const mockPublic = getMockPublicUser();

const acc1: AccommodationType = getMockAccommodation({
    id: getMockAccommodationId(),
    name: 'Hotel Search',
    summary: 'Best summary',
    description: 'Nice place',
    destinationId: getMockDestinationId(),
    price: { price: 100 },
    isFeatured: true,
    amenities: [
        {
            amenityId: 'a1' as AmenityId,
            accommodationId: getMockAccommodationId(),
            isOptional: false
        }
    ],
    features: [{ featureId: 'f1' as FeatureId, accommodationId: getMockAccommodationId() }],
    visibility: VisibilityEnum.PUBLIC,
    averageRating: 4.5
});
const acc2: AccommodationType = getMockAccommodation({
    id: 'acc-2' as AccommodationId,
    name: 'Cabin',
    summary: 'Cozy',
    description: 'Mountain',
    destinationId: 'dest-2' as DestinationId,
    price: { price: 200 },
    isFeatured: false,
    amenities: [
        {
            amenityId: 'a2' as AmenityId,
            accommodationId: 'acc-2' as AccommodationId,
            isOptional: false
        }
    ],
    features: [{ featureId: 'f2' as FeatureId, accommodationId: 'acc-2' as AccommodationId }],
    visibility: VisibilityEnum.PRIVATE,
    averageRating: 3.5
});
const accNoPrice: AccommodationType = getMockAccommodation({
    id: 'acc-3' as AccommodationId,
    price: undefined
});
const acc3: AccommodationType = getMockAccommodation({
    id: 'acc-3' as AccommodationId,
    name: 'Eco Lodge',
    summary: 'Nature and peace',
    description: 'A beautiful eco lodge in the forest',
    destinationId: getMockDestinationId(),
    price: { price: 300 },
    isFeatured: false,
    amenities: [
        {
            amenityId: 'a3' as AmenityId,
            accommodationId: 'acc-3' as AccommodationId,
            isOptional: true
        }
    ],
    features: [{ featureId: 'f3' as FeatureId, accommodationId: 'acc-3' as AccommodationId }],
    visibility: VisibilityEnum.PUBLIC,
    averageRating: 4.9
});
const acc4: AccommodationType = getMockAccommodation({
    id: 'acc-4' as AccommodationId,
    name: 'Urban Flat',
    summary: 'City center',
    description: 'Modern flat in the heart of the city',
    destinationId: 'dest-3' as DestinationId,
    price: { price: 150 },
    isFeatured: true,
    amenities: [
        {
            amenityId: 'a4' as AmenityId,
            accommodationId: 'acc-4' as AccommodationId,
            isOptional: false
        }
    ],
    features: [{ featureId: 'f4' as FeatureId, accommodationId: 'acc-4' as AccommodationId }],
    visibility: VisibilityEnum.PUBLIC,
    averageRating: 2.8
});
const acc5: AccommodationType = getMockAccommodation({
    id: 'acc-5' as AccommodationId,
    name: 'Beach House',
    summary: 'Sea breeze',
    description: 'House with direct access to the beach',
    destinationId: 'dest-2' as DestinationId,
    price: undefined,
    isFeatured: false,
    amenities: [
        {
            amenityId: 'a5' as AmenityId,
            accommodationId: 'acc-5' as AccommodationId,
            isOptional: false
        }
    ],
    features: [{ featureId: 'f5' as FeatureId, accommodationId: 'acc-5' as AccommodationId }],
    visibility: VisibilityEnum.PRIVATE,
    averageRating: 3.2
});
const acc6: AccommodationType = getMockAccommodation({
    id: 'acc-6' as AccommodationId,
    name: 'Mountain Cabin',
    summary: 'Cozy and warm',
    description: 'Cabin with fireplace and mountain view',
    destinationId: 'dest-4' as DestinationId,
    price: { price: 80 },
    isFeatured: true,
    amenities: [
        {
            amenityId: 'a6' as AmenityId,
            accommodationId: 'acc-6' as AccommodationId,
            isOptional: false
        }
    ],
    features: [{ featureId: 'f6' as FeatureId, accommodationId: 'acc-6' as AccommodationId }],
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
            acc2,
            acc3,
            acc4,
            acc5,
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
