import type {
    AccommodationType,
    DestinationType,
    DestinationWithRelationsType,
    FeatureType,
    PublicUserType,
    SeoType,
    TagType,
    UserType
} from '@repo/types';
import { EntityTypeEnum, TagColorEnum, createPublicUser } from '@repo/types';
import type {
    AccommodationId,
    AttractionId,
    DestinationId,
    DestinationReviewId,
    EventId,
    EventLocationId,
    FeatureId,
    PostId,
    PostSponsorId,
    RoleId,
    TagId,
    UserBookmarkId,
    UserId
} from '@repo/types/common/id.types';
import type { AttractionType } from '@repo/types/entities/destination/destination.attraction.types';
import type { DestinationReviewType } from '@repo/types/entities/destination/destination.review.types';
import type { EventLocationType } from '@repo/types/entities/event/event.location.types';
import type { EventType } from '@repo/types/entities/event/event.types';
import type { PostSponsorType } from '@repo/types/entities/post/post.sponsor.types';
import type { PostType } from '@repo/types/entities/post/post.types';
import type { EntityTagType } from '@repo/types/entities/tag/tag.types';
import type { UserBookmarkType } from '@repo/types/entities/user/user.bookmark.types';
import { AccommodationTypeEnum } from '@repo/types/enums/accommodation-type.enum';
import { ClientTypeEnum } from '@repo/types/enums/client-type.enum';
import { EventCategoryEnum } from '@repo/types/enums/event-category.enum';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { PostCategoryEnum } from '@repo/types/enums/post-category.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { expect } from 'vitest';

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

export const mockAccommodation = getMockAccommodation();

/**
 * Returns a mock UserType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns UserType
 * @example
 * const user = getMockUser({ id: 'user-2' as UserId });
 */
export const getMockUser = (overrides: Partial<UserType> = {}): UserType => ({
    id: '11111111-1111-1111-1111-111111111111' as UserId,
    userName: 'testuser',
    password: 'pw',
    role: RoleEnum.ADMIN,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '11111111-1111-1111-1111-111111111111' as UserId,
    updatedById: '11111111-1111-1111-1111-111111111111' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...overrides
});

/**
 * Returns a mock PublicUserType object.
 * @returns PublicUserType
 * @example
 * const publicUser = getMockPublicUser();
 */
export const getMockPublicUser = (): PublicUserType => createPublicUser();

/**
 * Returns a mock UserId for testing purposes.
 * @returns UserId
 * @example
 * const id = getMockUserId();
 */
export const getMockUserId = (): UserId => '11111111-1111-1111-1111-111111111111' as UserId;

/**
 * Returns a mock DestinationId for testing purposes.
 * @returns DestinationId
 * @example
 * const id = getMockDestinationId();
 */
export const getMockDestinationId = (): DestinationId =>
    '22222222-2222-2222-2222-222222222222' as DestinationId;

/**
 * Returns a mock RoleId for admin role.
 * @returns RoleId
 * @example
 * const id = getMockAdminRoleId();
 */
export const getMockAdminRoleId = (): RoleId => 'ADMIN' as RoleId;

/**
 * Returns a mock RoleId for a role with no permissions.
 * @returns RoleId
 * @example
 * const id = getMockNoPermRoleId();
 */
export const getMockNoPermRoleId = (): RoleId => 'role-1' as RoleId;

/**
 * Returns a mock AccommodationId for testing purposes.
 * @returns AccommodationId
 * @example
 * const id = getMockAccommodationId();
 */
export const getMockAccommodationId = (): AccommodationId => 'acc-99' as AccommodationId;

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
    seo: {
        title: 'Título SEO válido para test de alojamiento (máx 60)',
        description:
            'Descripción SEO suficientemente larga para pasar la validación de Zod. Debe tener más de 70 caracteres para que pase.',
        keywords: ['hotel', 'nuevo', 'moderno'] as string[]
    } as SeoType,
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

/**
 * Returns a mock TagType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns TagType
 * @example
 * const tag = getMockTag({ id: 'tag-2' as TagId });
 */
export const getMockTag = (overrides: Partial<TagType> = {}): TagType => ({
    id: '33333333-3333-3333-3333-333333333333' as TagId,
    name: 'Test Tag',
    color: TagColorEnum.BLUE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '11111111-1111-1111-1111-111111111111' as UserId,
    updatedById: '11111111-1111-1111-1111-111111111111' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...overrides
});

