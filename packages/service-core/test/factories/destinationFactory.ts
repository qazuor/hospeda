/**
 * destinationFactory.ts - Factory for destination test data
 * Provides standardized mock data generation for destination entities and DTOs
 */

import type { Destination, DestinationCreateInput, DestinationUpdateInput } from '@repo/schemas';
import { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

// ============================================================================
// BASE MOCK DATA
// ============================================================================

const baseDestination: Destination = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    slug: 'mock-destination',
    name: 'Mock Destination',
    summary: 'A beautiful mock destination for testing',
    description: 'This is a longer description of the mock destination used for testing purposes.',

    // Lifecycle fields
    lifecycleState: LifecycleStatusEnum.ACTIVE,

    // Moderation fields
    moderationState: ModerationStatusEnum.APPROVED,

    // Visibility fields
    visibility: VisibilityEnum.PUBLIC,

    // Optional fields
    isFeatured: false,
    location: {
        state: 'Buenos Aires',
        zipCode: 'C1000',
        country: 'Argentina',
        coordinates: { lat: '-34.6037', long: '-58.3816' }
    },
    media: {
        featuredImage: undefined,
        gallery: undefined,
        videos: undefined
    },
    tags: [],

    // Statistics
    accommodationsCount: 0,
    reviewsCount: 0,
    averageRating: 0,

    // Audit fields
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user') as string,
    updatedById: getMockId('user') as string,
    deletedAt: undefined,
    deletedById: undefined
};

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Returns a mock DestinationId for use in tests.
 */
export const getMockDestinationId = (id?: string): string =>
    id || (getMockId('destination') as string);

/**
 * Creates a mock destination with optional overrides
 */
export const createMockDestination = (overrides: Partial<Destination> = {}): Destination => ({
    ...baseDestination,
    id: getMockDestinationId(),
    ...overrides
});

/**
 * Creates a mock destination create input with optional overrides
 */
export const createMockDestinationCreateInput = (
    overrides: Partial<DestinationCreateInput> = {}
): DestinationCreateInput => ({
    slug: 'new-destination',
    name: 'New Destination',
    summary: 'A new destination for testing',
    description: 'This is a new destination created for testing purposes.',
    visibility: VisibilityEnum.PUBLIC,
    moderationState: ModerationStatusEnum.PENDING,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    isFeatured: false,
    location: {
        state: 'Buenos Aires',
        zipCode: 'C1000',
        country: 'Argentina',
        coordinates: { lat: '-34.6037', long: '-58.3816' }
    },
    media: {
        featuredImage: undefined,
        gallery: undefined,
        videos: undefined
    },
    tags: [],
    accommodationsCount: 0,
    reviewsCount: 0,
    averageRating: 0,
    ...overrides
});

/**
 * Creates a mock destination update input with optional overrides
 */
export const createMockDestinationUpdateInput = (
    overrides: Partial<DestinationUpdateInput> = {}
): DestinationUpdateInput => ({
    name: 'Updated Destination',
    summary: 'An updated destination for testing',
    ...overrides
});

// ============================================================================
// SCENARIO-SPECIFIC FACTORIES
// ============================================================================

/**
 * Creates a destination with PUBLIC visibility
 */
export const createPublicDestination = (overrides?: Partial<Destination>): Destination =>
    createMockDestination({
        visibility: VisibilityEnum.PUBLIC,
        moderationState: ModerationStatusEnum.APPROVED,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ...overrides
    });

/**
 * Creates a destination with PRIVATE visibility
 */
export const createPrivateDestination = (overrides?: Partial<Destination>): Destination =>
    createMockDestination({
        visibility: VisibilityEnum.PRIVATE,
        moderationState: ModerationStatusEnum.PENDING,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ...overrides
    });

/**
 * Creates a destination with RESTRICTED visibility
 */
export const createRestrictedDestination = (overrides?: Partial<Destination>): Destination =>
    createMockDestination({
        visibility: VisibilityEnum.RESTRICTED,
        moderationState: ModerationStatusEnum.APPROVED,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ...overrides
    });

/**
 * Creates a deleted destination
 */
export const createDeletedDestination = (overrides?: Partial<Destination>): Destination =>
    createMockDestination({
        deletedAt: new Date(),
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        ...overrides
    });

// ============================================================================
// BUILDER CLASS
// ============================================================================

export class DestinationFactoryBuilder {
    private data: Partial<Destination> = {};

    with(overrides: Partial<Destination>) {
        this.data = { ...this.data, ...overrides };
        return this;
    }

    withLocation(state: string, zipCode: string, country: string, lat?: string, long?: string) {
        this.data.location = {
            state,
            zipCode,
            country,
            coordinates: lat && long ? { lat, long } : undefined
        };
        return this;
    }

    withStats(accommodations: number, reviews: number, rating: number) {
        this.data.accommodationsCount = accommodations;
        this.data.reviewsCount = reviews;
        this.data.averageRating = rating;
        return this;
    }

    withAttractions(attractions: any[]) {
        this.data.attractions = attractions;
        return this;
    }

    public() {
        this.data.visibility = VisibilityEnum.PUBLIC;
        this.data.moderationState = ModerationStatusEnum.APPROVED;
        this.data.lifecycleState = LifecycleStatusEnum.ACTIVE;
        return this;
    }

    private() {
        this.data.visibility = VisibilityEnum.PRIVATE;
        this.data.moderationState = ModerationStatusEnum.PENDING;
        this.data.lifecycleState = LifecycleStatusEnum.ACTIVE;
        return this;
    }

    restricted() {
        this.data.visibility = VisibilityEnum.RESTRICTED;
        this.data.moderationState = ModerationStatusEnum.APPROVED;
        this.data.lifecycleState = LifecycleStatusEnum.ACTIVE;
        return this;
    }

    build(): Destination {
        return createMockDestination(this.data);
    }
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy function for backward compatibility
 * @deprecated Use createMockDestination instead
 */
export const createDestination = createMockDestination;
