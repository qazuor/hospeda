# Types Package Documentation

This package contains all the TypeScript types and interfaces used across the Hospeda application. It's organized into three main directories: `common`, `entities`, and `enums`.

## Directory Structure

```
src/
├── common/                    # Shared types and interfaces
│   ├── admin.types.ts        # Admin-related types
│   ├── contact.types.ts      # Contact information types
│   ├── helpers.types.ts      # Helper type compositions
│   ├── id.types.ts           # ID type definitions
│   ├── index.ts              # Common types exports
│   ├── location.types.ts     # Location-related types
│   ├── media.types.ts        # Media-related types
│   ├── price.types.ts        # Price-related types
│   ├── seo.types.ts          # SEO-related types
│   ├── social.types.ts       # Social network types
│   └── tag.types.ts          # Tag-related types
│
├── entities/                  # Entity-specific types
│   ├── accommodation/        # Accommodation-related types
│   ├── destination/         # Destination-related types
│   ├── event/              # Event-related types
│   ├── post/               # Post-related types
│   ├── user/               # User-related types
│   └── index.ts            # Entity types exports
│
├── enums/                    # Enumeration types
│   ├── accommodation-type.enum.ts
│   ├── amenity-type.enum.ts
│   ├── client-type.enum.ts
│   ├── contact-preference.enum.ts
│   ├── currency.enum.ts
│   ├── entity-type.enum.ts
│   ├── event-category.enum.ts
│   ├── index.ts
│   ├── lifecycle-state.enum.ts
│   ├── permission.enum.ts
│   ├── post-category.enum.ts
│   ├── recurrence.enum.ts
│   ├── role.enum.ts
│   ├── state.enum.ts
│   ├── tag-color.enum.ts
│   └── visibility.enum.ts
│
└── index.ts                  # Main package exports
```

## Common Types

### ID Types (`id.types.ts`)

#### `Brand<K, T>`

```typescript
type Brand<K, T> = K & { __brand: T };
```

#### Entity IDs

```typescript
type UserId = Brand<string, 'UserId'>;
type UserBookmarkId = Brand<string, 'UserBookmarkId'>;
type TagId = Brand<string, 'TagId'>;
type AccommodationId = Brand<string, 'AccommodationId'>;
type AmenityId = Brand<string, 'AmenityId'>;
type FeatureId = Brand<string, 'FeatureId'>;
type DestinationId = Brand<string, 'DestinationId'>;
type AttractionId = Brand<string, 'AttractionId'>;
type EventId = Brand<string, 'EventId'>;
type EventLocationId = Brand<string, 'EventLocationId'>;
type EventOrganizerId = Brand<string, 'EventOrganizerId'>;
type PostId = Brand<string, 'PostId'>;
type PostSponsorId = Brand<string, 'PostSponsorId'>;
type PostSponsorshipId = Brand<string, 'PostSponsorshipId'>;
```

### Admin Types (`admin.types.ts`)

#### `AdminInfoType`

```typescript
interface AdminInfoType extends WithTags {
    notes?: string;
    favorite: boolean;
}
```

### Tag Types (`tag.types.ts`)

#### `TagType`

```typescript
interface TagType extends WithId, WithAudit, WithLifecycleState, WithAdminInfo {
    name: string;
    color: string;
    icon?: string;
    notes?: string;
}
```

### Helper Types (`helpers.types.ts`)

#### `WithId`

```typescript
type WithId = {
    id: string;
};
```

#### `WithAudit`

```typescript
type WithAudit = {
    createdAt: Date;
    updatedAt: Date;
    createdById: UserId;
    updatedById: UserId;
    deletedAt?: Date;
    deletedById?: UserId;
};
```

#### `WithReviewState`

```typescript
type WithReviewState = {
    reviewsCount?: number;
    averageRating?: number;
};
```

#### `WithModerationState`

```typescript
type WithModerationState = {
    moderationState: ModerationStatusEnum;
};
```

#### `WithLifecycleState`

```typescript
type WithLifecycleState = {
    lifecycle: LifecycleStatusEnum;
};
```

