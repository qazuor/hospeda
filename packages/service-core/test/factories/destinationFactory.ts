/**
 * destinationFactory.ts
 *
 * Factory functions for generating Destination mock data for tests.
 * All mock data for DestinationService tests should be created here.
 */
import type {
    AttractionId,
    DestinationId,
    DestinationReviewId,
    DestinationType,
    FullLocationType,
    ImageType,
    UserId
} from '@repo/types';
import { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/types';
import { BaseFactoryBuilder } from './baseEntityFactory';
import { getMockId } from './utilsFactory';

type StrictDestinationType = Omit<
    DestinationType,
    'location' | 'reviewsCount' | 'averageRating' | 'attractions' | 'reviews'
> & {
    location: FullLocationType;
    reviewsCount: number;
    averageRating: number;
    attractions: {
        id: AttractionId;
        attractionId: AttractionId;
        name: string;
        slug: string;
        icon: string;
        description: string;
        destinationId: DestinationId;
        adminInfo?: { favorite: boolean; notes?: string };
    }[];
    reviews: {
        id: DestinationReviewId;
        userId: UserId;
        destinationId: DestinationId;
        createdAt: Date;
        updatedAt: Date;
        createdById: UserId;
        updatedById: UserId;
        lifecycleState: LifecycleStatusEnum;
        adminInfo?: { favorite: boolean; notes?: string };
        rating: {
            landscape: number;
            attractions: number;
            accessibility: number;
            safety: number;
            cleanliness: number;
            hospitality: number;
            culturalOffer: number;
            gastronomy: number;
            affordability: number;
            nightlife: number;
            infrastructure: number;
            environmentalCare: number;
            wifiAvailability: number;
            shopping: number;
            beaches: number;
            greenSpaces: number;
            localEvents: number;
            weatherSatisfaction: number;
        };
        title?: string;
        content?: string;
    }[];
};

const baseDestination: StrictDestinationType = {
    id: getMockId('destination') as DestinationId,
    slug: 'villa-elisa',
    name: 'Villa Elisa',
    summary: 'A beautiful destination.',
    description: 'A detailed description of Villa Elisa.',
    location: {
        state: 'Entre Ríos',
        zipCode: '3265',
        country: 'AR',
        coordinates: { lat: '-30.9500', long: '-57.9333' },
        street: 'Calle Principal',
        number: '123',
        city: 'Villa Elisa'
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
    seo: {
        title: 'A valid SEO title for destination with enough length',
        description:
            'A valid SEO description for destination with enough length to pass the minimum required by Zod schema for description field.',
        keywords: ['travel', 'destination']
    },
    reviewsCount: 0,
    averageRating: 0,
    rating: undefined,
    attractions: [],
    reviews: []
};

export class DestinationFactoryBuilder extends BaseFactoryBuilder<StrictDestinationType> {
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
    public withLocation(location: FullLocationType) {
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

export const createDestination = (
    overrides: Partial<StrictDestinationType> = {}
): StrictDestinationType => {
    const { reviewsCount, averageRating, ...rest } = overrides;
    const safeOverrides: Partial<StrictDestinationType> = {
        ...rest,
        ...(reviewsCount !== undefined ? { reviewsCount } : {}),
        ...(averageRating !== undefined ? { averageRating } : {})
    };
    return new DestinationFactoryBuilder()
        .with({ reviewsCount: 0, accommodationsCount: 0, averageRating: 0 })
        .with(safeOverrides)
        .build();
};
