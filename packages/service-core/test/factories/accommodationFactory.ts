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
 * Base generic factory for any entity type.
 *
 * Provides a simple way to create entity mocks with base data and overrides.
 *
 * @template T - The entity type.
 */
export class EntityFactory<T> {
    protected base: T;
    constructor(base: T) {
        this.base = base;
    }
    /**
     * Builds a new entity instance, applying any provided overrides.
     * @param overrides - Partial fields to override in the base entity.
     * @returns {T} The resulting entity instance.
     */
    build(overrides: Partial<T> = {}): T {
        return { ...this.base, ...overrides };
    }
}

/**
 * Builder pattern for generating AccommodationType mocks for tests.
 *
 * Allows fluent, type-safe creation of Accommodation objects with various states and overrides.
 *
 * @example
 * const accommodation = new AccommodationFactoryBuilder().public().withOwner('user-1').build();
 */
export class AccommodationFactoryBuilder extends EntityFactory<AccommodationType> {
    private data: Partial<AccommodationType> = {};
    constructor() {
        super(baseAccommodation);
    }
    /**
     * Sets the accommodation as public, active, and approved.
     * @returns {AccommodationFactoryBuilder}
     */
    public public() {
        this.data.visibility = VisibilityEnum.PUBLIC;
        this.data.lifecycleState = LifecycleStatusEnum.ACTIVE;
        this.data.moderationState = ModerationStatusEnum.APPROVED;
        this.data.deletedAt = undefined;
        return this;
    }
    /**
     * Sets the accommodation as draft, private, and pending moderation.
     * @returns {AccommodationFactoryBuilder}
     */
    public draft() {
        this.data.visibility = VisibilityEnum.PRIVATE;
        this.data.lifecycleState = LifecycleStatusEnum.DRAFT;
        this.data.moderationState = ModerationStatusEnum.PENDING;
        this.data.deletedAt = undefined;
        return this;
    }
    /**
     * Sets the accommodation as pending moderation, private, and active.
     * @returns {AccommodationFactoryBuilder}
     */
    public pending() {
        this.data.visibility = VisibilityEnum.PRIVATE;
        this.data.lifecycleState = LifecycleStatusEnum.ACTIVE;
        this.data.moderationState = ModerationStatusEnum.PENDING;
        this.data.deletedAt = undefined;
        return this;
    }
    /**
     * Sets the accommodation as rejected, private, and active.
     * @returns {AccommodationFactoryBuilder}
     */
    public rejected() {
        this.data.visibility = VisibilityEnum.PRIVATE;
        this.data.lifecycleState = LifecycleStatusEnum.ACTIVE;
        this.data.moderationState = ModerationStatusEnum.REJECTED;
        this.data.deletedAt = undefined;
        return this;
    }
    /**
     * Sets the accommodation as archived, private, and approved.
     * @returns {AccommodationFactoryBuilder}
     */
    public archived() {
        this.data.visibility = VisibilityEnum.PRIVATE;
        this.data.lifecycleState = LifecycleStatusEnum.ARCHIVED;
        this.data.moderationState = ModerationStatusEnum.APPROVED;
        this.data.deletedAt = undefined;
        return this;
    }
    /**
     * Marks the accommodation as deleted (sets deletedAt).
     * @returns {AccommodationFactoryBuilder}
     */
    public deleted() {
        this.data.deletedAt = new Date();
        return this;
    }
    /**
     * Sets the ownerId of the accommodation.
     * @param ownerId - The user ID to set as owner.
     * @returns {AccommodationFactoryBuilder}
     */
    public withOwner(ownerId: UserId) {
        this.data.ownerId = ownerId;
        return this;
    }
    /**
     * Sets the amenities array for the accommodation.
     * @param amenities - The amenities to assign.
     * @returns {AccommodationFactoryBuilder}
     */
    public withAmenities(amenities: AccommodationType['amenities']) {
        this.data.amenities = amenities;
        return this;
    }
    /**
     * Applies arbitrary overrides to the accommodation object.
     * @param overrides - Partial fields to override.
     * @returns {AccommodationFactoryBuilder}
     */
    public withOverrides(overrides: Partial<AccommodationType>) {
        Object.assign(this.data, overrides);
        return this;
    }
    /**
     * Builds and returns the AccommodationType object.
     * @returns {AccommodationType}
     */
    public build(): AccommodationType {
        return { ...this.base, ...this.data };
    }
    /**
     * Adds a given number of mock amenities to the accommodation.
     * @param count - Number of amenities to generate.
     * @returns {AccommodationFactoryBuilder}
     */
    public withAmenitiesCount(count: number): this {
        const amenities = Array.from({ length: count }, (_, i) => ({
            accommodationId: getMockAccommodationId(),
            amenityId: getMockAmenityId(`${i + 1}`),
            isOptional: i % 2 !== 0
        }));
        this.data.amenities = amenities;
        return this;
    }
    /**
     * Assigns a mock host as the owner of the accommodation.
     * @returns {AccommodationFactoryBuilder}
     */
    public withOwnerHost(): this {
        this.data.ownerId = getMockId('user', 'host') as UserId;
        return this;
    }
    /**
     * Adds a given number of random mock tags to the accommodation.
     * Each tag will have all required TagType fields populated with mock values.
     * @param count - Number of tags to generate.
     * @returns {AccommodationFactoryBuilder}
     */
    public withRandomTags(count: number): this {
        this.data.tags = Array.from({ length: count }, (_, i) => ({
            id: `tag-${i + 1}` as TagId,
            name: `Tag ${i + 1}`,
            slug: `tag-${i + 1}`,
            color: 'BLUE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserId,
            updatedById: getMockId('user') as UserId,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        }));
        return this;
    }
    /**
     * Assigns a default mock media object to the accommodation.
     * @returns {AccommodationFactoryBuilder}
     */
    public withDefaultMedia(): this {
        this.data.media = {
            featuredImage: {
                url: 'https://example.com/featured.jpg',
                moderationState: ModerationStatusEnum.APPROVED,
                tags: []
            }
        };
        return this;
    }
    /**
     * Assigns a default SEO object to the accommodation.
     * @returns {AccommodationFactoryBuilder}
     */
    public withDefaultSeo(): this {
        this.data.seo = {
            title: 'SEO Title',
            description: 'SEO Description for test accommodation.',
            keywords: ['test', 'accommodation']
        };
        return this;
    }
}