#### `WithVisibility`

```typescript
type WithVisibility = {
    visibility: VisibilityEnum;
};
```

#### `WithAdminInfo`

```typescript
interface WithAdminInfo {
    adminInfo?: AdminInfoType;
}
```

#### `WithTags`

```typescript
interface WithTags {
    tags?: TagType[];
}
```

#### `WithSeo`

```typescript
interface WithSeo {
    seo?: SeoType[];
}
```

#### `WithRelations`

```typescript
type WithRelations<T extends object> = {
    [K in keyof T]?: T[K];
};
```

### Utility Types

#### `With<T, K>`

```typescript
type With<T, K extends keyof T> = T & Required<Pick<T, K>>;
```

#### `WithOptional<T, K>`

```typescript
type WithOptional<T, K extends keyof T> = T & Partial<Pick<T, K>>;
```

#### `Writable<T>`

```typescript
type Writable<T> = { -readonly [P in keyof T]: T[P] };
```

#### `NewEntityInput<T>`

```typescript
type NewEntityInput<T extends { id: string; createdAt: Date }> = Omit<
    T,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById' | 'updatedById' | 'deletedById'
>;
```

#### `PartialEntity<T>`

```typescript
type PartialEntity<T> = Partial<Writable<T>>;
```

### Contact Types (`contact.types.ts`)

#### `ContactInfoType`

```typescript
interface ContactInfoType {
    personalEmail?: string;
    workEmail?: string;
    homePhone?: string;
    workPhone?: string;
    mobilePhone: string;
    website?: string;
    preferredEmail?: PreferedContactEnum;
    preferredPhone?: PreferedContactEnum;
}
```

### Location Types (`location.types.ts`)

#### `LocationType`

```typescript
interface LocationType {
    state: string;
    zipCode: string;
    country: string;
    coordinates?: CoordinatesType;
}
```

#### `FullLocationType`

```typescript
interface FullLocationType extends LocationType {
    street: string;
    number: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    department?: string;
}
```

### Media Types (`media.types.ts`)

#### `MediaType`

```typescript
interface MediaType {
    featuredImage: ImageType;
    gallery?: ImageType[];
    videos?: VideoType[];
}
```

#### `ImageType`

```typescript
interface ImageType {
    url: string;
    caption?: string;
    description?: string;
    tags?: TagType[];
    state: StateEnum;
}
```

#### `VideoType`

```typescript
interface VideoType {
    url: string;
    caption?: string;
    description?: string;
    tags?: TagType[];
    state: StateEnum;
}
```

### Price Types (`price.types.ts`)

#### `BasePriceType`

```typescript
interface BasePriceType {
    price?: number;
    currency?: PriceCurrencyEnum;
}
```

### SEO Types (`seo.types.ts`)

#### `SeoType`

```typescript
interface SeoType {
    title?: string;
    description?: string;
    keywords?: string[];
}
```

### Social Types (`social.types.ts`)

#### `SocialNetworkType`

```typescript
interface SocialNetworkType {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedIn?: string;
    tiktok?: string;
}
```

## Entities

### User Entity (`user.types.ts`)

#### `UserType`

```typescript
interface UserType extends WithId, WithAudit, WithLifecycleState, WithAdminInfo {
    id: UserId;
    userName: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    brithDate?: Date;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    contactInfo?: ContactInfoType;
    location?: FullLocationType;
    socialNetworks?: SocialNetworkType;
    role: RoleEnum;
    permissionIds?: PermissionId[];
    profile?: UserProfile;
    settings?: UserSettingsType;
    bookmarks?: UserBookmarkType[];
}
```

#### `UserProfile`

```typescript
interface UserProfile {
    avatar?: string;
    bio?: string;
    website?: string;
    occupation?: string;
}
```

#### `UserSettingsType`

```typescript
interface UserSettingsType {
    darkMode?: boolean;
    language?: string;
    notifications: UserNotificationsType;
}
```

#### `UserNotificationsType`

