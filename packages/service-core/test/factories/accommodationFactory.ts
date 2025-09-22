/**
 * accommodationFactory.ts
 *
 * Factory functions for generating Accommodation mock data for tests.
 * All mock data for AccommodationService tests should be created here.
 */

import type {
    Accommodation,
    AccommodationCreateInput,
    AccommodationIdType,
    AccommodationPrice,
    AccommodationUpdateInput,
    UserIdType
} from '@repo/schemas';
import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PriceCurrencyEnum,
    VisibilityEnum
} from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock AccommodationId for use in tests.
 */
export const getMockAccommodationId = (id?: string): AccommodationIdType =>
    getMockId('accommodation', id) as AccommodationIdType;

/**
 * Returns a mock AccommodationId for use in tests.
 */
/**
 * Returns a mock TagId for use in tests.
 */
export const getMockTagId = (id?: string): string => getMockId('tag', id) as string;

/**
 * Returns a mock DestinationId for use in tests.
 */
export const getMockDestinationId = (id?: string): string => getMockId('destination', id) as string;

// ============================================================================
// BASE MOCK DATA
// ============================================================================

const basePrice: AccommodationPrice = {
    price: 150.0,
    currency: PriceCurrencyEnum.USD
};

/**
 * Creates a base Accommodation with sensible defaults for testing.
 */
export const createMockAccommodation = (overrides: Partial<Accommodation> = {}): Accommodation => ({
    id: getMockAccommodationId(),
    name: 'Default Test Hotel',
    slug: 'default-test-hotel',
    summary: 'A wonderful place to stay.',
    description:
        'A detailed description of this wonderful place to stay, long enough for validation.',
    type: AccommodationTypeEnum.HOTEL,
    destinationId: getMockId('destination') as string,
    ownerId: getMockId('user') as string,
    isFeatured: false,

    // Base review fields
    reviewsCount: 0,
    averageRating: 0,

    // Base lifecycle fields
    lifecycleState: LifecycleStatusEnum.ACTIVE,

    // Base moderation fields
    moderationState: ModerationStatusEnum.APPROVED,

    // Base visibility fields
    visibility: VisibilityEnum.PUBLIC,

    // Base location fields - simplified
    location: {
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country'
    },

    // Base media fields - simplified
    media: {
        featuredImage: {
            url: 'https://example.com/image1.jpg',
            moderationState: ModerationStatusEnum.APPROVED
        }
    },

    // Base contact fields - simplified
    contactInfo: {
        mobilePhone: '+1-555-0123'
    },

    // Base audit fields
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user') as string,
    updatedById: getMockId('user') as string,

    // Optional fields
    price: basePrice,
    tags: [],

    ...overrides
});

/**
 * Creates accommodation creation input data (without auto-generated fields)
 */
export const createMockAccommodationCreateInput = (
    overrides: Partial<AccommodationCreateInput> = {}
): AccommodationCreateInput => {
    const baseInput = {
        name: 'Default Test Hotel',
        slug: 'default-test-hotel',
        summary: 'A wonderful place to stay.',
        description:
            'A detailed description of this wonderful place to stay, long enough for validation.',
        type: AccommodationTypeEnum.HOTEL,
        destinationId: getMockId('destination') as string,
        ownerId: getMockId('user') as string,
        isFeatured: false,
        reviewsCount: 0,
        averageRating: 0,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        visibility: VisibilityEnum.PUBLIC,

        // Base location fields - simplified
        location: {
            state: 'Test State',
            zipCode: '12345',
            country: 'Test Country'
        },

        // Base media fields - simplified
        media: {
            featuredImage: {
                url: 'https://example.com/image1.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            }
        },

        // Base contact fields - simplified
        contactInfo: {
            mobilePhone: '+15550123456'
        },

        // Optional fields
        price: basePrice,
        tags: []
    };

    return {
        ...baseInput,
        ...overrides
    };
};

/**
 * Creates accommodation update input data
 */
export const createMockAccommodationUpdateInput = (
    overrides: Partial<AccommodationUpdateInput> = {}
): AccommodationUpdateInput => ({
    name: 'Updated Test Hotel',
    summary: 'An updated wonderful place to stay.',
    description: 'An updated detailed description of this wonderful place to stay.',
    ...overrides
});

/**
 * Creates a collection of Accommodations for bulk testing.
 */
export const createMockAccommodations = (
    count: number,
    overrides: Partial<Accommodation> = {}
): Accommodation[] =>
    Array.from({ length: count }, (_, i) =>
        createMockAccommodation({
            id: getMockAccommodationId(`acc-${i + 1}`),
            name: `Test Accommodation ${i + 1}`,
            slug: `test-accommodation-${i + 1}`,
            ...overrides
        })
    );

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    create: createMockAccommodation,
    createInput: createMockAccommodationCreateInput,
    updateInput: createMockAccommodationUpdateInput,
    createMany: createMockAccommodations,
    ids: {
        accommodation: getMockAccommodationId
    }
};

