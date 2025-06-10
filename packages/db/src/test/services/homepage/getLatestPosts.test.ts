import type {
    AccommodationId,
    DestinationId,
    EventId,
    EventLocationId,
    PostId,
    UserId
} from '@repo/types';
import {
    AccommodationTypeEnum,
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PostCategoryEnum,
    VisibilityEnum
} from '@repo/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../models/accommodation/accommodation.model';
import { DestinationModel } from '../../../models/destination/destination.model';
import { EventModel } from '../../../models/event/event.model';
import { PostModel } from '../../../models/post/post.model';
import { getLatestPostsOutputSchema } from '../../../services/homepage/homepage.schemas';
import { homepageService } from '../../../services/homepage/homepage.service';

const postId = '11111111-1111-1111-1111-111111111111' as PostId;
const accId = '22222222-2222-2222-2222-222222222222' as AccommodationId;
const eventId = '33333333-3333-3333-3333-333333333333' as EventId;
const destId = '44444444-4444-4444-4444-444444444444' as DestinationId;
const now = new Date();

const userId = '55555555-5555-5555-5555-555555555555' as UserId;
const destinationId = destId;
const eventLocationId = '66666666-6666-6666-6666-666666666666' as EventLocationId;

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