```typescript
interface UserNotificationsType {
    enabled: boolean;
    allowEmails: boolean;
    allowSms: boolean;
    allowPush: boolean;
}
```

#### `UserBookmarkType`

```typescript
interface UserBookmarkType {
    ownerId: string;
    owner?: UserType;
    entityId: string;
    entity?: AccommodationType | DestinationType | UserType | PostType | EventType;
    entityType: EntityTypeEnum;
    name?: string;
    description?: string;
}
```

### Accommodation Entity (`accommodation.types.ts`)

#### `AccommodationType`

```typescript
interface AccommodationType extends WithId, WithAudit, WithLifecycleState, WithVisibility, WithReviewState, WithTags, WithSeo, WithAdminInfo {
    slug: string;
    name: string;
    summary: string;
    type: AccommodationTypeEnum;
    description: string;
    contactInfo: ContactInfoType;
    socialNetworks: SocialNetworkType;
    price: AccommodationPriceType;
    location: FullLocationType;
    media?: MediaType;
    isFeatured?: boolean;
    ownerId: UserId;
    owner?: UserType;
    destinationId: DestinationId;
    destination?: DestinationType;
    features?: AccommodationFeatureType[];
    amenities?: AccommodationAmenityType[];
    reviews?: AccommodationReviewType[];
    rating?: AccommodationRatingType;
    schedule?: ScheduleType;
    extraInfo?: ExtraInfoType;
    faqs?: AccommodationFaqType[];
    iaData?: AccommodationIaDataType[];
}
```

#### `AccommodationPriceType`

```typescript
interface AccommodationPriceType extends BasePriceType {
    additionalFees?: AdditionalFeesType;
    discounts?: DiscountsType;
}
```

#### `AdditionalFeesType`

```typescript
interface AdditionalFeesType {
    cleaning?: AdditionalFeesInfoType;
    tax?: AdditionalFeesInfoType;
    lateCheckout?: AdditionalFeesInfoType;
    pets?: AdditionalFeesInfoType;
    bedlinen?: AdditionalFeesInfoType;
    towels?: AdditionalFeesInfoType;
    babyCrib?: AdditionalFeesInfoType;
    babyHighChair?: AdditionalFeesInfoType;
    extraBed?: AdditionalFeesInfoType;
    securityDeposit?: AdditionalFeesInfoType;
    extraGuest?: AdditionalFeesInfoType;
    parking?: AdditionalFeesInfoType;
    earlyCheckin?: AdditionalFeesInfoType;
    lateCheckin?: AdditionalFeesInfoType;
    luggageStorage?: AdditionalFeesInfoType;
    others?: OtherAdditionalFeesType[];
}
```

#### `AdditionalFeesInfoType`

```typescript
interface AdditionalFeesInfoType extends BasePriceType {
    isIncluded?: boolean;
    isOptional?: boolean;
    isPercent?: boolean;
    isPerStay?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
}
```

#### `DiscountsType`

```typescript
interface DiscountsType {
    weekly?: DiscountInfoType;
    monthly?: DiscountInfoType;
    lastMinute?: DiscountInfoType;
    others?: OtherDiscountType[];
}
```

#### `DiscountInfoType`

```typescript
interface DiscountInfoType extends BasePriceType {
    isIncluded?: boolean;
    isOptional?: boolean;
    isPercent?: boolean;
    isPerStay?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
}
```

#### `AccommodationFeatureType`

```typescript
interface AccommodationFeatureType {
    accommodationId: string;
    accommodation?: AccommodationType;
    featureId: string;
    feature?: FeatureType;
    hostReWriteName?: string | null;
    comments?: string | null;
    state: string;
    adminInfo?: AdminInfoType;
}
```

#### `AccommodationAmenityType`

```typescript
interface AccommodationAmenityType {
    accommodationId: string;
    accommodation?: AccommodationType;
    amenityId: string;
    amenity?: AmenityType;
    isOptional: boolean;
    additionalCost?: BasePriceType;
    additionalCostPercent?: number;
    state: string;
    adminInfo?: AdminInfoType;
}
```

