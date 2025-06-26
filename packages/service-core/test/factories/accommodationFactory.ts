/**
 * accommodationFactory.ts
 *
 * Factory functions for generating Accommodation mock data for tests.
 * All mock data for AccommodationService tests should be created here.
 */

import type {
    AccommodationId,
    AccommodationPriceType,
    AccommodationRatingType,
    AccommodationType,
    AmenityId,
    DestinationId,
    FullLocationType,
    NewAccommodationInputType,
    TagId,
    UpdateAccommodationInputType,
    UserId
} from '@repo/types';
import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PriceCurrencyEnum,
    VisibilityEnum
} from '@repo/types';
import { getMockId } from '../factories/utilsFactory';
import { BaseFactoryBuilder } from './baseEntityFactory';

/**
 * Returns a mock AccommodationId for use in tests.
 * @param id - Optional custom string to generate a deterministic ID.
 * @returns AccommodationId
 */
export const getMockAccommodationId = (id?: string): AccommodationId =>
    getMockId('accommodation', id) as AccommodationId;

/**
 * Returns a mock AmenityId for use in tests.
 * @param id - Optional custom string to generate a deterministic ID.
 * @returns AmenityId
 */
export const getMockAmenityId = (id?: string): AmenityId => getMockId('feature', id) as AmenityId;

/**
 * Returns a mock DestinationId for use in tests.
 * @param id - Optional custom string to generate a deterministic ID.
 * @returns DestinationId
 */
export const getMockDestinationId = (id?: string): DestinationId =>
    getMockId('destination', id) as DestinationId;

const basePrice: AccommodationPriceType = {
    price: 100,
    currency: PriceCurrencyEnum.USD
};

const baseRating: AccommodationRatingType = {
    cleanliness: 4.5,
    hospitality: 4.5,
    services: 4.5,
    accuracy: 4.5,
    communication: 4.5,
    location: 4.5
};

const baseLocation: FullLocationType = {
    state: 'Test State',
    zipCode: '12345',
    country: 'Test Country',
    street: 'Test Street',
    number: '123',
    city: 'Test City'
};

/**
 * A robust, fully-populated base accommodation object that can be used for creating variations.
 */
const baseAccommodation: AccommodationType = {
    id: getMockId('accommodation') as AccommodationId,
    name: 'Default Test Hotel',
    slug: 'default-test-hotel',
    summary: 'A wonderful place to stay.',
    description:
        'A detailed description of this wonderful place to stay, long enough for validation.',
    type: AccommodationTypeEnum.HOTEL,
    price: {
        price: 150.0,
        currency: PriceCurrencyEnum.USD
    },
    location: {
        state: 'Default State',
        zipCode: '12345',
        country: 'Default Country',
        street: '123 Default St',
        number: '100',
        city: 'Default City'
    },
    ownerId: getMockId('user', 'owner') as UserId,
    destinationId: getMockId('destination') as DestinationId,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user', 'creator') as UserId,
    updatedById: getMockId('user', 'updater') as UserId,
    rating: {
        cleanliness: 5,
        hospitality: 5,
        services: 5,
        accuracy: 5,
        communication: 5,
        location: 5
    },
    reviewsCount: 100,
    media: {
        featuredImage: {
            url: 'https://example.com/featured.jpg',
            moderationState: ModerationStatusEnum.APPROVED,
            tags: []
        }
    },
    amenities: [],
    tags: [],
    seo: {
        title: 'SEO Title for Default Test Hotel',
        description: 'SEO description for the default test hotel, long enough for validation.',
        keywords: ['hotel', 'test']
    },
    adminInfo: { favorite: false },
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    deletedAt: undefined
};

/**
 * Builder pattern for generating AccommodationType mocks for tests.
 *
 * Allows fluent, type-safe creation of Accommodation objects with various states and overrides.
 *
 * @example
 * const accommodation = new AccommodationFactoryBuilder().public().withOwner('user-1').build();
 */
