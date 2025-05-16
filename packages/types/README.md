# @repo/types

Central type definitions for the Hospeda monorepo.

## Overview

The `@repo/types` package serves as the single source of truth for TypeScript type definitions across all applications and services in the Hospeda platform. It provides a comprehensive set of interfaces, types, and enums that ensure type consistency and enable strong typing throughout the codebase.

## Features

- Complete set of typed interfaces for all data models
- Enum definitions for all constrained values
- Type-safe integration between packages
- Documentation for all data structures
- Shared common types for consistency

## Structure

```
src/
├── common.types.ts         # Shared base types and interfaces
├── enums.types.ts          # All enum definitions
├── entities/               # Entity-specific types
│   ├── accommodation.types.ts
│   ├── amenity.types.ts
│   ├── destination.types.ts
│   ├── event.types.ts
│   ├── feature.types.ts
│   ├── post.types.ts
│   └── user.types.ts
└── index.ts                # Main exports
```

## Type Definitions

### Common Types

#### `BaseEntityType`
The base type for all primary entities in the system.
- `id`: string
- `name`: string
- `displayName`: string
- `state`: StateEnum
- `adminInfo?`: AdminInfoType
- `createdAt`: Date
- `createdById`: string
- `createdBy?`: UserType
- `updatedAt`: Date
- `updatedById`: string
- `updatedBy?`: UserType
- `deletedAt?`: Date
- `deletedById?`: string
- `deletedBy?`: UserType

#### `AdminInfoType`
Internal admin notes and tags used for moderation.
- `notes?`: string
- `favorite`: boolean

#### `TagType`
Tags for categorizing and filtering content.
- All properties from `BaseEntityType`
- `ownerId`: string
- `owner?`: UserType
- `notes?`: string
- `color`: string
- `icon?`: string

#### `ContactInfoType`
User or business contact details.
- `personalEmail?`: string
- `workEmail?`: string
- `homePhone?`: string
- `workPhone?`: string
- `mobilePhone`: string
- `website?`: string
- `preferredEmail`: PreferedContactEnum
- `preferredPhone`: PreferedContactEnum

#### `CoordinatesType`
Geographic coordinates.
- `lat`: string
- `long`: string

#### `BaseLocationType`
Basic location information.
- `state`: string
- `zipCode`: string
- `country`: string
- `coordinates?`: CoordinatesType

#### `FullLocationType`
Detailed location data with address.
- All properties from `BaseLocationType`
- `street`: string
- `number`: string
- `floor?`: string
- `apartment?`: string
- `neighborhood?`: string
- `city`: string
- `deparment?`: string

#### `SocialNetworkType`
Social media profiles.
- `facebook?`: string
- `twitter?`: string
- `instagram?`: string
- `linkedIn?`: string
- `tiktok?`: string

#### `BasePriceType`
Common monetary value type.
- `price?`: number
- `currency?`: PriceCurrencyEnum

#### `ImageType`
Image with metadata.
- `url`: string
- `caption?`: string
- `description?`: string
- `tags?`: TagType[]
- `state`: StateEnum

#### `VideoType`
Video with metadata.
- `url`: string
- `caption?`: string
- `description?`: string
- `tags?`: TagType[]
- `state`: StateEnum

#### `MediaType`
Collection of media content.
- `featuredImage`: ImageType
- `gallery?`: ImageType[]
- `videos?`: VideoType[]

#### `SeoType`
SEO metadata.
- `seoTitle?`: string
- `seoDescription?`: string
- `seoKeywords?`: string[]

### Accommodation Types

#### `AccommodationType`
Full representation of an accommodation listing.
- All properties from `BaseEntityType`
- `slug`: string
- `type`: AccommodationTypeEnum
- `description`: string
- `contactInfo`: ContactInfoType
- `socialNetworks`: SocialNetworkType
- `price`: AccommodationPriceType
- `ownerId`: string
- `owner?`: UserType
- `destinationId`: string
- `destination?`: DestinationType
- `location`: FullLocationType
- `features?`: FeatureType[]
- `amenities?`: AmenityType[]
- `media?`: MediaType
- `rating`: AccommodationRatingType
- `reviews?`: AccommodationReviewType[]
- `schedule?`: ScheduleType
- `extraInfo?`: ExtraInfoType
- `isFeatured?`: boolean
- `seo?`: SeoType
- `faqs?`: AccommodationFaqType[]
- `iaData?`: AccommodationIaDataType[]
- `tags?`: TagType[]