#### `AccommodationReviewType`

```typescript
interface AccommodationReviewType {
    accommodationId: string;
    accommodation?: AccommodationType;
    userId: string;
    user?: UserType;
    title?: string;
    content?: string;
    rating: AccommodationRatingType;
}
```

#### `AccommodationRatingType`

```typescript
interface AccommodationRatingType {
    cleanliness: number;
    hospitality: number;
    services: number;
    accuracy: number;
    communication: number;
    location: number;
}
```

#### `ScheduleType`

```typescript
interface ScheduleType {
    checkinTime?: string; // HH:mm
    checkoutTime?: string; // HH:mm
    earlyCheckinAccepted: boolean;
    earlyCheckinTime?: string;
    lateCheckinAccepted: boolean;
    lateCheckinTime?: string;
    lateCheckoutAccepted: boolean;
    lateCheckoutTime?: string;
    selfCheckin: boolean;
    selfCheckout: boolean;
}
```

#### `ExtraInfoType`

```typescript
interface ExtraInfoType {
    capacity: number;
    minNights: number;
    maxNights?: number;
    bedrooms: number;
    beds?: number;
    bathrooms: number;
    smokingAllowed?: boolean;
    extraInfo?: string[];
}
```

#### `AccommodationFaqType`

```typescript
interface AccommodationFaqType {
    accommodationId: string;
    accommodation?: AccommodationType;
    question: string;
    answer: string;
    category?: string;
}
```

#### `AccommodationIaDataType`

```typescript
interface AccommodationIaDataType {
    accommodationId: string;
    accommodation?: AccommodationType;
    title: string;
    content: string;
    category?: string;
}
```

### Accommodation Feature Types (`accommodation.feature.types.ts`)

#### `FeatureType` Partial, New, Update

```typescript
export type PartialFeature = Partial<Writable<FeatureType>>;
export type NewFeatureInput = NewEntityInput<FeatureType>;
export type UpdateFeatureInput = PartialFeature;
```

### Accommodation Amenity Types (`accommodation.amenity.types.ts`)

#### `AmenityType` Partial, New, Update

```typescript
export type PartialAmenity = Partial<Writable<AmenityType>>;
export type NewAmenityInput = NewEntityInput<AmenityType>;
export type UpdateAmenityInput = PartialAmenity;
```

### Accommodation FAQ Types (`accommodation.faq.types.ts`)

#### `AccommodationFaqType` Partial, New, Update

```typescript
export type PartialAccommodationFaq = Partial<Writable<AccommodationFaqType>>;
export type NewAccommodationFaqInput = NewEntityInput<AccommodationFaqType>;
export type UpdateAccommodationFaqInput = PartialAccommodationFaq;
```

### Accommodation IA Data Types (`accommodation.ia.types.ts`)

#### `AccommodationIaDataType` Partial, New, Update

```typescript
export type PartialAccommodationIaData = Partial<Writable<AccommodationIaDataType>>;
export type NewAccommodationIaDataInput = NewEntityInput<AccommodationIaDataType>;
export type UpdateAccommodationIaDataInput = PartialAccommodationIaData;
```

### Accommodation Review Types (`accommodation.review.types.ts`)

#### `AccommodationReviewType` Partial, New, Update

```typescript
export type PartialAccommodationReview = Partial<Writable<AccommodationReviewType>>;
export type NewAccommodationReviewInput = NewEntityInput<AccommodationReviewType>;
export type UpdateAccommodationReviewInput = PartialAccommodationReview;
```

### Destination Entity (`destination.types.ts`)

#### `DestinationType`

```typescript
interface DestinationType extends WithId, WithAudit, WithLifecycleState, WithVisibility, WithReviewState, WithTags, WithSeo, WithAdminInfo {
    slug: string;
    name: string;
    summary: string;
    description: string;
    media: MediaType;
    isFeatured?: boolean;
    location: BaseLocationType;
    attractions: DestinationAttractionsType[];
    accommodationsCount?: number;
}
```