// ============================================================================
// SCENARIO-SPECIFIC FACTORIES
// ============================================================================

/**
 * Creates an accommodation with PUBLIC visibility
 */
export const createPublicAccommodation = (overrides?: Partial<Accommodation>): Accommodation => {
    return createMockAccommodation({
        visibility: VisibilityEnum.PUBLIC,
        ...overrides
    });
};

/**
 * Creates an accommodation with PRIVATE visibility (draft)
 */
export const createDraftAccommodation = (overrides?: Partial<Accommodation>): Accommodation => {
    return createMockAccommodation({
        visibility: VisibilityEnum.PRIVATE,
        ...overrides
    });
};

/**
 * Creates an accommodation with PENDING moderation status
 */
export const createPendingAccommodation = (overrides?: Partial<Accommodation>): Accommodation => {
    return createMockAccommodation({
        moderationState: ModerationStatusEnum.PENDING,
        ...overrides
    });
};

/**
 * Creates an accommodation with REJECTED moderation status
 */
export const createRejectedAccommodation = (overrides?: Partial<Accommodation>): Accommodation => {
    return createMockAccommodation({
        moderationState: ModerationStatusEnum.REJECTED,
        ...overrides
    });
};

/**
 * Creates an accommodation with ARCHIVED lifecycle status
 */
export const createArchivedAccommodation = (overrides?: Partial<Accommodation>): Accommodation => {
    return createMockAccommodation({
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        ...overrides
    });
};

/**
 * Creates a soft-deleted accommodation
 */
export const createDeletedAccommodation = (overrides?: Partial<Accommodation>): Accommodation => {
    return createMockAccommodation({
        deletedAt: new Date(),
        ...overrides
    });
};

/**
 * Simple AccommodationFactory class for compatibility
 */
export class AccommodationFactoryBuilder {
    private data: Partial<Accommodation>;

    constructor() {
        this.data = {};
    }

    public with(overrides: Partial<Accommodation>) {
        this.data = { ...this.data, ...overrides };
        return this;
    }

    public withOverrides(overrides: Partial<Accommodation>) {
        return this.with(overrides);
    }

    public withOwner(ownerId: UserIdType) {
        this.data.ownerId = ownerId;
        return this;
    }

    public public() {
        this.data.visibility = VisibilityEnum.PUBLIC;
        return this;
    }

    public draft() {
        this.data.visibility = VisibilityEnum.PRIVATE;
        return this;
    }

    public pending() {
        this.data.moderationState = ModerationStatusEnum.PENDING;
        return this;
    }

    public rejected() {
        this.data.moderationState = ModerationStatusEnum.REJECTED;
        return this;
    }

    public archived() {
        this.data.lifecycleState = LifecycleStatusEnum.ARCHIVED;
        return this;
    }

    public deleted() {
        this.data.deletedAt = new Date();
        return this;
    }

    public build(): Accommodation {
        return createMockAccommodation(this.data);
    }
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use createMockAccommodation instead
 */
export const createAccommodation = createMockAccommodation;

/**
 * @deprecated Use createMockAccommodationCreateInput instead
 */
export const createNewAccommodationInput = createMockAccommodationCreateInput;

/**
 * Creates an accommodation with mock IDs for testing
 * @deprecated Use createMockAccommodation with specific overrides instead
 */
export const createAccommodationWithMockIds = (
    overrides: Partial<Accommodation> = {}
): Accommodation => {
    return createMockAccommodation({
        id: getMockAccommodationId(),
        ownerId: getMockId('user') as UserIdType,
        destinationId: getMockDestinationId(),
        ...overrides
    });
};