export const mockTag = getMockTag();

/**
 * Returns a mock EntityTagType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EntityTagType
 * @example
 * const entityTag = getMockEntityTag({ tagId: 'tag-2' as TagId });
 */
export const getMockEntityTag = (overrides: Partial<EntityTagType> = {}): EntityTagType => ({
    tagId: 'tag-1' as TagId,
    entityId: 'acc-1' as AccommodationId,
    entityType: EntityTypeEnum.ACCOMMODATION,
    ...overrides
});

export const mockEntityTag = getMockEntityTag();

/**
 * Returns a mock UserBookmarkType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns UserBookmarkType
 * @example
 * const bookmark = getMockUserBookmark({ id: 'bookmark-2' as UserBookmarkId });
 */
export const getMockUserBookmark = (
    overrides: Partial<UserBookmarkType> = {}
): UserBookmarkType => ({
    id: 'bookmark-uuid' as UserBookmarkId,
    entityId: 'accommodation-uuid' as AccommodationId,
    entityType: EntityTypeEnum.DESTINATION,
    name: 'Mi destino favorito',
    description: 'Un destino que quiero visitar',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined,
    ...overrides
});

export const mockUserBookmark = getMockUserBookmark();

/**
 * Returns a mock DestinationType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns DestinationType
 * @example
 * const dest = getMockDestination({ id: 'destination-2' as DestinationId });
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

export const mockDestination = getMockDestination();

/**
 * Returns a mock DestinationWithRelationsType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns DestinationWithRelationsType
 * @example
 * const dest = getMockDestinationWithRelations({ id: 'destination-2' as DestinationId });
 */
export const getMockDestinationWithRelations = (
    overrides: Partial<DestinationWithRelationsType> = {}
): DestinationWithRelationsType => ({
    ...mockDestination,
    accommodations: [],
    reviews: [],
    tags: [],
    attractions: [],
    ...overrides
});

export const mockDestinationWithRelations = getMockDestinationWithRelations();

/**
 * Returns a mock EventType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EventType
 * @example
 * const event = getMockEvent({ id: 'event-2' as EventId });
 */
export const getMockEvent = (overrides: Partial<EventType> = {}): EventType => ({
    id: 'event-uuid' as EventId,
    slug: 'fiesta-nacional',
    summary: 'Fiesta Nacional',
    description: 'Una fiesta popular',
    media: undefined,
    category: EventCategoryEnum.FESTIVAL,
    date: { start: new Date(), end: new Date() },
    authorId: 'user-uuid' as UserId,
    locationId: undefined,
    organizerId: undefined,
    pricing: undefined,
    contact: undefined,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: undefined,
    tags: [],
    seo: undefined,
    ...overrides
});

export const mockEvent = getMockEvent();

/**
 * Returns a mock PostType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns PostType
 * @example
 * const post = getMockPost({ id: 'post-2' as PostId });
 */
export const getMockPost = (overrides: Partial<PostType> = {}): PostType => ({
    id: 'post-uuid' as PostId,
    slug: 'post-slug',
    category: PostCategoryEnum.GENERAL,
    title: 'Título del post',
    summary: 'Resumen',
    content: 'Contenido',
    media: {
        featuredImage: {
            url: 'https://example.com/image.jpg',
            moderationState: ModerationStatusEnum.PENDING_REVIEW
        }
    },
    authorId: 'user-uuid' as UserId,
    sponsorshipId: undefined,
    relatedDestinationId: undefined,
    relatedAccommodationId: undefined,
    relatedEventId: undefined,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    isNews: false,
    isFeaturedInWebsite: false,
    expiresAt: undefined,
    likes: 0,
    comments: 0,
    shares: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    seo: undefined,
    tags: [],
    ...overrides
});

export const mockPost = getMockPost();

/**
 * Returns a mock PostSponsorType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns PostSponsorType
 * @example
 * const sponsor = getMockPostSponsor({ id: 'sponsor-2' as PostSponsorId });
 */
