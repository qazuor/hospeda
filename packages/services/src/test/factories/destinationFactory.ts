import type {
    DestinationId,
    DestinationType,
    DestinationWithRelationsType,
    UserId
} from '@repo/types';
import { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/types';

/**
 * Returns a mock DestinationType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns DestinationType
 */
export const getMockDestination = (overrides: Partial<DestinationType> = {}): DestinationType => ({
    id: 'destination-1' as DestinationId,
    slug: 'test-destination',
    name: 'Test Destination',
    summary: 'A test destination',
    description: 'Description',
    location: { state: '', zipCode: '', country: '' },
    media: { featuredImage: { url: '', moderationState: ModerationStatusEnum.PENDING_REVIEW } },
    isFeatured: false,
    visibility: VisibilityEnum.PUBLIC,
    accommodationsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-1' as UserId,
    updatedById: 'user-1' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    reviewsCount: 0,
    averageRating: 0,
    adminInfo: { favorite: false },
    seo: {},
    tags: [],
    attractions: [],
    reviews: [],
    ...overrides
});

/**
 * Returns a mock DestinationWithRelationsType object with default values.
 * @param overrides - Partial fields to override in the mock.
 * @returns DestinationWithRelationsType
 */
export const getMockDestinationWithRelations = (
    overrides: Partial<DestinationWithRelationsType> = {}
): DestinationWithRelationsType => ({
    ...getMockDestination(),
    accommodations: [],
    reviews: [],
    tags: [],
    attractions: [],
    ...overrides
});

export const createMockDestination = (overrides: Partial<DestinationType> = {}): DestinationType =>
    getMockDestination(overrides);

export const createMockDestinationInput = (
    overrides: Partial<Omit<DestinationType, 'id' | 'createdAt' | 'updatedAt'>> = {}
): Omit<DestinationType, 'id' | 'createdAt' | 'updatedAt'> => {
    const { id, createdAt, updatedAt, ...input } = getMockDestination();
    return { ...input, ...overrides } as Omit<DestinationType, 'id' | 'createdAt' | 'updatedAt'>;
};

export const getMockDestinationId = (id?: string): DestinationId =>
    (id && /^[0-9a-fA-F-]{36}$/.test(id)
        ? id
        : '22222222-2222-2222-2222-222222222222') as DestinationId;