#### `AccommodationPriceType`
Price details of accommodation.
- All properties from `BasePriceType`
- `additionalFees?`: AdditionalFeesType
- `discounts?`: DiscountsType

#### `AdditionalFeesType`
Optional fees associated with a stay.
- Multiple fee types (cleaning, tax, etc.)
- `others?`: OtherAdditionalFeesType[]

#### `DiscountsType`
Optional discounts for an accommodation.
- `weekly?`: DiscountInfoType
- `monthly?`: DiscountInfoType
- `lastMinute?`: DiscountInfoType
- `others?`: OtherDiscountType[]

#### `ScheduleType`
Check-in/check-out configuration.
- `checkinTime?`: string (HH:mm)
- `checkoutTime?`: string (HH:mm)
- `earlyCheckinAccepted`: boolean
- `earlyCheckinTime?`: string
- `lateCheckinAccepted`: boolean
- `lateCheckinTime?`: string
- `lateCheckoutAccepted`: boolean
- `lateCheckoutTime?`: string
- `selfCheckin`: boolean
- `selfCheckout`: boolean

#### `ExtraInfoType`
Detailed information about capacity and rooms.
- `capacity`: number
- `minNights`: number
- `maxNights?`: number
- `bedrooms`: number
- `beds?`: number
- `bathrooms`: number
- `smokingAllowed?`: boolean
- `extraInfo?`: string[]

#### `AccommodationRatingType`
User rating categories for accommodation.
- `cleanliness`: number
- `hospitality`: number
- `services`: number
- `accuracy`: number
- `communication`: number
- `location`: number

#### `AccommodationReviewType`
User-submitted reviews.
- All properties from `BaseEntityType`
- `accommodationId`: string
- `accommodation?`: AccommodationType
- `title?`: string
- `content?`: string
- `rating`: AccommodationRatingType

#### `AccommodationFaqType`
Frequently asked questions for an accommodation.
- All properties from `BaseEntityType`
- `accommodationId`: string
- `accommodation?`: AccommodationType
- `question`: string
- `answer`: string
- `category?`: string

#### `AccommodationIaDataType`
AI-related content for the accommodation.
- All properties from `BaseEntityType`
- `accommodationId`: string
- `accommodation?`: AccommodationType
- `title`: string
- `content`: string
- `category?`: string

### Amenity Types

#### `AmenityType`
- All properties from `BaseEntityType`
- `description?`: string
- `icon?`: string
- `isBuiltin`: boolean
- `type`: AmenitiesTypeEnum

#### `AccommodationAmenityType`
- `accommodationId`: string
- `accommodation?`: AccommodationType
- `amenityId`: string
- `amenity?`: AmenityType
- `isOptional`: boolean
- `additionalCost?`: BasePriceType
- `additionalCostPercent?`: number
- `state`: string
- `adminInfo?`: AdminInfoType

### Feature Types

#### `FeatureType`
- All properties from `BaseEntityType`
- `description?`: string
- `icon?`: string
- `isBuiltin`: boolean

#### `AccommodationFeatureType`
- `accommodationId`: string
- `accommodation?`: AccommodationType
- `featureId`: string
- `feature?`: FeatureType
- `hostReWriteName?`: string | null
- `comments?`: string | null
- `state`: string
- `adminInfo?`: AdminInfoType

### Destination Types

#### `DestinationType`
- All properties from `BaseEntityType`
- `slug`: string
- `summary`: string
- `description`: string
- `media`: MediaType
- `isFeatured?`: boolean
- `visibility`: VisibilityEnum
- `seo?`: SeoType
- `rating?`: DestinationRatingType
- `reviews?`: DestinationReviewType[]
- `location`: BaseLocationType
- `attractions`: DestinationAttractionsType[]
- `tags?`: TagType[]

