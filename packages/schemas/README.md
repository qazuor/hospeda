# @repo/schemas

Validation schemas for the Hospeda monorepo.

## Overview

The `@repo/schemas` package provides Zod validation schemas for all entities and data structures in the Hospeda platform. These schemas ensure data integrity, consistent validation, and proper error handling across the entire application stack.

## Features

- Runtime validation of all entity types
- Comprehensive error messages with i18n support
- Input validation for creation and update operations
- Type inference from schemas for strong typing
- Seamless integration with React Hook Form
- Validation rules consistent with database constraints

## Structure

```
src/
├── common.schema.ts        # Shared schemas (BaseEntity, AdminInfo, etc.)
├── enums.schema.ts         # Enum schemas using Zod.nativeEnum
├── utils/                  # Utility functions and constants
│   └── utils.ts            # Shared utilities for schemas
├── entities/               # Entity-specific schemas
│   ├── accommodation.schema.ts
│   ├── accommodation/      # Nested schemas for complex entities
│   │   ├── price.schema.ts
│   │   ├── rating.schema.ts
│   │   └── ...
│   ├── amenity.schema.ts
│   ├── destination.schema.ts
│   ├── event.schema.ts
│   ├── feature.schema.ts
│   ├── post.schema.ts
│   └── user.schema.ts
└── index.ts                # Main exports
```

## Comprehensive Schema Catalog

### Common Schemas

#### `AdminInfoSchema`
- `notes`: string (min 3 chars, optional)
- `favorite`: boolean (required)

#### `BaseEntitySchema`
- `id`: UUID string
- `name`: string (required)
- `displayName`: string (required)
- `state`: StateEnum
- `adminInfo`: AdminInfoSchema (optional)
- `createdAt`: Date
- `createdById`: UUID string
- `updatedAt`: Date
- `updatedById`: UUID string
- `deletedAt`: Date (optional)
- `deletedById`: UUID string (optional)

#### `TagSchema`
- All properties from `BaseEntitySchema`
- `ownerId`: UUID string
- `notes`: string (min 1 char, optional)
- `color`: TagColorEnum
- `icon`: string (min 1 char, optional)

#### `ContactInfoSchema`
- `personalEmail`: email string (optional)
- `workEmail`: email string (optional)
- `homePhone`: phone string (regex validated, optional)
- `workPhone`: phone string (regex validated, optional)
- `mobilePhone`: phone string (regex validated, required)
- `website`: URL string (optional)
- `preferredEmail`: PreferedContactEnum
- `preferredPhone`: PreferedContactEnum

#### `CoordinatesSchema`
- `lat`: number (-90 to 90)
- `long`: number (-180 to 180)

#### `BaseLocationSchema`
- `state`: string (required)
- `zipCode`: string (required)
- `country`: string (required)
- `coordinates`: CoordinatesSchema (optional)

#### `FullLocationSchema`
- All properties from `BaseLocationSchema`
- `street`: string (required)
- `number`: string (required)
- `floor`: string (optional)
- `apartment`: string (optional)
- `neighborhood`: string (optional)
- `city`: string (required)
- `deparment`: string (optional)

#### `SocialNetworkSchema`
- `facebook`: URL string (regex validated, optional)
- `twitter`: URL string (regex validated, optional)
- `instagram`: URL string (regex validated, optional)
- `linkedIn`: URL string (regex validated, optional)
- `tiktok`: URL string (regex validated, optional)

#### `BasePriceSchema`
- `price`: number (min 1, optional)
- `currency`: PriceCurrencyEnum (optional)

#### `ImageSchema`
- `url`: URL string (required)
- `caption`: string (min 3, max 20 chars, optional)
- `description`: string (min 3, max 100 chars, optional)
- `tags`: array of TagSchema (optional)
- `state`: StateEnum

#### `VideoSchema`
- `url`: URL string (required)
- `caption`: string (min 3, max 20 chars, optional)
- `description`: string (min 3, max 100 chars, optional)
- `tags`: array of TagSchema (optional)
- `state`: StateEnum

#### `MediaSchema`
- `featuredImage`: ImageSchema
- `gallery`: array of ImageSchema (optional)
- `videos`: array of VideoSchema (optional)

#### `SeoSchema`
- `seoTitle`: string (min 10, max 60 chars, optional)
- `seoDescription`: string (min 50, max 150 chars, optional)
- `seoKeywords`: array of strings (min 1, max 10, no duplicates, optional)

### Accommodation Schemas

