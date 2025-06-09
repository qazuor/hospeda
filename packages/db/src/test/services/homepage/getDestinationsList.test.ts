import type { DestinationId, UserId } from '@repo/types/common/id.types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
import { getDestinationsListOutputSchema } from '../../../services/homepage/homepage.schemas';
import { homepageService } from '../../../services/homepage/homepage.service';

const destId1 = '11111111-1111-1111-1111-111111111111' as DestinationId;
const destId2 = '22222222-2222-2222-2222-222222222222' as DestinationId;
const userId = '99999999-9999-9999-9999-999999999999' as UserId;
const now = new Date();

const mockDestinations = [
    {
        id: destId1,
        slug: 'paris',
        name: 'Paris',
        summary: 'Summary Paris',
        description: 'Description Paris',
        location: { state: 'Ile-de-France', zipCode: '75000', country: 'France' },
        media: {
            featuredImage: {
                url: 'https://img.com/paris.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            },
            gallery: [],
            videos: []
        },
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        adminInfo: { favorite: false },
        createdAt: now,
        updatedAt: now,
        createdById: userId,
        updatedById: userId,
        reviewsCount: 10,
        averageRating: 4.5,
        seo: { title: 'Paris', description: 'Paris SEO', keywords: ['paris'] }
    },
    {
        id: destId2,
        slug: 'london',
        name: 'London',
        summary: 'Summary London',
        description: 'Description London',
        location: { state: 'England', zipCode: 'EC1A', country: 'UK' },
        media: {
            featuredImage: {
                url: undefined as unknown as string,
                moderationState: ModerationStatusEnum.APPROVED
            },
            gallery: [],
            videos: []
        },
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        adminInfo: { favorite: false },
        createdAt: now,
        updatedAt: now,
        createdById: userId,
        updatedById: userId,
        reviewsCount: 5,
        averageRating: 4.0,
        seo: { title: 'London', description: 'London SEO', keywords: ['london'] }
    }
];

describe('homepageService.getDestinationsList', () => {
    beforeAll(() => {
        vi.spyOn(DestinationModel, 'list').mockResolvedValue(mockDestinations);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should return a list of destinations with and without images', async () => {
        const input = { limit: 2 };
        const result = await homepageService.getDestinationsList(input);
        expect(result).toEqual(
            getDestinationsListOutputSchema.parse({
                destinations: [
                    {
                        id: destId1,
                        slug: 'paris',
                        name: 'Paris',
                        image: 'https://img.com/paris.jpg'
                    },
                    {
                        id: destId2,
                        slug: 'london',
                        name: 'London',
                        image: undefined
                    }
                ]
            })
        );
    });

    it('should return an empty array if there are no destinations', async () => {
        vi.spyOn(DestinationModel, 'list').mockResolvedValue([]);
        const input = { limit: 5 };
        const result = await homepageService.getDestinationsList(input);
        expect(result).toEqual(getDestinationsListOutputSchema.parse({ destinations: [] }));
    });

    it('should throw on invalid input: limit = 0', async () => {
        await expect(homepageService.getDestinationsList({ limit: 0 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit negative', async () => {
        await expect(homepageService.getDestinationsList({ limit: -3 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit not a number', async () => {
        // @ts-expect-error purposely wrong type
        await expect(homepageService.getDestinationsList({ limit: 'abc' })).rejects.toThrow();
    });
});