export class AccommodationFactoryBuilder extends BaseFactoryBuilder<AccommodationType> {
    constructor() {
        super(baseAccommodation);
    }
    public public() {
        return this.with({
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            deletedAt: undefined
        });
    }
    public draft() {
        return this.with({
            visibility: VisibilityEnum.PRIVATE,
            lifecycleState: LifecycleStatusEnum.DRAFT,
            moderationState: ModerationStatusEnum.PENDING,
            deletedAt: undefined
        });
    }
    public pending() {
        return this.with({
            visibility: VisibilityEnum.PRIVATE,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.PENDING,
            deletedAt: undefined
        });
    }
    public rejected() {
        return this.with({
            visibility: VisibilityEnum.PRIVATE,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.REJECTED,
            deletedAt: undefined
        });
    }
    public archived() {
        return this.with({
            visibility: VisibilityEnum.PRIVATE,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            moderationState: ModerationStatusEnum.APPROVED,
            deletedAt: undefined
        });
    }
    public deleted() {
        return this.with({ deletedAt: new Date() });
    }
    public withOwner(ownerId: UserId) {
        return this.with({ ownerId });
    }
    public withAmenities(amenities: AccommodationType['amenities']) {
        return this.with({ amenities });
    }
    public withAmenitiesCount(count: number): this {
        const amenities = Array.from({ length: count }, (_, i) => ({
            accommodationId: getMockAccommodationId(),
            amenityId: getMockAmenityId(`${i + 1}`),
            isOptional: i % 2 !== 0
        }));
        return this.with({ amenities });
    }
    public withOwnerHost(): this {
        return this.with({ ownerId: getMockId('user', 'host') as UserId });
    }
    public withRandomTags(count: number): this {
        return this.with({
            tags: Array.from({ length: count }, (_, i) => ({
                id: `tag-${i + 1}` as TagId,
                name: `Tag ${i + 1}`,
                slug: `tag-${i + 1}`,
                color: 'BLUE',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: getMockId('user') as UserId,
                updatedById: getMockId('user') as UserId,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            }))
        });
    }
    public withDefaultMedia(): this {
        return this.with({
            media: {
                featuredImage: {
                    url: 'https://example.com/featured.jpg',
                    moderationState: ModerationStatusEnum.APPROVED,
                    tags: []
                }
            }
        });
    }
    public withDefaultSeo(): this {
        return this.with({
            seo: {
                title: 'SEO Title',
                description: 'SEO Description for test accommodation.',
                keywords: ['test', 'accommodation']
            }
        });
    }
}

/**
 * Creates a mock Accommodation entity using the builder pattern, allowing for overrides.
 * @param overrides - Partial fields to override in the base accommodation.
 * @returns {AccommodationType} The resulting mock accommodation entity.
 */
export const createAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => new AccommodationFactoryBuilder().with(overrides).build();

/**
 * Creates an array of mock Accommodation entities, each with unique IDs and names.
 * @param count - Number of accommodations to generate. Default: 3.
 * @param overrides - Partial fields to override in each accommodation.
 * @returns {AccommodationType[]} Array of mock accommodation entities.
 */
export const createAccommodations = (
    count = 3,
    overrides: Partial<AccommodationType> = {}
): AccommodationType[] =>
    Array.from({ length: count }, (_, i) =>
        createAccommodation({
            id: getMockId('accommodation', `acc-${i + 1}`) as AccommodationType['id'],
            name: `Accommodation ${i + 1}`,
            slug: `accommodation-${i + 1}`,
            ...overrides
        })
    );

/**
 * Creates a mock Accommodation entity in the public/active/approved state using the builder.
 */
export const createPublicAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => new AccommodationFactoryBuilder().public().with(overrides).build();

/**
 * Creates a mock Accommodation entity in the draft/private/pending state using the builder.
 */
export const createDraftAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => new AccommodationFactoryBuilder().draft().with(overrides).build();

/**
 * Creates a mock Accommodation entity in the pending/private/active state using the builder.
 */
export const createPendingAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => new AccommodationFactoryBuilder().pending().with(overrides).build();

/**
 * Creates a mock Accommodation entity in the rejected/private/active state using the builder.
 */
export const createRejectedAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => new AccommodationFactoryBuilder().rejected().with(overrides).build();

/**
 * Creates a mock Accommodation entity in the archived/private/approved state using the builder.
 */
export const createArchivedAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => new AccommodationFactoryBuilder().archived().with(overrides).build();

/**
 * Creates a mock Accommodation entity marked as deleted (deletedAt set) using the builder.
 */
export const createDeletedAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => new AccommodationFactoryBuilder().deleted().with(overrides).build();

/**
 * Generates a mock NewAccommodationInputType for use in tests.
 * @param overrides - Partial fields to override defaults.
 * @returns {NewAccommodationInputType} The resulting mock input object.
 */
export const createNewAccommodationInput = (
    overrides: Partial<NewAccommodationInputType> = {}
): NewAccommodationInputType => ({
    ...baseAccommodation,
    ...overrides,
    id: (overrides.id ?? getMockId('accommodation')) as NewAccommodationInputType['id'],
    ownerId: (overrides.ownerId ?? getMockId('user')) as NewAccommodationInputType['ownerId'],
    type: (overrides.type ?? AccommodationTypeEnum.HOTEL) as NewAccommodationInputType['type'],
    price: overrides.price ?? basePrice,
    rating: overrides.rating ?? baseRating,
    location: overrides.location ?? baseLocation,
    destinationId: (overrides.destinationId ??
        getMockId('destination')) as NewAccommodationInputType['destinationId'],
    createdById: (overrides.createdById ??
        getMockId('user')) as NewAccommodationInputType['createdById'],
    updatedById: (overrides.updatedById ??
        getMockId('user')) as NewAccommodationInputType['updatedById'],
    visibility: overrides.visibility ?? VisibilityEnum.PUBLIC,
    lifecycleState: overrides.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
    moderationState: overrides.moderationState ?? ModerationStatusEnum.APPROVED
});