#### `AccommodationSchema`
- All properties from `BaseEntitySchema`
- `slug`: string (min 3, max 30, regex validated)
- `type`: AccommodationTypeEnum
- `description`: string (min 50, max 1000)
- `contactInfo`: ContactInfoSchema (optional)
- `socialNetworks`: SocialNetworkSchema (optional)
- `price`: AccommodationPriceSchema (optional)
- `location`: FullLocationSchema (optional)
- `features`: array of AccommodationFeaturesSchema
- `amenities`: array of AccommodationAmenitiesSchema
- `media`: MediaSchema (optional)
- `rating`: AccommodationRatingSchema
- `reviews`: array of AccommodationReviewSchema (optional)
- `schedule`: AccommodationScheduleSchema (optional)
- `extraInfo`: AccommodationExtraInfoSchema (optional)
- `isFeatured`: boolean
- `seo`: SeoSchema (optional)
- `faqs`: array of AccommodationFaqSchema (optional)
- `iaData`: array of AccommodationIaDataSchema (optional)
- `tags`: array of TagSchema (optional)

#### `AccommodationAdditionalFeesSchema`
- Various fee types as AccommodationAdditionalFeesInfoSchema (optional)
- `others`: array of AccommodationOtherAdditionalFeesSchema

#### `AccommodationAdditionalFeesInfoSchema`
- `price`: BasePriceSchema (optional)
- `percent`: number (min 1, max 100, optional)
- `isIncluded`: boolean (optional)
- `isOptional`: boolean (optional)
- `isPercent`: boolean (optional)
- `isPerStay`: boolean (optional)
- `isPerNight`: boolean (optional)
- `isPerGuest`: boolean (optional)

#### `AccommodationDiscountInfoSchema`
- `price`: BasePriceSchema (optional)
- `percent`: number (min 0, max 5)
- Various boolean flags for discount behavior (all optional)

#### `AccommodationDiscountsSchema`
- `weekly`: AccommodationDiscountInfoSchema (optional)
- `monthly`: AccommodationDiscountInfoSchema (optional)
- `lastMinute`: AccommodationDiscountInfoSchema (optional)
- `others`: array of AccommodationOtherDiscountSchema (optional)

#### `AccommodationExtraInfoSchema`
- `capacity`: number (min 1)
- `minNights`: number (min 1)
- `maxNights`: number (min 1, optional)
- `bedrooms`: number
- `beds`: number (min 1, optional)
- `bathrooms`: number (min 1)
- `smokingAllowed`: boolean (optional)
- `extraInfo`: array of strings (optional)

#### `AccommodationFaqSchema`
- All properties from `BaseEntitySchema`
- `question`: string (min 5, max 50)
- `answer`: string (min 1, max 200)
- `category`: string (min 3, max 25, optional)

#### `AccommodationIaDataSchema`
- All properties from `BaseEntitySchema`
- `title`: string (min 5, max 50)
- `content`: string (min 1, max 200)
- `category`: string (min 3, max 25, optional)

#### `AccommodationRatingSchema`
- `cleanliness`: number (0-5, optional)
- `hospitality`: number (0-5, optional)
- `services`: number (0-5, optional)
- `accuracy`: number (0-5, optional)
- `communication`: number (0-5, optional)
- `location`: number (0-5, optional)

#### `AccommodationReviewSchema`
- All properties from `BaseEntitySchema`
- `title`: string (min 1, max 20, optional)
- `content`: string (min 10, max 150, optional)
- `rating`: AccommodationRatingSchema

#### `AccommodationScheduleSchema`
- `checkinTime`: string (HH:mm format, optional)
- `checkoutTime`: string (HH:mm format)
- `earlyCheckinAccepted`: boolean
- `earlyCheckinTime`: string (HH:mm format, optional)
- `lateCheckinAccepted`: boolean
- `lateCheckinTime`: string (HH:mm format, optional)
- `lateCheckoutAccepted`: boolean
- `lateCheckoutTime`: string (HH:mm format, optional)
- `selfCheckin`: boolean
- `selfCheckout`: boolean

### Amenity & Feature Schemas

#### `AmenitySchema`
- All properties from `BaseEntitySchema`
- `description`: string (min 10, max 150, optional)
- `icon`: string (min 1, optional)
- `isBuiltin`: boolean
- `type`: AmenitiesTypeEnum

#### `AccommodationAmenitySchema`
- `accommodationId`: UUID string
- `amenityId`: UUID string
- `isOptional`: boolean
- `additionalCost`: BasePriceSchema (optional, nullable)
- `additionalCostPercent`: number (0-100, optional, nullable)
- `state`: string (optional)
- `adminInfo`: object (optional)

#### `FeatureSchema`
- All properties from `BaseEntitySchema`
- `description`: string (min 10, max 150, optional)
- `icon`: string (min 1, optional)
- `isBuiltin`: boolean

