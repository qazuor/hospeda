import type { AccommodationId, AccommodationType, DestinationId, UserId } from '@repo/types';
import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/types';
import type {
    AccommodationAmenityType,
    AmenityType
} from '@repo/types/entities/accommodation/accommodation.amenity.types';
import type {
    AccommodationFeatureType,
    FeatureType
} from '@repo/types/entities/accommodation/accommodation.feature.types';
import { expect } from 'vitest';
import { getMockDestinationId } from './destinationFactory';
import { getMockUserId } from './userFactory';
import { getMockSeo } from './utilsFactory';

/**
 * Returns a mock AccommodationType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType
 * @example
 * const acc = getMockAccommodation({ id: 'acc-2' as AccommodationId, visibility: VisibilityEnum.PRIVATE });
 */
export const getMockAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => ({
    id: '11111111-1111-1111-1111-111111111111' as AccommodationId,
    slug: 'hotel-uruguay',
    name: 'Hotel Uruguay',
    summary: 'Un hotel en Uruguay',
    type: AccommodationTypeEnum.HOTEL,
    description:
        'Descripción completa y suficientemente larga para pasar la validación de Zod. Debe tener más de 30 caracteres.',
    ownerId: '11111111-1111-1111-1111-111111111111' as UserId,
    destinationId: '22222222-2222-2222-2222-222222222222' as DestinationId,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    isFeatured: false,
    reviewsCount: 0,
    averageRating: 0,
    createdById: '11111111-1111-1111-1111-111111111111' as UserId,
    updatedById: '11111111-1111-1111-1111-111111111111' as UserId,
    adminInfo: undefined,
    ...overrides
});

/**
 * Returns a mock input object for creating an accommodation.
 * @returns Object with accommodation input fields.
 * @example
 * const input = getMockAccommodationInput();
 */
