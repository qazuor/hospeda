import type {
    AccommodationId,
    DestinationId,
    EventId,
    PostId,
    UserBookmarkId,
    UserBookmarkType,
    UserId
} from '@repo/types';
import { EntityTypeEnum, LifecycleStatusEnum } from '@repo/types';

/**
 * UserBookmark test fixtures
 * Provides consistent test data for UserBookmark entities
 */

/**
 * Creates a complete UserBookmark fixture with all fields
 */
export const createUserBookmarkFixture = (
    overrides: Partial<UserBookmarkType> = {}
): UserBookmarkType => {
    const baseUserBookmark: UserBookmarkType = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' as UserBookmarkId,
        userId: '550e8400-e29b-41d4-a716-446655440001' as UserId,
        entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as AccommodationId,
        entityType: EntityTypeEnum.ACCOMMODATION,
        name: 'My Favorite Beach House',
        description: 'Beautiful beachfront accommodation with amazing sunset views',

        // Lifecycle fields
        lifecycleState: LifecycleStatusEnum.ACTIVE,

        // Audit fields
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
        deletedAt: undefined,
        createdById: '550e8400-e29b-41d4-a716-446655440002' as UserId,
        updatedById: '550e8400-e29b-41d4-a716-446655440002' as UserId,
        deletedById: undefined,

        // Admin fields
        adminInfo: undefined
    };

    return { ...baseUserBookmark, ...overrides };
};

/**
 * Creates a minimal UserBookmark fixture with only required fields
 */
export const createMinimalUserBookmarkFixture = (
    overrides: Partial<UserBookmarkType> = {}
): UserBookmarkType => {
    const minimalUserBookmark: UserBookmarkType = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480' as UserBookmarkId,
        userId: '550e8400-e29b-41d4-a716-446655440003' as UserId,
        entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c9' as PostId,
        entityType: EntityTypeEnum.POST,

        // Lifecycle fields
        lifecycleState: LifecycleStatusEnum.ACTIVE,

        // Audit fields
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
        deletedAt: undefined,
        createdById: '550e8400-e29b-41d4-a716-446655440004' as UserId,
        updatedById: '550e8400-e29b-41d4-a716-446655440004' as UserId,
        deletedById: undefined,

        // Admin fields
        adminInfo: undefined
    };

    return { ...minimalUserBookmark, ...overrides };
};

/**
 * Creates UserBookmark fixtures for different entity types
 */
export const createUserBookmarkByEntityType = (entityType: EntityTypeEnum): UserBookmarkType => {
    const entityIds = {
        [EntityTypeEnum.ACCOMMODATION]: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as AccommodationId,
        [EntityTypeEnum.POST]: '6ba7b810-9dad-11d1-80b4-00c04fd430c9' as PostId,
        [EntityTypeEnum.EVENT]: '6ba7b810-9dad-11d1-80b4-00c04fd430ca' as EventId,
        [EntityTypeEnum.DESTINATION]: '6ba7b810-9dad-11d1-80b4-00c04fd430cb' as DestinationId,
        [EntityTypeEnum.USER]: '6ba7b810-9dad-11d1-80b4-00c04fd430cc' as UserId
    };

    const names = {
        [EntityTypeEnum.ACCOMMODATION]: 'Favorite Hotel',
        [EntityTypeEnum.POST]: 'Interesting Article',
        [EntityTypeEnum.EVENT]: 'Must Attend Event',
        [EntityTypeEnum.DESTINATION]: 'Dream Destination',
        [EntityTypeEnum.USER]: 'Favorite User'
    };

    return createUserBookmarkFixture({
        entityId: entityIds[entityType],
        entityType,
        name: names[entityType]
    });
};

/**
 * Creates multiple UserBookmark fixtures for testing lists
 */
export const createUserBookmarkListFixture = (count = 3): UserBookmarkType[] => {
    return Array.from({ length: count }, (_, index) =>
        createUserBookmarkFixture({
            id: `f47ac10b-58cc-4372-a567-0e02b2c3d${(479 + index).toString().padStart(3, '0')}` as UserBookmarkId,
            name: `Bookmark ${index + 1}`,
            entityId: `6ba7b810-9dad-11d1-80b4-00c04fd430c${index}` as AccommodationId
        })
    );
};

/**
 * Creates UserBookmark input data for creation (without server-generated fields)
 */
export const createUserBookmarkInputFixture = (overrides: Record<string, unknown> = {}) => {
    return {
        userId: '550e8400-e29b-41d4-a716-446655440001' as UserId,
        entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as AccommodationId,
        entityType: EntityTypeEnum.ACCOMMODATION,
        name: 'My Favorite Place',
        description: 'A wonderful place I want to remember',
        ...overrides
    };
};

/**
 * Creates UserBookmark edge cases for validation testing
 */
export const createUserBookmarkEdgeCases = () => {
    return {
        // Minimum valid values
        minValues: {
            userId: '550e8400-e29b-41d4-a716-446655440001' as UserId,
            entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as AccommodationId,
            entityType: EntityTypeEnum.ACCOMMODATION,
            name: 'ABC', // 3 chars minimum
            description: 'Short desc' // 10 chars minimum
        },

        // Maximum valid values
        maxValues: {
            userId: '550e8400-e29b-41d4-a716-446655440001' as UserId,
            entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as AccommodationId,
            entityType: EntityTypeEnum.ACCOMMODATION,
            name: 'A'.repeat(100), // 100 chars maximum
            description: 'A'.repeat(300) // 300 chars maximum
        },

        // Invalid values for testing validation
        invalidValues: {
            invalidUserId: 'not-a-uuid',
            invalidEntityId: 'not-a-uuid',
            invalidEntityType: 'INVALID_TYPE',
            nameTooShort: 'AB', // 2 chars (below minimum)
            nameTooLong: 'A'.repeat(101), // 101 chars (above maximum)
            descriptionTooShort: 'Short', // 5 chars (below minimum)
            descriptionTooLong: 'A'.repeat(301) // 301 chars (above maximum)
        }
    };
};