#### `DestinationAttractionsType`

```typescript
interface DestinationAttractionsType {
    name: string;
    slug: string;
    description: string;
    icon: string;
}
```

#### `DestinationRatingType`

```typescript
interface DestinationRatingType {
    landscape: number;
    attractions: number;
    accessibility: number;
    safety: number;
    cleanliness: number;
    hospitality: number;
    culturalOffer: number;
    gastronomy: number;
    affordability: number;
    nightlife: number;
    infrastructure: number;
    environmentalCare: number;
    wifiAvailability: number;
    shopping: number;
    beaches: number;
    greenSpaces: number;
    localEvents: number;
    weatherSatisfaction: number;
}
```

### Event Entity (`event.types.ts`)

#### `EventType`

```typescript
interface EventType extends WithId, WithAudit, WithLifecycleState, WithVisibility, WithTags, WithSeo, WithAdminInfo {
    slug: string;
    name: string;
    summary: string;
    description?: string;
    media?: MediaType;
    category: EventCategoryEnum;
    date: EventDateType;
    authorId: string;
    author?: UserType;
    locationId?: string;
    location?: EventLocationType;
    organizerId?: string;
    organizer?: EventOrganizerType;
    pricing?: EventPriceType;
    contact?: ContactInfoType;
    isFeatured?: boolean;
}
```

#### `EventDateType`

```typescript
interface EventDateType {
    start: Date;
    end?: Date;
    isAllDay?: boolean;
    recurrence?: RecurrenceTypeEnum;
}
```

#### `EventPriceType`

```typescript
interface EventPriceType extends BasePriceType {
    isFree: boolean;
    priceFrom?: number;
    priceTo?: number;
    pricePerGroup?: number;
}
```

#### `EventOrganizerType`

```typescript
interface EventOrganizerType extends WithId, WithAudit {
    name: string;
    logo?: string;
    contactInfo?: ContactInfoType;
    social?: SocialNetworkType;
    events?: EventType[];
}
```

#### `EventLocationType`

```typescript
interface EventLocationType extends BaseLocationType {
    id: string;
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    department?: string;
    placeName?: string;
    events?: EventType[];
}
```

### Post Entity (`post.types.ts`)

#### `PostType`

```typescript
interface PostType extends WithId, WithAudit, WithLifecycleState, WithVisibility, WithTags, WithSeo, WithAdminInfo {
    slug: string;
    category: PostCategoryEnum;
    title: string;
    summary: string;
    content: string;
    media: MediaType;
    authorId: string;
    author?: UserType;
    sponsorshipId?: string;
    sponsorship?: PostSponsorshipType;
    relatedDestinationId?: string;
    relatedDestination?: DestinationType;
    relatedAccommodationId?: string;
    relatedAccommodation?: AccommodationType;
    relatedEventId?: string;
    relatedEvent?: EventType;
    isFeatured?: boolean;
    isNews?: boolean;
    isFeaturedInWebsite?: boolean;
    expiresAt?: Date;
    likes?: number;
    comments?: number;
    shares?: number;
}
```

#### `PostSponsorType`

```typescript
interface PostSponsorType extends WithId, WithAudit {
    type: ClientTypeEnum;
    description: string;
    logo?: ImageType;
    social?: SocialNetworkType;
    contact?: ContactInfoType;
    sponsorships?: PostSponsorshipType[];
}
```

#### `PostSponsorshipType`

```typescript
interface PostSponsorshipType extends WithId, WithAudit {
    sponsorId: string;
    sponsor?: PostSponsorType;
    postId: string;
    post?: PostType;
    message?: string;
    description: string;
    paid: BasePriceType;
    paidAt?: Date;
    fromDate?: Date;
    toDate?: Date;
    isHighlighted?: boolean;
}
```

## Enums

### System Enums

#### `BuiltinPermissionTypeEnum`

