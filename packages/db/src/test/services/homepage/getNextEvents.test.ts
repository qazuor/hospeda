import type { DestinationId, EventId, EventLocationId, UserId } from '@repo/types';
import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
import { EventModel } from '../../../models/event/event.model';
import { getNextEventsOutputSchema } from '../../../services/homepage/homepage.schemas';
import { homepageService } from '../../../services/homepage/homepage.service';

const eventId = '11111111-1111-1111-1111-111111111111' as EventId;
const destinationId = '22222222-2222-2222-2222-222222222222' as DestinationId;
const userId = '33333333-3333-3333-3333-333333333333' as UserId;
const now = new Date();
const futureDate = new Date(now.getTime() + 86400000); // +1 day
const eventLocationId = '44444444-4444-4444-4444-444444444444' as EventLocationId;

const mockEvent = {
    id: eventId,
    slug: 'event-1',
    summary: 'Event One',
    description: 'Event description',
    category: EventCategoryEnum.MUSIC,
    date: { start: futureDate, end: undefined },
    authorId: userId,
    locationId: eventLocationId,
    visibility: VisibilityEnum.PUBLIC,
    createdAt: now,
    updatedAt: now,
    createdById: userId,
    updatedById: userId,
    adminInfo: { favorite: false },
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    tags: [],
    seo: {},
    media: {
        featuredImage: {
            url: 'https://img.com/1.jpg',
            moderationState: ModerationStatusEnum.APPROVED,
            tags: []
        }
    }
};

const mockDestination = {
    id: destinationId,
    slug: 'dest-one',
    name: 'Destination One',
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
    adminInfo: { favorite: false },
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    reviewState: 'PUBLISHED',
    tags: [],
    seo: {},
    isFeatured: false
};

describe('homepageService.getNextEvents', () => {
    beforeAll(() => {
        vi.spyOn(EventModel, 'search').mockResolvedValue([mockEvent]);
        vi.spyOn(DestinationModel, 'getById').mockResolvedValue(mockDestination);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should return next events with destination', async () => {
        const input = { limit: 1 };
        const result = await homepageService.getNextEvents(input);
        expect(result).toEqual(
            getNextEventsOutputSchema.parse({
                events: [
                    {
                        id: mockEvent.id,
                        slug: mockEvent.slug,
                        name: mockEvent.summary,
                        summary: mockEvent.summary,
                        startDate: mockEvent.date.start.toISOString(),
                        endDate: undefined,
                        destination: mockDestination,
                        image: mockEvent.media.featuredImage.url
                    }
                ]
            })
        );
    });

    it('should return an empty array if there are no events', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue([]);
        const input = { limit: 5 };
        const result = await homepageService.getNextEvents(input);
        expect(result).toEqual(getNextEventsOutputSchema.parse({ events: [] }));
    });

    it('should filter out events without destination', async () => {
        const eventNoDest = { ...mockEvent, locationId: undefined };
        vi.spyOn(EventModel, 'search').mockResolvedValue([eventNoDest]);
        vi.spyOn(DestinationModel, 'getById').mockResolvedValue(undefined);
        const input = { limit: 1 };
        const result = await homepageService.getNextEvents(input);
        expect(result.events).toEqual([]);
    });

    it('should throw on invalid input: limit = 0', async () => {
        await expect(homepageService.getNextEvents({ limit: 0 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit negative', async () => {
        await expect(homepageService.getNextEvents({ limit: -5 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit not a number', async () => {
        // @ts-expect-error purposely wrong type
        await expect(homepageService.getNextEvents({ limit: 'abc' })).rejects.toThrow();
    });
});