#### `AccommodationFeatureSchema`
- `accommodationId`: UUID string
- `featureId`: UUID string
- `hostReWriteName`: string (optional, nullable)
- `comments`: string (optional, nullable)
- `state`: string (optional)
- `adminInfo`: object (optional)

### Destination Schemas

#### `DestinationSchema`
- All properties from `BaseEntitySchema`
- `slug`: string (min 3, max 30, regex validated)
- `summary`: string (min 50, max 200)
- `description`: string (min 50, max 1000)
- `media`: MediaSchema
- `isFeatured`: boolean (optional)
- `visibility`: VisibilityEnum
- `seo`: SeoSchema
- `rating`: DestinationRatingSchema
- `reviews`: array of DestinationReviewSchema (optional)
- `location`: BaseLocationSchema
- `attractions`: array of DestinationAttractionsSchema

#### `DestinationAttractionsSchema`
- All properties from `BaseEntitySchema`
- `name`: string (min 3, max 30)
- `slug`: string (min 3, max 30, regex validated)
- `description`: string (min 10, max 100, optional)
- `icon`: string (min 1, optional)

#### `DestinationRatingSchema`
- 18 different rating categories (landscape, attractions, safety, etc.), each number (0-5)

#### `DestinationReviewSchema`
- All properties from `BaseEntitySchema`
- `title`: string (min 1, max 20, optional)
- `content`: string (min 10, max 150, optional)
- `rating`: DestinationRatingSchema

### Event Schemas

#### `EventSchema`
- All properties from `BaseEntitySchema`
- `slug`: string (min 3, max 30, regex validated)
- `summary`: string (min 50, max 200)
- `description`: string (min 50, max 1000)
- `media`: MediaSchema (optional)
- `category`: EventCategoryEnum
- `date`: EventDateSchema
- `locationId`: UUID string
- `organizerId`: UUID string
- `pricing`: EventPriceSchema (optional)
- `contact`: ContactInfoSchema (optional)
- `visibility`: VisibilityEnum
- `seo`: SeoSchema (optional)
- `isFeatured`: boolean (optional)
- `tags`: array of TagSchema (optional)

#### `EventDateSchema`
- `start`: Date (with validation range)
- `end`: Date (with validation range, optional)
- `isAllDay`: boolean (optional)
- `recurrence`: RecurrenceTypeEnum (optional)

#### `EventLocationSchema`
- All properties from BaseEntitySchema and BaseLocationSchema
- Various address fields (street, number, neighborhood, etc.)
- `placeName`: string (min 10, max 150, optional)

#### `EventOrganizerSchema`
- All properties from `BaseEntitySchema`
- `logo`: string (min 1, optional)
- `contactInfo`: ContactInfoSchema (optional)
- `social`: SocialNetworkSchema (optional)

#### `EventPriceSchema`
- All properties from `BasePriceSchema`
- `isFree`: boolean
- `priceFrom`: number (min 1, optional)
- `priceTo`: number (min 1, optional)
- `pricePerGroup`: number (min 1, optional)

### Post Schemas

#### `PostSchema`
- All properties from `BaseEntitySchema`
- `slug`: string (min 3, max 30, regex validated)
- `category`: PostCategoryEnum
- `title`: string (min 50, max 200)
- `summary`: string (min 50, max 200)
- `content`: string (min 50, max 1000)
- `media`: MediaSchema (optional)
- `sponsorship`: PostSponsorshipSchema (optional)
- `relatedDestinationId`: UUID string (optional)
- `relatedAccommodationId`: UUID string (optional)
- `relatedEventId`: UUID string (optional)
- `visibility`: VisibilityEnum
- `seo`: SeoSchema (optional)
- Various boolean flags (isFeatured, isNews, isFeaturedInWebsite)
- `expiresAt`: Date (optional)
- `tags`: array of TagSchema (optional)

#### `PostSponsorSchema`
- All properties from `BaseEntitySchema`
- `type`: ClientTypeEnum
- `description`: string (min 3, max 100)
- `logo`: string (min 1, optional)
- `social`: SocialNetworkSchema (optional)
- `contact`: ContactInfoSchema (optional)
- `sponsorships`: array of PostSponsorshipSchema (optional)

#### `PostSponsorshipSchema`
- `message`: string (min 3, max 100)
- `description`: string (min 3, max 100)
- `paid`: BasePriceSchema
- `paidAt`: Date (optional, with validation)
- `fromDate`: Date (optional, with validation)
- `toDate`: Date (optional, with validation)
- `isHighlighted`: boolean

### User and Auth Schemas