```typescript
enum BuiltinPermissionTypeEnum {
    // User permissions
    USER_CREATE = 'USER_CREATE',
    USER_UPDATE = 'USER_UPDATE',
    USER_DELETE = 'USER_DELETE',

    // Destination permissions
    DESTINATION_CREATE = 'DESTINATION_CREATE',
    DESTINATION_UPDATE = 'DESTINATION_UPDATE',
    DESTINATION_DELETE = 'DESTINATION_DELETE',

    // Accommodation permissions
    ACCOMMODATION_CREATE = 'ACCOMMODATION_CREATE',
    ACCOMMODATION_UPDATE = 'ACCOMMODATION_UPDATE',
    ACCOMMODATION_DELETE = 'ACCOMMODATION_DELETE',

    // Event permissions
    EVENT_CREATE = 'EVENT_CREATE',
    EVENT_UPDATE = 'EVENT_UPDATE',
    EVENT_DELETE = 'EVENT_DELETE',

    // Post permissions
    POST_CREATE = 'POST_CREATE',
    POST_UPDATE = 'POST_UPDATE',
    POST_DELETE = 'POST_DELETE',

    // Tag permissions
    TAG_CREATE = 'TAG_CREATE',
    TAG_UPDATE = 'TAG_UPDATE',
    TAG_DELETE = 'TAG_DELETE',

    // Role and permission management
    USER_ROLE_CREATE = 'USER_ROLE_CREATE',
    USER_ROLE_UPDATE = 'USER_ROLE_UPDATE',
    USER_ROLE_DELETE = 'USER_ROLE_DELETE',
    USER_PERMISSION_CREATE = 'USER_PERMISSION_CREATE',
    USER_PERMISSION_UPDATE = 'USER_PERMISSION_UPDATE',
    USER_PERMISSION_DELETE = 'USER_PERMISSION_DELETE',

    // Post sponsor permissions
    POST_SPONSOR_CREATE = 'POST_SPONSOR_CREATE',
    POST_SPONSOR_UPDATE = 'POST_SPONSOR_UPDATE',
    POST_SPONSOR_DELETE = 'POST_SPONSOR_DELETE',

    // Amenity permissions
    AMENITY_CREATE = 'AMENITY_CREATE',
    AMENITY_UPDATE = 'AMENITY_UPDATE',
    AMENITY_DELETE = 'AMENITY_DELETE',

    // Feature permissions
    FEATURE_CREATE = 'FEATURE_CREATE',
    FEATURE_UPDATE = 'FEATURE_UPDATE',
    FEATURE_DELETE = 'FEATURE_DELETE'
}
```

#### `ModerationStatusEnum`

```typescript
enum ModerationStatusEnum {
    PENDING_REVIEW = 'PENDING_REVIEW',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    FLAGGED = 'FLAGGED'
}
```

#### `StateEnum`

```typescript
enum StateEnum {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    PENDING = 'PENDING',
    DELETED = 'DELETED'
}
```

#### `VisibilityEnum`

```typescript
enum VisibilityEnum {
    PUBLIC = 'PUBLIC',
    DRAFT = 'DRAFT',
    PRIVATE = 'PRIVATE'
}
```

#### `LifecycleStatusEnum`

```typescript
enum LifecycleStatusEnum {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ARCHIVED = 'ARCHIVED',
    SUSPENDED = 'SUSPENDED'
}
```

#### `BuiltinRoleTypeEnum`

```typescript
enum BuiltinRoleTypeEnum {
    ADMIN = 'ADMIN',
    EDITOR = 'EDITOR',
    CLIENT = 'CLIENT',
    USER = 'USER'
}
```

### Business Enums

#### `AccommodationTypeEnum`

```typescript
enum AccommodationTypeEnum {
    APARTMENT = 'APARTMENT',
    HOUSE = 'HOUSE',
    COUNTRY_HOUSE = 'COUNTRY_HOUSE',
    CABIN = 'CABIN',
    HOTEL = 'HOTEL',
    HOSTEL = 'HOSTEL',
    CAMPING = 'CAMPING',
    ROOM = 'ROOM',
    MOTEL = 'MOTEL',
    RESORT = 'RESORT'
}
```