#### `DestinationAttractionsType`
- All properties from `BaseEntityType`
- `name`: string
- `slug`: string
- `description`: string
- `icon`: string

#### `DestinationRatingType`
- 18 different rating categories:
  - `landscape`: number
  - `attractions`: number
  - `accessibility`: number
  - `safety`: number
  - `cleanliness`: number
  - `hospitality`: number
  - `culturalOffer`: number
  - `gastronomy`: number
  - `affordability`: number
  - `nightlife`: number
  - `infrastructure`: number
  - `environmentalCare`: number
  - `wifiAvailability`: number
  - `shopping`: number
  - `beaches`: number
  - `greenSpaces`: number
  - `localEvents`: number
  - `weatherSatisfaction`: number

#### `DestinationReviewType`
- `userId`: string
- `user?`: UserType
- `destinationId`: string
- `destination?`: DestinationType
- `title?`: string
- `content?`: string
- `rating`: DestinationRatingType

### Event Types

#### `EventType`
- All properties from `BaseEntityType`
- `slug`: string
- `summary`: string
- `description?`: string
- `media?`: MediaType
- `category`: EventCategoryEnum
- `date`: EventDateType
- `authorId`: string
- `author?`: UserType
- `locationId?`: string
- `location?`: EventLocationType
- `organizerId?`: string
- `organizer?`: EventOrganizerType
- `pricing?`: EventPriceType
- `contact?`: ContactInfoType
- `visibility`: VisibilityEnum
- `seo?`: SeoType
- `isFeatured?`: boolean
- `tags?`: TagType[]

#### `EventDateType`
- `start`: Date
- `end?`: Date
- `isAllDay?`: boolean
- `recurrence?`: RecurrenceTypeEnum

#### `EventPriceType`
- All properties from `BasePriceType`
- `isFree`: boolean
- `priceFrom?`: number
- `priceTo?`: number
- `pricePerGroup?`: number

#### `EventOrganizerType`
- All properties from `BaseEntityType`
- `logo?`: string
- `contactInfo?`: ContactInfoType
- `social?`: SocialNetworkType
- `events?`: EventType[]

#### `EventLocationType`
- All properties from `BaseLocationType`
- `id`: string
- `street?`: string
- `number?`: string
- `floor?`: string
- `apartment?`: string
- `neighborhood?`: string
- `city`: string
- `deparment?`: string
- `placeName?`: string
- `events?`: EventType[]

### Post Types

#### `PostType`
- All properties from `BaseEntityType`
- `slug`: string
- `category`: PostCategoryEnum
- `title`: string
- `summary`: string
- `content`: string
- `media`: MediaType
- `authorId`: string
- `author?`: UserType
- `sponsorshipId?`: string
- `sponsorship?`: PostSponsorshipType
- `relatedDestinationId?`: string
- `relatedDestination?`: DestinationType
- `relatedAccommodationId?`: string
- `relatedAccommodation?`: AccommodationType
- `relatedEventId?`: string
- `relatedEvent?`: EventType
- `visibility`: VisibilityEnum
- `seo?`: SeoType
- `isFeatured?`: boolean
- `isNews?`: boolean
- `isFeaturedInWebsite?`: boolean
- `expiresAt?`: Date
- `likes?`: number
- `comments?`: number
- `shares?`: number
- `tags?`: TagType[]

#### `PostSponsorType`
- All properties from `BaseEntityType`
- `type`: ClientTypeEnum
- `description`: string
- `logo?`: ImageType
- `social?`: SocialNetworkType
- `contact?`: ContactInfoType
- `sponsorships?`: PostSponsorshipType[]

#### `PostSponsorshipType`
- All properties from `BaseEntityType`
- `sponsorId`: string
- `sponsor?`: PostSponsorType
- `postId`: string
- `post?`: PostType
- `message?`: string
- `description`: string
- `paid`: BasePriceType
- `paidAt?`: Date
- `fromDate?`: Date
- `toDate?`: Date
- `isHighlighted?`: boolean

### User Types