#### `UserSchema`
- All properties from `BaseEntitySchema`
- `userName`: string (min 3, max 100, optional)
- `passwordHash`: string (min 3, max 100, optional)
- `firstName`: string (min 3, max 100, optional)
- `lastName`: string (min 3, max 100, optional)
- `brithDate`: Date (age validation, optional)
- `location`: FullLocationSchema (optional)
- `contactInfo`: ContactInfoSchema (optional)
- `socialNetworks`: SocialNetworkSchema (optional)
- `emailVerified`: boolean (optional)
- `phoneVerified`: boolean (optional)
- `profile`: UserProfileSchema (optional)
- `settings`: UserSettingsSchema
- `bookmarks`: array of BookmarkSchema (optional)
- `roleId`: UUID string
- `permissionsIds`: array of UUID strings (optional)

#### `UserProfileSchema`
- `avatar`: string (min 1, optional)
- `bio`: string (min 10, max 400, optional)
- `website`: URL string (min 10, max 100, optional)
- `occupation`: string (min 3, max 100, optional)

#### `UserSettingsSchema`
- `darkMode`: boolean (optional)
- `language`: string (2 chars, optional)
- `notifications`: UserNotificationsSchema

#### `UserNotificationsSchema`
- `enabled`: boolean
- `allowEmails`: boolean
- `allowSms`: boolean
- `allowPush`: boolean

#### `BookmarkSchema`
- All properties from `BaseEntitySchema`
- `ownerId`: UUID string
- `entityId`: UUID string
- `entityType`: EntityTypeEnum
- `name`: string (min 3, max 15, optional)
- `description`: string (min 10, max 100, optional)

#### `RoleSchema`
- All properties from `BaseEntitySchema`
- `description`: string (min 3, max 100)
- `isBuiltIn`: boolean
- `isDeprecated`: boolean (optional)
- `isDefault`: boolean (optional)
- `permissionsIds`: array of UUID strings (optional)

#### `PermissionSchema`
- All properties from `BaseEntitySchema`
- `description`: string (min 3, max 100)
- `isBuiltIn`: boolean
- `isDeprecated`: boolean (optional)

### Relationship Schemas

#### `EntityTagRelationSchema`
- `entityId`: UUID string
- `entityType`: EntityTypeEnum
- `tagId`: UUID string

#### `AccommodationFaqRelationSchema`
- `accommodationId`: UUID string
- `faqId`: UUID string

#### `AccommodationIaDataRelationSchema`
- `accommodationId`: UUID string
- `iaDataId`: UUID string

#### `AccommodationReviewRelationSchema`
- `accommodationId`: UUID string
- `reviewId`: UUID string

#### `DestinationAttractionRelationSchema`
- `destionationId`: UUID string
- `attractionId`: UUID string

#### `DestinationReviewRelationSchema`
- `destionationId`: UUID string
- `reviewId`: UUID string

#### `RolePermissionRelationSchema`
- `permissionId`: UUID string
- `roleId`: UUID string

#### `UserPermissionRelationSchema`
- `permissionId`: UUID string
- `userId`: UUID string

#### `UserBookmarkRelationSchema`
- `permissionId`: UUID string
- `userId`: UUID string

## Usage Examples

### Basic Validation

```typescript
import { AccommodationSchema } from '@repo/schemas';

// Validate accommodation data
try {
  const validatedData = AccommodationSchema.parse(inputData);
  // Data is valid and has the correct type
} catch (error) {
  // Handle validation errors
  const formattedErrors = error.format();
}
```

### Create and Update Operations

```typescript
import { AccommodationCreateSchema, AccommodationUpdateSchema } from '@repo/schemas';

// For creating a new accommodation
const newAccommodationData = AccommodationCreateSchema.parse(formData);

// For updating an existing accommodation
const updateData = AccommodationUpdateSchema.parse(patchData);
```

### With React Hook Form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserCreateSchema } from '@repo/schemas';

function UserForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(UserCreateSchema)
  });
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

## Type Inference

```typescript
import { z } from 'zod';
import { AccommodationSchema } from '@repo/schemas';

// Get the inferred type
type AccommodationInput = z.infer<typeof AccommodationSchema>;
```

## Error Handling

```typescript
try {
  const validatedData = UserSchema.parse(inputData);
} catch (error) {
  const messages = error.errors.map(err => t(err.message));
  // Display translated error messages
}
```

## Best Practices

1. **Use specific schemas for operations**: Use `CreateSchema` variants for creation and `UpdateSchema` variants for updates
2. **Pre-validate on the client**: Validate data before sending to the API to improve user experience
3. **Validate again on the server**: Always validate on the server regardless of client validation
4. **Keep schemas in sync with types**: When updating types, ensure the corresponding schemas are updated
5. **Leverage Zod's utility methods**: Use `safeParse()`, `refine()`, and other Zod utilities

## License

This package is part of the Hospeda monorepo and is subject to the same licensing terms.