#### `AmenitiesTypeEnum`

```typescript
enum AmenitiesTypeEnum {
    CLIMATE_CONTROL = 'CLIMATE_CONTROL',
    CONNECTIVITY = 'CONNECTIVITY',
    ENTERTAINMENT = 'ENTERTAINMENT',
    KITCHEN = 'KITCHEN',
    BED_AND_BATH = 'BED_AND_BATH',
    OUTDOORS = 'OUTDOORS',
    ACCESSIBILITY = 'ACCESSIBILITY',
    SERVICES = 'SERVICES',
    SAFETY = 'SAFETY',
    FAMILY_FRIENDLY = 'FAMILY_FRIENDLY',
    WORK_FRIENDLY = 'WORK_FRIENDLY',
    GENERAL_APPLIANCES = 'GENERAL_APPLIANCES'
}
```

#### `PostCategoryEnum`

```typescript
enum PostCategoryEnum {
    EVENTS = 'EVENTS',
    CULTURE = 'CULTURE',
    GASTRONOMY = 'GASTRONOMY',
    NATURE = 'NATURE',
    TOURISM = 'TOURISM',
    GENERAL = 'GENERAL',
    SPORT = 'SPORT',
    CARNIVAL = 'CARNIVAL',
    NIGHTLIFE = 'NIGHTLIFE',
    HISTORY = 'HISTORY',
    TRADITIONS = 'TRADITIONS',
    WELLNESS = 'WELLNESS',
    FAMILY = 'FAMILY',
    TIPS = 'TIPS',
    ART = 'ART',
    BEACH = 'BEACH',
    RURAL = 'RURAL',
    FESTIVALS = 'FESTIVALS'
}
```

#### `EventCategoryEnum`

```typescript
enum EventCategoryEnum {
    MUSIC = 'MUSIC',
    CULTURE = 'CULTURE',
    SPORTS = 'SPORTS',
    GASTRONOMY = 'GASTRONOMY',
    FESTIVAL = 'FESTIVAL',
    NATURE = 'NATURE',
    THEATER = 'THEATER',
    WORKSHOP = 'WORKSHOP',
    OTHER = 'OTHER'
}
```

#### `CurrencyEnum`

```typescript
enum CurrencyEnum {
    ARS = 'ARS',
    USD = 'USD'
}
```

#### `ClientTypeEnum`

```typescript
enum ClientTypeEnum {
    POST_SPONSOR = 'POST_SPONSOR',
    ADVERTISER = 'ADVERTISER',
    HOST = 'HOST'
}
```

#### `RecurrenceTypeEnum`

```typescript
enum RecurrenceTypeEnum {
    NONE = 'NONE',
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
    YEARLY = 'YEARLY'
}
```

#### `TagColorEnum`

```typescript
enum TagColorEnum {
    RED = 'RED',
    BLUE = 'BLUE',
    GREEN = 'GREEN',
    YELLOW = 'YELLOW',
    ORANGE = 'ORANGE',
    PURPLE = 'PURPLE',
    PINK = 'PINK',
    BROWN = 'BROWN',
    GREY = 'GREY',
    WHITE = 'WHITE',
    CYAN = 'CYAN',
    MAGENTA = 'MAGENTA',
    LIGHT_BLUE = 'LIGHT_BLUE',
    LIGHT_GREEN = 'LIGHT_GREEN'
}
```

#### `PreferedContactEnum`

```typescript
enum PreferedContactEnum {
    HOME = 'HOME',
    WORK = 'WORK',
    MOBILE = 'MOBILE'
}
```

#### `EntityTypeEnum`

```typescript
enum EntityTypeEnum {
    ACCOMMODATION = 'ACCOMMODATION',
    DESTINATION = 'DESTINATION',
    USER = 'USER',
    POST = 'POST',
    EVENT = 'EVENT'
}
```

## Additional Types

### Role Types

#### `RoleType`