#### `UserType`
- All properties from `BaseEntityType`
- `userName`: string
- `passwordHash`: string
- `firstName?`: string
- `lastName?`: string
- `brithDate?`: Date
- `location?`: FullLocationType
- `contactInfo?`: ContactInfoType
- `socialNetworks?`: SocialNetworkType
- `roleId`: string
- `role?`: RoleType
- `permissionsIds?`: string[]
- `permissions?`: PermissionType[]
- `state`: StateEnum
- `emailVerified?`: boolean
- `phoneVerified?`: boolean
- `profile?`: UserProfile
- `settings?`: UserSettingsType
- `bookmarks?`: UserBookmarkType[]

#### `UserProfile`
- `avatar?`: string
- `bio?`: string
- `website?`: string
- `occupation?`: string

#### `UserSettingsType`
- `darkMode?`: boolean
- `language?`: string
- `notifications`: UserNotificationsType

#### `UserNotificationsType`
- `enabled`: boolean
- `allowEmails`: boolean
- `allowSms`: boolean
- `allowPush`: boolean

#### `UserBookmarkType`
- `ownerId`: string
- `owner?`: UserType
- `entityId`: string
- `entity?`: AccommodationType | DestinationType | UserType | PostType | EventType
- `entityType`: EntityTypeEnum
- `name?`: string
- `description?`: string

#### `RoleType`
- All properties from `BaseEntityType`
- `description`: string
- `isBuiltIn`: boolean
- `isDeprecated?`: boolean
- `isDefault?`: boolean
- `permissionIds?`: string[]
- `permissions?`: PermissionType[]
- `users?`: UserType[]

#### `PermissionType`
- All properties from `BaseEntityType`
- `description`: string
- `isBuiltIn`: boolean
- `isDeprecated`: boolean
- `userIds?`: string[]
- `users?`: UserType[]
- `roleIds?`: string[]
- `roles?`: RoleType[]

#### `RolePermissionType`
- `roleId`: string
- `role?`: RoleType
- `permissionId`: string
- `permission?`: PermissionType

#### `UserPermissionType`
- `userId`: string
- `user?`: UserType
- `permissionId`: string
- `permission?`: PermissionType

### Enums

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

#### `StateEnum`
```typescript
enum StateEnum {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    PENDING = 'PENDING',
    DELETED = 'DELETED'
}
```

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
    ROOM = 'ROOM'
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

#### `BuiltinRoleTypeEnum`
```typescript
enum BuiltinRoleTypeEnum {
    ADMIN = 'ADMIN',
    EDITOR = 'EDITOR',
    CLIENT = 'CLIENT',
    USER = 'USER'
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
    SPORT = 'SPORT'
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

#### `PriceCurrencyEnum`
```typescript
enum PriceCurrencyEnum {
    ARS = 'ARS',
    USD = 'USD'
}
```

## Usage Examples

### Basic Type Usage

```typescript
import { AccommodationType, StateEnum } from '@repo/types';

// Create a variable of a specific type
const accommodation: AccommodationType = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'beach-house',
  displayName: 'Beach House',
  state: StateEnum.ACTIVE,
  // Other required properties...
};
```

### Using with API Responses

```typescript
import { UserType } from '@repo/types';

async function fetchUser(id: string): Promise<UserType> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  return data as UserType;
}
```

### Type Guards

```typescript
import { AccommodationType, DestinationType, EntityTypeEnum } from '@repo/types';

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

### Extending Types

```typescript
import { BaseEntityType, ContactInfoType } from '@repo/types';

interface CustomEntityType extends BaseEntityType {
  customField: string;
  extraContact: ContactInfoType;
}
```

## Best Practices

1. **Don't modify types directly**: Always extend from base types instead of modifying them
2. **Keep types in sync with schemas**: Ensure types match validation schemas in `@repo/schemas`
3. **Use enums for fixed values**: Leverage enums to ensure type safety for constrained values
4. **Follow type naming conventions**:
   - Use PascalCase for interface and type names
   - Add `Type` suffix to interfaces (e.g., `UserType`)
   - Add `Enum` suffix to enums (e.g., `StateEnum`)
5. **Use nullable properties carefully**: Prefer optional properties (`property?:`) over nullable (`property: string | null`)
6. **Document complex types**: Add comments for properties that need clarification

## License

This package is part of the Hospeda monorepo and is subject to the same licensing terms.