/**
 * Generates a mock UpdateAccommodationInputType for use in tests.
 * @param overrides - Partial fields to override defaults.
 * @returns {UpdateAccommodationInputType} The resulting mock input object.
 */
export const createUpdateAccommodationInput = (
    overrides: Partial<UpdateAccommodationInputType> = {}
): UpdateAccommodationInputType => ({
    name: 'Updated Accommodation',
    slug: 'updated-accommodation',
    summary: 'A summary for test accommodation',
    description:
        'A test accommodation with a description long enough to pass the Zod minimum length validation.',
    type: AccommodationTypeEnum.HOTEL,
    price: basePrice,
    location: baseLocation,
    ownerId: getMockId('user') as AccommodationType['ownerId'],
    destinationId: getMockId('destination') as AccommodationType['destinationId'],
    isFeatured: true,
    rating: baseRating,
    reviewsCount: 10,
    media: {
        featuredImage: {
            url: 'https://example.com/img1.jpg',
            moderationState: ModerationStatusEnum.APPROVED,
            tags: []
        }
    },
    amenities: [
        {
            accommodationId: getMockAccommodationId(),
            amenityId: getMockAmenityId('1'),
            isOptional: false
        },
        {
            accommodationId: getMockAccommodationId(),
            amenityId: getMockAmenityId('2'),
            isOptional: true
        }
    ],
    tags: [],
    seo: {
        title: 'SEO Title for Test Accommodation with enough length',
        description:
            'SEO Description for Test Accommodation with enough length to pass the minimum required by Zod schema for description field.',
        keywords: ['test']
    },
    adminInfo: { favorite: false },
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    ...overrides
});

const baseAccommodationWithMockIds: Omit<
    AccommodationType,
    | 'id'
    | 'ownerId'
    | 'type'
    | 'price'
    | 'rating'
    | 'location'
    | 'destinationId'
    | 'createdById'
    | 'updatedById'
    | 'visibility'
    | 'lifecycleState'
    | 'moderationState'
> & {
    id: AccommodationType['id'];
    ownerId: AccommodationType['ownerId'];
    type: AccommodationType['type'];
    price: AccommodationType['price'];
    rating: AccommodationType['rating'];
    location: AccommodationType['location'];
    destinationId: AccommodationType['destinationId'];
    createdById: AccommodationType['createdById'];
    updatedById: AccommodationType['updatedById'];
    visibility: AccommodationType['visibility'];
    lifecycleState: AccommodationType['lifecycleState'];
    moderationState: AccommodationType['moderationState'];
} = {
    id: getMockId('accommodation') as AccommodationType['id'],
    name: 'Test Accommodation',
    slug: 'test-accommodation',
    summary: 'A summary for test accommodation',
    description:
        'A test accommodation with a description long enough to pass the Zod minimum length validation.',
    type: AccommodationTypeEnum.HOTEL as AccommodationType['type'],
    price: basePrice,
    location: baseLocation,
    ownerId: getMockId('user') as AccommodationType['ownerId'],
    destinationId: getMockId('destination') as AccommodationType['destinationId'],
    isFeatured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user') as AccommodationType['createdById'],
    updatedById: getMockId('user') as AccommodationType['updatedById'],
    rating: baseRating,
    reviewsCount: 10,
    media: {
        featuredImage: {
            url: 'https://example.com/img1.jpg',
            moderationState: ModerationStatusEnum.APPROVED,
            tags: []
        }
    },
    amenities: [
        {
            accommodationId: getMockAccommodationId(),
            amenityId: getMockAmenityId('1'),
            isOptional: false
        },
        {
            accommodationId: getMockAccommodationId(),
            amenityId: getMockAmenityId('2'),
            isOptional: true
        }
    ],
    tags: [],
    seo: {
        title: 'SEO Title for Test Accommodation with enough length',
        description:
            'SEO Description for Test Accommodation with enough length to pass the minimum required by Zod schema for description field.',
        keywords: ['test']
    },
    adminInfo: { favorite: false },
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED
};

/**
 * Generates a mock Accommodation entity with mock IDs for use in tests.
 * @param overrides - Partial fields to override defaults.
 * @returns {AccommodationType} The resulting mock accommodation entity.
 */