```typescript
interface RoleType extends WithId, WithAudit, WithLifecycleState, WithAdminInfo {
    id: RoleId;
    name: string;
    description: string;
    isBuiltIn: boolean;
    isDeprecated?: boolean;
    isDefault?: boolean;
    permissionIds?: PermissionId[];
    userIds?: UserId[];
}
```

### Permission Types

#### `PermissionType`

```typescript
interface PermissionType extends WithId, WithAudit, WithLifecycleState, WithAdminInfo {
    id: PermissionId;
    name: string;
    description: string;
    isBuiltIn: boolean;
    isDeprecated: boolean;
    userIds?: UserId[];
    roles?: RoleEnum[];
}
```

### Amenity Types

#### `AmenityType`

```typescript
interface AmenityType extends WithId, WithAudit, WithLifecycleState, WithAdminInfo {
    id: AmenityId;
    name: string;
    description?: string;
    icon?: string;
    isBuiltin: boolean;
    type: AmenitiesTypeEnum;
}
```

## Usage Examples

### Basic Type Usage

```typescript
import type { UserType } from '@hospeda/types';
import type { WithId, WithAudit } from '@hospeda/types/common';

// Create a new user
const newUser: NewEntityInput<UserType> = {
    userName: 'john_doe',
    passwordHash: 'hashed_password',
    role: 'user_role'
};

// Update an existing user
const userUpdate: PartialEntity<UserType> = {
    firstName: 'John',
    lastName: 'Doe'
};
```

### Type Guards

```typescript
import type { AccommodationType, DestinationType, EntityTypeEnum } from '@hospeda/types';

function isAccommodation(entity: unknown): entity is AccommodationType {
    return (entity as AccommodationType)?.type !== undefined;
}

function getEntityType(id: string, type: EntityTypeEnum) {
    switch(type) {
        case EntityTypeEnum.ACCOMMODATION:
            return fetchAccommodation(id);
        case EntityTypeEnum.DESTINATION:
            return fetchDestination(id);
        // Other cases...
    }
}
```

### Working with Enums

```typescript
import { AccommodationTypeEnum, AmenitiesTypeEnum } from '@hospeda/types';

// Type-safe accommodation creation
const accommodation = {
    type: AccommodationTypeEnum.APARTMENT,
    amenities: [
        AmenitiesTypeEnum.CLIMATE_CONTROL,
        AmenitiesTypeEnum.CONNECTIVITY
    ]
};

// Enum validation
function isValidAccommodationType(type: string): type is AccommodationTypeEnum {
    return Object.values(AccommodationTypeEnum).includes(type as AccommodationTypeEnum);
}
```

## Best Practices

1. **Type Composition**
   - Always extend from appropriate base types (WithId, WithAudit, etc.)
   - Use composition over inheritance when possible
   - Leverage utility types for common patterns

2. **Type Safety**
   - Use enums instead of string literals
   - Avoid using `any` type
   - Use type guards for runtime type checking

3. **Database Integration**
   - Keep type definitions in sync with database schema
   - Use NewEntityInput type when creating new entities
   - Use PartialEntity type when updating existing entities

4. **Code Organization**
   - Group related types in appropriate files
   - Use clear and consistent naming conventions
   - Document complex types with comments

5. **Performance**
   - Use type imports instead of value imports
   - Avoid unnecessary type complexity
   - Use utility types to reduce code duplication

6. **Enum Usage**
   - Use enums for fixed sets of values
   - Group related enums together
   - Add comments for complex enum values
   - Use type guards with enums for runtime validation

7. **Type Organization**
   - Keep related types in the same file
   - Use clear file naming conventions
   - Export types through index files
   - Group types by domain/feature

8. **Type Safety with Enums**
   - Use string enums for better type safety
   - Add comments for complex enum values
   - Use type guards for enum validation
   - Consider using const enums for better performance

9. **Documentation**
   - Document all public types and interfaces
   - Include examples for complex types
   - Document type relationships
   - Keep documentation up to date with code changes

10. **Type Maintenance**
    - Review and update types regularly
    - Remove deprecated types
    - Keep type definitions DRY
    - Use type composition for shared properties
