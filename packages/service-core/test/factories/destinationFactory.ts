/**
 * destinationFactory.ts
 *
 * Factory functions for generating Destination mock data for tests.
 * All mock data for DestinationService tests should be created here.
 */
import type { DestinationId, DestinationType, ImageType, UserId } from '@repo/types';
import { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/types';
import { BaseFactoryBuilder } from './baseEntityFactory';
import { getMockId } from './utilsFactory';

const baseDestination: DestinationType = {
    id: getMockId('destination') as DestinationId,
    slug: 'villa-elisa',
    name: 'Villa Elisa',
    summary: 'A beautiful destination.',
    description: 'A detailed description of Villa Elisa.',
    location: {
        state: 'Entre Ríos',
        zipCode: '3265',
        country: 'AR',
        coordinates: { lat: '-30.9500', long: '-57.9333' }
    },
    media: {
        featuredImage: {
            url: 'https://example.com/featured.jpg',
            caption: 'Main view',
            description: 'A beautiful featured image',
            moderationState: ModerationStatusEnum.APPROVED,
            tags: []
        } as ImageType,
        gallery: [],
        videos: []
    },
    isFeatured: false,
    visibility: VisibilityEnum.PUBLIC,
    accommodationsCount: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user') as UserId,
    updatedById: getMockId('user', 'updater') as UserId,
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: { favorite: false },
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    tags: [],
    seo: { title: '', description: '', keywords: [] },
    reviewsCount: 10,
    rating: undefined,
    attractions: [],
    reviews: []
};

export class DestinationFactoryBuilder extends BaseFactoryBuilder<DestinationType> {
    constructor() {
        super(baseDestination);
    }
    public public() {
        return this.with({ visibility: VisibilityEnum.PUBLIC });
    }
    public draft() {
        return this.with({ visibility: VisibilityEnum.PRIVATE });
    }
    public featured() {
        return this.with({ isFeatured: true });
    }
    public withLocation(location: DestinationType['location']) {
        return this.with({ location });
    }
    public withMedia(media: DestinationType['media']) {
        return this.with({ media });
    }
    public withAccommodationsCount(count: number) {
        return this.with({ accommodationsCount: count });
    }
    public withReviewsCount(count: number) {
        return this.with({ reviewsCount: count });
    }
    public withAverageRating(rating: number) {
        return this.with({ averageRating: rating });
    }
}

export const createDestination = (overrides: Partial<DestinationType> = {}): DestinationType =>
    new DestinationFactoryBuilder().with(overrides).build();