export const getMockPostSponsor = (overrides: Partial<PostSponsorType> = {}): PostSponsorType => ({
    id: 'sponsor-uuid' as PostSponsorId,
    name: 'Sponsor Name',
    type: ClientTypeEnum.POST_SPONSOR,
    description: 'Sponsor description',
    logo: undefined,
    contact: undefined,
    social: undefined,
    adminInfo: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...overrides
});

export const mockPostSponsor = getMockPostSponsor();

/**
 * Returns a mock FeatureType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns FeatureType
 * @example
 * const feature = getMockFeature({ id: 'feature-2' as FeatureId });
 */
export const getMockFeature = (overrides: Partial<FeatureType> = {}): FeatureType => ({
    id: 'feature-uuid' as FeatureId,
    name: 'General Feature',
    description: 'A general feature',
    icon: 'star',
    isBuiltin: true,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: { favorite: false },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedAt: undefined,
    deletedById: undefined,
    ...overrides
});

export const mockFeature = getMockFeature();

/**
 * Returns a mock AttractionType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns AttractionType
 * @example
 * const attraction = getMockAttraction({ id: 'attr-2' as AttractionId });
 */
export const getMockAttraction = (overrides: Partial<AttractionType> = {}): AttractionType => ({
    id: 'attr-uuid' as AttractionId,
    slug: 'parque-urquiza',
    name: 'Parque Urquiza',
    description: 'Un parque emblemático',
    icon: '🌳',
    isBuiltin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    adminInfo: undefined,
    ...overrides
});

export const mockAttraction = getMockAttraction();

/**
 * Returns a mock DestinationReviewType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns DestinationReviewType
 * @example
 * const review = getMockDestinationReview({ id: 'review-2' as DestinationReviewId });
 */
