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
    FullLocationType,
    NewAccommodationInputType,
    UpdateAccommodationInputType
} from '@repo/types';
import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PriceCurrencyEnum,
    VisibilityEnum
} from '@repo/types';
import { getMockId } from '../factories/utilsFactory';

// Helpers para IDs tipados
export const getMockAccommodationId = (id?: string): AccommodationId =>
    getMockId('accommodation', id) as AccommodationId;
export const getMockAmenityId = (id?: string): AmenityId => getMockId('feature', id) as AmenityId;

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

const baseAccommodation: Omit<
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
 * Generates a mock Accommodation entity.
 * @param overrides - Partial fields to override defaults
 * @returns AccommodationType
 */
export const createAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => ({
    ...baseAccommodation,
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
 * Generates an array of mock Accommodation entities.
 * @param count - Number of accommodations to generate
 * @returns AccommodationType[]
 */
export const createAccommodations = (count = 3): AccommodationType[] =>
    Array.from({ length: count }, (_, i) =>
        createAccommodation({
            id: getMockId('accommodation', `acc-${i + 1}`) as AccommodationType['id'],
            name: `Accommodation ${i + 1}`,
            slug: `accommodation-${i + 1}`
        })
    );

/**
 * Generates a mock NewAccommodationInputType.
 * @param overrides - Partial fields to override defaults
 * @returns NewAccommodationInputType
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
 * Generates a mock UpdateAccommodationInputType.
 * @param overrides - Partial fields to override defaults
 * @returns UpdateAccommodationInputType
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
 * Generates a mock Accommodation entity with mock IDs.
 * @param overrides - Partial fields to override defaults
 * @returns AccommodationType
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
 * Generates an array of mock Accommodation entities with mock IDs.
 * @param count - Number of accommodations to generate
 * @returns AccommodationType[]
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
 * Generates a mock NewAccommodationInputType with mock IDs.
 * @param overrides - Partial fields to override defaults
 * @returns NewAccommodationInputType
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
 * Generates a mock UpdateAccommodationInputType with mock IDs.
 * @param overrides - Partial fields to override defaults
 * @returns UpdateAccommodationInputType
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
