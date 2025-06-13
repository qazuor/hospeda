import { AccommodationModel, DestinationModel, EventModel, PostModel } from '@repo/db';
import {
    AccommodationTypeEnum,
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PostCategoryEnum,
    VisibilityEnum
} from '@repo/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getLatestPostsOutputSchema } from '../../homepage/homepage.schemas';
import { homepageService } from '../../homepage/homepage.service';
import { getMockEventLocationId } from '../factories';
import { getMockAccommodationId } from '../factories/accommodationFactory';
import { getMockDestinationId } from '../factories/destinationFactory';
import { getMockEventId } from '../factories/eventFactory';
import { getMockPostId } from '../factories/postFactory';
import { getMockUserId } from '../factories/userFactory';

const postId = getMockPostId();
const accId = getMockAccommodationId();
const eventId = getMockEventId();
const destId = getMockDestinationId();
const now = new Date();

const userId = getMockUserId();
const destinationId = destId;
const eventLocationId = getMockEventLocationId();

const mockPost = {
    id: postId,
    slug: 'post-1',
    category: PostCategoryEnum.GENERAL,
    title: 'Post One',
    summary: 'Summary',
    content: 'Content',
    media: {
        featuredImage: {
            url: 'https://img.com/1.jpg',
            moderationState: ModerationStatusEnum.APPROVED,
            tags: []
        }
    },
    authorId: userId,
    visibility: VisibilityEnum.PUBLIC,
    createdAt: now,
    updatedAt: now,
    createdById: userId,
    updatedById: userId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    tags: [],
    seo: {},
    adminInfo: { favorite: false },
    relatedAccommodationId: accId,
    relatedEventId: eventId,
    relatedDestinationId: destId
};

const mockAcc = {
    id: accId,
    slug: 'acc-1',
    name: 'Acc One',
    summary: 'Summary',
    type: AccommodationTypeEnum.HOTEL,
    description: 'Description',
    ownerId: userId,
    destinationId: destinationId,
    visibility: VisibilityEnum.PUBLIC,
    createdAt: now,
    updatedAt: now,
    createdById: userId,
    updatedById: userId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    tags: [],
    seo: {},
    adminInfo: { favorite: false }
};

const mockEvent = {
    id: eventId,
    slug: 'event-1',
    summary: 'Event One',
    category: EventCategoryEnum.MUSIC,
    date: { start: now, end: undefined },
    authorId: userId,
    locationId: eventLocationId,
    visibility: VisibilityEnum.PUBLIC,
    createdAt: now,
    updatedAt: now,
    createdById: userId,
    updatedById: userId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    tags: [],
    seo: {},
    adminInfo: { favorite: false }
};

const mockDest = {
    id: destId,
    slug: 'dest-1',
    name: 'Dest One',
    summary: 'Summary',
    description: 'Description',
    location: { state: 'State', zipCode: '1234', country: 'Country' },
    media: {
        featuredImage: {
            url: 'https://img.com/1.jpg',
            moderationState: ModerationStatusEnum.APPROVED,
            tags: []
        }
    },
    visibility: VisibilityEnum.PUBLIC,
    createdAt: now,
    updatedAt: now,
    createdById: userId,
    updatedById: userId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    reviewState: 'PUBLISHED',
    tags: [],
    seo: {},
    adminInfo: { favorite: false }
};

describe('homepageService.getLatestPosts', () => {
    beforeAll(() => {
        vi.spyOn(PostModel, 'list').mockResolvedValue([mockPost]);
        vi.spyOn(AccommodationModel, 'getById').mockResolvedValue(mockAcc);
        vi.spyOn(EventModel, 'getById').mockResolvedValue(mockEvent);
        vi.spyOn(DestinationModel, 'getById').mockResolvedValue(mockDest);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should return latest posts with related entities', async () => {
        const input = { limit: 1 };
        const result = await homepageService.getLatestPosts(input);
        expect(result).toEqual(
            getLatestPostsOutputSchema.parse({
                posts: [
                    {
                        id: mockPost.id,
                        slug: mockPost.slug,
                        title: mockPost.title,
                        summary: mockPost.summary,
                        createdAt: mockPost.createdAt.toISOString(),
                        image: mockPost.media.featuredImage.url,
                        relatedAccommodation: mockAcc,
                        relatedEvent: {
                            id: mockEvent.id,
                            slug: mockEvent.slug,
                            name: mockEvent.summary
                        },
                        relatedDestination: mockDest
                    }
                ]
            })
        );
    });

    it('should return posts without related entities if no IDs', async () => {
        const postNoRelations = {
            ...mockPost,
            relatedAccommodationId: undefined,
            relatedEventId: undefined,
            relatedDestinationId: undefined
        };
        vi.spyOn(PostModel, 'list').mockResolvedValue([postNoRelations]);
        const input = { limit: 1 };
        const result = await homepageService.getLatestPosts(input);
        expect(result.posts[0]?.relatedAccommodation).toBeUndefined();
        expect(result.posts[0]?.relatedEvent).toBeUndefined();
        expect(result.posts[0]?.relatedDestination).toBeUndefined();
    });

    it('should return an empty array if there are no posts', async () => {
        vi.spyOn(PostModel, 'list').mockResolvedValue([]);
        const input = { limit: 5 };
        const result = await homepageService.getLatestPosts(input);
        expect(result).toEqual(getLatestPostsOutputSchema.parse({ posts: [] }));
    });

    it('should throw on invalid input: limit = 0', async () => {
        await expect(homepageService.getLatestPosts({ limit: 0 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit negative', async () => {
        await expect(homepageService.getLatestPosts({ limit: -5 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit not a number', async () => {
        // @ts-expect-error purposely wrong type
        await expect(homepageService.getLatestPosts({ limit: 'abc' })).rejects.toThrow();
    });
});