export const getMockDestinationReview = (
    overrides: Partial<DestinationReviewType> = {}
): DestinationReviewType => ({
    id: 'review-uuid' as DestinationReviewId,
    destinationId: 'dest-uuid' as DestinationId,
    userId: 'user-uuid' as UserId,
    title: 'Hermoso lugar',
    content: 'La experiencia fue increíble.',
    rating: {
        landscape: 5,
        attractions: 5,
        accessibility: 4,
        safety: 5,
        cleanliness: 5,
        hospitality: 5,
        culturalOffer: 4,
        gastronomy: 5,
        affordability: 4,
        nightlife: 3,
        infrastructure: 4,
        environmentalCare: 5,
        wifiAvailability: 4,
        shopping: 3,
        beaches: 4,
        greenSpaces: 5,
        localEvents: 4,
        weatherSatisfaction: 5
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    ...overrides
});

export const mockDestinationReview = getMockDestinationReview();

/**
 * Returns a mock EventLocationType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EventLocationType
 * @example
 * const location = getMockEventLocation({ id: 'location-2' as EventLocationId });
 */
export const getMockEventLocation = (
    overrides: Partial<EventLocationType> = {}
): EventLocationType => ({
    id: 'location-uuid' as EventLocationId,
    street: 'Calle Falsa',
    number: '123',
    floor: '1',
    apartment: 'A',
    neighborhood: 'Centro',
    city: 'Ciudad',
    department: 'Depto',
    placeName: 'Salón',
    state: 'Entre Ríos',
    zipCode: '3200',
    country: 'AR',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined,
    ...overrides
});

export const mockEventLocation = getMockEventLocation();

/**
 * Returns a mock AccommodationType object with PUBLIC visibility.
 * @returns AccommodationType
 * @example
 * const acc = getMockAccommodationPublic();
 */
export const getMockAccommodationPublic = (): AccommodationType =>
    getMockAccommodation({
        id: 'acc-1' as AccommodationId,
        visibility: VisibilityEnum.PUBLIC
    });

/**
 * Returns a mock AccommodationType object with PRIVATE visibility.
 * @returns AccommodationType
 * @example
 * const acc = getMockAccommodationPrivate();
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
 * @example
 * expect(result.accommodation).toMatchObject(getExpectedCreatedAccommodationMatchObject());
 */
export const getExpectedCreatedAccommodationMatchObject = () => ({
    id: getMockAccommodationId(),
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
    seo: expect.any(Object),
    tags: [],
    adminInfo: { notes: 'Notas válidas', favorite: false },
    isFeatured: false,
    reviewsCount: 0,
    averageRating: 0
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

// Mock de accommodation con media anidada
export const getMockAccommodationWithMedia = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    getMockAccommodation({
        media: mockMedia,
        ...overrides
    });

/**
 * Helper to generate a mock adminInfo fragment for entities that support admin notes and favorites.
 * @param overrides - Partial object to override default adminInfo fields.
 * @returns An object with adminInfo fields.
 * @example
 * const adminInfo = getMockAdminInfo({ notes: 'Custom note', favorite: true });
 */
export const getMockAdminInfo = (
    overrides: Partial<{ notes: string; favorite: boolean }> = {}
) => ({
    notes: 'Valid notes',
    favorite: false,
    ...overrides
});

/**
 * Helper to generate a mock SEO fragment for entities that support SEO fields.
 * @param overrides - Partial SeoType to override default SEO fields.
 * @returns A SeoType object with valid values for Zod validation.
 * @example
 * const seo = getMockSeo({ title: 'Custom SEO Title' });
 */
export const getMockSeo = (overrides: Partial<SeoType> = {}) => ({
    title: 'Valid SEO title for accommodation test (max 60)',
    description:
        'SEO description long enough to pass Zod validation. Must be more than 70 characters to be valid.',
    keywords: ['hotel', 'new', 'modern'],
    ...overrides
});

/**
 * Returns a mock AccommodationType object with UNKNOWN visibility (edge-case for testing unknown enum values).
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType with visibility set to 'UNKNOWN'.
 * @example
 * const acc = getMockAccommodationUnknownVisibility();
 */
export const getMockAccommodationUnknownVisibility = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    getMockAccommodation({
        id: 'acc-unknown' as AccommodationId,
        visibility: 'UNKNOWN' as VisibilityEnum,
        ...overrides
    });

/**
 * Returns a mock AccommodationType object with ARCHIVED lifecycleState (edge-case for testing deleted/archived entities).
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType with lifecycleState set to ARCHIVED.
 * @example
 * const acc = getMockAccommodationDeleted();
 */
export const getMockAccommodationDeleted = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    getMockAccommodation({
        id: 'acc-deleted' as AccommodationId,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        ...overrides
    });

/**
 * Returns a partial input object for updating an accommodation (only updatable fields).
 * Useful for update tests and partial update scenarios.
 * @param overrides - Partial fields to override in the mock input.
 * @returns Partial input object for accommodation update.
 * @example
 * const input = getMockAccommodationUpdateInput({ name: 'Updated Name' });
 */
export const getMockAccommodationUpdateInput = (overrides: Partial<AccommodationType> = {}) => ({
    name: 'Updated name',
    description: 'Updated description long enough for Zod.',
    seo: getMockSeo({ title: 'Updated SEO' }),
    ...overrides
});

/**
 * Returns a minimal AccommodationType mock with all optional fields (seo, tags, adminInfo) set to undefined.
 * Useful for testing required-only scenarios and Zod defaults.
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType with minimal required fields.
 * @example
 * const acc = getMockAccommodationMinimal();
 */
export const getMockAccommodationMinimal = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    getMockAccommodation({
        seo: undefined,
        tags: undefined,
        adminInfo: undefined,
        ...overrides
    });

/**
 * Returns a mock AccommodationType with owner and destination as full objects (not just IDs).
 * Useful for testing relation population and nested data scenarios.
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType with owner and destination objects.
 * @example
 * const acc = getMockAccommodationWithRelations();
 */
export const getMockAccommodationWithRelations = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType =>
    getMockAccommodation({
        owner: getMockUser(),
        destination: getMockDestination(),
        ...overrides
    });

/**
 * (DEV ONLY) Validates all main accommodation mocks against the AccommodationSchema to ensure they are always valid.
 * Uncomment and run in development to catch schema drift early.
 * @example
 * import { AccommodationSchema } from '@repo/schemas/entities/accommodation/accommodation.schema';
 * [
 *   getMockAccommodation(),
 *   getMockAccommodationMinimal(),
 *   getMockAccommodationWithMedia(),
 *   getMockAccommodationWithRelations(),
 *   getMockAccommodationUnknownVisibility(),
 *   getMockAccommodationDeleted()
 * ].forEach((mock) => {
 *   AccommodationSchema.parse(mock);
 * });
 */