/**
 * Creates a mock Accommodation entity, applying any provided overrides to the base object.
 * @param overrides - Partial fields to override in the base accommodation.
 * @returns {AccommodationType} The resulting mock accommodation entity.
 */
export const createAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => {
    return { ...baseAccommodation, ...overrides };
};

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
 * Creates a mock Accommodation entity in the public/active/approved state.
 * @param overrides - Partial fields to override in the base accommodation.
 * @returns {AccommodationType} The resulting mock accommodation entity.
 */
export const createPublicAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    createAccommodation({
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        deletedAt: undefined,
        ...overrides
    });

/**
 * Creates a mock Accommodation entity in the draft/private/pending state.
 * @param overrides - Partial fields to override in the base accommodation.
 * @returns {AccommodationType} The resulting mock accommodation entity.
 */
export const createDraftAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    createAccommodation({
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.DRAFT,
        moderationState: ModerationStatusEnum.PENDING,
        deletedAt: undefined,
        ...overrides
    });

/**
 * Creates a mock Accommodation entity in the pending/private/active state.
 * @param overrides - Partial fields to override in the base accommodation.
 * @returns {AccommodationType} The resulting mock accommodation entity.
 */
export const createPendingAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    createAccommodation({
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.PENDING,
        deletedAt: undefined,
        ...overrides
    });

/**
 * Creates a mock Accommodation entity in the rejected/private/active state.
 * @param overrides - Partial fields to override in the base accommodation.
 * @returns {AccommodationType} The resulting mock accommodation entity.
 */
export const createRejectedAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    createAccommodation({
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.REJECTED,
        deletedAt: undefined,
        ...overrides
    });

/**
 * Creates a mock Accommodation entity in the archived/private/approved state.
 * @param overrides - Partial fields to override in the base accommodation.
 * @returns {AccommodationType} The resulting mock accommodation entity.
 */
export const createArchivedAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    createAccommodation({
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        moderationState: ModerationStatusEnum.APPROVED,
        deletedAt: undefined,
        ...overrides
    });

/**
 * Creates a mock Accommodation entity marked as deleted (deletedAt set).
 * @param overrides - Partial fields to override in the base accommodation.
 * @returns {AccommodationType} The resulting mock accommodation entity.
 */
export const createDeletedAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    createAccommodation({
        deletedAt: new Date(),
        ...overrides
    });

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
