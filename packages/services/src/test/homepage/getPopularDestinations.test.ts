import { DestinationModel } from '@repo/db';
import type {
    AdminInfoType,
    AttractionId,
    AttractionType,
    BaseLocationType,
    DestinationAttractionType,
    DestinationId,
    DestinationType,
    ImageType,
    UserId
} from '@repo/types';
import { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getPopularDestinationsOutputSchema } from '../../homepage/homepage.schemas';
import { homepageService } from '../../homepage/homepage.service';

// Mock data
const mockAdminInfo: AdminInfoType = {
    favorite: false
};

const mockLocation: BaseLocationType = {
    state: 'Entre Ríos',
    zipCode: '3200',
    country: 'Argentina',
    coordinates: { lat: '0', long: '0' }
};

const mockImage: ImageType = {
    url: 'https://img.com/1.jpg',
    moderationState: ModerationStatusEnum.APPROVED
};

const mockAttraction: AttractionType = {
    id: '22222222-2222-2222-2222-222222222222' as AttractionId,
    name: 'Cascada Azul',
    slug: 'cascada-azul',
    description: 'A beautiful waterfall',
    icon: 'waterfall',
    isBuiltin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '33333333-3333-3333-3333-333333333333' as UserId,
    updatedById: '33333333-3333-3333-3333-333333333333' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: mockAdminInfo
};

const mockDestination: DestinationType & {
    attractions?: (DestinationAttractionType & { attraction?: AttractionType })[];
} = {
    id: '11111111-1111-1111-1111-111111111111' as DestinationId,
    slug: 'destino-popular',
    name: 'Destino Popular',
    summary: 'Un destino muy visitado',
    description: 'Descripción',
    location: mockLocation,
    media: {
        featuredImage: mockImage,
        gallery: [],
        videos: []
    },
    isFeatured: true,
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    reviewsCount: 10,
    averageRating: 4.8,
    accommodationsCount: 5,
    seo: {},
    adminInfo: mockAdminInfo,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '33333333-3333-3333-3333-333333333333' as UserId,
    updatedById: '33333333-3333-3333-3333-333333333333' as UserId,
    deletedAt: undefined,
    deletedById: undefined,
    moderationState: ModerationStatusEnum.APPROVED,
    attractions: [
        {
            destinationId: '11111111-1111-1111-1111-111111111111' as DestinationId,
            attractionId: '22222222-2222-2222-2222-222222222222' as AttractionId,
            attraction: mockAttraction
        }
    ]
};

describe('homepageService.getPopularDestinations', () => {
    beforeAll(() => {
        vi.spyOn(DestinationModel, 'list').mockResolvedValue([mockDestination]);
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should return popular destinations with mapped attractions and image', async () => {
        // Arrange
        const input = { limit: 1 };

        // Act
        const result = await homepageService.getPopularDestinations(input);

        // Assert
        expect(result).toEqual(
            getPopularDestinationsOutputSchema.parse({
                destinations: [
                    {
                        id: mockDestination.id,
                        slug: mockDestination.slug,
                        name: mockDestination.name,
                        summary: mockDestination.summary,
                        reviewsCount: mockDestination.reviewsCount,
                        averageRating: mockDestination.averageRating,
                        image: mockDestination.media.featuredImage.url,
                        accommodationsCount: mockDestination.accommodationsCount,
                        attractions: [
                            {
                                id: mockAttraction.id,
                                name: mockAttraction.name,
                                slug: mockAttraction.slug,
                                description: mockAttraction.description,
                                icon: mockAttraction.icon
                            }
                        ]
                    }
                ]
            })
        );
    });

    it('should return an empty array if there are no popular destinations', async () => {
        vi.spyOn(DestinationModel, 'list').mockResolvedValue([]);
        const input = { limit: 5 };
        const result = await homepageService.getPopularDestinations(input);
        expect(result).toEqual(getPopularDestinationsOutputSchema.parse({ destinations: [] }));
    });

    it('should return a destination with empty attractions if it has none', async () => {
        const destNoAttractions = { ...mockDestination, attractions: [] };
        vi.spyOn(DestinationModel, 'list').mockResolvedValue([destNoAttractions]);
        const input = { limit: 1 };
        const result = await homepageService.getPopularDestinations(input);
        expect(result.destinations[0]?.attractions ?? []).toEqual([]);
    });

    it('should return a destination with image undefined if no featuredImage is present', async () => {
        const destNoImage = {
            ...mockDestination,
            media: {
                ...mockDestination.media,
                featuredImage: { url: '', moderationState: ModerationStatusEnum.APPROVED }
            }
        };
        vi.spyOn(DestinationModel, 'list').mockResolvedValue([destNoImage]);
        const input = { limit: 1 };
        const result = await homepageService.getPopularDestinations(input);
        expect(result.destinations[0]?.image).toBeUndefined();
    });

    it('should throw on invalid input: limit = 0', async () => {
        await expect(homepageService.getPopularDestinations({ limit: 0 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit negative', async () => {
        await expect(homepageService.getPopularDestinations({ limit: -5 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit not a number', async () => {
        // @ts-expect-error purposely wrong type
        await expect(homepageService.getPopularDestinations({ limit: 'abc' })).rejects.toThrow();
    });

    it('should not include attractions without embedded data', async () => {
        const destWithEmptyAttraction = {
            ...mockDestination,
            attractions: [
                {
                    destinationId: mockDestination.id,
                    attractionId: '33333333-3333-3333-3333-333333333333' as AttractionId
                    // no attraction field
                }
            ]
        };
        vi.spyOn(DestinationModel, 'list').mockResolvedValue([destWithEmptyAttraction]);
        const input = { limit: 1 };
        const result = await homepageService.getPopularDestinations(input);
        expect(result.destinations[0]?.attractions ?? []).toEqual([]);
    });

    it('should return image undefined if featuredImage exists but has no url', async () => {
        const destNoImageUrl = {
            ...mockDestination,
            media: {
                ...mockDestination.media,
                featuredImage: { url: '', moderationState: ModerationStatusEnum.APPROVED }
            }
        };
        vi.spyOn(DestinationModel, 'list').mockResolvedValue([destNoImageUrl]);
        const input = { limit: 1 };
        const result = await homepageService.getPopularDestinations(input);
        expect(result.destinations[0]?.image).toBeUndefined();
    });

    it('should not break if optional fields are missing', async () => {
        const destMinimal = {
            ...mockDestination,
            reviewsCount: 0,
            averageRating: 0,
            accommodationsCount: 0,
            summary: '',
            attractions: undefined
        };
        vi.spyOn(DestinationModel, 'list').mockResolvedValue([destMinimal]);
        const input = { limit: 1 };
        const result = await homepageService.getPopularDestinations(input);
        expect(result.destinations[0]).toMatchObject({
            id: mockDestination.id,
            slug: mockDestination.slug,
            name: mockDestination.name
        });
    });
});
