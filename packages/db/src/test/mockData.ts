import type {
    AccommodationType,
    DestinationType,
    DestinationWithRelationsType,
    FeatureType,
    PublicUserType,
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

/**
 * Returns a mock AccommodationType object.
 * You can override any field by passing an object with the desired values.
 *
 * @param overrides - Partial fields to override in the mock.
 * @returns AccommodationType
 * @example
 * const acc = getMockAccommodation({ id: 'acc-2' as AccommodationId, visibility: VisibilityEnum.PRIVATE });
 */
export const getMockAccommodation = (
    overrides: Partial<AccommodationType> = {}
): AccommodationType => ({
    id: 'acc-uuid' as AccommodationId,
    slug: 'hotel-uruguay',
    name: 'Hotel Uruguay',
    summary: 'Un hotel en Uruguay',
    type: AccommodationTypeEnum.HOTEL,
    description: 'Descripción completa',
    ownerId: 'user-uuid' as UserId,
    destinationId: 'dest-uuid' as DestinationId,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    isFeatured: false,
    reviewsCount: 0,
    averageRating: 0,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    adminInfo: undefined,
    ...overrides
});

export const mockAccommodation = getMockAccommodation();

/**
 * Returns a mock UserType object.
 * You can override any field by passing an object with the desired values.
 *
 * @param overrides - Partial fields to override in the mock.
 * @returns UserType
 * @example
 * const user = getMockUser({ id: 'user-2' as UserId });
 */
export const getMockUser = (overrides: Partial<UserType> = {}): UserType => ({
    id: 'user-1' as UserId,
    userName: 'testuser',
    password: 'pw',
    role: RoleEnum.ADMIN,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-1' as UserId,
    updatedById: 'user-1' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...overrides
});

/**
 * Returns a mock PublicUserType object.
 *
 * @returns PublicUserType
 * @example
 * const publicUser = getMockPublicUser();
 */
export const getMockPublicUser = (): PublicUserType => createPublicUser();

// UUIDs y datos base reutilizables para tests de service
export const getMockUserId = (): UserId => '11111111-1111-1111-1111-111111111111' as UserId;
export const getMockDestinationId = (): DestinationId =>
    '22222222-2222-2222-2222-222222222222' as DestinationId;
export const getMockAdminRoleId = (): RoleId => 'ADMIN' as RoleId;
export const getMockNoPermRoleId = (): RoleId => 'role-1' as RoleId;
export const getMockAccommodationId = (): AccommodationId => 'acc-99' as AccommodationId;

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
        seoTitle: 'SEO title',
        seoDescription: 'SEO desc',
        title: 'SEO title',
        description: 'SEO desc'
    },
    tags: [],
    adminInfo: { notes: 'Notas válidas', favorite: false },
    createdById: getMockUserId(),
    updatedById: getMockUserId(),
    createdAt: new Date(),
    updatedAt: new Date()
});

export const getMockAccommodationCreated = () =>
    getMockAccommodation({
        ...getMockAccommodationInput(),
        id: getMockAccommodationId()
    });

export const getMockTag = (overrides: Partial<TagType> = {}): TagType => ({
    id: 'tag-1' as TagId,
    name: 'Test Tag',
    color: TagColorEnum.BLUE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-1' as UserId,
    updatedById: 'user-1' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...overrides
});

export const mockTag = getMockTag();

export const getMockEntityTag = (overrides: Partial<EntityTagType> = {}): EntityTagType => ({
    tagId: 'tag-1' as TagId,
    entityId: 'acc-1' as AccommodationId,
    entityType: EntityTypeEnum.ACCOMMODATION,
    ...overrides
});

export const mockEntityTag = getMockEntityTag();

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