export const getMockAccommodationInput = () => ({
    name: 'Nuevo Hotel',
    slug: 'nuevo-hotel',
    summary: 'Un hotel nuevo y moderno',
    type: AccommodationTypeEnum.HOTEL,
    description: 'Descripción larga y detallada del hotel, con más de 30 caracteres.',
    ownerId: getMockUserId(),
    destinationId: getMockDestinationId(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    moderationState: ModerationStatusEnum.APPROVED,
    seo: getMockSeo(),
    tags: [],
    adminInfo: { notes: 'Notas válidas', favorite: false },
    createdById: getMockUserId(),
    updatedById: getMockUserId(),
    createdAt: new Date(),
    updatedAt: new Date()
});

/**
 * Returns a mock AccommodationType object representing a created accommodation.
 * @returns AccommodationType
 * @example
 * const acc = getMockAccommodationCreated();
 */
export const getMockAccommodationCreated = () =>
    getMockAccommodation({
        ...getMockAccommodationInput(),
        id: getMockAccommodationId()
    });

export const createMockPublicAccommodation = (overrides = {}) =>
    getMockAccommodation({ visibility: VisibilityEnum.PUBLIC, ...overrides });

export const createMockPrivateAccommodation = (overrides = {}) =>
    getMockAccommodation({ visibility: VisibilityEnum.PRIVATE, ...overrides });

export const createMockArchivedAccommodation = (overrides = {}) =>
    getMockAccommodation({
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        ...overrides
    });

// Mock de featuredImage para media
export const mockFeaturedImage = {
    url: 'https://example.com/featured.jpg',
    moderationState: ModerationStatusEnum.APPROVED,
    description: 'Imagen destacada',
    tags: []
};

// Mock de gallery (array de imágenes)
export const mockGallery = [
    {
        url: 'https://example.com/gallery1.jpg',
        moderationState: ModerationStatusEnum.APPROVED,
        description: 'Imagen galería 1',
        tags: []
    },
    {
        url: 'https://example.com/gallery2.jpg',
        moderationState: ModerationStatusEnum.PENDING_REVIEW,
        description: 'Imagen galería 2',
        tags: []
    }
];

// Mock de videos (array de videos)
export const mockVideos = [
    {
        url: 'https://example.com/video1.mp4',
        moderationState: ModerationStatusEnum.APPROVED,
        description: 'Video 1',
        tags: []
    }
];

// Mock de media completo
export const mockMedia = {
    featuredImage: mockFeaturedImage,
    gallery: mockGallery,
    videos: mockVideos
};

/**
 * Returns a mock AccommodationType object with media attached.
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType with media
 */
export const getMockAccommodationWithMedia = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    getMockAccommodation({
        media: mockMedia,
        ...overrides
    });

/**
 * Returns a mock AccommodationType object with PUBLIC visibility.
 * @returns AccommodationType
 */
export const getMockAccommodationPublic = (): AccommodationType =>
    getMockAccommodation({
        id: 'acc-1' as AccommodationId,
        visibility: VisibilityEnum.PUBLIC
    });

/**
 * Returns a mock AccommodationType object with PRIVATE visibility.
 * @returns AccommodationType
 */
export const getMockAccommodationPrivate = (): AccommodationType =>
    getMockAccommodation({
        id: 'acc-2' as AccommodationId,
        name: 'Private Hotel',
        visibility: VisibilityEnum.PRIVATE
    });

/**
 * Returns the expected object shape for a created accommodation (for use in tests).
 * @returns Object with expected fields for a created accommodation.
 */
export const getExpectedCreatedAccommodationMatchObject = () => ({
    id: expect.any(String),
    name: 'Nuevo Hotel',
    slug: 'nuevo-hotel',
    summary: 'Un hotel nuevo y moderno',
    type: AccommodationTypeEnum.HOTEL,
    description: 'Descripción larga y detallada del hotel, con más de 30 caracteres.',
    ownerId: expect.any(String),
    destinationId: expect.any(String),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    moderationState: ModerationStatusEnum.APPROVED,
    seo: expect.any(Object),
    tags: [],
    adminInfo: { notes: 'Notas válidas', favorite: false },
    isFeatured: false,
    reviewsCount: 0,
    averageRating: 0
});

/**
 * Returns a mock AccommodationType object with unknown visibility.
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType
 */
export const getMockAccommodationUnknownVisibility = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    getMockAccommodation({
        id: 'acc-3' as AccommodationId,
        name: 'Unknown Visibility Hotel',
        visibility: 'UNKNOWN' as unknown as VisibilityEnum,
        ...overrides
    });

/**
 * Returns a mock AccommodationType object with deleted lifecycle state.
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType
 */
export const getMockAccommodationDeleted = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    getMockAccommodation({
        id: 'acc-4' as AccommodationId,
        name: 'Deleted Hotel',
        lifecycleState: LifecycleStatusEnum.INACTIVE,
        ...overrides
    });

/**
 * Returns a mock update input for an accommodation.
 * @param overrides - Partial fields to override in the mock.
 * @returns Object with update fields
 */
export const getMockAccommodationUpdateInput = (overrides: Partial<AccommodationType> = {}) => ({
    name: 'Updated Hotel',
    description:
        'Descripción actualizada que debe tener más de 30 caracteres para validación correcta.',
    seo: getMockSeo(),
    ...overrides
});

/**
 * Returns a minimal mock AccommodationType object.
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType
 */
export const getMockAccommodationMinimal = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    getMockAccommodation({
        id: 'acc-5' as AccommodationId,
        name: 'Minimal Hotel',
        summary: 'Minimal data',
        description: 'Descripción mínima pero válida con más de 30 caracteres',
        ...overrides
    });

/**
 * Returns a mock AccommodationType object with features and amenities relations or plain arrays.
 * @param params - Object with optional features and amenities arrays (either type), and other overrides.
 * @returns AccommodationType
 * @example
 * const acc = getMockAccommodationWithRelations({ features, amenities });
 */
export const getMockAccommodationWithRelations = ({
    features = [],
    amenities = [],
    id = '11111111-1111-1111-1111-111111111111' as AccommodationId,
    ...overrides
}: Partial<AccommodationType> & {
    features?: (FeatureType | AccommodationFeatureType)[];
    amenities?: (AmenityType | AccommodationAmenityType)[];
} = {}): AccommodationType => {
    // Si todos los features son FeatureType, pásalos directo
    const allFeaturesAreBase = features.every((f) => 'id' in f && 'name' in f);
    const adaptedFeatures = allFeaturesAreBase
        ? features
        : features.map((f) => {
              if ('featureId' in f && 'feature' in f)
                  return (f as AccommodationFeatureType).feature;
              return f;
          });
    // Lo mismo para amenities
    const allAmenitiesAreBase = amenities.every((a) => 'id' in a && 'name' in a);
    const adaptedAmenities = allAmenitiesAreBase
        ? amenities
        : amenities.map((a) => {
              if ('amenityId' in a && 'amenity' in a)
                  return (a as AccommodationAmenityType).amenity;
              return a;
          });
    return getMockAccommodation({
        id,
        features: adaptedFeatures as AccommodationFeatureType[],
        amenities: adaptedAmenities as AccommodationAmenityType[],
        ...overrides
    });
};

export const createMockAccommodationWithMedia = (overrides = {}) =>
    getMockAccommodationWithMedia({ ...overrides });

export const createMockAccommodation = (overrides = {}) => getMockAccommodation({ ...overrides });

/**
 * Returns a mock AccommodationId for testing purposes.
 * @param id - Optional specific ID to use
 * @returns AccommodationId
 */
export const getMockAccommodationId = (id?: string): AccommodationId =>
    (id && /^[0-9a-fA-F-]{36}$/.test(id)
        ? id
        : '00000000-0000-0000-0000-000000000001') as AccommodationId;