export const createAccommodationWithMockIds = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => ({
    ...baseAccommodationWithMockIds,
    ...overrides,
    id: (overrides.id ?? getMockId('accommodation')) as AccommodationType['id'],
    ownerId: (overrides.ownerId ?? getMockId('user')) as AccommodationType['ownerId'],
    type: (overrides.type ?? AccommodationTypeEnum.HOTEL) as AccommodationType['type'],
    price: overrides.price ?? basePrice,
    rating: overrides.rating ?? baseRating,
    location: overrides.location ?? baseLocation,
    destinationId: (overrides.destinationId ??
        getMockId('destination')) as AccommodationType['destinationId'],
    createdById: (overrides.createdById ?? getMockId('user')) as AccommodationType['createdById'],
    updatedById: (overrides.updatedById ?? getMockId('user')) as AccommodationType['updatedById'],
    visibility: overrides.visibility ?? VisibilityEnum.PUBLIC,
    lifecycleState: overrides.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
    moderationState: overrides.moderationState ?? ModerationStatusEnum.APPROVED
});

/**
 * Generates an array of mock Accommodation entities with mock IDs for use in tests.
 * @param count - Number of accommodations to generate. Default: 3.
 * @returns {AccommodationType[]} Array of mock accommodation entities.
 */
export const createAccommodationsWithMockIds = (count = 3): AccommodationType[] =>
    Array.from({ length: count }, (_, i) =>
        createAccommodationWithMockIds({
            id: getMockId('accommodation', `acc-${i + 1}`) as AccommodationType['id'],
            name: `Accommodation ${i + 1}`,
            slug: `accommodation-${i + 1}`
        })
    );

/**
 * Generates a mock NewAccommodationInputType with mock IDs for use in tests.
 * @param overrides - Partial fields to override defaults.
 * @returns {NewAccommodationInputType} The resulting mock input object.
 */
export const createNewAccommodationInputWithMockIds = (
    overrides: Partial<NewAccommodationInputType> = {}
): NewAccommodationInputType => ({
    ...baseAccommodationWithMockIds,
    ...overrides,
    id: (overrides.id ?? getMockId('accommodation')) as NewAccommodationInputType['id'],
    ownerId: (overrides.ownerId ?? getMockId('user')) as NewAccommodationInputType['ownerId'],
    type: (overrides.type ?? AccommodationTypeEnum.HOTEL) as NewAccommodationInputType['type'],
    price: overrides.price ?? basePrice,
    rating: overrides.rating ?? baseRating,
    location: overrides.location ?? baseLocation,
    destinationId: (overrides.destinationId ??
        getMockId('destination')) as NewAccommodationInputType['destinationId'],
    createdById: (overrides.createdById ??
        getMockId('user')) as NewAccommodationInputType['createdById'],
    updatedById: (overrides.updatedById ??
        getMockId('user')) as NewAccommodationInputType['updatedById'],
    visibility: overrides.visibility ?? VisibilityEnum.PUBLIC,
    lifecycleState: overrides.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
    moderationState: overrides.moderationState ?? ModerationStatusEnum.APPROVED
});

/**
 * Generates a mock UpdateAccommodationInputType with mock IDs for use in tests.
 * @param overrides - Partial fields to override defaults.
 * @returns {UpdateAccommodationInputType} The resulting mock input object.
 */
export const createUpdateAccommodationInputWithMockIds = (
    overrides: Partial<UpdateAccommodationInputType> = {}
): UpdateAccommodationInputType => ({
    name: 'Updated Accommodation',
    slug: 'updated-accommodation',
    summary: 'A summary for test accommodation',
    description:
        'A test accommodation with a description long enough to pass the Zod minimum length validation.',
    type: AccommodationTypeEnum.HOTEL,
    price: basePrice,
    location: baseLocation,
    ownerId: getMockId('user') as AccommodationType['ownerId'],
    destinationId: getMockId('destination') as AccommodationType['destinationId'],
    isFeatured: true,
    rating: baseRating,
    reviewsCount: 10,
    media: {
        featuredImage: {
            url: 'https://example.com/img1.jpg',
            moderationState: ModerationStatusEnum.APPROVED,
            tags: []
        }
    },
    amenities: [
        {
            accommodationId: getMockAccommodationId(),
            amenityId: getMockAmenityId('1'),
            isOptional: false
        },
        {
            accommodationId: getMockAccommodationId(),
            amenityId: getMockAmenityId('2'),
            isOptional: true
        }
    ],
    tags: [],
    seo: {
        title: 'SEO Title for Test Accommodation with enough length',
        description:
            'SEO Description for Test Accommodation with enough length to pass the minimum required by Zod schema for description field.',
        keywords: ['test']
    },
    adminInfo: { favorite: false },
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    ...overrides
});
